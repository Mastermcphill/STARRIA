// Unit test for PrismaTrustRepository with an in-memory fake of PrismaService.

import { PrismaTrustRepository } from './prisma-trust.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TrustSignals } from '@starria/trust-core';

function makeFakeDb() {
  const profiles = new Map<string, any>();
  const flags: any[] = [];
  let seq = 0;
  return {
    trustProfile: {
      findUnique: async ({ where }: any) => profiles.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = profiles.get(where.userId);
        const row = existing ? { ...existing, ...update } : { ...create };
        profiles.set(where.userId, row);
        return row;
      },
    },
    trustFlag: {
      create: async ({ data }: any) => {
        const row = { id: `f-${++seq}`, ...data };
        flags.push(row);
        return row;
      },
      findMany: async ({ where }: any) => flags.filter((f) => f.userId === where.userId),
    },
    trustRestrictionRecord: {
      create: async ({ data }: any) => ({ id: `r-${++seq}`, ...data }),
      findMany: async () => [],
    },
  } as unknown as PrismaService;
}

const signals: TrustSignals = {
  moderationScore: 100, fraudScore: 100, spamScore: 100, accountAgeDays: 30,
  conversationQuality: 80, creatorFeedback: 80, paymentDisputes: 0,
};

describe('PrismaTrustRepository', () => {
  it('upserts a profile preserving signals (Json), restrictions (String[]) and flags (Json)', async () => {
    const repo = new PrismaTrustRepository(makeFakeDb());
    const saved = await repo.upsert({
      userId: 'u1', score: 88, signals, restrictions: ['SHADOW_RESTRICTED'], flags: [],
      updatedAt: '2026-06-18T00:00:00.000Z',
    });
    expect(saved.score).toBe(88);
    expect(saved.restrictions).toEqual(['SHADOW_RESTRICTED']);
    const found = await repo.find('u1');
    expect(found?.signals.moderationScore).toBe(100);
  });

  it('appends and reads flags', async () => {
    const repo = new PrismaTrustRepository(makeFakeDb());
    await repo.appendFlag({ userId: 'u1', flagType: 'SPAM', raisedBy: 'mod', raisedAt: '2026-06-18T00:00:00.000Z' });
    const flags = await repo.getFlags('u1');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('SPAM');
  });
});
