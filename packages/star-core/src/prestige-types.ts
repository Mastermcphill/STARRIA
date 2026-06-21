// ---------------------------------------------------------------------------
// star-core — Sprint 4 Prestige types
// White Star, Gold Star, Upload Allowance, Creator Fee
// ---------------------------------------------------------------------------

// ── White Star ───────────────────────────────────────────────────────────────

/**
 * Half-star rating 1–10 (represents 0.5★ → 5★).
 * halfStars=1 → 0.5★ (Spark), halfStars=10 → 5★ (Legendary)
 */
export type WhiteStarHalfStars = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type WhiteStarTierLabel =
  | 'Spark'
  | 'Rising'
  | 'Radiant'
  | 'Nova'
  | 'Celestial'
  | 'Legendary';

export interface WhiteStarTierConfig {
  readonly halfStars: WhiteStarHalfStars;
  readonly label: WhiteStarTierLabel;
  readonly minScore: number;
  readonly uploadCapPerWeek: number;
}

export const WHITE_STAR_TIERS: readonly WhiteStarTierConfig[] = [
  { halfStars: 1,  label: 'Spark',     minScore: 0,    uploadCapPerWeek: 2 },
  { halfStars: 2,  label: 'Rising',    minScore: 50,   uploadCapPerWeek: 3 },
  { halfStars: 4,  label: 'Radiant',   minScore: 150,  uploadCapPerWeek: 4 },
  { halfStars: 6,  label: 'Nova',      minScore: 350,  uploadCapPerWeek: 6 },
  { halfStars: 8,  label: 'Celestial', minScore: 700,  uploadCapPerWeek: 8 },
  { halfStars: 10, label: 'Legendary', minScore: 1200, uploadCapPerWeek: 10 },
];

export interface WhiteStarScoreFactors {
  readonly supporters: number;
  readonly giftVolume: number;
  readonly watchTime: number;
  readonly retention: number;
  readonly tapVelocity: number;
}

export interface WhiteStarProfile {
  readonly id: string;
  readonly starId: string;
  readonly score: number;
  readonly halfStars: WhiteStarHalfStars;
  readonly tierLabel: WhiteStarTierLabel;
  readonly factors: WhiteStarScoreFactors;
  readonly uploadUsedThisWeek: number;
  readonly weekResetAt: string; // ISO — Monday 00:00 UTC
  readonly lastCalculatedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WhiteStarHistory {
  readonly id: string;
  readonly starId: string;
  readonly score: number;
  readonly halfStars: WhiteStarHalfStars;
  readonly tierLabel: WhiteStarTierLabel;
  readonly factors: WhiteStarScoreFactors;
  readonly recordedAt: string;
}

export interface SeasonScore {
  readonly id: string;
  readonly starId: string;
  readonly seasonId: string;
  readonly seasonName: string;
  readonly finalScore: number;
  readonly finalHalfStars: WhiteStarHalfStars;
  readonly finalTierLabel: WhiteStarTierLabel;
  readonly rank?: number;
  readonly resetAt: string;
}

export interface StarDecay {
  readonly id: string;
  readonly starId: string;
  readonly decayAmount: number;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly reason: 'INACTIVITY' | 'MODERATION' | 'MANUAL';
  readonly appliedAt: string;
}

// ── Calculated prestige score ────────────────────────────────────────────────

export interface CalculateWhiteStarInput {
  readonly supporterCount: number;
  readonly giftVolumeCoins: number;
  readonly watchTimeMinutes: number;
  readonly averageRetentionPct: number;
  readonly tapVelocityPerDay: number;
}

/**
 * score = supporters*0.35 + gift_volume*0.25 + watch_time*0.20 + retention*0.10 + tap_velocity*0.10
 * Inputs are normalised to 0–1000 scale within each dimension.
 */
export function calculateWhiteStarScore(input: CalculateWhiteStarInput): {
  score: number;
  factors: WhiteStarScoreFactors;
} {
  const supporters   = Math.min(input.supporterCount / 10, 1000) * 0.35;
  const giftVolume   = Math.min(input.giftVolumeCoins / 100, 1000) * 0.25;
  const watchTime    = Math.min(input.watchTimeMinutes / 60, 1000) * 0.20;
  const retention    = Math.min(input.averageRetentionPct, 100) * 10 * 0.10;
  const tapVelocity  = Math.min(input.tapVelocityPerDay * 10, 1000) * 0.10;

  return {
    score: Math.round(supporters + giftVolume + watchTime + retention + tapVelocity),
    factors: {
      supporters: Math.round(supporters),
      giftVolume: Math.round(giftVolume),
      watchTime:  Math.round(watchTime),
      retention:  Math.round(retention),
      tapVelocity: Math.round(tapVelocity),
    },
  };
}

export function resolveWhiteStarTier(score: number): WhiteStarTierConfig {
  const sorted = [...WHITE_STAR_TIERS].sort((a, b) => b.minScore - a.minScore);
  return sorted.find(t => score >= t.minScore) ?? WHITE_STAR_TIERS[0];
}

// ── Gold Star ────────────────────────────────────────────────────────────────

export type GoldStarTierLabel = 'Aurora' | 'Nebula' | 'Galaxy' | 'Supernova' | 'Eternal';

export interface GoldStarTierConfig {
  readonly label: GoldStarTierLabel;
  readonly minScore: number;
  readonly revenueFeePct: number; // platform fee for this gold tier
}

export const GOLD_STAR_TIERS: readonly GoldStarTierConfig[] = [
  { label: 'Aurora',    minScore: 0,   revenueFeePct: 40 },
  { label: 'Nebula',    minScore: 100, revenueFeePct: 30 },
  { label: 'Galaxy',    minScore: 300, revenueFeePct: 20 },
  { label: 'Supernova', minScore: 600, revenueFeePct: 15 },
  { label: 'Eternal',   minScore: 1000,revenueFeePct: 10 },
];

export interface GoldStarProfile {
  readonly id: string;
  readonly starId: string;
  readonly score: number;
  readonly tierLabel: GoldStarTierLabel;
  readonly accountAgeMonths: number;
  readonly supporterRetentionPct: number;
  readonly countryReach: number;     // distinct countries
  readonly moderationIncidents: number;
  readonly isVerified: boolean;
  readonly lastCalculatedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegacyAchievement {
  readonly id: string;
  readonly starId: string;
  readonly achievementType:
    | 'FIRST_100_SUPPORTERS'
    | 'FIRST_LIVE_STREAM'
    | 'GLOBAL_REACH'
    | 'RETENTION_MASTER'
    | 'GIFT_MILESTONE'
    | 'VERIFIED_CREATOR'
    | 'SEASON_CHAMPION';
  readonly title: string;
  readonly description: string;
  readonly iconUrl?: string;
  readonly unlockedAt: string;
}

export interface CreatorReputation {
  readonly id: string;
  readonly starId: string;
  readonly whiteStarScore: number;
  readonly goldStarScore: number;
  readonly combinedScore: number;
  readonly platformFeePct: number;  // resolved from tiers
  readonly weeklyUploadCap: number; // resolved from white star
  readonly updatedAt: string;
}

export function calculateGoldStarScore(params: {
  accountAgeMonths: number;
  supporterRetentionPct: number;
  countryReach: number;
  moderationIncidents: number;
  isVerified: boolean;
}): number {
  const age         = Math.min(params.accountAgeMonths * 5, 300);
  const retention   = params.supporterRetentionPct * 2;
  const reach       = Math.min(params.countryReach * 10, 200);
  const modPenalty  = params.moderationIncidents * 25;
  const verifiedBonus = params.isVerified ? 100 : 0;
  return Math.max(0, Math.round(age + retention + reach + verifiedBonus - modPenalty));
}

export function resolveGoldStarTier(score: number): GoldStarTierConfig {
  const sorted = [...GOLD_STAR_TIERS].sort((a, b) => b.minScore - a.minScore);
  return sorted.find(t => score >= t.minScore) ?? GOLD_STAR_TIERS[0];
}

// ── Revenue Ladder ───────────────────────────────────────────────────────────

export type CreatorRevenueTier = 'NEW' | 'RISING' | 'ESTABLISHED' | 'ELITE' | 'LEGENDARY';

export const REVENUE_TIER_FEE_PCT: Record<CreatorRevenueTier, number> = {
  NEW:         50,
  RISING:      40,
  ESTABLISHED: 30,
  ELITE:       20,
  LEGENDARY:   10,
};

export function resolveRevenueTier(whiteStarHalfStars: WhiteStarHalfStars | 0): CreatorRevenueTier {
  if (whiteStarHalfStars >= 8) return 'LEGENDARY';
  if (whiteStarHalfStars >= 6) return 'ELITE';
  if (whiteStarHalfStars >= 4) return 'ESTABLISHED';
  if (whiteStarHalfStars >= 2) return 'RISING';
  return 'NEW';
}

export function resolveCreatorFeePct(
  whiteStarHalfStars: WhiteStarHalfStars | 0,
  goldStarTier?: GoldStarTierLabel,
): number {
  // Gold star fee overrides if it's lower (better for creator)
  const whiteStarFee = REVENUE_TIER_FEE_PCT[resolveRevenueTier(whiteStarHalfStars)];
  if (!goldStarTier) return whiteStarFee;
  const goldTier = GOLD_STAR_TIERS.find(t => t.label === goldStarTier);
  const goldFee = goldTier?.revenueFeePct ?? whiteStarFee;
  return Math.min(whiteStarFee, goldFee);
}
