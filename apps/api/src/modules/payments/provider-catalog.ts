// ---------------------------------------------------------------------------
// Provider catalog — the single source of truth for which payment providers
// serve which flows ("capabilities"), and which env var holds the credential
// that decides whether a provider is "configured".
//
// Capabilities are intentionally segregated because real providers do not all
// do everything:
//   - checkout      : collect a one-time payment (buy coins)
//   - subscription  : recurring billing (Star subscriptions)
//   - payout        : send money out to a creator (withdrawals)
//
// Trolley / Wise / Tipalti are payout-only rails (they cannot collect money).
// Lemon Squeezy / Paddle are merchant-of-record checkout+subscription platforms
// (they cannot pay creators out). The matrix below encodes exactly that.
// ---------------------------------------------------------------------------

export const PAYMENT_CAPABILITIES = ['checkout', 'subscription', 'payout'] as const;
export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number];

export interface ProviderCapabilityEntry {
  /** Env var that, when non-empty, marks this provider+capability "configured". */
  credentialEnv: string;
}

export interface ProviderCatalogEntry {
  /** Stable lowercase key used in DTOs, DB rows and env var names. */
  key: string;
  /** Human label for the admin console. */
  label: string;
  /** Which capabilities this provider supports, and the credential gate for each. */
  capabilities: Partial<Record<PaymentCapability, ProviderCapabilityEntry>>;
}

// Order here is the display order in the admin console.
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    key: 'paystack',
    label: 'Paystack',
    capabilities: {
      checkout: { credentialEnv: 'PAYSTACK_SECRET_KEY' },
      subscription: { credentialEnv: 'PAYSTACK_SECRET_KEY' },
      payout: { credentialEnv: 'PAYSTACK_SECRET_KEY' },
    },
  },
  {
    key: 'korapay',
    label: 'Korapay',
    capabilities: {
      checkout: { credentialEnv: 'KORAPAY_SECRET_KEY' },
      payout: { credentialEnv: 'KORAPAY_SECRET_KEY' },
    },
  },
  {
    key: 'flutterwave',
    label: 'Flutterwave',
    capabilities: {
      checkout: { credentialEnv: 'FLUTTERWAVE_SECRET_KEY' },
      subscription: { credentialEnv: 'FLUTTERWAVE_SECRET_KEY' },
      payout: { credentialEnv: 'FLUTTERWAVE_SECRET_KEY' },
    },
  },
  {
    key: 'stripe',
    label: 'Stripe',
    capabilities: {
      checkout: { credentialEnv: 'STRIPE_SECRET_KEY' },
      subscription: { credentialEnv: 'STRIPE_SECRET_KEY' },
    },
  },
  {
    // Payouts go through Stripe Connect (transfer to a connected account), which
    // is a distinct rail from plain Stripe checkout — separate destination
    // semantics (acct_… handle) and its own onboarding, so its own catalog key.
    key: 'stripe_connect',
    label: 'Stripe Connect',
    capabilities: {
      payout: { credentialEnv: 'STRIPE_SECRET_KEY' },
    },
  },
  {
    key: 'tazapay',
    label: 'Tazapay',
    capabilities: {
      checkout: { credentialEnv: 'TAZAPAY_API_KEY' },
    },
  },
  {
    key: 'lemonsqueezy',
    label: 'Lemon Squeezy',
    capabilities: {
      checkout: { credentialEnv: 'LEMONSQUEEZY_API_KEY' },
      subscription: { credentialEnv: 'LEMONSQUEEZY_API_KEY' },
    },
  },
  {
    key: 'paddle',
    label: 'Paddle',
    capabilities: {
      checkout: { credentialEnv: 'PADDLE_API_KEY' },
      subscription: { credentialEnv: 'PADDLE_API_KEY' },
    },
  },
  {
    key: 'trolley',
    label: 'Trolley',
    capabilities: {
      payout: { credentialEnv: 'TROLLEY_ACCESS_KEY' },
    },
  },
  {
    key: 'wise',
    label: 'Wise',
    capabilities: {
      payout: { credentialEnv: 'WISE_API_TOKEN' },
    },
  },
  {
    key: 'tipalti',
    label: 'Tipalti',
    capabilities: {
      payout: { credentialEnv: 'TIPALTI_API_KEY' },
    },
  },
];

const CATALOG_BY_KEY = new Map(PROVIDER_CATALOG.map((e) => [e.key, e]));

export function getCatalogEntry(provider: string): ProviderCatalogEntry | undefined {
  return CATALOG_BY_KEY.get(provider);
}

/** True if `provider` declares support for `capability` in the catalog. */
export function providerSupports(provider: string, capability: PaymentCapability): boolean {
  return Boolean(CATALOG_BY_KEY.get(provider)?.capabilities[capability]);
}

/** Env var name for the on/off default of a (provider, capability) pair. */
export function enabledEnvVar(provider: string, capability: PaymentCapability): string {
  return `PAYMENTS_${provider.toUpperCase()}_${capability.toUpperCase()}_ENABLED`;
}

/** Every (provider, capability) pair in the catalog, flattened. */
export function allProviderCapabilities(): Array<{
  provider: string;
  label: string;
  capability: PaymentCapability;
  credentialEnv: string;
}> {
  const out: Array<{
    provider: string;
    label: string;
    capability: PaymentCapability;
    credentialEnv: string;
  }> = [];
  for (const entry of PROVIDER_CATALOG) {
    for (const cap of PAYMENT_CAPABILITIES) {
      const c = entry.capabilities[cap];
      if (c) {
        out.push({
          provider: entry.key,
          label: entry.label,
          capability: cap,
          credentialEnv: c.credentialEnv,
        });
      }
    }
  }
  return out;
}
