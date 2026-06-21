// Unit test for PrismaReplayRepository with an in-memory fake of PrismaService.

import { PrismaReplayRepository } from './prisma-replay.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Replay } from '@starria/replay-core';

function makeFakeDb() {
  const replays = new Map<string, any>();
  return {
    replay: {
      create: async ({ data }: any) => {
        replays.set(data.id, { ...data });
        return replays.get(data.id);
      },
      findUnique: async ({ where }: any) => replays.get(where.id) ?? null,
      findFirst: async ({ where }: any) =>
        [...replays.values()].find((r) => r.recordingId === where.recordingId) ?? null,
      findMany: async ({ where }: any) =>
        [...replays.values()].filter(
          (r) =>
            (where.creatorId ? r.creatorId === where.creatorId : true) &&
            (where.pushedToDiscovery !== undefined ? r.pushedToDiscovery === where.pushedToDiscovery : true) &&
            (where.visibility ? r.visibility === where.visibility : true),
        ),
      update: async ({ where, data }: any) => {
        const cur = replays.get(where.id);
        const next = { ...cur };
        for (const [k, v] of Object.entries(data)) {
          next[k] = v && typeof v === 'object' && 'increment' in (v as any) ? cur[k] + (v as any).increment : v;
        }
        replays.set(where.id, next);
        return next;
      },
    },
  } as unknown as PrismaService;
}

const replay: Replay = {
  id: 'r1', roomId: 'room-1', recordingId: 'rec-1', creatorId: 'c1', sourceRoomType: 'LIVE_EVENT',
  status: 'READY', visibility: 'PUBLIC', rawAssetUrl: undefined, playbackUrl: undefined,
  posterUrl: undefined, thumbnailUrls: [], durationSeconds: 120, priceCoins: undefined,
  minSubscriberTier: undefined, title: 'Replay', viewCount: 0, pushedToDiscovery: false,
  createdAt: '2026-06-18T00:00:00.000Z', publishedAt: undefined,
};

describe('PrismaReplayRepository', () => {
  it('creates, finds by recording, and increments views', async () => {
    const repo = new PrismaReplayRepository(makeFakeDb());
    await repo.create(replay);
    expect((await repo.getByRecording('rec-1'))?.id).toBe('r1');
    await repo.incrementViews('r1');
    await repo.incrementViews('r1');
    expect((await repo.get('r1'))?.viewCount).toBe(2);
  });

  it('lists discoverable replays after publish', async () => {
    const repo = new PrismaReplayRepository(makeFakeDb());
    await repo.create(replay);
    expect(await repo.listDiscoverable()).toHaveLength(0);
    await repo.update('r1', { pushedToDiscovery: true, publishedAt: '2026-06-18T01:00:00.000Z' });
    const disc = await repo.listDiscoverable('PUBLIC');
    expect(disc).toHaveLength(1);
    expect(disc[0].publishedAt).toBe('2026-06-18T01:00:00.000Z');
  });
});
