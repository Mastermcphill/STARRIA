// ---------------------------------------------------------------------------
// domain-events — Sprint 5 Trust System events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const TRUST_SCORE_UPDATED    = 'trust.score.updated';
export const TRUST_FLAG_RAISED      = 'trust.flag.raised';
export const TRUST_RESTRICTION_SET  = 'trust.restriction.set';

export interface TrustScoreUpdatedPayload {
  readonly userId: string;
  readonly previousScore: number;
  readonly newScore: number;
  readonly signals: {
    moderationScore: number;
    fraudScore: number;
    spamScore: number;
    accountAgeDays: number;
    conversationQuality: number;
    creatorFeedback: number;
    paymentDisputes: number;
  };
  readonly updatedAt: string;
}

export interface TrustFlagRaisedPayload {
  readonly userId: string;
  readonly flagType: 'SPAM' | 'FRAUD' | 'ABUSE' | 'PAYMENT_DISPUTE';
  readonly raisedBy: string;
  readonly raisedAt: string;
}

export interface TrustRestrictionSetPayload {
  readonly userId: string;
  readonly restriction: 'MESSAGING_BLOCKED' | 'PATRON_INELIGIBLE' | 'SHADOW_RESTRICTED';
  readonly reason: string;
  readonly expiresAt?: string;
  readonly setAt: string;
}

export type TrustScoreUpdatedEvent   = DomainEvent<TrustScoreUpdatedPayload>;
export type TrustFlagRaisedEvent     = DomainEvent<TrustFlagRaisedPayload>;
export type TrustRestrictionSetEvent = DomainEvent<TrustRestrictionSetPayload>;
