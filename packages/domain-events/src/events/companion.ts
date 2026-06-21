// ---------------------------------------------------------------------------
// domain-events — Sprint 6 Companion Economy events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

// ── Companion Profile ─────────────────────────────────────────────────────────

export const COMPANION_PROFILE_CREATED  = 'companion.profile.created';
export const COMPANION_PROFILE_UPDATED  = 'companion.profile.updated';
export const COMPANION_VERIFIED         = 'companion.verified';
export const COMPANION_SUSPENDED        = 'companion.suspended';

export interface CompanionProfileCreatedPayload {
  readonly companionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly createdAt: string;
}

export interface CompanionVerifiedPayload {
  readonly companionId: string;
  readonly verificationType: 'IDENTITY' | 'AGE' | 'BOTH';
  readonly verifiedAt: string;
}

export interface CompanionSuspendedPayload {
  readonly companionId: string;
  readonly reason: string;
  readonly suspendedAt: string;
  readonly expiresAt?: string;
}

export type CompanionProfileCreatedEvent = DomainEvent<CompanionProfileCreatedPayload>;
export type CompanionVerifiedEvent       = DomainEvent<CompanionVerifiedPayload>;
export type CompanionSuspendedEvent      = DomainEvent<CompanionSuspendedPayload>;

// ── Age Gate ──────────────────────────────────────────────────────────────────

export const AGE_GATE_PASSED    = 'age_gate.passed';
export const AGE_GATE_FAILED    = 'age_gate.failed';
export const CONSENT_RECORDED   = 'age_gate.consent.recorded';

export type AgeGateLevel = '18+' | '21+';

export interface AgeGatePassedPayload {
  readonly userId: string;
  readonly level: AgeGateLevel;
  readonly verificationMethod: 'SELF_DECLARE' | 'DOCUMENT' | 'BIOMETRIC';
  readonly passedAt: string;
}

export interface AgeGateFailedPayload {
  readonly userId: string;
  readonly level: AgeGateLevel;
  readonly reason: string;
  readonly failedAt: string;
}

export interface ConsentRecordedPayload {
  readonly userId: string;
  readonly consentType: 'COMPANION_DISCOVERY' | 'ADULT_CONTENT' | 'SESSION_RECORDING';
  readonly granted: boolean;
  readonly recordedAt: string;
  readonly ipAddress?: string;
}

export type AgeGatePassedEvent   = DomainEvent<AgeGatePassedPayload>;
export type AgeGateFailedEvent   = DomainEvent<AgeGateFailedPayload>;
export type ConsentRecordedEvent = DomainEvent<ConsentRecordedPayload>;

// ── Session ───────────────────────────────────────────────────────────────────

export const SESSION_BOOKED     = 'session.booked';
export const SESSION_STARTED    = 'session.started';
export const SESSION_EXTENDED   = 'session.extended';
export const SESSION_ENDED      = 'session.ended';
export const SESSION_CANCELLED  = 'session.cancelled';
export const SESSION_PAYOUT_SETTLED = 'session.payout.settled';
export const PARTICIPANT_INVITED    = 'session.participant.invited';
export const PARTICIPANT_JOINED     = 'session.participant.joined';
export const PARTICIPANT_LEFT       = 'session.participant.left';

export type SessionType = 'AUDIO' | 'VIDEO' | 'GROUP' | 'PRIVATE' | 'SUPPORTER_ONLY';

export interface SessionBookedPayload {
  readonly sessionId: string;
  readonly bookingId: string;
  readonly companionId: string;
  readonly patronId: string;
  readonly sessionType: SessionType;
  readonly durationMinutes: number;
  readonly coinCost: number;
  readonly escrowedCoins: number;
  readonly scheduledAt: string;
  readonly bookedAt: string;
}

export interface SessionStartedPayload {
  readonly sessionId: string;
  readonly companionId: string;
  readonly startedAt: string;
  readonly durationMinutes: number;
  readonly endsAt: string;
}

export interface SessionExtendedPayload {
  readonly sessionId: string;
  readonly addedMinutes: number;
  readonly additionalCoins: number;
  readonly newEndsAt: string;
  readonly extendedAt: string;
}

export interface SessionEndedPayload {
  readonly sessionId: string;
  readonly companionId: string;
  readonly actualDurationMinutes: number;
  readonly totalCoinsEarned: number;
  readonly endedAt: string;
}

export interface SessionCancelledPayload {
  readonly sessionId: string;
  readonly cancelledBy: string;
  readonly reason?: string;
  readonly refundCoins: number;
  readonly cancelledAt: string;
}

export interface SessionPayoutSettledPayload {
  readonly sessionId: string;
  readonly companionId: string;
  readonly grossCoins: number;
  readonly platformFeeCoins: number;
  readonly netCoins: number;
  readonly splits: Array<{ userId: string; coins: number; pct: number }>;
  readonly settledAt: string;
}

export interface ParticipantInvitedPayload {
  readonly sessionId: string;
  readonly invitedUserId: string;
  readonly invitedBy: string;
  readonly role: 'GUEST' | 'CO_HOST';
  readonly invitedAt: string;
}

export interface ParticipantJoinedPayload {
  readonly sessionId: string;
  readonly userId: string;
  readonly joinedAt: string;
}

export interface ParticipantLeftPayload {
  readonly sessionId: string;
  readonly userId: string;
  readonly leftAt: string;
  readonly watchSeconds: number;
}

export type SessionBookedEvent          = DomainEvent<SessionBookedPayload>;
export type SessionStartedEvent         = DomainEvent<SessionStartedPayload>;
export type SessionExtendedEvent        = DomainEvent<SessionExtendedPayload>;
export type SessionEndedEvent           = DomainEvent<SessionEndedPayload>;
export type SessionCancelledEvent       = DomainEvent<SessionCancelledPayload>;
export type SessionPayoutSettledEvent   = DomainEvent<SessionPayoutSettledPayload>;
export type ParticipantInvitedEvent     = DomainEvent<ParticipantInvitedPayload>;
export type ParticipantJoinedEvent      = DomainEvent<ParticipantJoinedPayload>;
export type ParticipantLeftEvent        = DomainEvent<ParticipantLeftPayload>;

// ── Loneliness / Recommendation ───────────────────────────────────────────────

export const LONELINESS_PROFILE_UPDATED    = 'loneliness.profile.updated';
export const COMPANION_RECOMMENDATION_SENT = 'loneliness.recommendation.sent';

export interface LonelinessProfileUpdatedPayload {
  readonly userId: string;
  readonly score: number;        // 0–100; higher = more signal. Never exposed publicly.
  readonly signals: {
    inactiveChatDays: number;
    lowEngagementDays: number;
    recentSupportLoss: boolean;
    selfSelectedPreference: boolean;
    lowSocialActivityScore: number;
  };
  readonly updatedAt: string;
}

export interface CompanionRecommendationSentPayload {
  readonly userId: string;
  readonly recommendedCompanionIds: string[];
  readonly reason: 'LONELINESS_SIGNAL' | 'ACTIVITY_MATCH' | 'AVAILABILITY';
  readonly sentAt: string;
}

export type LonelinessProfileUpdatedEvent    = DomainEvent<LonelinessProfileUpdatedPayload>;
export type CompanionRecommendationSentEvent = DomainEvent<CompanionRecommendationSentPayload>;

// ── Safety ────────────────────────────────────────────────────────────────────

export const COMPANION_BLOCKED        = 'companion.safety.blocked';
export const COMPANION_REPORTED       = 'companion.safety.reported';
export const PANIC_LEAVE_TRIGGERED    = 'companion.safety.panic_leave';
export const SESSION_FLAGGED          = 'companion.safety.session_flagged';

export interface CompanionBlockedPayload {
  readonly blockerId: string;
  readonly blockedId: string;
  readonly blockedAt: string;
}

export interface CompanionReportedPayload {
  readonly reporterId: string;
  readonly reportedId: string;
  readonly sessionId?: string;
  readonly reason: string;
  readonly reportedAt: string;
}

export interface PanicLeaveTriggeredPayload {
  readonly userId: string;
  readonly sessionId: string;
  readonly triggeredAt: string;
}

export interface SessionFlaggedPayload {
  readonly sessionId: string;
  readonly flaggedBy: string;
  readonly reason: string;
  readonly flaggedAt: string;
}

export type CompanionBlockedEvent     = DomainEvent<CompanionBlockedPayload>;
export type CompanionReportedEvent    = DomainEvent<CompanionReportedPayload>;
export type PanicLeaveTriggeredEvent  = DomainEvent<PanicLeaveTriggeredPayload>;
export type SessionFlaggedEvent       = DomainEvent<SessionFlaggedPayload>;
