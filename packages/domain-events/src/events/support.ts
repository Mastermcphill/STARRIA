// ---------------------------------------------------------------------------
// domain-events — support-core events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

// ── Event type constants ───────────────────────────────────────────────────

export const SUPPORTER_PROFILE_CREATED        = 'supporter.profile.created';
export const SUPPORTER_SPEND_RECORDED         = 'supporter.spend.recorded';
export const SUPPORTER_TIER_UPGRADED          = 'supporter.tier.upgraded';
export const SUPPORTER_SUBSCRIBED             = 'supporter.subscribed';
export const SUPPORTER_SUBSCRIPTION_CANCELLED = 'supporter.subscription.cancelled';
export const SUPPORTER_STREAK_ACHIEVED        = 'supporter.streak.achieved';
export const SUPPORTER_ANNIVERSARY            = 'supporter.anniversary';

// ── Payloads ──────────────────────────────────────────────────────────────

export interface SupporterProfileCreatedPayload {
  readonly supporterId: string;
  readonly userId: string;
  readonly displayName: string;
}

export interface SpendRecordedPayload {
  readonly supporterId: string;
  readonly coinsSpent: number;
  readonly fiatMinorUnitsSpent: number;
  readonly lifetimeCoinsSpent: number;
  readonly lifetimeFiatSpent: number;
}

export interface SupporterTierUpgradedPayload {
  readonly supporterId: string;
  readonly previousTier: string;
  readonly newTier: string;
}

export interface SubscriptionCreatedPayload {
  readonly subscriptionId: string;
  readonly supporterId: string;
  readonly starId: string;
  readonly tier: string;
  readonly startedAt: string;
  readonly endsAt?: string;
}

export interface SubscriptionCancelledPayload {
  readonly subscriptionId: string;
  readonly supporterId: string;
  readonly starId: string;
  readonly cancelledAt: string;
  readonly immediate: boolean;
}

export interface SupportStreakAchievedPayload {
  readonly supporterProfileId: string;
  readonly starProfileId: string;
  readonly relationshipId: string;
  readonly streakDays: number;
  readonly longestStreakDays: number;
  readonly streakStartedAt: string;
}

export interface SupportAnniversaryPayload {
  readonly supporterProfileId: string;
  readonly starProfileId: string;
  readonly relationshipId: string;
  readonly years: number;
  readonly relationshipStartedAt: string;
  readonly message: string;
}

// ── Typed event aliases ────────────────────────────────────────────────────

export type SupporterProfileCreatedEvent = DomainEvent<SupporterProfileCreatedPayload>;
export type SpendRecordedEvent           = DomainEvent<SpendRecordedPayload>;
export type SupporterTierUpgradedEvent   = DomainEvent<SupporterTierUpgradedPayload>;
export type SubscriptionCreatedEvent     = DomainEvent<SubscriptionCreatedPayload>;
export type SubscriptionCancelledEvent   = DomainEvent<SubscriptionCancelledPayload>;
export type SupportStreakAchievedEvent   = DomainEvent<SupportStreakAchievedPayload>;
export type SupportAnniversaryEvent      = DomainEvent<SupportAnniversaryPayload>;
