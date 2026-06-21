// Paddle (Billing) checkout provider (merchant-of-record). Creates a
// transaction with an ad-hoc price referencing a configured product, and
// returns its hosted checkout URL. Webhooks carry a `Paddle-Signature` header
//   ts=<unix>;h1=<hex hmac sha256 of `${ts}:${rawBody}` under PADDLE_WEBHOOK_SECRET>
//
// Requires PADDLE_API_KEY and PADDLE_PRODUCT_ID. Set PADDLE_API_BASE to the
// sandbox host for test mode.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
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

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

@Injectable()
export class PaddleProvider implements PaymentProvider {
  readonly name = 'paddle';
  private readonly logger = new Logger(PaddleProvider.name);
  private readonly apiKey: string;
  private readonly productId: string;
  private readonly webhookSecret: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('PADDLE_API_KEY') ?? '';
    this.productId = config.get<string>('PADDLE_PRODUCT_ID') ?? '';
    this.webhookSecret = config.get<string>('PADDLE_WEBHOOK_SECRET') ?? '';
    this.base = config.get<string>('PADDLE_API_BASE') ?? 'https://api.paddle.com';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.apiKey || !this.productId) {
      throw new RetryableHttpError(503, 'paddle_not_configured');
    }
    const body = await withRetry(
      () =>
        this.request('/transactions', {
          items: [
            {
              quantity: 1,
              price: {
                description: 'STARRIA Coins',
                product_id: this.productId,
                unit_price: {
                  amount: String(input.amountMinorUnits),
                  currency_code: input.currency.toUpperCase(),
                },
              },
            },
          ],
          custom_data: {
            userId: input.userId,
            coins: String(input.metadata?.coins ?? ''),
            reference: input.reference,
          },
        }),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    return {
      providerReference: (body.data?.id as string) ?? input.reference,
      authorizationUrl: body.data?.checkout?.url as string | undefined,
      status: 'initiated',
    };
  }

  async verify(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    if (!this.webhookSecret) return false;
    const header = headers['paddle-signature'];
    if (!header) return false;

    let ts = '';
    let h1 = '';
    for (const part of header.split(';')) {
      const [k, v] = part.split('=');
      if (k === 'ts') ts = v;
      else if (k === 'h1') h1 = v;
    }
    if (!ts || !h1) return false;

    const age = Math.floor(Date.now() / 1000) - Number(ts);
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${ts}:${bodyToString(rawBody)}`)
      .digest('hex');
    return safeEqual(expected, h1);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event_type?: string;
      data?: { status?: string; custom_data?: Record<string, any> };
    };
    const type = evt.event_type ?? 'unknown';
    const custom = evt.data?.custom_data ?? {};
    const paid =
      (type === 'transaction.completed' || type === 'transaction.paid') &&
      (evt.data?.status === 'completed' || evt.data?.status === 'paid');
    return {
      event: type,
      reference: custom.reference,
      userId: custom.userId,
      coins: custom.coins !== undefined ? Number(custom.coins) : undefined,
      success: paid,
    };
  }

  private async request(
    path: string,
    json: unknown,
  ): Promise<{ data?: { id?: string; checkout?: { url?: string } } }> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Paddle ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data?: { id?: string; checkout?: { url?: string } } };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Paddle ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
