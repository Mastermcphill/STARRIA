// Korapay checkout provider — charge initialize + verify by reference.
// Like Flutterwave, Korapay amounts are MAJOR currency units. Korapay signs
// webhooks by HMAC-SHA256 over the JSON-serialised `data` object only (not the
// whole body) using the secret key — so we re-serialise data to verify.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  ParsedCheckoutWebhook,
} from './payment-provider.interface';
import { withRetry, isTransientHttpError, RetryableHttpError } from './retry.util';
import { bodyToString, hmacHex, safeEqual } from './webhook-crypto.util';

const KORA_BASE = 'https://api.korapay.com/merchant/api/v1';

@Injectable()
export class KorapayProvider implements PaymentProvider {
  readonly name = 'korapay';
  private readonly logger = new Logger(KorapayProvider.name);
  private readonly secretKey: string;
  private readonly redirectUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('KORAPAY_SECRET_KEY') ?? '';
    this.redirectUrl =
      config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.secretKey) {
      throw new RetryableHttpError(503, 'korapay_not_configured');
    }
    const body = await withRetry(
      () =>
        this.request('/charges/initialize', 'POST', {
          amount: input.amountMinorUnits / 100,
          currency: input.currency,
          reference: input.reference,
          redirect_url: `${this.redirectUrl}?ref=${encodeURIComponent(input.reference)}`,
          narration: 'STARRIA Coins',
          customer: {
            email: (input.metadata?.email as string) ?? `${input.userId}@users.starria`,
          },
          metadata: {
            userId: input.userId,
            coins: input.metadata?.coins,
            packageId: input.metadata?.packageId,
          },
        }),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    return {
      providerReference: (body.data?.reference as string) ?? input.reference,
      authorizationUrl: body.data?.checkout_url as string,
      status: 'initiated',
    };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!this.secretKey) {
      return { verified: false, amountMinorUnits: 0, currency: 'NGN', status: 'pending' };
    }
    const body = await withRetry(
      () => this.request(`/charges/${encodeURIComponent(input.reference)}`, 'GET'),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('verify', n, e) },
    );
    const data = body.data ?? {};
    const ok = data.status === 'success';
    return {
      verified: ok,
      amountMinorUnits: Math.round((Number(data.amount) || 0) * 100),
      currency: data.currency ?? 'NGN',
      status: ok ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
    };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    const sent = headers['x-korapay-signature'];
    if (!this.secretKey || !sent) return false;
    let data: unknown;
    try {
      data = (JSON.parse(bodyToString(rawBody)) as { data?: unknown }).data;
    } catch {
      return false;
    }
    if (data === undefined) return false;
    return safeEqual(hmacHex('sha256', this.secretKey, JSON.stringify(data)), sent);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event?: string;
      data?: { reference?: string; status?: string; metadata?: Record<string, any> };
    };
    const data = evt.data ?? {};
    const meta = data.metadata ?? {};
    return {
      event: evt.event ?? 'unknown',
      reference: data.reference,
      userId: meta.userId,
      coins: meta.coins !== undefined ? Number(meta.coins) : undefined,
      success: evt.event === 'charge.success' && data.status === 'success',
    };
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    json?: unknown,
  ): Promise<{ data?: Record<string, any> }> {
    const res = await fetch(`${KORA_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Korapay ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data?: Record<string, any> };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Korapay ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
