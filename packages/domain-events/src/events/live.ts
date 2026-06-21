// ---------------------------------------------------------------------------
// domain-events — live streaming events (Sprint 3)
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const LIVE_CREATED            = 'live.created';
export const LIVE_STARTED            = 'live.started';
export const LIVE_ENDED              = 'live.ended';
export const LIVE_PARTICIPANT_JOINED = 'live.participant.joined';
export const LIVE_PARTICIPANT_LEFT   = 'live.participant.left';
export const LIVE_PARTICIPANT_BANNED = 'live.participant.banned';
export const LIVE_GIFT_SENT          = 'live.gift.sent';
export const LIVE_REPLAY_PUBLISHED   = 'live.replay.published';

export type LiveRoomType = 'PUBLIC' | 'SUPPORTERS_ONLY' | 'TICKETED' | 'INVITE_ONLY';
export type LiveParticipantRole = 'HOST' | 'COHOST' | 'GUEST' | 'MODERATOR' | 'VIEWER';

export interface LiveCreatedPayload {
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly roomType: LiveRoomType;
  readonly title: string;
  readonly createdAt: string;
}

export interface LiveStartedPayload {
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly startedAt: string;
}

export interface LiveEndedPayload {
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly endedAt: string;
  readonly durationSeconds: number;
  readonly peakViewerCount: number;
  readonly totalGiftsSentCoins: number;
}

export interface LiveParticipantJoinedPayload {
  readonly participantId: string;
  readonly roomId: string;
  readonly userId: string;
  readonly role: LiveParticipantRole;
  readonly joinedAt: string;
}

export interface LiveParticipantLeftPayload {
  readonly participantId: string;
  readonly roomId: string;
  readonly userId: string;
  readonly leftAt: string;
  readonly watchSeconds: number;
}

export interface LiveParticipantBannedPayload {
  readonly roomId: string;
  readonly bannedUserId: string;
  readonly moderatorId: string;
  readonly reason?: string;
  readonly bannedAt: string;
}

export interface LiveGiftSentPayload {
  readonly giftId: string;
  readonly roomId: string;
  readonly eventId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly coins: number;
  readonly creatorAmount: number;
  readonly platformCut: number;
  readonly giftType: string;
  readonly sentAt: string;
}

export interface LiveReplayPublishedPayload {
  readonly replayId: string;
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly playbackUrl: string;
  readonly durationSeconds: number;
  readonly publishedAt: string;
}

export type LiveCreatedEvent          = DomainEvent<LiveCreatedPayload>;
export type LiveStartedEvent          = DomainEvent<LiveStartedPayload>;
export type LiveEndedEvent            = DomainEvent<LiveEndedPayload>;
export type LiveParticipantJoinedEvent = DomainEvent<LiveParticipantJoinedPayload>;
export type LiveParticipantLeftEvent   = DomainEvent<LiveParticipantLeftPayload>;
export type LiveParticipantBannedEvent = DomainEvent<LiveParticipantBannedPayload>;
export type LiveGiftSentEvent         = DomainEvent<LiveGiftSentPayload>;
export type LiveReplayPublishedEvent  = DomainEvent<LiveReplayPublishedPayload>;
