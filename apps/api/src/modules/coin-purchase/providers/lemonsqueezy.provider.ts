// Lemon Squeezy checkout provider (merchant-of-record). Creates a hosted
// checkout for a configured pay-what-you-want variant with a `custom_price`
// equal to the coin package price, so arbitrary amounts work without a variant
// per package. Webhooks carry an `X-Signature` = HMAC-SHA256(body) under
// LEMONSQUEEZY_WEBHOOK_SECRET.
//
// Requires LEMONSQUEEZY_STORE_ID and LEMONSQUEEZY_VARIANT_ID (a PWYW variant).
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
import { bodyToString, verifyHmac } from './webhook-crypto.util';

const LS_BASE = 'https://api.lemonsqueezy.com/v1';
const JSON_API = 'application/vnd.api+json';

@Injectable()
export class LemonSqueezyProvider implements PaymentProvider {
  readonly name = 'lemonsqueezy';
  private readonly logger = new Logger(LemonSqueezyProvider.name);
  private readonly apiKey: string;
  private readonly storeId: string;
  private readonly variantId: string;
  private readonly webhookSecret: string;
  private readonly successUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('LEMONSQUEEZY_API_KEY') ?? '';
    this.storeId = config.get<string>('LEMONSQUEEZY_STORE_ID') ?? '';
    this.variantId = config.get<string>('LEMONSQUEEZY_VARIANT_ID') ?? '';
    this.webhookSecret = config.get<string>('LEMONSQUEEZY_WEBHOOK_SECRET') ?? '';
    this.successUrl =
      config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.apiKey || !this.storeId || !this.variantId) {
      throw new RetryableHttpError(503, 'lemonsqueezy_not_configured');
    }
    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          custom_price: input.amountMinorUnits,
          product_options: { redirect_url: `${this.successUrl}?ref=${encodeURIComponent(input.reference)}` },
          checkout_data: {
            email: (input.metadata?.email as string) ?? `${input.userId}@users.starria`,
            custom: {
              userId: input.userId,
              coins: String(input.metadata?.coins ?? ''),
              reference: input.reference,
            },
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: this.storeId } },
          variant: { data: { type: 'variants', id: this.variantId } },
        },
      },
    };

    const body = await withRetry(() => this.request('/checkouts', payload), {
      isRetryable: isTransientHttpError,
      onRetry: (n, e) => this.logRetry('initiate', n, e),
    });

    return {
      providerReference: (body.data?.id as string) ?? input.reference,
      authorizationUrl: body.data?.attributes?.url as string,
      status: 'initiated',
    };
  }

  async verify(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyHmac('sha256', this.webhookSecret, bodyToString(rawBody), headers['x-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      meta?: { event_name?: string; custom_data?: Record<string, any> };
      data?: { attributes?: { status?: string } };
    };
    const eventName = evt.meta?.event_name ?? 'unknown';
    const custom = evt.meta?.custom_data ?? {};
    const status = evt.data?.attributes?.status;
    return {
      event: eventName,
      reference: custom.reference,
      userId: custom.userId,
      coins: custom.coins !== undefined ? Number(custom.coins) : undefined,
      success: eventName === 'order_created' && status === 'paid',
    };
  }

  private async request(
    path: string,
    json: unknown,
  ): Promise<{ data?: { id?: string; attributes?: Record<string, any> } }> {
    const res = await fetch(`${LS_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': JSON_API,
        Accept: JSON_API,
      },
      body: JSON.stringify(json),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `LemonSqueezy ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data?: { id?: string; attributes?: Record<string, any> } };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`LemonSqueezy ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
