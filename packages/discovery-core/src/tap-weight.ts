// ---------------------------------------------------------------------------
// discovery-core — tap weight + anti-spam validation (pure)
//
//   tap_weight = trust_score × account_age × geo_diversity × engagement_quality
//
// All factors are normalised; the product is the contribution a single tap
// makes to a video's regional boost and discovery score.
// ---------------------------------------------------------------------------

/** Hard cap on taps a single user may contribute to one video. */
export const MAX_TAPS_PER_USER_VIDEO = 10_000;

/** Minimum trust score required for a tap to be accepted at all. */
export const MIN_TRUST_SCORE = 0.1;

/** Account age (days) at which the age factor reaches its maximum. */
export const ACCOUNT_AGE_MATURITY_DAYS = 30;

export interface TapWeightFactors {
  /** 0..1 — reputation / fraud-inverse signal for the tapping user. */
  readonly trustScore: number;
  /** Age of the tapping account in days. */
  readonly accountAgeDays: number;
  /** ~0.8..1.3 — geo-diversity multiplier (see geo-core.geoDiversityMultiplier). */
  readonly geoDiversity: number;
  /** 0..1 — engagement quality (e.g. watch retention for this video). */
  readonly engagementQuality: number;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Account-age factor in [0, 1]: linear ramp to maturity, then flat at 1. */
export function accountAgeFactor(accountAgeDays: number): number {
  if (accountAgeDays <= 0) return 0;
  return Math.min(1, accountAgeDays / ACCOUNT_AGE_MATURITY_DAYS);
}

/**
 * Compute the weight of a single tap. Returns a non-negative float, typically
 * in [0, ~1.3]. A perfectly trusted, mature, engaged user tapping from an
 * under-represented region produces the highest weight.
 */
export function computeTapWeight(factors: TapWeightFactors): number {
  const trust = clamp01(factors.trustScore);
  const age = accountAgeFactor(factors.accountAgeDays);
  const geo = Math.max(0, factors.geoDiversity);
  const engagement = clamp01(factors.engagementQuality);
  const weight = trust * age * geo * engagement;
  return Number.isFinite(weight) ? Math.max(0, weight) : 0;
}

// ── Synchronous (IO-free) anti-spam validation ───────────────────────────────

export type TapValidationFailure =
  | 'self_tap'
  | 'limit_exceeded'
  | 'low_trust'
  | 'video_not_published';

export interface TapValidationInput {
  readonly tapperUserId: string;
  readonly creatorUserId: string;
  readonly existingTapCount: number;
  readonly trustScore: number;
  readonly videoPublished: boolean;
}

export interface TapValidationResult {
  readonly ok: boolean;
  readonly reason?: TapValidationFailure;
}

/**
 * Validate the rules that do not require external IO. Rate-limiting and
 * AI-Brain fraud checks are layered on top of this in the service.
 */
export function validateTap(input: TapValidationInput): TapValidationResult {
  if (!input.videoPublished) return { ok: false, reason: 'video_not_published' };
  if (input.tapperUserId === input.creatorUserId) return { ok: false, reason: 'self_tap' };
  if (input.existingTapCount >= MAX_TAPS_PER_USER_VIDEO) return { ok: false, reason: 'limit_exceeded' };
  if (clamp01(input.trustScore) < MIN_TRUST_SCORE) return { ok: false, reason: 'low_trust' };
  return { ok: true };
}
