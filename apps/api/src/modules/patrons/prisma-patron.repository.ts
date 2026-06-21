// ---------------------------------------------------------------------------
// patrons — Prisma adapter for PatronStorePort (Sprint 10).
// Replaces the in-memory Maps with the PatronProfile / PatronHistory /
// CreatorRelationship / PatronAchievement / PatronMilestone tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PatronProfile,
  PatronHistory,
  CreatorRelationship,
  PatronAchievement,
  PatronAchievementType,
  PatronMilestone,
  PatronStorePort,
  PatronTier,
} from '@starria/patron-core';
import type {
  PatronProfile as DbProfile,
  PatronHistory as DbHistory,
  CreatorRelationship as DbRelationship,
  PatronAchievement as DbAchievement,
  PatronMilestone as DbMilestone,
} from '@prisma/client';

function toProfile(p: DbProfile): PatronProfile {
  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl ?? undefined,
    tier: p.tier as PatronTier,
    lifetimeUsdCents: p.lifetimeUsdCents,
    lifetimeCoins: p.lifetimeCoins,
    supportDiversity: p.supportDiversity,
    accountAgeDays: p.accountAgeDays,
    moderationStrikes: p.moderationStrikes,
    isPublic: p.isPublic,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toHistory(h: DbHistory): PatronHistory {
  return {
    id: h.id,
    patronId: h.patronId,
    starId: h.starId,
    action: h.action as PatronHistory['action'],
    coinsAmount: h.coinsAmount,
    usdCents: h.usdCents,
    recordedAt: h.recordedAt.toISOString(),
  };
}

function toRelationship(r: DbRelationship): CreatorRelationship {
  return {
    id: r.id,
    patronId: r.patronId,
    starId: r.starId,
    creatorLifetimeUsdCents: r.creatorLifetimeUsdCents,
    creatorLifetimeCoins: r.creatorLifetimeCoins,
    creatorTier: r.creatorTier as PatronTier,
    isMuted: r.isMuted,
    rank: r.rank ?? undefined,
    firstSupportedAt: r.firstSupportedAt.toISOString(),
    lastSupportedAt: r.lastSupportedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toAchievement(a: DbAchievement): PatronAchievement {
  return {
    id: a.id,
    patronId: a.patronId,
    achievementType: a.achievementType as PatronAchievementType,
    title: a.title,
    description: a.description,
    badge: a.badge,
    unlockedAt: a.unlockedAt.toISOString(),
  };
}

function toMilestone(m: DbMilestone): PatronMilestone {
  return {
    id: m.id,
    patronId: m.patronId,
    starId: m.starId,
    milestoneType: m.milestoneType as PatronMilestone['milestoneType'],
    thresholdUsdCents: m.thresholdUsdCents,
    reachedAt: m.reachedAt.toISOString(),
  };
}

@Injectable()
export class PrismaPatronRepository implements PatronStorePort {
  constructor(private readonly db: PrismaService) {}

  async findById(id: string): Promise<PatronProfile | null> {
    const p = await this.db.patronProfile.findUnique({ where: { id } });
    return p ? toProfile(p) : null;
  }

  async findByUserId(userId: string): Promise<PatronProfile | null> {
    const p = await this.db.patronProfile.findUnique({ where: { userId } });
    return p ? toProfile(p) : null;
  }

  async create(input: Omit<PatronProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronProfile> {
    const p = await this.db.patronProfile.create({
      data: {
        userId: input.userId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        tier: input.tier,
        lifetimeUsdCents: input.lifetimeUsdCents,
        lifetimeCoins: input.lifetimeCoins,
        supportDiversity: input.supportDiversity,
        accountAgeDays: input.accountAgeDays,
        moderationStrikes: input.moderationStrikes,
        isPublic: input.isPublic,
      },
    });
    return toProfile(p);
  }

  async update(id: string, patch: Partial<PatronProfile>): Promise<PatronProfile> {
    const data: Record<string, unknown> = {};
    (['displayName', 'tier', 'lifetimeUsdCents', 'lifetimeCoins', 'supportDiversity',
      'accountAgeDays', 'moderationStrikes', 'isPublic'] as const).forEach((k) => {
      if (patch[k] !== undefined) data[k] = patch[k];
    });
    if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl ?? null;
    const p = await this.db.patronProfile.update({ where: { id }, data });
    return toProfile(p);
  }

  async findRelationship(patronId: string, starId: string): Promise<CreatorRelationship | null> {
    const r = await this.db.creatorRelationship.findUnique({
      where: { patronId_starId: { patronId, starId } },
    });
    return r ? toRelationship(r) : null;
  }

  async findRelationshipsByPatron(patronId: string): Promise<CreatorRelationship[]> {
    const rows = await this.db.creatorRelationship.findMany({ where: { patronId } });
    return rows.map(toRelationship);
  }

  async findRelationshipsByStar(starId: string, limit = 50): Promise<CreatorRelationship[]> {
    const rows = await this.db.creatorRelationship.findMany({
      where: { starId },
      orderBy: { creatorLifetimeUsdCents: 'desc' },
      take: limit,
    });
    return rows.map(toRelationship);
  }

  async upsertRelationship(
    rel: Omit<CreatorRelationship, 'id' | 'updatedAt'> & { id?: string },
  ): Promise<CreatorRelationship> {
    const data = {
      creatorLifetimeUsdCents: rel.creatorLifetimeUsdCents,
      creatorLifetimeCoins: rel.creatorLifetimeCoins,
      creatorTier: rel.creatorTier,
      isMuted: rel.isMuted,
      rank: rel.rank ?? null,
      lastSupportedAt: new Date(rel.lastSupportedAt),
    };
    const r = await this.db.creatorRelationship.upsert({
      where: { patronId_starId: { patronId: rel.patronId, starId: rel.starId } },
      create: {
        patronId: rel.patronId,
        starId: rel.starId,
        firstSupportedAt: new Date(rel.firstSupportedAt),
        ...data,
      },
      update: data,
    });
    return toRelationship(r);
  }

  async appendHistory(entry: Omit<PatronHistory, 'id'>): Promise<PatronHistory> {
    const h = await this.db.patronHistory.create({
      data: {
        patronId: entry.patronId,
        starId: entry.starId,
        action: entry.action,
        coinsAmount: entry.coinsAmount,
        usdCents: entry.usdCents,
        recordedAt: new Date(entry.recordedAt),
      },
    });
    return toHistory(h);
  }

  async getHistory(patronId: string, limit = 50): Promise<PatronHistory[]> {
    const rows = await this.db.patronHistory.findMany({
      where: { patronId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
    return rows.map(toHistory);
  }

  async appendAchievement(a: Omit<PatronAchievement, 'id'>): Promise<PatronAchievement> {
    const r = await this.db.patronAchievement.create({
      data: {
        patronId: a.patronId,
        achievementType: a.achievementType,
        title: a.title,
        description: a.description,
        badge: a.badge,
        unlockedAt: new Date(a.unlockedAt),
      },
    });
    return toAchievement(r);
  }

  async getAchievements(patronId: string): Promise<PatronAchievement[]> {
    const rows = await this.db.patronAchievement.findMany({ where: { patronId } });
    return rows.map(toAchievement);
  }

  async hasAchievement(patronId: string, type: PatronAchievementType): Promise<boolean> {
    const a = await this.db.patronAchievement.findFirst({ where: { patronId, achievementType: type } });
    return a !== null;
  }

  async appendMilestone(m: Omit<PatronMilestone, 'id'>): Promise<PatronMilestone> {
    const r = await this.db.patronMilestone.create({
      data: {
        patronId: m.patronId,
        starId: m.starId,
        milestoneType: m.milestoneType,
        thresholdUsdCents: m.thresholdUsdCents,
        reachedAt: new Date(m.reachedAt),
      },
    });
    return toMilestone(r);
  }

  async getMilestones(patronId: string, starId?: string): Promise<PatronMilestone[]> {
    const rows = await this.db.patronMilestone.findMany({
      where: { patronId, ...(starId ? { starId } : {}) },
    });
    return rows.map(toMilestone);
  }
}
