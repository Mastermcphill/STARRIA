// Paystack payment provider — real Transaction Initialize / Verify calls via
// the Paystack REST API with retry + backoff. When PAYSTACK_SECRET_KEY is unset
// (local dev) it falls back to a clearly-marked stub so the app still boots.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  ParsedCheckoutWebhook,
} from './payment-provider.interface';
import { bodyToString } from './webhook-crypto.util';
import { withRetry, isTransientHttpError, RetryableHttpError } from './retry.util';

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('PAYSTACK_SECRET_KEY') ?? '';
    this.webhookSecret =
      config.get<string>('PAYSTACK_WEBHOOK_SECRET') ?? this.secretKey;
    this.live = Boolean(this.secretKey);
    if (!this.live) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set — Paystack in DEV STUB mode');
    }
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.live) {
      return {
        providerReference: `pstk_stub_${input.reference}`,
        authorizationUrl: `https://paystack.com/pay/stub_${input.reference}`,
        status: 'initiated',
      };
    }

    const body = await withRetry(
      () =>
        this.request('/transaction/initialize', 'POST', {
          amount: input.amountMinorUnits,
          currency: input.currency,
          email: (input.metadata?.email as string) ?? `${input.userId}@users.starria`,
          reference: input.reference,
          metadata: input.metadata ?? {},
        }),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    return {
      providerReference: body.data.reference,
      authorizationUrl: body.data.authorization_url,
      status: 'initiated',
    };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!this.live) {
      return { verified: true, amountMinorUnits: 0, currency: 'NGN', status: 'success' };
    }

    const body = await withRetry(
      () => this.request(`/transaction/verify/${encodeURIComponent(input.reference)}`, 'GET'),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('verify', n, e) },
    );

    const data = body.data;
    return {
      verified: data?.status === 'success',
      amountMinorUnits: data?.amount ?? 0,
      currency: data?.currency ?? 'NGN',
      status: data?.status === 'success' ? 'success' : data?.status === 'failed' ? 'failed' : 'pending',
    };
  }

  // ── Generic webhook interface (used by the multi-provider router) ───────────

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return this.verifyWebhookSignature(rawBody, headers['x-paystack-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event?: string;
      data?: { reference?: string; metadata?: Record<string, any> };
    };
    const data = evt.data ?? {};
    const meta = data.metadata ?? {};
    return {
      event: evt.event ?? 'unknown',
      reference: data.reference,
      userId: meta.userId,
      coins: meta.coins !== undefined ? Number(meta.coins) : undefined,
      success: evt.event === 'charge.success',
    };
  }

  /**
   * Verify a Paystack webhook signature. Paystack signs the raw request body
   * with HMAC-SHA512 keyed on the secret and sends it as x-paystack-signature.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    if (!signature) return false;
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

  private async request(path: string, method: 'GET' | 'POST', json?: unknown) {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Paystack ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data: any };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Paystack ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
