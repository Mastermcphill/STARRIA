// Wise (TransferWise) payout rail. A transfer is the 4-step dance
//   quote → (recipient already exists) → transfer → fund
// encapsulated behind the single transfer() contract. `destination` is the Wise
// recipient account id (numeric) — created out of band during recipient
// onboarding (bank-detail capture is a separate piece; see the design doc).
//
// Amounts are MAJOR units (Wise uses decimals). We send `targetAmount` = the net
// the creator should receive (creator absorbs fees; Wise's own fee is funded
// from our balance). customerTransactionId = our PayoutRequest.id for idempotency.
//
// Webhooks are RSA-SHA256 signed: the base64 signature is in X-Signature-SHA256,
// verified against WISE_WEBHOOK_PUBLIC_KEY (PEM).
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';
import { bodyToString, verifyRsaSignature } from '../../coin-purchase/providers/webhook-crypto.util';

@Injectable()
export class WisePayoutProvider implements PayoutProviderPort {
  readonly name = 'wise';
  private readonly logger = new Logger(WisePayoutProvider.name);
  private readonly token: string;
  private readonly profileId: string;
  private readonly base: string;
  private readonly sourceCurrency: string;
  private readonly webhookPublicKey: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('WISE_API_TOKEN') ?? '';
    this.profileId = config.get<string>('WISE_PROFILE_ID') ?? '';
    this.base = config.get<string>('WISE_API_BASE') ?? 'https://api.wise.com';
    this.sourceCurrency = (config.get<string>('WISE_SOURCE_CURRENCY') ?? 'USD').toUpperCase();
    this.webhookPublicKey = (config.get<string>('WISE_WEBHOOK_PUBLIC_KEY') ?? '').replace(/\\n/g, '\n');
  }

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.token || !this.profileId) {
      return { accepted: false, status: 'failed', error: 'wise_not_configured' };
    }
    const targetAccount = Number(input.destination);
    if (!Number.isFinite(targetAccount)) {
      return { accepted: false, status: 'failed', error: 'invalid_destination' };
    }

    try {
      // 1. Quote for the exact net the creator receives.
      const quote = await this.post(`/v3/profiles/${this.profileId}/quotes`, {
        sourceCurrency: this.sourceCurrency,
        targetCurrency: input.currency.toUpperCase(),
        targetAmount: input.amountMinorUnits / 100,
        payOut: 'BANK_TRANSFER',
      });
      const quoteId = quote.id as string;

      // 2. Transfer against the quote + existing recipient.
      const transfer = await this.post('/v1/transfers', {
        targetAccount,
        quoteUuid: quoteId,
        customerTransactionId: input.reference,
        details: { reference: 'STARRIA payout' },
      });
      const transferId = transfer.id != null ? String(transfer.id) : undefined;
      if (!transferId) return { accepted: false, status: 'failed', error: 'wise_no_transfer_id' };

      // 3. Fund the transfer from our Wise balance.
      const fund = await this.rawPost(
        `/v3/profiles/${this.profileId}/transfers/${transferId}/payments`,
        { type: 'BALANCE' },
      );
      if (fund.status >= 500) throw new Error(`Wise fund ${fund.status}`);
      if (!fund.ok) {
        const text = await fund.text().catch(() => '');
        return { accepted: false, status: 'failed', error: `wise_fund_${fund.status}:${text.slice(0, 120)}` };
      }

      return { accepted: true, providerRef: transferId, status: 'processing' };
    } catch (e) {
      // Transport / 5xx — let the service retry.
      throw e instanceof Error ? e : new Error('wise_transfer_error');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    return verifyRsaSignature(this.webhookPublicKey, rawBody, signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event_type?: string;
      data?: { resource?: { id?: number | string }; current_state?: string };
    };
    const event = evt.event_type ?? 'unknown';
    const transferId = evt.data?.resource?.id;
    const state = evt.data?.current_state ?? '';
    const outcome: PayoutWebhookParseResult['outcome'] =
      state === 'outgoing_payment_sent'
        ? 'success'
        : ['cancelled', 'funds_refunded', 'bounced_back', 'charged_back'].includes(state)
          ? 'failed'
          : 'other';
    return {
      event,
      providerRef: transferId != null ? String(transferId) : undefined,
      dedupeKey: `${event}:${transferId ?? 'unknown'}:${state}`,
      outcome,
    };
  }

  // ─── HTTP helpers ────────────────────────────────────────────────────────────

  private rawPost(path: string, json: unknown): Promise<Response> {
    return fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json),
    });
  }

  private async post(path: string, json: unknown): Promise<Record<string, any>> {
    const res = await this.rawPost(path, json);
    if (res.status >= 500) throw new Error(`Wise ${path} ${res.status}`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Wise ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }
}
