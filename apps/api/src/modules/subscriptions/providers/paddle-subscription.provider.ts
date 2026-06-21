// Paddle (Billing) subscription rail — creates a transaction for a recurring
// price (the plan's providerPlanId is a Paddle price id with a billing cycle)
// and returns its hosted checkout URL. Lifecycle is driven by subscription.*
// webhooks; the Paddle-Signature header (ts=<unix>;h1=<hmac sha256>) is verified
// over the raw body.
//
// Requires PADDLE_API_KEY and PADDLE_WEBHOOK_SECRET. Set PADDLE_API_BASE to the
// sandbox host for test mode.
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
import { bodyToString, verifyPaddleSignature } from '../../coin-purchase/providers/webhook-crypto.util';

@Injectable()
export class PaddleSubscriptionProvider implements SubscriptionProviderPort {
  readonly name = 'paddle';
  private readonly logger = new Logger(PaddleSubscriptionProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly base: string;
  private readonly successUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('PADDLE_API_KEY') ?? '';
    this.webhookSecret = config.get<string>('PADDLE_WEBHOOK_SECRET') ?? '';
    this.base = config.get<string>('PADDLE_API_BASE') ?? 'https://api.paddle.com';
    this.successUrl = config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
  }

  async createCheckout(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.apiKey) throw new RetryableHttpError(503, 'paddle_not_configured');
    const body = await withRetry(
      () =>
        this.request('POST', '/transactions', {
          items: [{ price_id: input.plan.providerPlanId, quantity: 1 }],
          custom_data: { userId: input.userId, reference: input.reference },
          checkout: { url: `${this.successUrl}?ref=${encodeURIComponent(input.reference)}` },
        }),
      {
        isRetryable: isTransientHttpError,
        onRetry: (n, e) => this.logger.warn(`Paddle sub create retry #${n}: ${(e as Error)?.message}`),
      },
    );
    return { authorizationUrl: body.data?.checkout?.url as string | undefined, status: 'pending' };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    if (!this.apiKey) throw new RetryableHttpError(503, 'paddle_not_configured');
    // Cancel at the end of the current billing period (keeps access until then).
    await this.request('POST', `/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, {
      effective_from: 'next_billing_period',
    });
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyPaddleSignature(this.webhookSecret, rawBody, headers['paddle-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedSubscriptionWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      event_id?: string;
      event_type?: string;
      data?: {
        id?: string;
        subscription_id?: string;
        status?: string;
        custom_data?: Record<string, any>;
        current_billing_period?: { ends_at?: string };
      };
    };
    const type = evt.event_type ?? 'unknown';
    const data = evt.data ?? {};
    const custom = data.custom_data ?? {};
    const dedupeKey = `${type}:${evt.event_id ?? data.id ?? 'unknown'}`;

    if (type.startsWith('subscription.')) {
      const status = type === 'subscription.canceled'
        ? 'cancelled'
        : mapPaddleStatus(data.status);
      return {
        event: type,
        dedupeKey,
        providerSubscriptionId: data.id,
        reference: custom.reference,
        status,
        currentPeriodEnd: data.current_billing_period?.ends_at ?? undefined,
      };
    }

    // First paid transaction links our reference → the new subscription id.
    if (type === 'transaction.completed' && data.subscription_id) {
      return {
        event: type,
        dedupeKey,
        providerSubscriptionId: data.subscription_id,
        reference: custom.reference,
        status: 'active',
      };
    }

    return { event: type, dedupeKey };
  }

  private async request(
    method: 'POST',
    path: string,
    json: unknown,
  ): Promise<{ data?: { id?: string; checkout?: { url?: string } } }> {
    const res = await fetch(`${this.base}${path}`, {
      method,
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
}

function mapPaddleStatus(s: string | undefined): SubscriptionStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    case 'paused':
      return 'past_due';
    default:
      return 'pending';
  }
}
