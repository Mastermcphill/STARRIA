// ---------------------------------------------------------------------------
// trust-core — domain types
// Composite 0–100 trust score from 7 behavioural signals
// ---------------------------------------------------------------------------

export type TrustRestriction = 'MESSAGING_BLOCKED' | 'PATRON_INELIGIBLE' | 'SHADOW_RESTRICTED';
export type TrustFlagType    = 'SPAM' | 'FRAUD' | 'ABUSE' | 'PAYMENT_DISPUTE';

// ── TrustProfile ─────────────────────────────────────────────────────────────

export interface TrustProfile {
  readonly userId: string;
  /** Composite trust score 0–100 */
  readonly score: number;
  readonly signals: TrustSignals;
  readonly restrictions: TrustRestriction[];
  readonly flags: TrustFlag[];
  readonly updatedAt: string;
}

export interface TrustSignals {
  /** 0–100; 100 = zero moderation actions. Decreases per strike */
  readonly moderationScore: number;
  /** 0–100; 100 = no fraud signals detected */
  readonly fraudScore: number;
  /** 0–100; 100 = no spam detected */
  readonly spamScore: number;
  /** Account age in days; capped contribution at 365 days */
  readonly accountAgeDays: number;
  /** 0–100; rated quality of sent conversations */
  readonly conversationQuality: number;
  /** 0–100; aggregate feedback from creators who received messages */
  readonly creatorFeedback: number;
  /** Count of payment disputes raised */
  readonly paymentDisputes: number;
}

export interface TrustFlag {
  readonly id: string;
  readonly userId: string;
  readonly flagType: TrustFlagType;
  readonly raisedBy: string;
  readonly raisedAt: string;
}

export interface TrustRestrictionRecord {
  readonly id: string;
  readonly userId: string;
  readonly restriction: TrustRestriction;
  readonly reason: string;
  readonly expiresAt?: string;
  readonly setAt: string;
}

// ── Score formula ─────────────────────────────────────────────────────────────

/**
 * Composite trust score — 0 to 100.
 *
 * Weights:
 *   moderationScore    × 0.25
 *   fraudScore         × 0.20
 *   spamScore          × 0.15
 *   accountAge (norm)  × 0.15   (capped at 365 days → contribution 0–15)
 *   conversationQuality× 0.10
 *   creatorFeedback    × 0.10
 *   paymentDisputes    × 0.05   (each dispute subtracts from max 5 pts)
 */
export function calculateTrustScore(signals: TrustSignals): number {
  const ageNorm = Math.min(signals.accountAgeDays / 365, 1) * 100;
  const disputePenalty = Math.min(signals.paymentDisputes * 20, 100);
  const disputeScore   = Math.max(0, 100 - disputePenalty);

  const raw =
    signals.moderationScore    * 0.25 +
    signals.fraudScore         * 0.20 +
    signals.spamScore          * 0.15 +
    ageNorm                    * 0.15 +
    signals.conversationQuality* 0.10 +
    signals.creatorFeedback    * 0.10 +
    disputeScore               * 0.05;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ── Restriction thresholds ────────────────────────────────────────────────────

/** Score below which restrictions auto-apply */
export const RESTRICTION_THRESHOLDS: Record<TrustRestriction, number> = {
  MESSAGING_BLOCKED:   20,
  PATRON_INELIGIBLE:   30,
  SHADOW_RESTRICTED:   40,
};

export function resolveAutoRestrictions(score: number): TrustRestriction[] {
  return (Object.keys(RESTRICTION_THRESHOLDS) as TrustRestriction[]).filter(
    r => score <= RESTRICTION_THRESHOLDS[r],
  );
}

// ── Persistence ports ─────────────────────────────────────────────────────────

export interface TrustStorePort {
  find(userId: string): Promise<TrustProfile | null>;
  upsert(profile: TrustProfile): Promise<TrustProfile>;

  appendFlag(flag: Omit<TrustFlag, 'id'>): Promise<TrustFlag>;
  getFlags(userId: string): Promise<TrustFlag[]>;

  appendRestriction(rec: Omit<TrustRestrictionRecord, 'id'>): Promise<TrustRestrictionRecord>;
  getRestrictions(userId: string): Promise<TrustRestrictionRecord[]>;
}

// ── Service I/O ───────────────────────────────────────────────────────────────

export interface UpdateSignalsInput {
  readonly userId: string;
  readonly signals: Partial<TrustSignals>;
}

export interface RaiseFlagInput {
  readonly userId: string;
  readonly flagType: TrustFlagType;
  readonly raisedBy: string;
}

export interface SetRestrictionInput {
  readonly userId: string;
  readonly restriction: TrustRestriction;
  readonly reason: string;
  readonly expiresAt?: string;
}

export interface TrustEligibility {
  readonly canMessage: boolean;
  readonly canBePatron: boolean;
  readonly isShadowRestricted: boolean;
  readonly score: number;
}
