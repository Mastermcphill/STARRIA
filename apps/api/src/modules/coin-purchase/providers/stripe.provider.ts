// Stripe checkout provider — creates a hosted Checkout Session and verifies
// the signed `stripe-signature` webhook. Fails closed when STRIPE_SECRET_KEY is
// unset (no dev stub: Stripe has a full test mode, use test keys for dev).
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

const STRIPE_BASE = 'https://api.stripe.com';
// Reject webhooks whose timestamp is older than this (replay defence alongside
// the per-reference idempotency of creditCoins).
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.successUrl =
      config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
    this.cancelUrl =
      config.get<string>('PAYMENTS_CANCEL_URL') ?? 'https://starria.com/pay/cancel';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.secretKey) {
      throw new RetryableHttpError(503, 'stripe_not_configured');
    }
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${this.successUrl}?ref=${encodeURIComponent(input.reference)}`);
    form.set('cancel_url', this.cancelUrl);
    form.set('client_reference_id', input.reference);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    form.set('line_items[0][price_data][unit_amount]', String(input.amountMinorUnits));
    form.set('line_items[0][price_data][product_data][name]', 'STARRIA Coins');
    // Echo metadata onto BOTH the session and the resulting payment intent, so
    // either webhook event can credit.
    for (const [k, v] of metadataPairs(input)) {
      form.set(`metadata[${k}]`, v);
      form.set(`payment_intent_data[metadata][${k}]`, v);
    }

    const body = await withRetry(
      () => this.request('/v1/checkout/sessions', form),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    return {
      providerReference: body.id as string,
      authorizationUrl: body.url as string,
      status: 'initiated',
    };
  }

  /**
   * Stripe has no "verify by our reference" lookup, so synchronous verification
   * stays pending — the signed webhook (checkout.session.completed) is the
   * source of truth and credits the buyer.
   */
  async verify(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return { verified: false, amountMinorUnits: 0, currency: 'usd', status: 'pending' };
  }

  /**
   * Verify the `stripe-signature` header: scheme is
   *   t=<unix>,v1=<hex hmac sha256 of `${t}.${rawBody}` under whsec>
   * Multiple v1 signatures may be present during a secret rotation.
   */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    if (!this.webhookSecret) return false;
    const header = headers['stripe-signature'];
    if (!header) return false;

    let timestamp = '';
    const signatures: string[] = [];
    for (const part of header.split(',')) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      else if (key === 'v1' && value) signatures.push(value);
    }
    if (!timestamp || signatures.length === 0) return false;

    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${bodyToString(rawBody)}`)
      .digest('hex');
    return signatures.some((s) => safeEqual(expected, s));
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      type?: string;
      data?: { object?: Record<string, any> };
    };
    const type = evt.type ?? 'unknown';
    const obj = evt.data?.object ?? {};
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const reference = meta.reference ?? obj.client_reference_id;
    const paid =
      (type === 'checkout.session.completed' && obj.payment_status === 'paid') ||
      type === 'payment_intent.succeeded';
    return {
      event: type,
      reference,
      userId: meta.userId,
      coins: meta.coins ? Number(meta.coins) : undefined,
      success: paid,
    };
  }

  private async request(path: string, form: URLSearchParams): Promise<Record<string, unknown>> {
    const res = await fetch(`${STRIPE_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Stripe ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Stripe ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}

function metadataPairs(input: InitiatePaymentInput): Array<[string, string]> {
  const pairs: Array<[string, string]> = [['reference', input.reference], ['userId', input.userId]];
  const coins = input.metadata?.coins;
  if (coins !== undefined) pairs.push(['coins', String(coins)]);
  const pkg = input.metadata?.packageId;
  if (pkg !== undefined) pairs.push(['packageId', String(pkg)]);
  return pairs;
}
