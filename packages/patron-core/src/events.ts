// ---------------------------------------------------------------------------
// patron-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  PatronProfileCreatedEvent,
  PatronTierUpgradedEvent,
  PatronAchievementUnlockedEvent,
  PatronMilestoneReachedEvent,
  PatronRelationshipCreatedEvent,
  PatronSpendRecordedEvent,
} from '@starria/domain-events';
import {
  PATRON_PROFILE_CREATED,
  PATRON_TIER_UPGRADED,
  PATRON_ACHIEVEMENT_UNLOCKED,
  PATRON_MILESTONE_REACHED,
  PATRON_RELATIONSHIP_CREATED,
  PATRON_SPEND_RECORDED,
} from '@starria/domain-events';
import type { PatronTier } from './types';

export function buildPatronProfileCreated(params: {
  patronId: string;
  userId: string;
  displayName: string;
  createdAt: string;
}): PatronProfileCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_PROFILE_CREATED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}

export function buildPatronTierUpgraded(params: {
  patronId: string;
  userId: string;
  previousTier: PatronTier;
  newTier: PatronTier;
  lifetimeSpendUsd: number;
  upgradedAt: string;
}): PatronTierUpgradedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_TIER_UPGRADED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}

export function buildPatronAchievementUnlocked(params: {
  patronId: string;
  achievementId: string;
  achievementType: string;
  title: string;
  unlockedAt: string;
}): PatronAchievementUnlockedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_ACHIEVEMENT_UNLOCKED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}

export function buildPatronMilestoneReached(params: {
  patronId: string;
  starId: string;
  milestoneId: string;
  milestoneType: string;
  totalSpendUsd: number;
  reachedAt: string;
}): PatronMilestoneReachedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_MILESTONE_REACHED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}

export function buildPatronRelationshipCreated(params: {
  patronId: string;
  starId: string;
  initialTier: PatronTier;
  createdAt: string;
}): PatronRelationshipCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_RELATIONSHIP_CREATED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}

export function buildPatronSpendRecorded(params: {
  patronId: string;
  starId: string;
  coinsSpent: number;
  fiatUsdCents: number;
  lifetimeUsdCents: number;
  creatorLifetimeUsdCents: number;
  recordedAt: string;
}): PatronSpendRecordedEvent {
  return createEvent({
    id: randomUUID(),
    type: PATRON_SPEND_RECORDED,
    aggregateId: params.patronId,
    aggregateType: 'PatronProfile',
    payload: params,
  });
}
