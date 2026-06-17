// ---------------------------------------------------------------------------
// support-core — domain event publishers
// Re-exports the canonical event types and provides factory functions
// so service code stays free of UUID/date boilerplate.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  SupporterProfileCreatedEvent,
  SpendRecordedEvent,
  SupporterTierUpgradedEvent,
  SubscriptionCreatedEvent,
  SubscriptionCancelledEvent,
  SupportStreakAchievedEvent,
  SupportAnniversaryEvent,
} from '@starria/domain-events';
import {
  SUPPORTER_PROFILE_CREATED,
  SUPPORTER_SPEND_RECORDED,
  SUPPORTER_TIER_UPGRADED,
  SUPPORTER_SUBSCRIBED,
  SUPPORTER_SUBSCRIPTION_CANCELLED,
  SUPPORTER_STREAK_ACHIEVED,
  SUPPORTER_ANNIVERSARY,
} from '@starria/domain-events';

export function buildSupporterProfileCreatedEvent(params: {
  supporterId: string;
  userId: string;
  displayName: string;
}): SupporterProfileCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_PROFILE_CREATED,
    aggregateId: params.supporterId,
    aggregateType: 'SupporterProfile',
    payload: params,
  });
}

export function buildSpendRecordedEvent(params: {
  supporterId: string;
  coinsSpent: number;
  fiatMinorUnitsSpent: number;
  lifetimeCoinsSpent: number;
  lifetimeFiatSpent: number;
}): SpendRecordedEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_SPEND_RECORDED,
    aggregateId: params.supporterId,
    aggregateType: 'SupporterProfile',
    payload: params,
  });
}

export function buildSupporterTierUpgradedEvent(params: {
  supporterId: string;
  previousTier: string;
  newTier: string;
}): SupporterTierUpgradedEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_TIER_UPGRADED,
    aggregateId: params.supporterId,
    aggregateType: 'SupporterProfile',
    payload: params,
  });
}

export function buildSubscriptionCreatedEvent(params: {
  subscriptionId: string;
  supporterId: string;
  starId: string;
  tier: string;
  startedAt: string;
  endsAt?: string;
}): SubscriptionCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_SUBSCRIBED,
    aggregateId: params.subscriptionId,
    aggregateType: 'Subscription',
    payload: params,
  });
}

export function buildSubscriptionCancelledEvent(params: {
  subscriptionId: string;
  supporterId: string;
  starId: string;
  cancelledAt: string;
  immediate: boolean;
}): SubscriptionCancelledEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_SUBSCRIPTION_CANCELLED,
    aggregateId: params.subscriptionId,
    aggregateType: 'Subscription',
    payload: params,
  });
}

export function buildStreakAchievedEvent(params: {
  supporterProfileId: string;
  starProfileId: string;
  relationshipId: string;
  streakDays: number;
  longestStreakDays: number;
  streakStartedAt: string;
}): SupportStreakAchievedEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_STREAK_ACHIEVED,
    aggregateId: params.relationshipId,
    aggregateType: 'SupportRelationship',
    payload: params,
  });
}

export function buildAnniversaryEvent(params: {
  supporterProfileId: string;
  starProfileId: string;
  relationshipId: string;
  years: number;
  relationshipStartedAt: string;
  message: string;
}): SupportAnniversaryEvent {
  return createEvent({
    id: randomUUID(),
    type: SUPPORTER_ANNIVERSARY,
    aggregateId: params.relationshipId,
    aggregateType: 'SupportRelationship',
    payload: params,
  });
}
