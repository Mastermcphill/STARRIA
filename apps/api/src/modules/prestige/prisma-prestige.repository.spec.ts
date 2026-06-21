// Unit tests for the prestige Prisma repositories with an in-memory fake DB.

import {
  PrismaWhiteStarRepository,
  PrismaGoldStarRepository,
  PrismaLeaderboardRepository,
} from './prisma-prestige.repository';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakeDb() {
  const ws = new Map<string, any>();
  const gs = new Map<string, any>();
  let seq = 0;
  const upsert = (map: Map<string, any>) => async ({ where, create, update }: any) => {
    const existing = map.get(where.starId);
    const row = existing
      ? { ...existing, ...update, updatedAt: new Date() }
      : { id: `id-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...create };
    map.set(where.starId, row);
    return row;
  };
  return {
    whiteStarProfile: {
      findUnique: async ({ where }: any) => ws.get(where.starId) ?? null,
      upsert: upsert(ws),
      update: async ({ where, data }: any) => {
        const cur = ws.get(where.starId);
        const next = { ...cur };
        for (const [k, v] of Object.entries(data)) {
          next[k] = v && typeof v === 'object' && 'increment' in (v as any) ? cur[k] + (v as any).increment : v;
        }
        ws.set(where.starId, next);
        return next;
      },
      findMany: async ({ take = 50 }: any) =>
        [...ws.values()].sort((a, b) => b.score - a.score).slice(0, take),
    },
    goldStarPrestigeProfile: {
      findUnique: async ({ where }: any) => gs.get(where.starId) ?? null,
      upsert: upsert(gs),
    },
  } as unknown as PrismaService;
}

const wsProfile = {
  starId: 's1', score: 200, halfStars: 4 as const, tierLabel: 'Radiant' as const,
  factors: { supporters: 70, giftVolume: 50, watchTime: 40, retention: 20, tapVelocity: 20 },
  uploadUsedThisWeek: 0, weekResetAt: '2026-06-22T00:00:00.000Z',
  lastCalculatedAt: '2026-06-18T00:00:00.000Z',
};

describe('PrismaWhiteStarRepository', () => {
  it('upserts a profile and increments upload count', async () => {
    const repo = new PrismaWhiteStarRepository(makeFakeDb());
    await repo.upsert(wsProfile);
    const p = await repo.incrementUploadCount('s1');
    expect(p.uploadUsedThisWeek).toBe(1);
    expect(p.factors.supporters).toBe(70);
  });
});

describe('PrismaLeaderboardRepository', () => {
  it('ranks white star profiles by score', async () => {
    const db = makeFakeDb();
    const ws = new PrismaWhiteStarRepository(db);
    await ws.upsert({ ...wsProfile, starId: 'aaaa', score: 100 });
    await ws.upsert({ ...wsProfile, starId: 'bbbb', score: 500 });
    const lb = new PrismaLeaderboardRepository(db);
    const board = await lb.getLeaderboard('MOST_GIFTED', 'ALL_TIME', 10);
    expect(board[0].starId).toBe('bbbb');
    expect(board[0].rank).toBe(1);
  });
});

describe('PrismaGoldStarRepository', () => {
  it('upserts a gold star prestige profile', async () => {
    const repo = new PrismaGoldStarRepository(makeFakeDb());
    const p = await repo.upsert({
      starId: 's1', score: 300, tierLabel: 'Galaxy', accountAgeMonths: 12,
      supporterRetentionPct: 60, countryReach: 5, moderationIncidents: 0, isVerified: true,
      lastCalculatedAt: '2026-06-18T00:00:00.000Z',
    });
    expect(p.tierLabel).toBe('Galaxy');
    expect((await repo.findByStarId('s1'))?.score).toBe(300);
  });
});
