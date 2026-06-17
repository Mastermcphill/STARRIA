// ---------------------------------------------------------------------------
// support-core — types
// Defines the Supporter identity, subscription contract, and gifting history
// for the STARRIA platform.
// No NestJS / Prisma dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supporter profile
// ---------------------------------------------------------------------------

export type SupporterTier = 'free' | 'fan' | 'superfan' | 'ultra';

export interface SupporterProfile {
  readonly id: string;
  readonly userId: string;
  readonly tier: SupporterTier;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
  /** Total coins spent across all Taps — drives tier progression. */
  readonly lifetimeCoinsSpent: number;
  /** Total fiat spent across all Taps (minor units, default currency). */
  readonly lifetimeFiatSpent: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSupporterProfileInput {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
}

export interface UpdateSupporterProfileInput {
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type SubscriptionTier = 'basic' | 'premium' | 'vip';

export interface Subscription {
  readonly id: string;
  readonly supporterId: string;
  readonly starId: string;
  readonly tier: SubscriptionTier;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly endsAt?: string;
  readonly cancelledAt?: string;
  readonly renewalEnabled: boolean;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SubscribeInput {
  readonly supporterId: string;
  readonly starId: string;
  readonly tier: SubscriptionTier;
  readonly durationDays?: number;
  readonly idempotencyKey: string;
}

export interface CancelSubscriptionInput {
  readonly subscriptionId: string;
  readonly supporterId: string;
  readonly reason?: string;
  readonly immediate?: boolean;
}

// ---------------------------------------------------------------------------
// Supporter gifting summary (derived — not stored directly)
// ---------------------------------------------------------------------------

export interface SupporterGiftingSummary {
  readonly supporterId: string;
  readonly starId: string;
  readonly totalCoinsGifted: number;
  readonly totalFiatGifted: number;
  readonly tapCount: number;
  readonly lastTapAt?: string;
}

// ---------------------------------------------------------------------------
// Supporter tier thresholds
// ---------------------------------------------------------------------------

export interface SupporterTierConfig {
  readonly tier: SupporterTier;
  /** Lifetime coins spent required to reach this tier. */
  readonly coinsThreshold: number;
  readonly label: string;
  readonly badgeUrl?: string;
  readonly perks: string[];
}

export const DEFAULT_TIER_CONFIG: readonly SupporterTierConfig[] = [
  { tier: 'free',      coinsThreshold: 0,     label: 'Free',      perks: [] },
  { tier: 'fan',       coinsThreshold: 100,   label: 'Fan',       perks: ['fan_badge'] },
  { tier: 'superfan',  coinsThreshold: 1000,  label: 'SuperFan',  perks: ['fan_badge', 'superfan_badge', 'priority_queue'] },
  { tier: 'ultra',     coinsThreshold: 10000, label: 'Ultra',     perks: ['fan_badge', 'superfan_badge', 'ultra_badge', 'priority_queue', 'exclusive_content'] },
];

export function computeSupporterTier(
  lifetimeCoinsSpent: number,
  config: readonly SupporterTierConfig[] = DEFAULT_TIER_CONFIG,
): SupporterTier {
  const sorted = [...config].sort((a, b) => b.coinsThreshold - a.coinsThreshold);
  for (const c of sorted) {
    if (lifetimeCoinsSpent >= c.coinsThreshold) return c.tier;
  }
  return 'free';
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface SupporterListFilter {
  starId?: string;
  tier?: SupporterTier;
  cursor?: string;
  limit?: number;
}

export interface SubscriptionListFilter {
  supporterId?: string;
  starId?: string;
  status?: SubscriptionStatus;
  cursor?: string;
  limit?: number;
}
