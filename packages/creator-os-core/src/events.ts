// ---------------------------------------------------------------------------
// creator-os-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  CreatorOnboardedEvent,
  CreatorSettingsUpdatedEvent,
  CreatorPayoutConfiguredEvent,
  CreatorDeactivatedEvent,
  CreatorReactivatedEvent,
} from '@starria/domain-events';
import {
  CREATOR_ONBOARDED,
  CREATOR_SETTINGS_UPDATED,
  CREATOR_PAYOUT_CONFIGURED,
  CREATOR_DEACTIVATED,
  CREATOR_REACTIVATED,
} from '@starria/domain-events';

export function buildCreatorOnboardedEvent(params: {
  creatorId: string; userId: string; starId: string;
  onboardedAt: string; onboardingVersion: string;
}): CreatorOnboardedEvent {
  return createEvent({ id: randomUUID(), type: CREATOR_ONBOARDED, aggregateId: params.creatorId, aggregateType: 'Creator', payload: params });
}

export function buildCreatorSettingsUpdatedEvent(params: {
  creatorId: string; starId: string; changedFields: string[]; updatedAt: string;
}): CreatorSettingsUpdatedEvent {
  return createEvent({ id: randomUUID(), type: CREATOR_SETTINGS_UPDATED, aggregateId: params.creatorId, aggregateType: 'Creator', payload: params });
}

export function buildCreatorPayoutConfiguredEvent(params: {
  creatorId: string; starId: string; payoutMethod: string; configuredAt: string;
}): CreatorPayoutConfiguredEvent {
  return createEvent({ id: randomUUID(), type: CREATOR_PAYOUT_CONFIGURED, aggregateId: params.creatorId, aggregateType: 'Creator', payload: params });
}

export function buildCreatorDeactivatedEvent(params: {
  creatorId: string; starId: string; reason: string;
  deactivatedAt: string; deactivatedBy: string;
}): CreatorDeactivatedEvent {
  return createEvent({ id: randomUUID(), type: CREATOR_DEACTIVATED, aggregateId: params.creatorId, aggregateType: 'Creator', payload: params });
}

export function buildCreatorReactivatedEvent(params: {
  creatorId: string; starId: string; reactivatedAt: string; reactivatedBy: string;
}): CreatorReactivatedEvent {
  return createEvent({ id: randomUUID(), type: CREATOR_REACTIVATED, aggregateId: params.creatorId, aggregateType: 'Creator', payload: params });
}
