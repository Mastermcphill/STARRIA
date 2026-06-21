// Korapay Disbursement implementation of PayoutProviderPort.
//
// `destination` carries the bank target as "<bankCode>:<accountNumber>".
// Amounts are MAJOR currency units. Webhooks are HMAC-SHA256 over the `data`
// object (Korapay's scheme); the controller passes the x-korapay-signature
// header value as the `signature` arg.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';
import { bodyToString, hmacHex, safeEqual } from '../../coin-purchase/providers/webhook-crypto.util';
import { parseBankDestination } from './flutterwave-payout.provider';

const KORA_BASE = 'https://api.korapay.com/merchant/api/v1';

@Injectable()
export class KorapayPayoutProvider implements PayoutProviderPort {
  readonly name = 'korapay';
  private readonly logger = new Logger(KorapayPayoutProvider.name);
  private readonly secretKey: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('KORAPAY_SECRET_KEY') ?? '';
  }

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.secretKey) {
      return { accepted: false, status: 'failed', error: 'korapay_not_configured' };
    }
    const target = parseBankDestination(input.destination);
    if (!target) {
      return { accepted: false, status: 'failed', error: 'invalid_destination' };
    }

    const res = await fetch(`${KORA_BASE}/transactions/disburse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: input.reference,
        destination: {
          type: 'bank_account',
          amount: input.amountMinorUnits / 100,
          currency: input.currency,
          narration: 'STARRIA withdrawal',
          bank_account: { bank: target.bankCode, account: target.accountNumber },
        },
      }),
    });

    if (res.status >= 500) throw new Error(`Korapay disburse ${res.status}`);

    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      data?: { reference?: string; status?: string };
      message?: string;
    };

    const txStatus = body.data?.status;
    const accepted = body.status === true && (txStatus === 'processing' || txStatus === 'success');
    if (!res.ok || !accepted) {
      return { accepted: false, status: 'failed', error: body.message ?? `http_${res.status}` };
    }
    return { accepted: true, providerRef: body.data?.reference, status: 'processing' };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    if (!this.secretKey || !signature) return false;
    let data: unknown;
    try {
      data = (JSON.parse(bodyToString(rawBody)) as { data?: unknown }).data;
    } catch {
      return false;
    }
    if (data === undefined) return false;
    return safeEqual(hmacHex('sha256', this.secretKey, JSON.stringify(data)), signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const body = JSON.parse(bodyToString(rawBody)) as {
      event?: string;
      data?: { reference?: string; status?: string };
    };
    const event = body.event ?? 'unknown';
    const data = body.data ?? {};
    const outcome: PayoutWebhookParseResult['outcome'] =
      event === 'transfer.success'
        ? 'success'
        : event === 'transfer.failed' || event === 'transfer.reversed'
          ? 'failed'
          : 'other';
    return {
      event,
      reference: data.reference,
      dedupeKey: `${event}:${data.reference ?? 'unknown'}`,
      outcome,
    };
  }
}
