// Stripe Connect payout rail — implements BOTH the onboarding port (Express
// connected account + hosted Account Link, status via account.updated) and the
// payout port (Transfer to the connected account, settled via transfer.* events).
//
// Same-currency only for now (the transfer amount is sent in minor units of the
// payout currency; FX is a separate design decision — see the rollout doc).
//
// Webhooks (account.updated + transfer.*) are Connect events delivered to the
// Connect webhook endpoint and verified with STRIPE_CONNECT_WEBHOOK_SECRET.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PayoutProviderPort,
  PayoutTransferInput,
  PayoutTransferResult,
  PayoutWebhookParseResult,
} from '../ports/payout-provider.port';
import type {
  RecipientOnboardingPort,
  OnboardingLinkInput,
  OnboardingLinkResult,
  RecipientStatus,
  RecipientStatusValue,
  ParsedOnboardingWebhook,
} from '../ports/recipient-onboarding.port';
import { bodyToString, verifyStripeSignature } from '../../coin-purchase/providers/webhook-crypto.util';

const STRIPE_BASE = 'https://api.stripe.com';

@Injectable()
export class StripeConnectProvider implements PayoutProviderPort, RecipientOnboardingPort {
  readonly name = 'stripe_connect';
  private readonly logger = new Logger(StripeConnectProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET') ?? '';
  }

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async createOnboardingLink(input: OnboardingLinkInput): Promise<OnboardingLinkResult> {
    if (!this.secretKey) throw new Error('stripe_not_configured');

    // Create the Express connected account, tagging it with our recipient id so
    // the account.updated webhook can be matched back. (Re-running onboarding
    // creates a fresh account; the caller persists the latest providerRef.)
    const acct = await this.post('/v1/accounts', toForm({
      type: 'express',
      ...(input.country ? { country: input.country } : {}),
      ...(input.email ? { email: input.email } : {}),
      'capabilities[transfers][requested]': 'true',
      'metadata[recipientId]': input.recipientId,
      'metadata[userId]': input.userId,
    }));
    const acctId = acct.id as string;

    const link = await this.post('/v1/account_links', toForm({
      account: acctId,
      refresh_url: input.refreshUrl ?? input.returnUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    }));

    return { providerRef: acctId, url: link.url as string | undefined, ready: false };
  }

  async getRecipientStatus(providerRef: string): Promise<RecipientStatus> {
    if (!this.secretKey) throw new Error('stripe_not_configured');
    const acct = await this.get(`/v1/accounts/${encodeURIComponent(providerRef)}`);
    const mapped = mapAccount(acct);
    return { providerRef, ...mapped };
  }

  verifyOnboardingWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean {
    return verifyStripeSignature(this.webhookSecret, rawBody, headers['stripe-signature']);
  }

  parseOnboardingWebhook(rawBody: Buffer | string): ParsedOnboardingWebhook | null {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, any> };
    };
    if (evt.type !== 'account.updated') return null;
    const acct = evt.data?.object ?? {};
    const mapped = mapAccount(acct);
    return {
      event: evt.type,
      dedupeKey: `${evt.type}:${evt.id ?? acct.id ?? 'unknown'}`,
      providerRef: acct.id as string | undefined,
      status: mapped.status,
      payable: mapped.payable,
    };
  }

  // ─── Payout (settlement) ─────────────────────────────────────────────────────

  async transfer(input: PayoutTransferInput): Promise<PayoutTransferResult> {
    if (!this.secretKey) {
      return { accepted: false, status: 'failed', error: 'stripe_not_configured' };
    }
    // `destination` is the connected account id (acct_…), resolved by the
    // PayoutService from the payable PayoutRecipient.
    const res = await this.rawPost('/v1/transfers', toForm({
      amount: String(input.amountMinorUnits),
      currency: input.currency.toLowerCase(),
      destination: input.destination,
      transfer_group: input.reference,
      'metadata[reference]': input.reference,
    }));
    if (res.status >= 500) throw new Error(`Stripe transfer ${res.status}`);

    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !body.id) {
      return { accepted: false, status: 'failed', error: body.error?.message ?? `http_${res.status}` };
    }
    return { accepted: true, providerRef: body.id, status: 'processing' };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    return verifyStripeSignature(this.webhookSecret, rawBody, signature);
  }

  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult {
    const evt = JSON.parse(bodyToString(rawBody)) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, any> };
    };
    const type = evt.type ?? 'unknown';
    const obj = evt.data?.object ?? {};
    const reference = obj.transfer_group ?? obj.metadata?.reference;
    const outcome: PayoutWebhookParseResult['outcome'] =
      type === 'transfer.created' || type === 'transfer.paid'
        ? 'success'
        : type === 'transfer.reversed' || type === 'transfer.failed'
          ? 'failed'
          : 'other';
    return {
      event: type,
      reference,
      dedupeKey: `${type}:${evt.id ?? obj.id ?? 'unknown'}`,
      outcome,
    };
  }

  // ─── HTTP helpers ────────────────────────────────────────────────────────────

  private rawPost(path: string, form: URLSearchParams): Promise<Response> {
    return fetch(`${STRIPE_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  }

  private async post(path: string, form: URLSearchParams): Promise<Record<string, any>> {
    const res = await this.rawPost(path, form);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Stripe ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }

  private async get(path: string): Promise<Record<string, any>> {
    const res = await fetch(`${STRIPE_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Stripe ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as Record<string, any>;
  }
}

function toForm(fields: Record<string, string>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

/** Map a Stripe account object to our recipient lifecycle state. */
export function mapAccount(acct: Record<string, any>): {
  status: RecipientStatusValue;
  payable: boolean;
  details: Record<string, unknown>;
} {
  const reqs = (acct.requirements ?? {}) as { disabled_reason?: string; currently_due?: string[] };
  const disabled = reqs.disabled_reason;
  const payouts = acct.payouts_enabled === true;
  const details = {
    payouts_enabled: acct.payouts_enabled,
    charges_enabled: acct.charges_enabled,
    disabled_reason: disabled,
    currently_due: reqs.currently_due,
  };
  if (payouts) return { status: 'active', payable: true, details };
  if (disabled?.startsWith('rejected')) return { status: 'rejected', payable: false, details };
  if (disabled) return { status: 'restricted', payable: false, details };
  return { status: 'onboarding', payable: false, details };
}
