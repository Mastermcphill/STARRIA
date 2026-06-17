// ---------------------------------------------------------------------------
// event-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  StarriaEventCreatedEvent,
  StarriaEventScheduledEvent,
  StarriaEventStartedEvent,
  StarriaEventEndedEvent,
  StarriaEventCancelledEvent,
  ReplayPublishedEvent,
  ViewerJoinedEvent,
  ViewerLeftEvent,
} from '@starria/domain-events';
import {
  STARRIA_EVENT_CREATED,
  STARRIA_EVENT_SCHEDULED,
  STARRIA_EVENT_STARTED,
  STARRIA_EVENT_ENDED,
  STARRIA_EVENT_CANCELLED,
  STARRIA_EVENT_REPLAY_PUBLISHED,
  STARRIA_EVENT_VIEWER_JOINED,
  STARRIA_EVENT_VIEWER_LEFT,
} from '@starria/domain-events';

export function buildStarriaEventCreatedEvent(params: {
  eventId: string; starId: string; arenaId?: string; title: string;
  type: string; visibility: string; scheduledAt?: string;
}): StarriaEventCreatedEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_CREATED, aggregateId: params.eventId, aggregateType: 'StarriaEvent', payload: params });
}

export function buildStarriaEventScheduledEvent(params: {
  eventId: string; starId: string; scheduledAt: string;
}): StarriaEventScheduledEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_SCHEDULED, aggregateId: params.eventId, aggregateType: 'StarriaEvent', payload: params });
}

export function buildStarriaEventStartedEvent(params: {
  eventId: string; starId: string; arenaId?: string; startedAt: string;
}): StarriaEventStartedEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_STARTED, aggregateId: params.eventId, aggregateType: 'StarriaEvent', payload: params });
}

export function buildStarriaEventEndedEvent(params: {
  eventId: string; starId: string; endedAt: string; durationSeconds?: number;
  peakViewerCount: number; totalViewerCount: number; tapCount: number;
}): StarriaEventEndedEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_ENDED, aggregateId: params.eventId, aggregateType: 'StarriaEvent', payload: params });
}

export function buildStarriaEventCancelledEvent(params: {
  eventId: string; starId: string; cancelledAt: string;
}): StarriaEventCancelledEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_CANCELLED, aggregateId: params.eventId, aggregateType: 'StarriaEvent', payload: params });
}

export function buildReplayPublishedEvent(params: {
  replayId: string; eventId: string; starId: string; playbackUrl: string; durationSeconds?: number;
}): ReplayPublishedEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_REPLAY_PUBLISHED, aggregateId: params.replayId, aggregateType: 'EventReplay', payload: params });
}

export function buildViewerJoinedEvent(params: {
  sessionId: string; eventId: string; userId: string; joinedAt: string;
}): ViewerJoinedEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_VIEWER_JOINED, aggregateId: params.sessionId, aggregateType: 'EventWatchSession', payload: params });
}

export function buildViewerLeftEvent(params: {
  sessionId: string; eventId: string; userId: string; leftAt: string; watchSeconds: number;
}): ViewerLeftEvent {
  return createEvent({ id: randomUUID(), type: STARRIA_EVENT_VIEWER_LEFT, aggregateId: params.sessionId, aggregateType: 'EventWatchSession', payload: params });
}
