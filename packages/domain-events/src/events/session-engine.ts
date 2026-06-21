// ---------------------------------------------------------------------------
// domain-events — Session Engine events (Sprint 7)
// Unified room engine: rooms, participants, billing, moderation, recording.
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

// ── Room type taxonomy ─────────────────────────────────────────────────────────

export type SessionRoomType =
  | 'LIVE_EVENT'
  | 'COMPANION_AUDIO'
  | 'COMPANION_VIDEO'
  | 'SUPPORTER_ROOM'
  | 'CREATOR_QA'
  | 'RAP_BATTLE'
  | 'SING_OFF'
  | 'YAP_BATTLE'
  | 'AI_PREMIERE'
  | 'PRIVATE_ROOM';

export type SessionRoomStatus =
  | 'CREATED'
  | 'OPEN'
  | 'LIVE'
  | 'PAUSED'
  | 'ENDED'
  | 'CANCELLED';

export type SessionRoomRole = 'HOST' | 'CO_HOST' | 'PERFORMER' | 'GUEST' | 'VIEWER' | 'MODERATOR';

// ── Event type constants ────────────────────────────────────────────────────────

export const SESSION_ROOM_CREATED      = 'session-engine.room.created';
export const SESSION_ROOM_OPENED       = 'session-engine.room.opened';
export const SESSION_ROOM_STARTED      = 'session-engine.room.started';
export const SESSION_ROOM_PAUSED       = 'session-engine.room.paused';
export const SESSION_ROOM_ENDED        = 'session-engine.room.ended';
export const SESSION_ROOM_CANCELLED    = 'session-engine.room.cancelled';

export const SESSION_PARTICIPANT_JOINED   = 'session-engine.participant.joined';
export const SESSION_PARTICIPANT_LEFT     = 'session-engine.participant.left';
export const SESSION_PARTICIPANT_INVITED  = 'session-engine.participant.invited';
export const SESSION_PARTICIPANT_PROMOTED = 'session-engine.participant.promoted';
export const SESSION_PARTICIPANT_REMOVED  = 'session-engine.participant.removed';

export const SESSION_BILLING_CHARGED    = 'session-engine.billing.charged';
export const SESSION_BILLING_SETTLED    = 'session-engine.billing.settled';

export const SESSION_MODERATION_FLAGGED = 'session-engine.moderation.flagged';
export const SESSION_MODERATION_ACTIONED = 'session-engine.moderation.actioned';

export const SESSION_RECORDING_STARTED  = 'session-engine.recording.started';
export const SESSION_RECORDING_STOPPED  = 'session-engine.recording.stopped';

// ── Payloads ────────────────────────────────────────────────────────────────────

export interface SessionRoomCreatedPayload {
  readonly roomId: string;
  readonly roomType: SessionRoomType;
  readonly hostId: string;
  readonly title: string;
  readonly maxParticipants: number;
  readonly livekitRoomName: string;
  readonly billingMode: string;
  readonly createdAt: string;
}

export interface SessionRoomLifecyclePayload {
  readonly roomId: string;
  readonly roomType: SessionRoomType;
  readonly status: SessionRoomStatus;
  readonly at: string;
  readonly reason?: string;
}

export interface SessionParticipantPayload {
  readonly roomId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly role: SessionRoomRole;
  readonly at: string;
}

export interface SessionBillingPayload {
  readonly roomId: string;
  readonly userId: string;
  readonly coins: number;
  readonly reason: string;
  readonly at: string;
}

export interface SessionModerationPayload {
  readonly roomId: string;
  readonly targetUserId: string;
  readonly actorId: string;
  readonly action: string;
  readonly reason?: string;
  readonly at: string;
}

export interface SessionRecordingPayload {
  readonly roomId: string;
  readonly recordingId: string;
  readonly egressId?: string;
  readonly at: string;
}

// ── Typed events ────────────────────────────────────────────────────────────────

export type SessionRoomCreatedEvent     = DomainEvent<SessionRoomCreatedPayload>;
export type SessionRoomLifecycleEvent   = DomainEvent<SessionRoomLifecyclePayload>;
export type SessionParticipantEvent     = DomainEvent<SessionParticipantPayload>;
export type SessionBillingEvent         = DomainEvent<SessionBillingPayload>;
export type SessionModerationEvent      = DomainEvent<SessionModerationPayload>;
export type SessionRecordingEvent       = DomainEvent<SessionRecordingPayload>;
