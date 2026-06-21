// Tipalti payout rail — implements BOTH the onboarding port (hosted payee
// "Tipalti Hub" iframe + payee.* webhooks) and the payout port (submit a
// payment keyed by refCode, settled via payment.* webhooks).
//
// Tipalti identifies a payee by `idap` — a payer-assigned id. We use our
// PayoutRecipient.id as the idap, so onboarding needs NO API call: the hosted
// iframe URL is built locally and HMAC-signed. The signature (`hashkey`) is the
// hex HMAC-SHA256 of the URL-encoded query string under the API key — the same
// scheme Tipalti uses to authenticate iframe links and webhooks.
//
// Amounts are MAJOR units (Tipalti uses decimal strings). We submit the net the
// creator receives (creator absorbs fees). refCode = our PayoutRequest.id so the
// payment webhook links back to the local row.
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
import { bodyToString, hmacHex, verifyHmac } from '../../coin-purchase/providers/webhook-crypto.util';

@Injectable()
export class TipaltiPayoutProvider implements PayoutProviderPort, RecipientOnboardingPort {
  readonly name = 'tipalti';
  private readonly logger = new Logger(TipaltiPayoutProvider.name);
  private readonly payerName: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly base: string;
  private readonly iframeBase: string;
  private readonly sourceCurrency: string;

  constructor(config: ConfigService) {
    this.payerName = config.get<string>('TIPALTI_PAYER_NAME') ?? '';
    this.apiKey = config.get<string>('TIPALTI_API_KEY') ?? '';
    this.webhookSecret = config.get<string>('TIPALTI_WEBHOOK_SECRET') ?? '';
    this.base = config.get<string>('TIPALTI_API_BASE') ?? 'https://api.tipalti.com';
    this.iframeBase = config.get<string>('TIPALTI_IFRAME_BASE') ?? 'https://ui2.tipalti.com';
    this.sourceCurrency = (config.get<string>('TIPALTI_SOURCE_CURRENCY') ?? 'USD').toUpperCase();
  }

  private get configured(): boolean {
    return Boolean(this.payerName && this.apiKey);
  }

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async createOnboardingLink(input: OnboardingLinkInput): Promise<OnboardingLinkResult> {
    if (!this.configured) throw new Error('tipalti_not_configured');

    // Tipalti keys a payee by idap (our recipient id). No API call: the hosted
    // iframe URL is built and HMAC-signed locally. The payee is created/resolved
    // by Tipalti when the user opens the link.
    const url = this.iframeUrl(input.recipientId, input.returnUrl, input.email);
    return { providerRef: input.recipientId, url, ready: false };
  }

  async getRecipientStatus(providerRef: string): Promise<RecipientStatus> {
    if (!this.configured) throw new Error('tipalti_not_configured');
    const res = await this.get(`/api/v1/payees/${encodeURIComponent(providerRef)}`);
    const mapped = mapPayee(res);
    return { providerRef, ...mapped };
  }

  verifyOnboardingWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyHmac('sha256', this.webhookSecret, rawBody, tipaltiSignatureHeader(headers));
  }

  parseOnboardingWebhook(rawBody: Buffer | string): ParsedOnboardingWebhook | null {
    const evt = JSON.parse(bodyToString(rawBody)) as TipaltiWebhook;
    const type = evt.type ?? '';
    if (!type.startsWith('payee')) return null;
    const data = evt.data ?? {};
    const mapped = mapPayee(data);
    return {
      event: type,
      dedupeKey: `${type}:${evt.id ?? data.idap ?? 'unknown'}:${data.status ?? data.payable ?? ''}`,
      providerRef: data.idap,
      status: mapped.status,
      payable: mapped.payable,
    };
  }

  // ─── Payout (settlement) ─────────────────────────────────────────────────────

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.configured) {
      return { accepted: false, status: 'failed', error: 'tipalti_not_configured' };
    }
    try {
      // Submit a single payment to the (onboarded) payee. `destination` is the
      // payee idap, resolved by the service from the payable recipient.
      const res = await this.rawPost('/api/v1/payments', {
        payerName: this.payerName,
        sourceCurrency: this.sourceCurrency,
        payments: [
          {
            idap: input.destination,
            refCode: input.reference,
            amount: (input.amountMinorUnits / 100).toFixed(2),
            currency: input.currency.toUpperCase(),
          },
        ],
      });
      if (res.status >= 500) throw new Error(`Tipalti payments ${res.status}`);

      const body = (await res.json().catch(() => ({}))) as {
        payments?: Array<{ paymentRefCode?: string; idItem?: string; errorMessage?: string }>;
        errorMessage?: string;
      };
      const item = body.payments?.[0];
      if (!res.ok || !item || item.errorMessage) {
        return { accepted: false, status: 'failed', error: item?.errorMessage ?? body.errorMessage ?? `http_${res.status}` };
      }
      // Tipalti echoes our refCode; the webhook matches by it. Keep the payment
      // item id as providerRef when present.
      return { accepted: true, providerRef: item.idItem ?? input.reference, status: 'processing' };
    } catch (e) {
      // Transport / 5xx — let the service retry.
      throw e instanceof Error ? e : new Error('tipalti_transfer_error');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    return verifyHmac('sha256', this.webhookSecret, rawBody, signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const evt = JSON.parse(bodyToString(rawBody)) as TipaltiWebhook;
    const type = evt.type ?? 'unknown';
    const data = evt.data ?? {};
    const outcome: PayoutWebhookParseResult['outcome'] =
      type === 'payment.completed'
        ? 'success'
        : type === 'payment.error' || type === 'payment.failed' || type === 'payment.cancelled'
          ? 'failed'
          : 'other';
    return {
      event: type,
      // refCode is the reference we sent.
      reference: data.refCode,
      providerRef: data.idItem,
      dedupeKey: `${type}:${data.refCode ?? data.idItem ?? 'unknown'}:${data.status ?? ''}`,
      outcome,
    };
  }

  // ─── Signed iframe URL ────────────────────────────────────────────────────────

  /** Build a signed hosted-onboarding (Tipalti Hub) iframe URL for a payee. */
  private iframeUrl(idap: string, returnUrl: string, email?: string): string {
    const ts = Math.floor(Date.now() / 1000).toString();
    const params = new URLSearchParams({
      payer: this.payerName,
      idap,
      ts,
      redirectto: returnUrl,
      ...(email ? { email } : {}),
    });
    // hashkey = hex HMAC-SHA256 of the URL-encoded query string under the API key.
    const hashkey = hmacHex('sha256', this.apiKey, params.toString());
    params.set('hashkey', hashkey);
    return `${this.iframeBase}/payeedashboard/home?${params.toString()}`;
  }

  // ─── HTTP helpers ────────────────────────────────────────────────────────────

  private rawPost(path: string, json: unknown): Promise<Response> {
    return fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json),
    });
  }

  private async get(path: string): Promise<Record<string, any>> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Tipalti ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }
}

interface TipaltiWebhook {
  id?: string;
  type?: string;
  data?: {
    idap?: string;
    idItem?: string;
    refCode?: string;
    status?: string;
    payable?: boolean;
    isPayable?: boolean;
    isSuspended?: boolean;
    isBlocked?: boolean;
  };
}

/** Tipalti webhooks carry the HMAC in X-Tipalti-Signature. */
function tipaltiSignatureHeader(headers: Record<string, string | undefined>): string | undefined {
  return headers['x-tipalti-signature'];
}

/** Map a Tipalti payee object to our recipient lifecycle state. */
export function mapPayee(payee: {
  payable?: boolean;
  isPayable?: boolean;
  isSuspended?: boolean;
  isBlocked?: boolean;
  status?: string;
}): {
  status: RecipientStatusValue;
  payable: boolean;
  details: Record<string, unknown>;
} {
  const payable = payee.payable === true || payee.isPayable === true;
  const details = {
    payable,
    isSuspended: payee.isSuspended,
    isBlocked: payee.isBlocked,
    status: payee.status,
  };
  if (payee.isBlocked === true) return { status: 'rejected', payable: false, details };
  if (payee.isSuspended === true) return { status: 'restricted', payable: false, details };
  if (payable) return { status: 'active', payable: true, details };
  return { status: 'onboarding', payable: false, details };
}
