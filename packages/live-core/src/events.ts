// ---------------------------------------------------------------------------
// live-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  LIVE_CREATED, LIVE_STARTED, LIVE_ENDED,
  LIVE_PARTICIPANT_JOINED, LIVE_PARTICIPANT_LEFT, LIVE_PARTICIPANT_BANNED,
  LIVE_GIFT_SENT, LIVE_REPLAY_PUBLISHED,
} from '@starria/domain-events';
import type {
  LiveCreatedEvent, LiveStartedEvent, LiveEndedEvent,
  LiveParticipantJoinedEvent, LiveParticipantLeftEvent, LiveParticipantBannedEvent,
  LiveGiftSentEvent, LiveReplayPublishedEvent,
  LiveRoomType, LiveParticipantRole,
} from '@starria/domain-events';

export function buildLiveCreatedEvent(p: {
  roomId: string; eventId: string; starId: string;
  roomType: LiveRoomType; title: string;
}): LiveCreatedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_CREATED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, createdAt: new Date().toISOString() },
  });
}

export function buildLiveStartedEvent(p: {
  roomId: string; eventId: string; starId: string;
}): LiveStartedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_STARTED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, startedAt: new Date().toISOString() },
  });
}

export function buildLiveEndedEvent(p: {
  roomId: string; eventId: string; starId: string;
  durationSeconds: number; peakViewerCount: number; totalGiftsSentCoins: number;
}): LiveEndedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_ENDED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, endedAt: new Date().toISOString() },
  });
}

export function buildParticipantJoinedEvent(p: {
  participantId: string; roomId: string; userId: string; role: LiveParticipantRole;
}): LiveParticipantJoinedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_PARTICIPANT_JOINED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, joinedAt: new Date().toISOString() },
  });
}

export function buildParticipantLeftEvent(p: {
  participantId: string; roomId: string; userId: string; watchSeconds: number;
}): LiveParticipantLeftEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_PARTICIPANT_LEFT,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, leftAt: new Date().toISOString() },
  });
}

export function buildParticipantBannedEvent(p: {
  roomId: string; bannedUserId: string; moderatorId: string; reason?: string;
}): LiveParticipantBannedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_PARTICIPANT_BANNED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, bannedAt: new Date().toISOString() },
  });
}

export function buildLiveGiftSentEvent(p: {
  giftId: string; roomId: string; eventId: string;
  senderId: string; recipientId: string; coins: number;
  creatorAmount: number; platformCut: number; giftType: string;
}): LiveGiftSentEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_GIFT_SENT,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, sentAt: new Date().toISOString() },
  });
}

export function buildReplayPublishedEvent(p: {
  replayId: string; roomId: string; eventId: string; starId: string;
  playbackUrl: string; durationSeconds: number;
}): LiveReplayPublishedEvent {
  return createEvent({
    id: randomUUID(), type: LIVE_REPLAY_PUBLISHED,
    aggregateId: p.roomId, aggregateType: 'LiveRoom',
    payload: { ...p, publishedAt: new Date().toISOString() },
  });
}
