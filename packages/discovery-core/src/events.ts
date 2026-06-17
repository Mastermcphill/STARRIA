// ---------------------------------------------------------------------------
// discovery-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  DiscoveryScoreUpdatedEvent,
  LocalTrendTriggeredEvent,
  GlobalTrendTriggeredEvent,
  ContentTapRecordedEvent,
  ContentTapRejectedEvent,
  RegionalBoostUpdatedEvent,
  ContentTapRejectReason,
  DiscoveryEntityType,
} from '@starria/domain-events';
import {
  DISCOVERY_SCORE_UPDATED,
  LOCAL_TREND_TRIGGERED,
  GLOBAL_TREND_TRIGGERED,
  CONTENT_TAP_RECORDED,
  CONTENT_TAP_REJECTED,
  REGIONAL_BOOST_UPDATED,
} from '@starria/domain-events';

export function buildDiscoveryScoreUpdatedEvent(params: {
  entityId: string;
  entityType: DiscoveryEntityType;
  previousScore: number;
  newScore: number;
}): DiscoveryScoreUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: DISCOVERY_SCORE_UPDATED,
    aggregateId: params.entityId,
    aggregateType: 'DiscoveryScore',
    payload: params,
  });
}

export function buildLocalTrendTriggeredEvent(params: {
  entityId: string;
  entityType: DiscoveryEntityType;
  region: string;
  score: number;
  rank: number;
}): LocalTrendTriggeredEvent {
  return createEvent({
    id: randomUUID(),
    type: LOCAL_TREND_TRIGGERED,
    aggregateId: params.entityId,
    aggregateType: 'TrendingScore',
    payload: { ...params, triggeredAt: new Date().toISOString() },
  });
}

export function buildGlobalTrendTriggeredEvent(params: {
  entityId: string;
  entityType: DiscoveryEntityType;
  score: number;
  rank: number;
}): GlobalTrendTriggeredEvent {
  return createEvent({
    id: randomUUID(),
    type: GLOBAL_TREND_TRIGGERED,
    aggregateId: params.entityId,
    aggregateType: 'TrendingScore',
    payload: { ...params, triggeredAt: new Date().toISOString() },
  });
}

export function buildContentTapRecordedEvent(params: {
  tapId: string;
  userId: string;
  videoId: string;
  starProfileId: string;
  weight: number;
  region: string;
  country?: string;
}): ContentTapRecordedEvent {
  return createEvent({
    id: randomUUID(),
    type: CONTENT_TAP_RECORDED,
    aggregateId: params.tapId,
    aggregateType: 'ContentTap',
    payload: { ...params, recordedAt: new Date().toISOString() },
  });
}

export function buildContentTapRejectedEvent(params: {
  userId: string;
  videoId: string;
  reason: ContentTapRejectReason;
}): ContentTapRejectedEvent {
  return createEvent({
    id: randomUUID(),
    type: CONTENT_TAP_REJECTED,
    aggregateId: params.videoId,
    aggregateType: 'ContentTap',
    payload: { ...params, rejectedAt: new Date().toISOString() },
  });
}

export function buildRegionalBoostUpdatedEvent(params: {
  videoId: string;
  region: string;
  previousBoost: number;
  newBoost: number;
  tapCount: number;
}): RegionalBoostUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: REGIONAL_BOOST_UPDATED,
    aggregateId: params.videoId,
    aggregateType: 'RegionalTapBoost',
    payload: { ...params, updatedAt: new Date().toISOString() },
  });
}
