// Unit test for PrismaPatronRepository with an in-memory fake of PrismaService.

import { PrismaPatronRepository } from './prisma-patron.repository';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakeDb() {
  const profiles = new Map<string, any>();
  const rels = new Map<string, any>();
  const achievements: any[] = [];
  let seq = 0;
  const id = () => `id-${++seq}`;
  return {
    patronProfile: {
      create: async ({ data }: any) => {
        const now = new Date();
        const row = { id: id(), createdAt: now, updatedAt: now, ...data };
        profiles.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) =>
        where.id
          ? profiles.get(where.id) ?? null
          : [...profiles.values()].find((p) => p.userId === where.userId) ?? null,
      update: async ({ where, data }: any) => {
        const row = { ...profiles.get(where.id), ...data, updatedAt: new Date() };
        profiles.set(where.id, row);
        return row;
      },
    },
    creatorRelationship: {
      findUnique: async ({ where }: any) =>
        rels.get(`${where.patronId_starId.patronId}:${where.patronId_starId.starId}`) ?? null,
      findMany: async ({ where, take = 50 }: any) =>
        [...rels.values()]
          .filter((r) => (where.patronId ? r.patronId === where.patronId : r.starId === where.starId))
          .sort((a, b) => b.creatorLifetimeUsdCents - a.creatorLifetimeUsdCents)
          .slice(0, take),
      upsert: async ({ where, create, update }: any) => {
        const k = `${where.patronId_starId.patronId}:${where.patronId_starId.starId}`;
        const existing = rels.get(k);
        const row = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { id: id(), updatedAt: new Date(), ...create };
        rels.set(k, row);
        return row;
      },
    },
    patronAchievement: {
      create: async ({ data }: any) => {
        const row = { id: id(), ...data };
        achievements.push(row);
        return row;
      },
      findMany: async ({ where }: any) => achievements.filter((a) => a.patronId === where.patronId),
      findFirst: async ({ where }: any) =>
        achievements.find((a) => a.patronId === where.patronId && a.achievementType === where.achievementType) ?? null,
    },
  } as unknown as PrismaService;
}

describe('PrismaPatronRepository', () => {
  it('creates a profile and updates tier', async () => {
    const repo = new PrismaPatronRepository(makeFakeDb());
    const p = await repo.create({
      userId: 'u1', displayName: 'P', avatarUrl: undefined, tier: 'VISITOR',
      lifetimeUsdCents: 0, lifetimeCoins: 0, supportDiversity: 0, accountAgeDays: 10,
      moderationStrikes: 0, isPublic: true,
    });
    const up = await repo.update(p.id, { tier: 'PATRON', lifetimeUsdCents: 100_000 });
    expect(up.tier).toBe('PATRON');
    expect((await repo.findByUserId('u1'))?.lifetimeUsdCents).toBe(100_000);
  });

  it('upserts a relationship on the composite key', async () => {
    const repo = new PrismaPatronRepository(makeFakeDb());
    const base = {
      patronId: 'p1', starId: 's1', creatorLifetimeUsdCents: 100, creatorLifetimeCoins: 1,
      creatorTier: 'SUPPORTER' as const, isMuted: false, rank: undefined,
      firstSupportedAt: '2026-06-01T00:00:00.000Z', lastSupportedAt: '2026-06-10T00:00:00.000Z',
    };
    await repo.upsertRelationship(base);
    await repo.upsertRelationship({ ...base, creatorLifetimeUsdCents: 500 });
    const found = await repo.findRelationship('p1', 's1');
    expect(found?.creatorLifetimeUsdCents).toBe(500);
    expect(await repo.findRelationshipsByStar('s1')).toHaveLength(1);
  });

  it('tracks achievements with hasAchievement', async () => {
    const repo = new PrismaPatronRepository(makeFakeDb());
    expect(await repo.hasAchievement('p1', 'FIRST_SUPPORT')).toBe(false);
    await repo.appendAchievement({
      patronId: 'p1', achievementType: 'FIRST_SUPPORT', title: 't', description: 'd',
      badge: '⭐', unlockedAt: '2026-06-10T00:00:00.000Z',
    });
    expect(await repo.hasAchievement('p1', 'FIRST_SUPPORT')).toBe(true);
  });
});
