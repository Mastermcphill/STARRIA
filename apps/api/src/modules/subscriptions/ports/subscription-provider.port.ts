// ---------------------------------------------------------------------------
// SubscriptionProviderPort — recurring-billing abstraction. Implemented by the
// MoR/PSP rails (Stripe, Lemon Squeezy, Paddle). SubscriptionsService depends
// only on this interface and resolves the rail per plan from the registry.
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export interface SubscriptionPlanRef {
  key: string;
  /** Provider-side price/variant id this plan maps to. */
  providerPlanId: string;
  priceMinorUnits: number;
  currency: string;
  interval: string;
}

export interface CreateSubscriptionInput {
  userId: string;
  email?: string;
  /** Our idempotencyKey — providers echo it back so the webhook can be linked. */
  reference: string;
  plan: SubscriptionPlanRef;
}

export interface CreateSubscriptionResult {
  /** Set if the provider returns the subscription id synchronously (often not). */
  providerSubscriptionId?: string;
  /** Hosted checkout URL the buyer is redirected to. */
  authorizationUrl?: string;
  status: 'pending' | 'active';
}

export interface ParsedSubscriptionWebhook {
  event: string;
  /** Provider event identity; the replay-protection key. */
  dedupeKey: string;
  providerSubscriptionId?: string;
  /** Our reference, if the provider echoes it in custom data. */
  reference?: string;
  /** Mapped lifecycle status, or undefined for non-lifecycle events. */
  status?: SubscriptionStatus;
  /** ISO timestamp of the current period end, if present. */
  currentPeriodEnd?: string;
}

export interface SubscriptionProviderPort {
  readonly name: string;
  /** Create a hosted subscription checkout for the plan. */
  createCheckout(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  /** Cancel an active subscription (at period end where supported). */
  cancel(providerSubscriptionId: string): Promise<void>;
  /** Constant-time verification over the raw webhook body. */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean;
  /** Parse an already-verified webhook into a normalised lifecycle result. */
  parseWebhook(rawBody: Buffer | string): ParsedSubscriptionWebhook;
}
