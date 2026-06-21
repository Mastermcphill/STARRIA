// Lemon Squeezy subscription rail — hosted checkout for a subscription variant
// + subscription_* lifecycle webhooks (X-Signature HMAC-SHA256).
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
import { bodyToString, verifyHmac } from '../../coin-purchase/providers/webhook-crypto.util';

const LS_BASE = 'https://api.lemonsqueezy.com/v1';
const JSON_API = 'application/vnd.api+json';

@Injectable()
export class LemonSqueezySubscriptionProvider implements SubscriptionProviderPort {
  readonly name = 'lemonsqueezy';
  private readonly logger = new Logger(LemonSqueezySubscriptionProvider.name);
  private readonly apiKey: string;
  private readonly storeId: string;
  private readonly webhookSecret: string;
  private readonly successUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('LEMONSQUEEZY_API_KEY') ?? '';
    this.storeId = config.get<string>('LEMONSQUEEZY_STORE_ID') ?? '';
    this.webhookSecret = config.get<string>('LEMONSQUEEZY_WEBHOOK_SECRET') ?? '';
    this.successUrl = config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
  }

  async createCheckout(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.apiKey || !this.storeId) throw new RetryableHttpError(503, 'lemonsqueezy_not_configured');
    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          product_options: { redirect_url: `${this.successUrl}?ref=${encodeURIComponent(input.reference)}` },
          checkout_data: {
            email: input.email ?? `${input.userId}@users.starria`,
            custom: { userId: input.userId, reference: input.reference },
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: this.storeId } },
          variant: { data: { type: 'variants', id: input.plan.providerPlanId } },
        },
      },
    };
    const body = await withRetry(() => this.request('POST', '/checkouts', payload), {
      isRetryable: isTransientHttpError,
      onRetry: (n, e) => this.logger.warn(`LS sub create retry #${n}: ${(e as Error)?.message}`),
    });
    return { authorizationUrl: body.data?.attributes?.url as string, status: 'pending' };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    if (!this.apiKey) throw new RetryableHttpError(503, 'lemonsqueezy_not_configured');
    await this.request('DELETE', `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyHmac('sha256', this.webhookSecret, bodyToString(rawBody), headers['x-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedSubscriptionWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      meta?: { event_name?: string; custom_data?: Record<string, any> };
      data?: { id?: string; attributes?: Record<string, any> };
    };
    const eventName = evt.meta?.event_name ?? 'unknown';
    const custom = evt.meta?.custom_data ?? {};
    const attrs = evt.data?.attributes ?? {};
    const status = eventName.startsWith('subscription_') ? mapLsStatus(attrs.status) : undefined;
    return {
      event: eventName,
      dedupeKey: `${eventName}:${evt.data?.id ?? 'unknown'}:${attrs.status ?? ''}`,
      providerSubscriptionId: evt.data?.id,
      reference: custom.reference,
      status,
      currentPeriodEnd: attrs.renews_at ?? undefined,
    };
  }

  private async request(
    method: 'POST' | 'DELETE',
    path: string,
    json?: unknown,
  ): Promise<{ data?: { id?: string; attributes?: Record<string, any> } }> {
    const res = await fetch(`${LS_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': JSON_API,
        Accept: JSON_API,
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `LemonSqueezy ${path} -> ${res.status} ${text}`);
    }
    if (res.status === 204) return {};
    return (await res.json()) as { data?: { id?: string; attributes?: Record<string, any> } };
  }
}

function mapLsStatus(s: string | undefined): SubscriptionStatus {
  switch (s) {
    case 'active':
    case 'on_trial':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}
