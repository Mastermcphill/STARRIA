// ---------------------------------------------------------------------------
// domain-events — Sprint 5 Patron Economy events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const PATRON_PROFILE_CREATED     = 'patron.profile.created';
export const PATRON_TIER_UPGRADED       = 'patron.tier.upgraded';
export const PATRON_ACHIEVEMENT_UNLOCKED = 'patron.achievement.unlocked';
export const PATRON_MILESTONE_REACHED   = 'patron.milestone.reached';
export const PATRON_RELATIONSHIP_CREATED = 'patron.relationship.created';
export const PATRON_SPEND_RECORDED      = 'patron.spend.recorded';

export type PatronTier = 'VISITOR' | 'SUPPORTER' | 'PATRON' | 'BENEFACTOR' | 'LEGEND' | 'OG';

export interface PatronProfileCreatedPayload {
  readonly patronId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly createdAt: string;
}

export interface PatronTierUpgradedPayload {
  readonly patronId: string;
  readonly userId: string;
  readonly previousTier: PatronTier;
  readonly newTier: PatronTier;
  readonly lifetimeSpendUsd: number;
  readonly upgradedAt: string;
}

export interface PatronAchievementUnlockedPayload {
  readonly patronId: string;
  readonly achievementId: string;
  readonly achievementType: string;
  readonly title: string;
  readonly unlockedAt: string;
}

export interface PatronMilestoneReachedPayload {
  readonly patronId: string;
  readonly starId: string;
  readonly milestoneId: string;
  readonly milestoneType: string;
  readonly totalSpendUsd: number;
  readonly reachedAt: string;
}

export interface PatronRelationshipCreatedPayload {
  readonly patronId: string;
  readonly starId: string;
  readonly initialTier: PatronTier;
  readonly createdAt: string;
}

export interface PatronSpendRecordedPayload {
  readonly patronId: string;
  readonly starId: string;
  readonly coinsSpent: number;
  readonly fiatUsdCents: number;
  readonly lifetimeUsdCents: number;
  readonly creatorLifetimeUsdCents: number;
  readonly recordedAt: string;
}

export type PatronProfileCreatedEvent      = DomainEvent<PatronProfileCreatedPayload>;
export type PatronTierUpgradedEvent        = DomainEvent<PatronTierUpgradedPayload>;
export type PatronAchievementUnlockedEvent = DomainEvent<PatronAchievementUnlockedPayload>;
export type PatronMilestoneReachedEvent    = DomainEvent<PatronMilestoneReachedPayload>;
export type PatronRelationshipCreatedEvent = DomainEvent<PatronRelationshipCreatedPayload>;
export type PatronSpendRecordedEvent       = DomainEvent<PatronSpendRecordedPayload>;
