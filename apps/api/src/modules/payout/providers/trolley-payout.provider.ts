// Trolley (formerly Payment Rails) payout rail — implements BOTH the onboarding
// port (Recipient entity + hosted onboarding widget, status via recipient.*
// webhooks) and the payout port (a single-payment Batch: create → add payment →
// quote → start-processing, settled via payment.* webhooks).
//
// API requests are signed per Trolley's scheme:
//   Authorization: prsign <accessKey>:<hmacSha256Hex>
//   X-PR-Timestamp: <unix>
// where the HMAC (under the secret key) is over `${ts}\n${method}\n${path}\n${body}\n`.
//
// Webhooks are HMAC-SHA256 signed with the Stripe-style `t=<unix>,v1=<hex>`
// header (X-PR-Signature), verified against TROLLEY_WEBHOOK_SECRET.
//
// Amounts are MAJOR units (Trolley uses decimal strings). We send the net the
// creator receives (creator absorbs fees). externalId = our PayoutRequest.id so
// the payment webhook links back to the local row.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';
import type {
  RecipientOnboardingPort,
  OnboardingLinkInput,
  OnboardingLinkResult,
  RecipientStatus,
  RecipientStatusValue,
  ParsedOnboardingWebhook,
} from '../ports/recipient-onboarding.port';
import { bodyToString, hmacHex, verifyStripeSignature } from '../../coin-purchase/providers/webhook-crypto.util';

@Injectable()
export class TrolleyPayoutProvider implements PayoutProviderPort, RecipientOnboardingPort {
  readonly name = 'trolley';
  private readonly logger = new Logger(TrolleyPayoutProvider.name);
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly base: string;
  private readonly widgetBase: string;
  private readonly sourceCurrency: string;

  constructor(config: ConfigService) {
    this.accessKey = config.get<string>('TROLLEY_ACCESS_KEY') ?? '';
    this.secretKey = config.get<string>('TROLLEY_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('TROLLEY_WEBHOOK_SECRET') ?? '';
    this.base = config.get<string>('TROLLEY_API_BASE') ?? 'https://api.trolley.com';
    this.widgetBase = config.get<string>('TROLLEY_WIDGET_BASE') ?? 'https://widget.trolley.com';
    this.sourceCurrency = (config.get<string>('TROLLEY_SOURCE_CURRENCY') ?? 'USD').toUpperCase();
  }

  private get configured(): boolean {
    return Boolean(this.accessKey && this.secretKey);
  }

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async createOnboardingLink(input: OnboardingLinkInput): Promise<OnboardingLinkResult> {
    if (!this.configured) throw new Error('trolley_not_configured');

    // Create the recipient, tagging referenceId with our PayoutRecipient.id so
    // the recipient.updated webhook can match back. (Re-running creates a fresh
    // recipient; the caller persists the latest providerRef.)
    const created = await this.post('/v1/recipients', {
      type: 'individual',
      referenceId: input.recipientId,
      ...(input.email ? { email: input.email } : {}),
      ...(input.country ? { address: { country: input.country } } : {}),
    });
    const recipientId = created.recipient?.id as string | undefined;
    if (!recipientId) throw new Error('trolley_no_recipient_id');

    return {
      providerRef: recipientId,
      url: this.widgetUrl(recipientId, input.returnUrl),
      ready: false,
    };
  }

  async getRecipientStatus(providerRef: string): Promise<RecipientStatus> {
    if (!this.configured) throw new Error('trolley_not_configured');
    const res = await this.get(`/v1/recipients/${encodeURIComponent(providerRef)}`);
    const mapped = mapRecipient(res.recipient ?? {});
    return { providerRef, ...mapped };
  }

  verifyOnboardingWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyStripeSignature(this.webhookSecret, rawBody, trolleySignatureHeader(headers));
  }

  parseOnboardingWebhook(rawBody: Buffer | string): ParsedOnboardingWebhook | null {
    const evt = JSON.parse(bodyToString(rawBody)) as TrolleyWebhook;
    if (evt.model !== 'recipient') return null;
    const recipient = evt.body?.recipient ?? {};
    const mapped = mapRecipient(recipient);
    return {
      event: `recipient.${evt.action ?? 'unknown'}`,
      dedupeKey: `recipient:${evt.action}:${recipient.id ?? 'unknown'}:${recipient.status ?? ''}`,
      providerRef: recipient.id,
      status: mapped.status,
      payable: mapped.payable,
    };
  }

  // ─── Payout (settlement) ─────────────────────────────────────────────────────

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.configured) {
      return { accepted: false, status: 'failed', error: 'trolley_not_configured' };
    }
    try {
      // 1. Create a batch in our source currency.
      const batch = await this.post('/v1/batches', {
        sourceCurrency: this.sourceCurrency,
        description: `STARRIA payout ${input.reference}`,
      });
      const batchId = batch.batch?.id as string | undefined;
      if (!batchId) return { accepted: false, status: 'failed', error: 'trolley_no_batch_id' };

      // 2. Add the single payment to the (onboarded) recipient. `destination` is
      //    the Trolley recipient id, resolved by the service from the recipient.
      const payment = await this.post(`/v1/batches/${batchId}/payments`, {
        recipient: { id: input.destination },
        amount: (input.amountMinorUnits / 100).toFixed(2),
        currency: input.currency.toUpperCase(),
        memo: 'STARRIA payout',
        externalId: input.reference,
      });
      const paymentId = payment.payment?.id as string | undefined;
      if (!paymentId) return { accepted: false, status: 'failed', error: 'trolley_no_payment_id' };

      // 3. Quote + 4. start processing (funds the batch).
      await this.post(`/v1/batches/${batchId}/generate-quote`, {});
      const start = await this.rawRequest('POST', `/v1/batches/${batchId}/start-processing`, {});
      if (start.status >= 500) throw new Error(`Trolley start-processing ${start.status}`);
      if (!start.ok) {
        const text = await start.text().catch(() => '');
        return { accepted: false, status: 'failed', error: `trolley_start_${start.status}:${text.slice(0, 120)}` };
      }

      return { accepted: true, providerRef: paymentId, status: 'processing' };
    } catch (e) {
      // Transport / 5xx — let the service retry.
      throw e instanceof Error ? e : new Error('trolley_transfer_error');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    return verifyStripeSignature(this.webhookSecret, rawBody, signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const evt = JSON.parse(bodyToString(rawBody)) as TrolleyWebhook;
    const payment = evt.body?.payment ?? {};
    const action = evt.action ?? 'unknown';
    const outcome: PayoutWebhookParseResult['outcome'] =
      evt.model === 'payment' && action === 'processed'
        ? 'success'
        : evt.model === 'payment' && (action === 'failed' || action === 'returned')
          ? 'failed'
          : 'other';
    return {
      event: `payment.${action}`,
      // externalId is the reference we sent; fall back to matching by payment id.
      reference: payment.externalId,
      providerRef: payment.id,
      dedupeKey: `payment:${action}:${payment.id ?? 'unknown'}:${payment.status ?? ''}`,
      outcome,
    };
  }

  // ─── Signed widget URL ───────────────────────────────────────────────────────

  /** Build a signed hosted-onboarding widget URL for a recipient. */
  private widgetUrl(recipientId: string, returnUrl: string): string {
    const ts = Math.floor(Date.now() / 1000).toString();
    const params = new URLSearchParams({
      key: this.accessKey,
      ts,
      recipientReferenceId: recipientId,
      returnUrl,
    });
    // Sign the canonical query so the widget can verify the link is ours.
    const sig = hmacHex('sha256', this.secretKey, params.toString());
    params.set('sign', sig);
    return `${this.widgetBase}/v1/recipient?${params.toString()}`;
  }

  // ─── Signed HTTP helpers ──────────────────────────────────────────────────────

  private rawRequest(method: 'GET' | 'POST', path: string, json: unknown): Promise<Response> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = method === 'GET' ? '' : JSON.stringify(json);
    const signature = hmacHex('sha256', this.secretKey, `${ts}\n${method}\n${path}\n${body}\n`);
    return fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `prsign ${this.accessKey}:${signature}`,
        'X-PR-Timestamp': ts,
        'Content-Type': 'application/json',
      },
      ...(method === 'GET' ? {} : { body }),
    });
  }

  private async post(path: string, json: unknown): Promise<Record<string, any>> {
    const res = await this.rawRequest('POST', path, json);
    if (res.status >= 500) throw new Error(`Trolley ${path} ${res.status}`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Trolley ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }

  private async get(path: string): Promise<Record<string, any>> {
    const res = await this.rawRequest('GET', path, undefined);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Trolley ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }
}

interface TrolleyWebhook {
  model?: string;
  action?: string;
  body?: {
    recipient?: { id?: string; status?: string; referenceId?: string };
    payment?: { id?: string; status?: string; externalId?: string };
  };
}

/** Newer Trolley sends X-PR-Signature; older deliveries use X-PaymentRails-Signature. */
function trolleySignatureHeader(headers: Record<string, string | undefined>): string | undefined {
  return headers['x-pr-signature'] ?? headers['x-paymentrails-signature'];
}

/** Map a Trolley recipient to our recipient lifecycle state. */
export function mapRecipient(recipient: { status?: string }): {
  status: RecipientStatusValue;
  payable: boolean;
  details: Record<string, unknown>;
} {
  const status = (recipient.status ?? '').toLowerCase();
  const details = { status: recipient.status };
  switch (status) {
    case 'active':
      return { status: 'active', payable: true, details };
    case 'blocked':
    case 'suspended':
      return { status: 'rejected', payable: false, details };
    case 'disabled':
    case 'archived':
      return { status: 'disabled', payable: false, details };
    default:
      // 'incomplete' or anything not yet payable.
      return { status: 'onboarding', payable: false, details };
  }
}
