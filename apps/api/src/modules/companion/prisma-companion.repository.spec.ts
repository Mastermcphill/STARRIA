// Unit tests for PrismaCompanionRepository + PrismaSessionRepository using an
// in-memory fake of the PrismaService delegates (no DB).

import { PrismaCompanionRepository } from './prisma-companion.repository';
import { PrismaSessionRepository } from './prisma-session.repository';
import type { PrismaService } from '../../prisma/prisma.service';

function table() {
  const rows = new Map<string, any>();
  let seq = 0;
  return { rows, id: () => `id-${++seq}` };
}

function makeFakeDb() {
  const profiles = table();
  const rates = new Map<string, any>(); // composite key
  const bookings = table();
  const reservations = table();

  return {
    companionProfile: {
      create: async ({ data }: any) => {
        const now = new Date();
        const row = { id: profiles.id(), createdAt: now, updatedAt: now, ...data };
        profiles.rows.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return profiles.rows.get(where.id) ?? null;
        if (where.userId) return [...profiles.rows.values()].find((p) => p.userId === where.userId) ?? null;
        return null;
      },
      update: async ({ where, data }: any) => {
        const row = { ...profiles.rows.get(where.id), ...data, updatedAt: new Date() };
        profiles.rows.set(where.id, row);
        return row;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let rows = [...profiles.rows.values()].filter((p) => p.status === where.status);
        if (where.sessionTypes?.has) rows = rows.filter((p) => p.sessionTypes.includes(where.sessionTypes.has));
        if (where.isAvailableNow !== undefined) rows = rows.filter((p) => p.isAvailableNow === where.isAvailableNow);
        return rows.slice(skip, skip + take);
      },
    },
    companionRate: {
      upsert: async ({ where, create, update }: any) => {
        const k = JSON.stringify(where.companionId_sessionType_durationMinutes);
        const existing = rates.get(k);
        const row = existing ? { ...existing, ...update } : { ...create };
        rates.set(k, row);
        return row;
      },
      findMany: async ({ where }: any) => [...rates.values()].filter((r) => r.companionId === where.companionId),
      findUnique: async ({ where }: any) =>
        rates.get(JSON.stringify(where.companionId_sessionType_durationMinutes)) ?? null,
    },
    sessionBooking: {
      create: async ({ data }: any) => {
        const row = { id: bookings.id(), createdAt: new Date(), ...data };
        bookings.rows.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return bookings.rows.get(where.id) ?? null;
        if (where.idempotencyKey)
          return [...bookings.rows.values()].find((b) => b.idempotencyKey === where.idempotencyKey) ?? null;
        return null;
      },
      update: async ({ where, data }: any) => {
        const row = { ...bookings.rows.get(where.id), ...data };
        bookings.rows.set(where.id, row);
        return row;
      },
    },
    sessionReservation: {
      create: async ({ data }: any) => {
        const now = new Date();
        const row = { id: reservations.id(), createdAt: now, updatedAt: now, ...data };
        reservations.rows.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => reservations.rows.get(where.id) ?? null,
      findFirst: async ({ where }: any) =>
        [...reservations.rows.values()].find((r) => r.bookingId === where.bookingId) ?? null,
      update: async ({ where, data }: any) => {
        const row = { ...reservations.rows.get(where.id), ...data, updatedAt: new Date() };
        reservations.rows.set(where.id, row);
        return row;
      },
    },
  } as unknown as PrismaService;
}

const baseProfile = {
  userId: 'u1', displayName: 'Aria', bio: undefined, nationality: 'JP',
  languages: ['en', 'ja'], timezone: 'Asia/Tokyo', heightCm: undefined,
  hobbies: [], interests: [], sessionTypes: ['VIDEO' as const], activities: ['CHATTING' as const],
  verificationStatus: 'VERIFIED' as const, verificationBadge: true, ageVerified: true,
  introVideoUrl: undefined, introImageUrls: [], status: 'ACTIVE' as const, isAvailableNow: true,
  averageRating: 0, reviewCount: 0, totalSessionMinutes: 0,
};

describe('PrismaCompanionRepository', () => {
  it('creates, finds by user, and discovers by sessionType', async () => {
    const repo = new PrismaCompanionRepository(makeFakeDb());
    const created = await repo.create(baseProfile);
    expect(created.languages).toEqual(['en', 'ja']);
    expect(await repo.findByUserId('u1')).not.toBeNull();
    const found = await repo.discover({ sessionType: 'VIDEO', availableNow: true });
    expect(found).toHaveLength(1);
    expect(await repo.discover({ sessionType: 'AUDIO' })).toHaveLength(0);
  });

  it('upserts rates idempotently on the composite key', async () => {
    const repo = new PrismaCompanionRepository(makeFakeDb());
    const rate = { companionId: 'c1', sessionType: 'VIDEO' as const, durationMinutes: 30 as const, coinCost: 100, maxParticipants: 1, isEnabled: true };
    await repo.upsertRate(rate);
    await repo.upsertRate({ ...rate, coinCost: 150 });
    const rates = await repo.getRates('c1');
    expect(rates).toHaveLength(1);
    expect(rates[0].coinCost).toBe(150);
  });
});

describe('PrismaSessionRepository', () => {
  it('round-trips a booking by idempotency key and updates status', async () => {
    const repo = new PrismaSessionRepository(makeFakeDb());
    const b = await repo.createBooking({
      companionId: 'c1', patronId: 'p1', sessionType: 'VIDEO', durationMinutes: 30,
      coinCost: 100, status: 'PENDING', idempotencyKey: 'bk-1',
      scheduledAt: '2026-06-18T10:00:00.000Z',
    });
    expect((await repo.findBookingByKey('bk-1'))?.id).toBe(b.id);
    const updated = await repo.updateBooking(b.id, { status: 'CONFIRMED', sessionId: 's1' });
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.sessionId).toBe('s1');
  });
});
