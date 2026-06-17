// ---------------------------------------------------------------------------
// arena-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  ArenaCreatedEvent,
  ArenaClosedEvent,
  ArenaParticipantJoinedEvent,
  ArenaParticipantLeftEvent,
  ArenaParticipantModeratedEvent,
} from '@starria/domain-events';
import {
  ARENA_CREATED,
  ARENA_CLOSED,
  ARENA_PARTICIPANT_JOINED,
  ARENA_PARTICIPANT_LEFT,
  ARENA_PARTICIPANT_MUTED,
  ARENA_PARTICIPANT_REMOVED,
  ARENA_PARTICIPANT_BANNED,
  ARENA_PARTICIPANT_PROMOTED,
  ARENA_PARTICIPANT_DEMOTED,
} from '@starria/domain-events';

export function buildArenaCreatedEvent(params: {
  arenaId: string; starId: string; name: string;
  accessMode: string; livekitRoom: string; createdAt: string;
}): ArenaCreatedEvent {
  return createEvent({ id: randomUUID(), type: ARENA_CREATED, aggregateId: params.arenaId, aggregateType: 'Arena', payload: params });
}

export function buildArenaClosedEvent(params: {
  arenaId: string; starId: string; closedAt: string; totalParticipantCount: number;
}): ArenaClosedEvent {
  return createEvent({ id: randomUUID(), type: ARENA_CLOSED, aggregateId: params.arenaId, aggregateType: 'Arena', payload: params });
}

export function buildParticipantJoinedEvent(params: {
  participantId: string; arenaId: string; userId: string; role: string; joinedAt: string;
}): ArenaParticipantJoinedEvent {
  return createEvent({ id: randomUUID(), type: ARENA_PARTICIPANT_JOINED, aggregateId: params.participantId, aggregateType: 'ArenaParticipant', payload: params });
}

export function buildParticipantLeftEvent(params: {
  participantId: string; arenaId: string; userId: string; leftAt: string; durationSeconds: number;
}): ArenaParticipantLeftEvent {
  return createEvent({ id: randomUUID(), type: ARENA_PARTICIPANT_LEFT, aggregateId: params.participantId, aggregateType: 'ArenaParticipant', payload: params });
}

const MODERATION_TYPE_MAP: Record<string, string> = {
  mute: ARENA_PARTICIPANT_MUTED,
  unmute: ARENA_PARTICIPANT_MUTED,
  remove: ARENA_PARTICIPANT_REMOVED,
  ban: ARENA_PARTICIPANT_BANNED,
  promote: ARENA_PARTICIPANT_PROMOTED,
  demote: ARENA_PARTICIPANT_DEMOTED,
};

export function buildParticipantModeratedEvent(params: {
  recordId: string; arenaId: string; moderatorId: string;
  targetUserId: string; action: string; reason?: string; expiresAt?: string;
}): ArenaParticipantModeratedEvent {
  const eventType = MODERATION_TYPE_MAP[params.action] ?? ARENA_PARTICIPANT_REMOVED;
  return createEvent({ id: randomUUID(), type: eventType, aggregateId: params.recordId, aggregateType: 'ArenaModerationRecord', payload: params });
}
