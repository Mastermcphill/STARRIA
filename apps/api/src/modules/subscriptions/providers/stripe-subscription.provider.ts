// Stripe subscription rail — Checkout Session (mode=subscription) + lifecycle
// webhooks. Reuses the shared stripe-signature verification.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SubscriptionProviderPort,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  ParsedSubscriptionWebhook,
  SubscriptionStatus,
} from '../ports/subscription-provider.port';
import { withRetry, isTransientHttpError, RetryableHttpError } from '../../coin-purchase/providers/retry.util';
import { bodyToString, verifyStripeSignature } from '../../coin-purchase/providers/webhook-crypto.util';

const STRIPE_BASE = 'https://api.stripe.com';

@Injectable()
export class StripeSubscriptionProvider implements SubscriptionProviderPort {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeSubscriptionProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.successUrl = config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
    this.cancelUrl = config.get<string>('PAYMENTS_CANCEL_URL') ?? 'https://starria.com/pay/cancel';
  }

  async createCheckout(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.secretKey) throw new RetryableHttpError(503, 'stripe_not_configured');
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('success_url', `${this.successUrl}?ref=${encodeURIComponent(input.reference)}`);
    form.set('cancel_url', this.cancelUrl);
    form.set('client_reference_id', input.reference);
    form.set('line_items[0][price]', input.plan.providerPlanId);
    form.set('line_items[0][quantity]', '1');
    if (input.email) form.set('customer_email', input.email);
    form.set('subscription_data[metadata][reference]', input.reference);
    form.set('subscription_data[metadata][userId]', input.userId);
    form.set('metadata[reference]', input.reference);

    const body = await withRetry(() => this.post('/v1/checkout/sessions', form), {
      isRetryable: isTransientHttpError,
      onRetry: (n, e) => this.logger.warn(`Stripe sub create retry #${n}: ${(e as Error)?.message}`),
    });
    return { authorizationUrl: body.url as string, status: 'pending' };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    if (!this.secretKey) throw new RetryableHttpError(503, 'stripe_not_configured');
    // Cancel at period end (keeps access until the paid period lapses).
    const form = new URLSearchParams();
    form.set('cancel_at_period_end', 'true');
    await this.post(`/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`, form);
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyStripeSignature(this.webhookSecret, rawBody, headers['stripe-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedSubscriptionWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, any> };
    };
    const type = evt.type ?? 'unknown';
    const obj = evt.data?.object ?? {};
    const dedupeKey = `${type}:${evt.id ?? obj.id ?? 'unknown'}`;

    // checkout.session.completed links our reference → the new subscription id.
    if (type === 'checkout.session.completed') {
      return {
        event: type,
        dedupeKey,
        providerSubscriptionId: obj.subscription,
        reference: obj.client_reference_id ?? obj.metadata?.reference,
        status: 'active',
      };
    }

    if (type.startsWith('customer.subscription.')) {
      const status = type.endsWith('.deleted')
        ? 'cancelled'
        : mapStripeStatus(obj.status);
      return {
        event: type,
        dedupeKey,
        providerSubscriptionId: obj.id,
        reference: obj.metadata?.reference,
        status,
        currentPeriodEnd: obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : undefined,
      };
    }

    return { event: type, dedupeKey };
  }

  private async post(path: string, form: URLSearchParams): Promise<Record<string, any>> {
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
    return (await res.json()) as Record<string, any>;
  }
}

function mapStripeStatus(s: string | undefined): SubscriptionStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'pending';
  }
}
