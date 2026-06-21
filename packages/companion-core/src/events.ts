// ---------------------------------------------------------------------------
// companion-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  COMPANION_PROFILE_CREATED,
  COMPANION_VERIFIED,
  COMPANION_SUSPENDED,
  COMPANION_BLOCKED,
  COMPANION_REPORTED,
} from '@starria/domain-events';
import type {
  CompanionProfileCreatedEvent,
  CompanionVerifiedEvent,
  CompanionSuspendedEvent,
  CompanionBlockedEvent,
  CompanionReportedEvent,
} from '@starria/domain-events';

export function buildCompanionProfileCreated(params: {
  companionId: string;
  userId: string;
  displayName: string;
  createdAt: string;
}): CompanionProfileCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: COMPANION_PROFILE_CREATED,
    aggregateId: params.companionId,
    aggregateType: 'CompanionProfile',
    payload: params,
  });
}

export function buildCompanionVerified(params: {
  companionId: string;
  verificationType: 'IDENTITY' | 'AGE' | 'BOTH';
  verifiedAt: string;
}): CompanionVerifiedEvent {
  return createEvent({
    id: randomUUID(),
    type: COMPANION_VERIFIED,
    aggregateId: params.companionId,
    aggregateType: 'CompanionProfile',
    payload: params,
  });
}

export function buildCompanionSuspended(params: {
  companionId: string;
  reason: string;
  suspendedAt: string;
  expiresAt?: string;
}): CompanionSuspendedEvent {
  return createEvent({
    id: randomUUID(),
    type: COMPANION_SUSPENDED,
    aggregateId: params.companionId,
    aggregateType: 'CompanionProfile',
    payload: params,
  });
}

export function buildCompanionBlocked(params: {
  blockerId: string;
  blockedId: string;
  blockedAt: string;
}): CompanionBlockedEvent {
  return createEvent({
    id: randomUUID(),
    type: COMPANION_BLOCKED,
    aggregateId: params.blockerId,
    aggregateType: 'CompanionBlock',
    payload: params,
  });
}

export function buildCompanionReported(params: {
  reporterId: string;
  reportedId: string;
  sessionId?: string;
  reason: string;
  reportedAt: string;
}): CompanionReportedEvent {
  return createEvent({
    id: randomUUID(),
    type: COMPANION_REPORTED,
    aggregateId: params.reportedId,
    aggregateType: 'CompanionProfile',
    payload: params,
  });
}
