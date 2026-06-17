// ---------------------------------------------------------------------------
// discovery-core — discovery ranking + regional boost + trending (pure)
//
//   score = watch_time*0.25 + supporters*0.25 + tap_velocity*0.20
//         + retention*0.15 + star_multiplier*0.15
//
// Each component is normalised to [0, 1] before weighting, so the final score
// is also in [0, 1] (multiply by 100 for display if desired).
// ---------------------------------------------------------------------------

export const RANKING_WEIGHTS = {
  watchTime: 0.25,
  supporters: 0.25,
  tapVelocity: 0.20,
  retention: 0.15,
  starMultiplier: 0.15,
} as const;

/** Raw signals for a video; counts are normalised internally via log-scaling. */
export interface DiscoveryRankingSignals {
  /** Total watch time across all viewers, in seconds. */
  readonly totalWatchSeconds: number;
  /** Distinct supporters of the creator (or who tapped/gifted this video). */
  readonly supporterCount: number;
  /** Weighted taps accrued in the recent window (the "velocity"). */
  readonly recentWeightedTaps: number;
  /** Average retention across views, already in [0, 1]. */
  readonly averageRetention: number;
  /** Star tier multiplier in [0, 1] (e.g. RISING=0.4, VERIFIED=0.7, ELITE=1.0). */
  readonly starMultiplier: number;
}

/** Log-normalise a count to [0, 1] given a saturation point. */
export function normaliseCount(value: number, saturationAt: number): number {
  if (value <= 0) return 0;
  if (saturationAt <= 1) return value > 0 ? 1 : 0;
  const v = Math.log1p(value) / Math.log1p(saturationAt);
  return Math.max(0, Math.min(1, v));
}

export interface DiscoveryScoreBreakdown {
  readonly watchTimeScore: number;
  readonly supportersScore: number;
  readonly tapVelocityScore: number;
  readonly retentionScore: number;
  readonly starMultiplierScore: number;
  readonly score: number; // weighted total in [0, 1]
}

/** Saturation points control how quickly each signal approaches its max. */
const SATURATION = {
  watchSeconds: 3_600_000, // 1,000 hours of cumulative watch time
  supporters: 10_000,
  weightedTaps: 5_000,
} as const;

export function computeDiscoveryScore(signals: DiscoveryRankingSignals): DiscoveryScoreBreakdown {
  const watchTimeScore = normaliseCount(signals.totalWatchSeconds, SATURATION.watchSeconds);
  const supportersScore = normaliseCount(signals.supporterCount, SATURATION.supporters);
  const tapVelocityScore = normaliseCount(signals.recentWeightedTaps, SATURATION.weightedTaps);
  const retentionScore = Math.max(0, Math.min(1, signals.averageRetention));
  const starMultiplierScore = Math.max(0, Math.min(1, signals.starMultiplier));

  const score =
    watchTimeScore * RANKING_WEIGHTS.watchTime +
    supportersScore * RANKING_WEIGHTS.supporters +
    tapVelocityScore * RANKING_WEIGHTS.tapVelocity +
    retentionScore * RANKING_WEIGHTS.retention +
    starMultiplierScore * RANKING_WEIGHTS.starMultiplier;

  return {
    watchTimeScore,
    supportersScore,
    tapVelocityScore,
    retentionScore,
    starMultiplierScore,
    score: Math.max(0, Math.min(1, score)),
  };
}

// ── Regional boost accumulation ──────────────────────────────────────────────

/**
 * Apply a new weighted tap to an existing regional boost using exponential
 * time-decay so trends rise and fade naturally.
 *
 * decayed = previous * decayFactor(elapsed) + tapWeight
 */
export function applyTapToRegionalBoost(params: {
  previousBoost: number;
  tapWeight: number;
  secondsSinceLastTap: number;
  /** Half-life of a boost in seconds (default 24h). */
  halfLifeSeconds?: number;
}): number {
  const halfLife = params.halfLifeSeconds ?? 86_400;
  const decay = Math.pow(0.5, Math.max(0, params.secondsSinceLastTap) / halfLife);
  const next = params.previousBoost * decay + params.tapWeight;
  return Number.isFinite(next) ? Math.max(0, next) : params.tapWeight;
}

// ── Trending (velocity) ──────────────────────────────────────────────────────

/**
 * Trending score combines the discovery score with recent tap velocity and a
 * recency bonus. Used to rank the trending rails (local + global).
 */
export function computeTrendingScore(params: {
  discoveryScore: number;       // 0..1
  recentWeightedTaps: number;   // last window
  hoursSincePublish: number;
}): number {
  const velocity = normaliseCount(params.recentWeightedTaps, SATURATION.weightedTaps);
  // Recency bonus decays over ~72h.
  const recency = Math.pow(0.5, Math.max(0, params.hoursSincePublish) / 72);
  const score = params.discoveryScore * 0.5 + velocity * 0.35 + recency * 0.15;
  return Math.max(0, Math.min(1, score));
}

/** Thresholds above which a video is considered to be "trending". */
export const TREND_THRESHOLDS = {
  local: 0.6,
  global: 0.75,
} as const;
