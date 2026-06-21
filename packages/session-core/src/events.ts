// ---------------------------------------------------------------------------
// session-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  SESSION_BOOKED,
  SESSION_STARTED,
  SESSION_EXTENDED,
  SESSION_ENDED,
  SESSION_CANCELLED,
  SESSION_PAYOUT_SETTLED,
  PARTICIPANT_INVITED,
  PARTICIPANT_JOINED,
  PARTICIPANT_LEFT,
  PANIC_LEAVE_TRIGGERED,
  SESSION_FLAGGED,
} from '@starria/domain-events';
import type {
  SessionBookedEvent,
  SessionStartedEvent,
  SessionExtendedEvent,
  SessionEndedEvent,
  SessionCancelledEvent,
  SessionPayoutSettledEvent,
  ParticipantInvitedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  PanicLeaveTriggeredEvent,
  SessionFlaggedEvent,
  SessionType,
} from '@starria/domain-events';
import type { PayoutSplit } from './types';

export function buildSessionBooked(params: {
  sessionId: string;
  bookingId: string;
  companionId: string;
  patronId: string;
  sessionType: SessionType;
  durationMinutes: number;
  coinCost: number;
  escrowedCoins: number;
  scheduledAt: string;
  bookedAt: string;
}): SessionBookedEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_BOOKED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionStarted(params: {
  sessionId: string;
  companionId: string;
  startedAt: string;
  durationMinutes: number;
  endsAt: string;
}): SessionStartedEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_STARTED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionExtended(params: {
  sessionId: string;
  addedMinutes: number;
  additionalCoins: number;
  newEndsAt: string;
  extendedAt: string;
}): SessionExtendedEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_EXTENDED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionEnded(params: {
  sessionId: string;
  companionId: string;
  actualDurationMinutes: number;
  totalCoinsEarned: number;
  endedAt: string;
}): SessionEndedEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_ENDED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionCancelled(params: {
  sessionId: string;
  cancelledBy: string;
  reason?: string;
  refundCoins: number;
  cancelledAt: string;
}): SessionCancelledEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_CANCELLED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionPayoutSettled(params: {
  sessionId: string;
  companionId: string;
  grossCoins: number;
  platformFeeCoins: number;
  netCoins: number;
  splits: PayoutSplit[];
  settledAt: string;
}): SessionPayoutSettledEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_PAYOUT_SETTLED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildParticipantInvited(params: {
  sessionId: string;
  invitedUserId: string;
  invitedBy: string;
  role: 'GUEST' | 'CO_HOST';
  invitedAt: string;
}): ParticipantInvitedEvent {
  return createEvent({
    id: randomUUID(),
    type: PARTICIPANT_INVITED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildParticipantJoined(params: {
  sessionId: string;
  userId: string;
  joinedAt: string;
}): ParticipantJoinedEvent {
  return createEvent({
    id: randomUUID(),
    type: PARTICIPANT_JOINED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildParticipantLeft(params: {
  sessionId: string;
  userId: string;
  leftAt: string;
  watchSeconds: number;
}): ParticipantLeftEvent {
  return createEvent({
    id: randomUUID(),
    type: PARTICIPANT_LEFT,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildPanicLeave(params: {
  userId: string;
  sessionId: string;
  triggeredAt: string;
}): PanicLeaveTriggeredEvent {
  return createEvent({
    id: randomUUID(),
    type: PANIC_LEAVE_TRIGGERED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}

export function buildSessionFlagged(params: {
  sessionId: string;
  flaggedBy: string;
  reason: string;
  flaggedAt: string;
}): SessionFlaggedEvent {
  return createEvent({
    id: randomUUID(),
    type: SESSION_FLAGGED,
    aggregateId: params.sessionId,
    aggregateType: 'Session',
    payload: params,
  });
}
