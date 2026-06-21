import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';

const PAYSTACK_BASE = 'https://api.paystack.co';

/**
 * Paystack Transfers implementation of PayoutProviderPort.
 *
 * `destination` is expected to be a pre-created Paystack recipient_code (bank
 * accounts are linked/KYC'd out of band, which is the standard Paystack flow),
 * so a payout is a single POST /transfer from the platform balance. Webhooks
 * (transfer.success | transfer.failed | transfer.reversed) are HMAC-SHA512
 * verified against the same secret.
 */
@Injectable()
export class PaystackPayoutProvider implements PayoutProviderPort {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackPayoutProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('PAYSTACK_SECRET_KEY') ?? '';
    // Paystack signs webhooks with the secret key unless a dedicated webhook
    // secret is configured.
    this.webhookSecret =
      config.get<string>('PAYSTACK_WEBHOOK_SECRET') || this.secretKey;
  }

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.secretKey) {
      // Misconfiguration must not look like a successful payout.
      return { accepted: false, status: 'failed', error: 'paystack_not_configured' };
    }

    const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: input.amountMinorUnits,
        currency: input.currency,
        recipient: input.destination,
        reference: input.reference,
        reason: 'Starria withdrawal',
      }),
    });

    if (res.status >= 500) {
      // Transient — let the caller's retry strategy handle it.
      throw new Error(`Paystack transfer ${res.status}`);
    }

    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      data?: { transfer_code?: string; status?: string };
      message?: string;
    };

    if (!res.ok || body.status !== true) {
      return { accepted: false, status: 'failed', error: body.message ?? `http_${res.status}` };
    }

    return {
      accepted: true,
      providerRef: body.data?.transfer_code,
      status: 'processing',
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    if (!signature || !this.webhookSecret) return false;
    const expected = createHmac('sha512', this.webhookSecret)
      .update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
      .digest('hex');
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const body = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')) as {
      event?: string;
      data?: { reference?: string; transfer_code?: string; id?: number | string };
    };
    const event = body.event ?? 'unknown';
    const reference = body.data?.reference;
    const identity = body.data?.id ?? body.data?.transfer_code ?? reference ?? 'unknown';
    const outcome: PayoutWebhookParseResult['outcome'] =
      event === 'transfer.success'
        ? 'success'
        : event === 'transfer.failed' || event === 'transfer.reversed'
          ? 'failed'
          : 'other';
    return { event, reference, dedupeKey: `${event}:${identity}`, outcome };
  }
}
