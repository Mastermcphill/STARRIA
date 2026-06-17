// ---------------------------------------------------------------------------
// domain-events — event-core events (EventRecord lifecycle)
// Prefixed `starria.event.*` to avoid collision with the JS `Event` built-in.
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const STARRIA_EVENT_CREATED          = 'starria.event.created';
export const STARRIA_EVENT_SCHEDULED        = 'starria.event.scheduled';
export const STARRIA_EVENT_STARTED          = 'starria.event.started';
export const STARRIA_EVENT_ENDED            = 'starria.event.ended';
export const STARRIA_EVENT_CANCELLED        = 'starria.event.cancelled';
export const STARRIA_EVENT_REPLAY_PUBLISHED = 'starria.event.replay.published';
export const STARRIA_EVENT_VIEWER_JOINED    = 'starria.event.viewer.joined';
export const STARRIA_EVENT_VIEWER_LEFT      = 'starria.event.viewer.left';

export interface StarriaEventCreatedPayload {
  readonly eventId: string;
  readonly starId: string;
  readonly arenaId?: string;
  readonly title: string;
  readonly type: string;
  readonly visibility: string;
  readonly scheduledAt?: string;
}

export interface StarriaEventScheduledPayload {
  readonly eventId: string;
  readonly starId: string;
  readonly scheduledAt: string;
}

export interface StarriaEventStartedPayload {
  readonly eventId: string;
  readonly starId: string;
  readonly arenaId?: string;
  readonly startedAt: string;
}

export interface StarriaEventEndedPayload {
  readonly eventId: string;
  readonly starId: string;
  readonly endedAt: string;
  readonly durationSeconds?: number;
  readonly peakViewerCount: number;
  readonly totalViewerCount: number;
  readonly tapCount: number;
}

export interface StarriaEventCancelledPayload {
  readonly eventId: string;
  readonly starId: string;
  readonly cancelledAt: string;
}

export interface ReplayPublishedPayload {
  readonly replayId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly playbackUrl: string;
  readonly durationSeconds?: number;
}

export interface ViewerJoinedPayload {
  readonly sessionId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly joinedAt: string;
}

export interface ViewerLeftPayload {
  readonly sessionId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly leftAt: string;
  readonly watchSeconds: number;
}

export type StarriaEventCreatedEvent      = DomainEvent<StarriaEventCreatedPayload>;
export type StarriaEventScheduledEvent    = DomainEvent<StarriaEventScheduledPayload>;
export type StarriaEventStartedEvent      = DomainEvent<StarriaEventStartedPayload>;
export type StarriaEventEndedEvent        = DomainEvent<StarriaEventEndedPayload>;
export type StarriaEventCancelledEvent    = DomainEvent<StarriaEventCancelledPayload>;
export type ReplayPublishedEvent          = DomainEvent<ReplayPublishedPayload>;
export type ViewerJoinedEvent             = DomainEvent<ViewerJoinedPayload>;
export type ViewerLeftEvent               = DomainEvent<ViewerLeftPayload>;
