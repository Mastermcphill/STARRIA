// ---------------------------------------------------------------------------
// prestige — Prisma adapters for WhiteStarStorePort, GoldStarStorePort and
// LeaderboardPort (star-core, Sprint 10). Replaces the in-memory Maps with the
// WhiteStarProfile / WhiteStarHistory / StarDecay / WhiteStarSeasonScore /
// GoldStarPrestigeProfile / GoldStarAchievement / CreatorReputation tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  WhiteStarStorePort,
  GoldStarStorePort,
  LeaderboardPort,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardEntry,
  WhiteStarProfile,
  WhiteStarHistory,
  SeasonScore,
  StarDecay,
  GoldStarProfile,
  LegacyAchievement,
  CreatorReputation,
  WhiteStarScoreFactors,
  WhiteStarHalfStars,
  WhiteStarTierLabel,
  GoldStarTierLabel,
} from '@starria/star-core';
import type {
  WhiteStarProfile as DbWhiteStar,
  WhiteStarHistory as DbHistory,
  StarDecay as DbDecay,
  WhiteStarSeasonScore as DbSeason,
  GoldStarPrestigeProfile as DbGoldStar,
  GoldStarAchievement as DbAchievement,
  CreatorReputation as DbReputation,
} from '@prisma/client';

// ── White Star mappers ────────────────────────────────────────────────────────

function toWhiteStar(p: DbWhiteStar): WhiteStarProfile {
  return {
    id: p.id,
    starId: p.starId,
    score: p.score,
    halfStars: p.halfStars as WhiteStarHalfStars,
    tierLabel: p.tierLabel as WhiteStarTierLabel,
    factors: p.factors as unknown as WhiteStarScoreFactors,
    uploadUsedThisWeek: p.uploadUsedThisWeek,
    weekResetAt: p.weekResetAt.toISOString(),
    lastCalculatedAt: p.lastCalculatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toHistory(h: DbHistory): WhiteStarHistory {
  return {
    id: h.id,
    starId: h.starId,
    score: h.score,
    halfStars: h.halfStars as WhiteStarHalfStars,
    tierLabel: h.tierLabel as WhiteStarTierLabel,
    factors: h.factors as unknown as WhiteStarScoreFactors,
    recordedAt: h.recordedAt.toISOString(),
  };
}

function toDecay(d: DbDecay): StarDecay {
  return {
    id: d.id,
    starId: d.starId,
    decayAmount: d.decayAmount,
    scoreBefore: d.scoreBefore,
    scoreAfter: d.scoreAfter,
    reason: d.reason as StarDecay['reason'],
    appliedAt: d.appliedAt.toISOString(),
  };
}

function toSeason(s: DbSeason): SeasonScore {
  return {
    id: s.id,
    starId: s.starId,
    seasonId: s.seasonId,
    seasonName: s.seasonName,
    finalScore: s.finalScore,
    finalHalfStars: s.finalHalfStars as WhiteStarHalfStars,
    finalTierLabel: s.finalTierLabel as WhiteStarTierLabel,
    rank: s.rank ?? undefined,
    resetAt: s.resetAt.toISOString(),
  };
}

// ── Gold Star mappers ─────────────────────────────────────────────────────────

function toGoldStar(p: DbGoldStar): GoldStarProfile {
  return {
    id: p.id,
    starId: p.starId,
    score: p.score,
    tierLabel: p.tierLabel as GoldStarTierLabel,
    accountAgeMonths: p.accountAgeMonths,
    supporterRetentionPct: p.supporterRetentionPct,
    countryReach: p.countryReach,
    moderationIncidents: p.moderationIncidents,
    isVerified: p.isVerified,
    lastCalculatedAt: p.lastCalculatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toAchievement(a: DbAchievement): LegacyAchievement {
  return {
    id: a.id,
    starId: a.starId,
    achievementType: a.achievementType as LegacyAchievement['achievementType'],
    title: a.title,
    description: a.description,
    iconUrl: a.iconUrl ?? undefined,
    unlockedAt: a.unlockedAt.toISOString(),
  };
}

function toReputation(r: DbReputation): CreatorReputation {
  return {
    id: r.id,
    starId: r.starId,
    whiteStarScore: r.whiteStarScore,
    goldStarScore: r.goldStarScore,
    combinedScore: r.combinedScore,
    platformFeePct: r.platformFeePct,
    weeklyUploadCap: r.weeklyUploadCap,
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaWhiteStarRepository implements WhiteStarStorePort {
  constructor(private readonly db: PrismaService) {}

  async findByStarId(starId: string): Promise<WhiteStarProfile | null> {
    const p = await this.db.whiteStarProfile.findUnique({ where: { starId } });
    return p ? toWhiteStar(p) : null;
  }

  async upsert(
    profile: Omit<WhiteStarProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<WhiteStarProfile> {
    const data = {
      score: profile.score,
      halfStars: profile.halfStars,
      tierLabel: profile.tierLabel,
      factors: profile.factors as unknown as object,
      uploadUsedThisWeek: profile.uploadUsedThisWeek,
      weekResetAt: new Date(profile.weekResetAt),
      lastCalculatedAt: new Date(profile.lastCalculatedAt),
    };
    const p = await this.db.whiteStarProfile.upsert({
      where: { starId: profile.starId },
      create: { starId: profile.starId, ...data },
      update: data,
    });
    return toWhiteStar(p);
  }

  async incrementUploadCount(starId: string): Promise<WhiteStarProfile> {
    const p = await this.db.whiteStarProfile.update({
      where: { starId },
      data: { uploadUsedThisWeek: { increment: 1 } },
    });
    return toWhiteStar(p);
  }

  async resetWeeklyUploads(starId: string, weekResetAt: string): Promise<WhiteStarProfile> {
    const p = await this.db.whiteStarProfile.update({
      where: { starId },
      data: { uploadUsedThisWeek: 0, weekResetAt: new Date(weekResetAt) },
    });
    return toWhiteStar(p);
  }

  async appendHistory(entry: Omit<WhiteStarHistory, 'id'>): Promise<WhiteStarHistory> {
    const h = await this.db.whiteStarHistory.create({
      data: {
        starId: entry.starId,
        score: entry.score,
        halfStars: entry.halfStars,
        tierLabel: entry.tierLabel,
        factors: entry.factors as unknown as object,
        recordedAt: new Date(entry.recordedAt),
      },
    });
    return toHistory(h);
  }

  async getHistory(starId: string, limit = 30): Promise<WhiteStarHistory[]> {
    const rows = await this.db.whiteStarHistory.findMany({
      where: { starId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
    return rows.reverse().map(toHistory);
  }

  async appendDecay(decay: Omit<StarDecay, 'id'>): Promise<StarDecay> {
    const d = await this.db.starDecay.create({
      data: {
        starId: decay.starId,
        decayAmount: decay.decayAmount,
        scoreBefore: decay.scoreBefore,
        scoreAfter: decay.scoreAfter,
        reason: decay.reason,
        appliedAt: new Date(decay.appliedAt),
      },
    });
    return toDecay(d);
  }

  async getDecays(starId: string): Promise<StarDecay[]> {
    const rows = await this.db.starDecay.findMany({ where: { starId }, orderBy: { appliedAt: 'asc' } });
    return rows.map(toDecay);
  }

  async appendSeasonScore(score: Omit<SeasonScore, 'id'>): Promise<SeasonScore> {
    const s = await this.db.whiteStarSeasonScore.create({
      data: {
        starId: score.starId,
        seasonId: score.seasonId,
        seasonName: score.seasonName,
        finalScore: score.finalScore,
        finalHalfStars: score.finalHalfStars,
        finalTierLabel: score.finalTierLabel,
        rank: score.rank ?? null,
        resetAt: new Date(score.resetAt),
      },
    });
    return toSeason(s);
  }

  async getSeasonScores(starId: string): Promise<SeasonScore[]> {
    const rows = await this.db.whiteStarSeasonScore.findMany({
      where: { starId },
      orderBy: { resetAt: 'asc' },
    });
    return rows.map(toSeason);
  }
}

@Injectable()
export class PrismaGoldStarRepository implements GoldStarStorePort {
  constructor(private readonly db: PrismaService) {}

  async findByStarId(starId: string): Promise<GoldStarProfile | null> {
    const p = await this.db.goldStarPrestigeProfile.findUnique({ where: { starId } });
    return p ? toGoldStar(p) : null;
  }

  async upsert(
    profile: Omit<GoldStarProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<GoldStarProfile> {
    const data = {
      score: profile.score,
      tierLabel: profile.tierLabel,
      accountAgeMonths: profile.accountAgeMonths,
      supporterRetentionPct: profile.supporterRetentionPct,
      countryReach: profile.countryReach,
      moderationIncidents: profile.moderationIncidents,
      isVerified: profile.isVerified,
      lastCalculatedAt: new Date(profile.lastCalculatedAt),
    };
    const p = await this.db.goldStarPrestigeProfile.upsert({
      where: { starId: profile.starId },
      create: { starId: profile.starId, ...data },
      update: data,
    });
    return toGoldStar(p);
  }

  async appendAchievement(a: Omit<LegacyAchievement, 'id'>): Promise<LegacyAchievement> {
    const r = await this.db.goldStarAchievement.create({
      data: {
        starId: a.starId,
        achievementType: a.achievementType,
        title: a.title,
        description: a.description,
        iconUrl: a.iconUrl ?? null,
        unlockedAt: new Date(a.unlockedAt),
      },
    });
    return toAchievement(r);
  }

  async getAchievements(starId: string): Promise<LegacyAchievement[]> {
    const rows = await this.db.goldStarAchievement.findMany({ where: { starId } });
    return rows.map(toAchievement);
  }

  async hasAchievement(
    starId: string,
    type: LegacyAchievement['achievementType'],
  ): Promise<boolean> {
    const a = await this.db.goldStarAchievement.findFirst({ where: { starId, achievementType: type } });
    return a !== null;
  }

  async getReputation(starId: string): Promise<CreatorReputation | null> {
    const r = await this.db.creatorReputation.findUnique({ where: { starId } });
    return r ? toReputation(r) : null;
  }

  async upsertReputation(
    rep: Omit<CreatorReputation, 'id' | 'updatedAt'> & { id?: string },
  ): Promise<CreatorReputation> {
    const data = {
      whiteStarScore: rep.whiteStarScore,
      goldStarScore: rep.goldStarScore,
      combinedScore: rep.combinedScore,
      platformFeePct: rep.platformFeePct,
      weeklyUploadCap: rep.weeklyUploadCap,
    };
    const r = await this.db.creatorReputation.upsert({
      where: { starId: rep.starId },
      create: { starId: rep.starId, ...data },
      update: data,
    });
    return toReputation(r);
  }
}

@Injectable()
export class PrismaLeaderboardRepository implements LeaderboardPort {
  constructor(private readonly db: PrismaService) {}

  async getLeaderboard(
    _category: LeaderboardCategory,
    _period: LeaderboardPeriod,
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    // Ranks known White Star profiles by score (proxy), matching the previous
    // in-memory behaviour. A materialized view / Redis sorted set replaces this
    // in a dedicated leaderboard sprint.
    const profiles = await this.db.whiteStarProfile.findMany({
      orderBy: { score: 'desc' },
      take: limit,
    });
    return profiles.map((p, i): LeaderboardEntry => ({
      rank: i + 1,
      starId: p.starId,
      displayName: `Creator ${p.starId.slice(-4)}`,
      score: p.score,
      halfStars: p.halfStars,
      tierLabel: p.tierLabel,
    }));
  }
}
