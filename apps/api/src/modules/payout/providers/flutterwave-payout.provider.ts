// Flutterwave Transfers implementation of PayoutProviderPort.
//
// `destination` carries the bank target as "<bankCode>:<accountNumber>" (e.g.
// "044:0690000031"). Amounts are MAJOR currency units (÷100 from our minor
// units). Webhooks reuse the Flutterwave `verif-hash` secret — the controller
// passes that header value as the `signature` arg.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';
import { bodyToString, safeEqual } from '../../coin-purchase/providers/webhook-crypto.util';

const FLW_BASE = 'https://api.flutterwave.com/v3';

@Injectable()
export class FlutterwavePayoutProvider implements PayoutProviderPort {
  readonly name = 'flutterwave';
  private readonly logger = new Logger(FlutterwavePayoutProvider.name);
  private readonly secretKey: string;
  private readonly secretHash: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('FLUTTERWAVE_SECRET_KEY') ?? '';
    this.secretHash = config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET') ?? '';
  }

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.secretKey) {
      return { accepted: false, status: 'failed', error: 'flutterwave_not_configured' };
    }
    const target = parseBankDestination(input.destination);
    if (!target) {
      return { accepted: false, status: 'failed', error: 'invalid_destination' };
    }

    const res = await fetch(`${FLW_BASE}/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: target.bankCode,
        account_number: target.accountNumber,
        amount: input.amountMinorUnits / 100,
        currency: input.currency,
        reference: input.reference,
        narration: 'STARRIA withdrawal',
      }),
    });

    if (res.status >= 500) throw new Error(`Flutterwave transfer ${res.status}`);

    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      data?: { id?: number | string; status?: string };
      message?: string;
    };

    if (!res.ok || body.status !== 'success') {
      return { accepted: false, status: 'failed', error: body.message ?? `http_${res.status}` };
    }
    return {
      accepted: true,
      providerRef: body.data?.id != null ? String(body.data.id) : undefined,
      status: 'processing',
    };
  }

  verifyWebhookSignature(_rawBody: Buffer | string, signature?: string): boolean {
    if (!this.secretHash || !signature) return false;
    return safeEqual(this.secretHash, signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const body = JSON.parse(bodyToString(rawBody)) as {
      event?: string;
      data?: { reference?: string; id?: number | string; status?: string };
    };
    const event = body.event ?? 'unknown';
    const data = body.data ?? {};
    const status = (data.status ?? '').toUpperCase();
    const identity = data.id ?? data.reference ?? 'unknown';
    const outcome: PayoutWebhookParseResult['outcome'] =
      status === 'SUCCESSFUL' ? 'success' : status === 'FAILED' ? 'failed' : 'other';
    return { event, reference: data.reference, dedupeKey: `${event}:${identity}`, outcome };
  }
}

/** Parse a "<bankCode>:<accountNumber>" destination. */
export function parseBankDestination(
  destination: string,
): { bankCode: string; accountNumber: string } | null {
  const idx = destination.indexOf(':');
  if (idx <= 0) return null;
  const bankCode = destination.slice(0, idx).trim();
  const accountNumber = destination.slice(idx + 1).trim();
  if (!bankCode || !accountNumber) return null;
  return { bankCode, accountNumber };
}
