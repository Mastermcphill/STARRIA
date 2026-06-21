// Tazapay checkout provider — cross-border hosted checkout. Auth is HTTP Basic
// (api key:secret, base64). Webhooks are HMAC-SHA256 over the raw body under
// TAZAPAY_WEBHOOK_SECRET (sent as the `x-tazapay-signature` header).
//
// NOTE: exact request/response field names should be confirmed against the
// Tazapay dashboard for your account version; the security-critical part (the
// webhook HMAC) is what the unit tests pin down.
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

const TAZAPAY_BASE = 'https://service.tazapay.com/v3';

@Injectable()
export class TazapayProvider implements PaymentProvider {
  readonly name = 'tazapay';
  private readonly logger = new Logger(TazapayProvider.name);
  private readonly authHeader: string;
  private readonly configured: boolean;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('TAZAPAY_API_KEY') ?? '';
    const secret = config.get<string>('TAZAPAY_API_SECRET') ?? '';
    this.configured = Boolean(key && secret);
    this.authHeader = this.configured
      ? `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
      : '';
    this.webhookSecret = config.get<string>('TAZAPAY_WEBHOOK_SECRET') ?? '';
    this.successUrl =
      config.get<string>('PAYMENTS_SUCCESS_URL') ?? 'https://starria.com/pay/success';
    this.cancelUrl =
      config.get<string>('PAYMENTS_CANCEL_URL') ?? 'https://starria.com/pay/cancel';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.configured) throw new RetryableHttpError(503, 'tazapay_not_configured');

    const body = await withRetry(
      () =>
        this.request('/checkout', {
          invoice_currency: input.currency,
          amount: input.amountMinorUnits,
          transaction_description: 'STARRIA Coins',
          customer_details: {
            email: (input.metadata?.email as string) ?? `${input.userId}@users.starria`,
          },
          success_url: `${this.successUrl}?ref=${encodeURIComponent(input.reference)}`,
          cancel_url: this.cancelUrl,
          reference_id: input.reference,
          metadata: {
            userId: input.userId,
            coins: input.metadata?.coins,
            reference: input.reference,
          },
        }),
      { isRetryable: isTransientHttpError, onRetry: (n, e) => this.logRetry('initiate', n, e) },
    );

    const data = body.data ?? {};
    return {
      providerReference: (data.id as string) ?? input.reference,
      authorizationUrl: (data.url as string) ?? (data.redirect_url as string),
      status: 'initiated',
    };
  }

  // Tazapay verification is webhook-driven; no synchronous lookup by our ref.
  async verify(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyHmac('sha256', this.webhookSecret, bodyToString(rawBody), headers['x-tazapay-signature']);
  }

  parseWebhook(rawBody: Buffer | string): ParsedCheckoutWebhook {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      type?: string;
      event?: string;
      data?: { status?: string; reference_id?: string; metadata?: Record<string, any> };
    };
    const type = evt.type ?? evt.event ?? 'unknown';
    const data = evt.data ?? {};
    const meta = data.metadata ?? {};
    const status = (data.status ?? '').toLowerCase();
    return {
      event: type,
      reference: data.reference_id ?? meta.reference,
      userId: meta.userId,
      coins: meta.coins !== undefined ? Number(meta.coins) : undefined,
      success: status === 'paid' || status === 'succeeded' || type === 'charge.succeeded',
    };
  }

  private async request(path: string, json: unknown): Promise<{ data?: Record<string, any> }> {
    const res = await fetch(`${TAZAPAY_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RetryableHttpError(res.status, `Tazapay ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as { data?: Record<string, any> };
  }

  private logRetry(op: string, attempt: number, err: unknown) {
    this.logger.warn(`Tazapay ${op} retry #${attempt}: ${(err as Error)?.message ?? err}`);
  }
}
