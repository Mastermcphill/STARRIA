// ---------------------------------------------------------------------------
// session-engine-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  SessionRoomCreatedEvent,
  SessionRoomLifecycleEvent,
  SessionParticipantEvent,
  SessionBillingEvent,
  SessionModerationEvent,
  SessionRecordingEvent,
  SessionRoomCreatedPayload,
  SessionRoomLifecyclePayload,
  SessionParticipantPayload,
  SessionBillingPayload,
  SessionModerationPayload,
  SessionRecordingPayload,
} from '@starria/domain-events';
import {
  SESSION_ROOM_CREATED,
  SESSION_ROOM_OPENED,
  SESSION_ROOM_STARTED,
  SESSION_ROOM_PAUSED,
  SESSION_ROOM_ENDED,
  SESSION_ROOM_CANCELLED,
  SESSION_PARTICIPANT_JOINED,
  SESSION_PARTICIPANT_LEFT,
  SESSION_PARTICIPANT_INVITED,
  SESSION_PARTICIPANT_PROMOTED,
  SESSION_PARTICIPANT_REMOVED,
  SESSION_BILLING_CHARGED,
  SESSION_BILLING_SETTLED,
  SESSION_MODERATION_FLAGGED,
  SESSION_MODERATION_ACTIONED,
  SESSION_RECORDING_STARTED,
  SESSION_RECORDING_STOPPED,
} from '@starria/domain-events';

export function buildRoomCreated(payload: SessionRoomCreatedPayload): SessionRoomCreatedEvent {
  return createEvent({ id: randomUUID(), type: SESSION_ROOM_CREATED, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}

function lifecycle(type: string, payload: SessionRoomLifecyclePayload): SessionRoomLifecycleEvent {
  return createEvent({ id: randomUUID(), type, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}
export const buildRoomOpened    = (p: SessionRoomLifecyclePayload) => lifecycle(SESSION_ROOM_OPENED, p);
export const buildRoomStarted   = (p: SessionRoomLifecyclePayload) => lifecycle(SESSION_ROOM_STARTED, p);
export const buildRoomPaused    = (p: SessionRoomLifecyclePayload) => lifecycle(SESSION_ROOM_PAUSED, p);
export const buildRoomEnded     = (p: SessionRoomLifecyclePayload) => lifecycle(SESSION_ROOM_ENDED, p);
export const buildRoomCancelled = (p: SessionRoomLifecyclePayload) => lifecycle(SESSION_ROOM_CANCELLED, p);

function participant(type: string, payload: SessionParticipantPayload): SessionParticipantEvent {
  return createEvent({ id: randomUUID(), type, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}
export const buildParticipantJoined   = (p: SessionParticipantPayload) => participant(SESSION_PARTICIPANT_JOINED, p);
export const buildParticipantLeft     = (p: SessionParticipantPayload) => participant(SESSION_PARTICIPANT_LEFT, p);
export const buildParticipantInvited  = (p: SessionParticipantPayload) => participant(SESSION_PARTICIPANT_INVITED, p);
export const buildParticipantPromoted = (p: SessionParticipantPayload) => participant(SESSION_PARTICIPANT_PROMOTED, p);
export const buildParticipantRemoved  = (p: SessionParticipantPayload) => participant(SESSION_PARTICIPANT_REMOVED, p);

function billing(type: string, payload: SessionBillingPayload): SessionBillingEvent {
  return createEvent({ id: randomUUID(), type, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}
export const buildBillingCharged = (p: SessionBillingPayload) => billing(SESSION_BILLING_CHARGED, p);
export const buildBillingSettled = (p: SessionBillingPayload) => billing(SESSION_BILLING_SETTLED, p);

function moderation(type: string, payload: SessionModerationPayload): SessionModerationEvent {
  return createEvent({ id: randomUUID(), type, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}
export const buildModerationFlagged  = (p: SessionModerationPayload) => moderation(SESSION_MODERATION_FLAGGED, p);
export const buildModerationActioned = (p: SessionModerationPayload) => moderation(SESSION_MODERATION_ACTIONED, p);

function recording(type: string, payload: SessionRecordingPayload): SessionRecordingEvent {
  return createEvent({ id: randomUUID(), type, aggregateId: payload.roomId, aggregateType: 'SessionRoom', payload });
}
export const buildRecordingStarted = (p: SessionRecordingPayload) => recording(SESSION_RECORDING_STARTED, p);
export const buildRecordingStopped = (p: SessionRecordingPayload) => recording(SESSION_RECORDING_STOPPED, p);
