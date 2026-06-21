// Unit test for PrismaSessionEngineRepository with an in-memory fake of PrismaService.

import { PrismaSessionEngineRepository } from './prisma-session-engine.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionRoom } from '@starria/session-engine-core';

function makeFakeDb() {
  const rooms = new Map<string, any>();
  const participants: any[] = [];
  return {
    sessionRoom: {
      create: async ({ data }: any) => {
        rooms.set(data.id, { ...data });
        return rooms.get(data.id);
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return rooms.get(where.id) ?? null;
        if (where.idempotencyKey)
          return [...rooms.values()].find((r) => r.idempotencyKey === where.idempotencyKey) ?? null;
        return null;
      },
      update: async ({ where, data }: any) => {
        const row = { ...rooms.get(where.id), ...data };
        rooms.set(where.id, row);
        return row;
      },
      findMany: async ({ where }: any) =>
        [...rooms.values()].filter(
          (r) =>
            (where?.status ? r.status === where.status : true) &&
            (where?.roomType ? r.roomType === where.roomType : true),
        ),
    },
    sessionRoomParticipant: {
      create: async ({ data }: any) => {
        participants.push({ ...data });
        return data;
      },
      findFirst: async ({ where }: any) =>
        participants.find((p) => p.roomId === where.roomId && p.userId === where.userId) ?? null,
      updateMany: async ({ where, data }: any) => {
        participants.forEach((p, i) => {
          if (p.roomId === where.roomId && p.userId === where.userId) participants[i] = { ...p, ...data };
        });
        return { count: 1 };
      },
      findMany: async ({ where }: any) => participants.filter((p) => p.roomId === where.roomId),
      count: async ({ where }: any) =>
        participants.filter((p) => p.roomId === where.roomId && p.status === where.status).length,
    },
  } as unknown as PrismaService;
}

const room: SessionRoom = {
  id: 'room-1', roomType: 'LIVE_EVENT', title: 'Show', hostId: 'h1', status: 'CREATED',
  maxParticipants: 100, livekitRoomName: 'lk-room-1',
  billing: { mode: 'FREE', platformFeePct: 20, creatorPct: 80 },
  permissions: { canPublishVideo: ['HOST'], canPublishAudio: ['HOST'], canScreenShare: [], canInvite: ['HOST'], canModerate: ['HOST'], canRecord: ['HOST'] },
  recordingEnabled: false, replayPublishing: false, metadata: undefined,
  createdAt: '2026-06-18T00:00:00.000Z',
};

describe('PrismaSessionEngineRepository', () => {
  it('creates a room, sets/finds idempotency key, and round-trips billing+permissions JSON', async () => {
    const repo = new PrismaSessionEngineRepository(makeFakeDb());
    const created = await repo.createRoom(room);
    expect(created.billing.mode).toBe('FREE');
    expect(created.permissions.canRecord).toEqual(['HOST']);
    await repo.setRoomKey('idem-1', 'room-1');
    expect((await repo.findRoomByKey('idem-1'))?.id).toBe('room-1');
  });

  it('tracks participants and counts active', async () => {
    const repo = new PrismaSessionEngineRepository(makeFakeDb());
    await repo.createRoom(room);
    await repo.addParticipant({ id: 'p1', roomId: 'room-1', userId: 'u1', role: 'GUEST', status: 'JOINED' });
    await repo.addParticipant({ id: 'p2', roomId: 'room-1', userId: 'u2', role: 'GUEST', status: 'INVITED' });
    expect(await repo.countActiveParticipants('room-1')).toBe(1);
    await repo.updateParticipant('room-1', 'u2', { status: 'JOINED' });
    expect(await repo.countActiveParticipants('room-1')).toBe(2);
  });
});
