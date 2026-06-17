// ---------------------------------------------------------------------------
// star-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  StarProfileCreatedEvent,
  StarTierUpgradedEvent,
  StarVerifiedEvent,
  StarVerificationRejectedEvent,
  StarFollowedEvent,
  StarUnfollowedEvent,
  StarSubscriberAddedEvent,
  StarSubscriberRemovedEvent,
} from '@starria/domain-events';
import {
  STAR_PROFILE_CREATED,
  STAR_TIER_UPGRADED,
  STAR_VERIFIED,
  STAR_VERIFICATION_REJECTED,
  STAR_FOLLOWED,
  STAR_UNFOLLOWED,
  STAR_SUBSCRIBER_ADDED,
  STAR_SUBSCRIBER_REMOVED,
} from '@starria/domain-events';

export function buildStarProfileCreatedEvent(params: {
  starId: string; userId: string; displayName: string; username: string;
}): StarProfileCreatedEvent {
  return createEvent({ id: randomUUID(), type: STAR_PROFILE_CREATED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarTierUpgradedEvent(params: {
  starId: string; previousTier: string; newTier: string; subscriberCount: number;
}): StarTierUpgradedEvent {
  return createEvent({ id: randomUUID(), type: STAR_TIER_UPGRADED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarVerifiedEvent(params: {
  starId: string; requestId: string; reviewedBy: string; reviewedAt: string;
}): StarVerifiedEvent {
  return createEvent({ id: randomUUID(), type: STAR_VERIFIED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarVerificationRejectedEvent(params: {
  starId: string; requestId: string; reviewedBy: string; reason: string;
}): StarVerificationRejectedEvent {
  return createEvent({ id: randomUUID(), type: STAR_VERIFICATION_REJECTED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarFollowedEvent(params: {
  starId: string; followerId: string; followerCount: number;
}): StarFollowedEvent {
  return createEvent({ id: randomUUID(), type: STAR_FOLLOWED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarUnfollowedEvent(params: {
  starId: string; followerId: string; followerCount: number;
}): StarUnfollowedEvent {
  return createEvent({ id: randomUUID(), type: STAR_UNFOLLOWED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarSubscriberAddedEvent(params: {
  starId: string; supporterId: string; subscriptionTier: string; subscriberCount: number;
}): StarSubscriberAddedEvent {
  return createEvent({ id: randomUUID(), type: STAR_SUBSCRIBER_ADDED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}

export function buildStarSubscriberRemovedEvent(params: {
  starId: string; supporterId: string; subscriberCount: number;
}): StarSubscriberRemovedEvent {
  return createEvent({ id: randomUUID(), type: STAR_SUBSCRIBER_REMOVED, aggregateId: params.starId, aggregateType: 'StarProfile', payload: params });
}
