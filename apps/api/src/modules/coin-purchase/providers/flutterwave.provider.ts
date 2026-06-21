// Flutterwave checkout provider — Standard payment link + verify-by-reference.
// NOTE: Flutterwave amounts are MAJOR currency units (e.g. 500.00 NGN), whereas
// our InitiatePaymentInput.amountMinorUnits is minor (kobo/cents), so we divide
// by 100 on the way out and multiply back on verify. Webhooks are authenticated
// by the `verif-hash` header equalling the dashboard "secret hash".
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
import { bodyToString, safeEqual } from './webhook-crypto.util';

const FLW_BASE = 'https://api.flutterwave.com/v3';

@Injectable()
export class FlutterwaveProvider implements PaymentProvider {
  readonly name = 'flutterwave';
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private readonly secretKey: string;
  private readonly secretHash: string;
  private readonly redirectUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('FLUTTERWAVE_SECRET_KEY') ?? '';
    this.secretHash = config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET') ?? '';
    this.redirectUrl =
      config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.secretKey) {
      throw new RetryableHttpError(503, 'flutterwave_not_configured');
    }
    const body = await withRetry(
      () =>
        this.request('/payments', 'POST', {
          tx_ref: input.reference,
          amount: input.amountMinorUnits / 100,
          currency: input.currency,
          redirect_url: `${this.redirectUrl}?ref=${encodeURIComponent(input.reference)}`,
          customer: {
            email: (input.metadata?.email as string) ?? `${input.userId}@users.starria`,
          },
          meta: {
            userId: input.userId,
            coins: input.metadata?.coins,
            packageId: input.metadata?.packageId,
            reference: input.reference,
          },
        }),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    return {
      providerReference: input.reference,
      authorizationUrl: body.data?.link as string,
      status: 'initiated',
    };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!this.secretKey) {
      return { verified: false, amountMinorUnits: 0, currency: 'NGN', status: 'pending' };
    }
    const body = await withRetry(
      () =>
        this.request(
          `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.reference)}`,
          'GET',
        ),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('verify', n, e) },
    );
    const data = body.data ?? {};
    const ok = data.status === 'successful';
    return {
      verified: ok,
      amountMinorUnits: Math.round((Number(data.amount) || 0) * 100),
      currency: data.currency ?? 'NGN',
      status: ok ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
    };
  }

  verifyWebhook(_rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    const sent = headers['verif-hash'];
    if (!this.secretHash || !sent) return false;
    return safeEqual(this.secretHash, sent);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event?: string;
      data?: { tx_ref?: string; status?: string; meta?: Record<string, any> };
    };
    const data = evt.data ?? {};
    const meta = data.meta ?? {};
    return {
      event: evt.event ?? 'unknown',
      reference: data.tx_ref ?? meta.reference,
      userId: meta.userId,
      coins: meta.coins !== undefined ? Number(meta.coins) : undefined,
      success: evt.event === 'charge.completed' && data.status === 'successful',
    };
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    json?: unknown,
  ): Promise<{ data?: Record<string, any> }> {
    const res = await fetch(`${FLW_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Flutterwave ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data?: Record<string, any> };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Flutterwave ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
