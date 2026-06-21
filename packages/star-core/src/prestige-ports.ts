// ---------------------------------------------------------------------------
// star-core — Sprint 4 Prestige port interfaces
// ---------------------------------------------------------------------------

import type {
  WhiteStarProfile,
  WhiteStarHistory,
  SeasonScore,
  StarDecay,
  GoldStarProfile,
  LegacyAchievement,
  CreatorReputation,
} from './prestige-types';

// ── White Star Store ─────────────────────────────────────────────────────────

export interface WhiteStarStorePort {
  findByStarId(starId: string): Promise<WhiteStarProfile | null>;
  upsert(profile: Omit<WhiteStarProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<WhiteStarProfile>;
  incrementUploadCount(starId: string): Promise<WhiteStarProfile>;
  resetWeeklyUploads(starId: string, weekResetAt: string): Promise<WhiteStarProfile>;
  appendHistory(entry: Omit<WhiteStarHistory, 'id'>): Promise<WhiteStarHistory>;
  getHistory(starId: string, limit?: number): Promise<WhiteStarHistory[]>;
  appendDecay(decay: Omit<StarDecay, 'id'>): Promise<StarDecay>;
  getDecays(starId: string): Promise<StarDecay[]>;
  appendSeasonScore(score: Omit<SeasonScore, 'id'>): Promise<SeasonScore>;
  getSeasonScores(starId: string): Promise<SeasonScore[]>;
}

// ── Gold Star Store ──────────────────────────────────────────────────────────

export interface GoldStarStorePort {
  findByStarId(starId: string): Promise<GoldStarProfile | null>;
  upsert(profile: Omit<GoldStarProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<GoldStarProfile>;
  appendAchievement(a: Omit<LegacyAchievement, 'id'>): Promise<LegacyAchievement>;
  getAchievements(starId: string): Promise<LegacyAchievement[]>;
  hasAchievement(starId: string, type: LegacyAchievement['achievementType']): Promise<boolean>;
  getReputation(starId: string): Promise<CreatorReputation | null>;
  upsertReputation(rep: Omit<CreatorReputation, 'id' | 'updatedAt'> & { id?: string }): Promise<CreatorReputation>;
}

// ── Leaderboard Port ─────────────────────────────────────────────────────────

export type LeaderboardCategory =
  | 'MOST_SUPPORTERS'
  | 'MOST_GIFTED'
  | 'MOST_WATCHED'
  | 'FASTEST_RISING'
  | 'BEST_LIVE_PERFORMER';

export type LeaderboardPeriod = 'WEEKLY' | 'MONTHLY' | 'ALL_TIME';

export interface LeaderboardEntry {
  readonly rank: number;
  readonly starId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly score: number;
  readonly delta?: number; // rank change vs previous period
  readonly halfStars?: number;
  readonly tierLabel?: string;
}

export interface LeaderboardPort {
  getLeaderboard(
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    limit?: number,
  ): Promise<LeaderboardEntry[]>;
}
