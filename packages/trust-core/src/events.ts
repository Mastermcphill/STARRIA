// ---------------------------------------------------------------------------
// trust-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  TrustScoreUpdatedEvent,
  TrustFlagRaisedEvent,
  TrustRestrictionSetEvent,
} from '@starria/domain-events';
import {
  TRUST_SCORE_UPDATED,
  TRUST_FLAG_RAISED,
  TRUST_RESTRICTION_SET,
} from '@starria/domain-events';
import type { TrustSignals, TrustRestriction, TrustFlagType } from './types';

export function buildTrustScoreUpdated(params: {
  userId: string;
  previousScore: number;
  newScore: number;
  signals: {
    moderationScore: number;
    fraudScore: number;
    spamScore: number;
    accountAgeDays: number;
    conversationQuality: number;
    creatorFeedback: number;
    paymentDisputes: number;
  };
  updatedAt: string;
}): TrustScoreUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: TRUST_SCORE_UPDATED,
    aggregateId: params.userId,
    aggregateType: 'TrustProfile',
    payload: params,
  });
}

export function buildTrustFlagRaised(params: {
  userId: string;
  flagType: TrustFlagType;
  raisedBy: string;
  raisedAt: string;
}): TrustFlagRaisedEvent {
  return createEvent({
    id: randomUUID(),
    type: TRUST_FLAG_RAISED,
    aggregateId: params.userId,
    aggregateType: 'TrustProfile',
    payload: params,
  });
}

export function buildTrustRestrictionSet(params: {
  userId: string;
  restriction: TrustRestriction;
  reason: string;
  expiresAt?: string;
  setAt: string;
}): TrustRestrictionSetEvent {
  return createEvent({
    id: randomUUID(),
    type: TRUST_RESTRICTION_SET,
    aggregateId: params.userId,
    aggregateType: 'TrustProfile',
    payload: params,
  });
}
