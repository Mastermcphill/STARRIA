// Unit test for PrismaCampaignRepository — verifies row<->domain mapping and
// delegate usage with an in-memory fake of the PrismaService delegates (no DB).

import { PrismaCampaignRepository } from './prisma-campaign.repository';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakeDb() {
  const campaigns = new Map<string, any>();
  const ledger: any[] = [];
  const analytics = new Map<string, any>();
  let seq = 0;
  const id = () => `id-${++seq}`;

  return {
    visibilityCampaign: {
      findUnique: async ({ where }: any) => {
        if (where.id) return campaigns.get(where.id) ?? null;
        if (where.idempotencyKey)
          return [...campaigns.values()].find((c) => c.idempotencyKey === where.idempotencyKey) ?? null;
        return null;
      },
      findMany: async ({ where }: any) =>
        [...campaigns.values()].filter(
          (c) =>
            (where.starId ? c.starId === where.starId : true) &&
            (where.status ? c.status === where.status : true) &&
            (where.scope ? c.scope === where.scope : true),
        ),
      create: async ({ data }: any) => {
        const now = new Date();
        const row = { id: id(), createdAt: now, updatedAt: now, ...data };
        campaigns.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...campaigns.get(where.id), ...data, updatedAt: new Date() };
        campaigns.set(where.id, row);
        return row;
      },
    },
    campaignLedgerEntry: {
      create: async ({ data }: any) => {
        const row = { id: id(), createdAt: new Date(), ...data };
        ledger.push(row);
        return row;
      },
      findMany: async ({ where }: any) => ledger.filter((e) => e.campaignId === where.campaignId),
    },
    campaignAnalytics: {
      findUnique: async ({ where }: any) => analytics.get(where.campaignId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = analytics.get(where.campaignId);
        const row = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { id: id(), updatedAt: new Date(), ...create };
        analytics.set(where.campaignId, row);
        return row;
      },
    },
  } as unknown as PrismaService;
}

describe('PrismaCampaignRepository', () => {
  it('creates and finds a campaign, mapping dates to ISO strings', async () => {
    const repo = new PrismaCampaignRepository(makeFakeDb());
    const created = await repo.create({
      starId: 'star-1',
      promotableType: 'VIDEO',
      promotableId: 'vid-1',
      scope: 'LOCAL',
      status: 'ACTIVE',
      coinsSpent: 50,
      idempotencyKey: 'key-1',
      startsAt: '2026-06-18T00:00:00.000Z',
      expiresAt: '2026-06-20T00:00:00.000Z',
    });
    expect(created.id).toBeDefined();
    expect(typeof created.createdAt).toBe('string');
    expect(created.startsAt).toBe('2026-06-18T00:00:00.000Z');

    const byId = await repo.findById(created.id);
    expect(byId?.idempotencyKey).toBe('key-1');
    const byKey = await repo.findByIdempotencyKey('key-1');
    expect(byKey?.id).toBe(created.id);
  });

  it('filters active campaigns by scope and updates status', async () => {
    const repo = new PrismaCampaignRepository(makeFakeDb());
    await repo.create({
      starId: 's', promotableType: 'VIDEO', promotableId: 'v', scope: 'GLOBAL',
      status: 'ACTIVE', coinsSpent: 1, idempotencyKey: 'k1',
      startsAt: '2026-06-18T00:00:00.000Z', expiresAt: '2026-06-20T00:00:00.000Z',
    });
    const active = await repo.findActive('GLOBAL');
    expect(active).toHaveLength(1);
    const updated = await repo.updateStatus(active[0].id, 'CANCELLED');
    expect(updated.status).toBe('CANCELLED');
    expect(await repo.findActive('GLOBAL')).toHaveLength(0);
  });

  it('appends ledger entries and upserts analytics', async () => {
    const repo = new PrismaCampaignRepository(makeFakeDb());
    await repo.appendLedger({ campaignId: 'c1', starId: 's', action: 'CHARGE', coinsAmount: 50 });
    expect(await repo.getLedger('c1')).toHaveLength(1);

    await repo.upsertAnalytics({ campaignId: 'c1', impressions: 10, clicks: 2, conversions: 1, ctr: 0.2 });
    await repo.upsertAnalytics({ campaignId: 'c1', impressions: 20, clicks: 5, conversions: 2, ctr: 0.25 });
    const a = await repo.getAnalytics('c1');
    expect(a?.impressions).toBe(20);
    expect(a?.ctr).toBe(0.25);
  });
});
