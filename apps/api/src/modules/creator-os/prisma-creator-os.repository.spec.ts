// Unit tests for the creator-os Prisma stores with an in-memory fake DB.

import {
  PrismaCalendarStore,
  PrismaCommerceStore,
  PrismaClipStore,
} from './prisma-creator-os.repository';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakeDb() {
  const calendar = new Map<string, any>();
  const commerce = new Map<string, any>();
  const purchases = new Map<string, any>();
  const clips = new Map<string, any>();
  return {
    creatorCalendarEntry: {
      create: async ({ data }: any) => { calendar.set(data.id, { ...data }); return calendar.get(data.id); },
      findMany: async ({ where }: any) => [...calendar.values()].filter((e) => e.creatorId === where.creatorId),
      update: async ({ where, data }: any) => { const r = { ...calendar.get(where.id), ...data }; calendar.set(where.id, r); return r; },
    },
    creatorCommerceItem: {
      create: async ({ data }: any) => { commerce.set(data.id, { ...data }); return commerce.get(data.id); },
      findUnique: async ({ where }: any) => commerce.get(where.id) ?? null,
      update: async ({ where, data }: any) => { const r = { ...commerce.get(where.id), ...data }; commerce.set(where.id, r); return r; },
      findMany: async ({ where }: any) => [...commerce.values()].filter((i) => i.roomId === where.roomId),
    },
    creatorCommercePurchase: {
      findUnique: async ({ where }: any) => purchases.get(where.idempotencyKey) ?? null,
      create: async ({ data }: any) => { purchases.set(data.idempotencyKey, { ...data }); return data; },
    },
    creatorClip: {
      create: async ({ data }: any) => { clips.set(data.id, { ...data }); return clips.get(data.id); },
      findMany: async ({ where }: any) => [...clips.values()].filter((c) => c.sourceReplayId === where.sourceReplayId),
    },
  } as unknown as PrismaService;
}

describe('creator-os Prisma stores', () => {
  it('calendar: create, list, update', async () => {
    const store = new PrismaCalendarStore(makeFakeDb());
    await store.create({ id: 'e1', creatorId: 'c1', title: 'Premiere', kind: 'PREMIERE', scheduledFor: '2026-06-20T00:00:00.000Z', status: 'DRAFT', metadata: undefined });
    expect(await store.list('c1')).toHaveLength(1);
    const up = await store.update('e1', { status: 'SCHEDULED' });
    expect(up.status).toBe('SCHEDULED');
  });

  it('commerce: idempotent purchase recording', async () => {
    const store = new PrismaCommerceStore(makeFakeDb());
    await store.create({ id: 'i1', creatorId: 'c1', roomId: 'room-1', itemType: 'DIGITAL_ITEM', title: 'Sticker', priceCoins: 50, inventory: undefined, sold: 0, active: true, listedAt: '2026-06-18T00:00:00.000Z' });
    expect(await store.findPurchaseByKey('k1')).toBeNull();
    await store.recordPurchase('k1', 'i1', 'b1');
    expect(await store.findPurchaseByKey('k1')).toEqual({ itemId: 'i1', buyerId: 'b1' });
    expect(await store.listByRoom('room-1')).toHaveLength(1);
  });

  it('clips: create and list by replay', async () => {
    const store = new PrismaClipStore(makeFakeDb());
    await store.create({ id: 'cl1', sourceReplayId: 'r1', creatorId: 'c1', lengthSeconds: 30, startOffsetSeconds: 10, clipUrl: 'http://x/clip.mp4', generatedAt: '2026-06-18T00:00:00.000Z' });
    const list = await store.listByReplay('r1');
    expect(list).toHaveLength(1);
    expect(list[0].lengthSeconds).toBe(30);
  });
});
