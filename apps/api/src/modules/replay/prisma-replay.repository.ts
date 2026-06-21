// ---------------------------------------------------------------------------
// replay — Prisma adapter for ReplayStorePort (Sprint 10).
// Replaces the in-memory Map with the Replay table. The media processor,
// discovery publisher and access-gate adapters remain unchanged (external/stub).
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ReplayStorePort,
  Replay,
  ReplayVisibility,
  ReplayStatus,
} from '@starria/replay-core';
import type { Replay as DbReplay } from '@prisma/client';

function toReplay(r: DbReplay): Replay {
  return {
    id: r.id,
    roomId: r.roomId,
    recordingId: r.recordingId,
    creatorId: r.creatorId,
    sourceRoomType: r.sourceRoomType,
    status: r.status as ReplayStatus,
    visibility: r.visibility as ReplayVisibility,
    rawAssetUrl: r.rawAssetUrl ?? undefined,
    playbackUrl: r.playbackUrl ?? undefined,
    posterUrl: r.posterUrl ?? undefined,
    thumbnailUrls: r.thumbnailUrls,
    durationSeconds: r.durationSeconds,
    priceCoins: r.priceCoins ?? undefined,
    minSubscriberTier: r.minSubscriberTier ?? undefined,
    title: r.title,
    viewCount: r.viewCount,
    pushedToDiscovery: r.pushedToDiscovery,
    createdAt: r.createdAt.toISOString(),
    publishedAt: r.publishedAt?.toISOString(),
  };
}

@Injectable()
export class PrismaReplayRepository implements ReplayStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(replay: Replay): Promise<Replay> {
    const r = await this.db.replay.create({
      data: {
        id: replay.id,
        roomId: replay.roomId,
        recordingId: replay.recordingId,
        creatorId: replay.creatorId,
        sourceRoomType: replay.sourceRoomType,
        status: replay.status,
        visibility: replay.visibility,
        rawAssetUrl: replay.rawAssetUrl ?? null,
        playbackUrl: replay.playbackUrl ?? null,
        posterUrl: replay.posterUrl ?? null,
        thumbnailUrls: [...replay.thumbnailUrls],
        durationSeconds: replay.durationSeconds,
        priceCoins: replay.priceCoins ?? null,
        minSubscriberTier: replay.minSubscriberTier ?? null,
        title: replay.title,
        viewCount: replay.viewCount,
        pushedToDiscovery: replay.pushedToDiscovery,
        createdAt: new Date(replay.createdAt),
        publishedAt: replay.publishedAt ? new Date(replay.publishedAt) : null,
      },
    });
    return toReplay(r);
  }

  async get(replayId: string): Promise<Replay | null> {
    const r = await this.db.replay.findUnique({ where: { id: replayId } });
    return r ? toReplay(r) : null;
  }

  async getByRecording(recordingId: string): Promise<Replay | null> {
    const r = await this.db.replay.findFirst({ where: { recordingId } });
    return r ? toReplay(r) : null;
  }

  async update(replayId: string, patch: Partial<Replay>): Promise<Replay> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.visibility !== undefined) data.visibility = patch.visibility;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.durationSeconds !== undefined) data.durationSeconds = patch.durationSeconds;
    if (patch.viewCount !== undefined) data.viewCount = patch.viewCount;
    if (patch.pushedToDiscovery !== undefined) data.pushedToDiscovery = patch.pushedToDiscovery;
    if (patch.rawAssetUrl !== undefined) data.rawAssetUrl = patch.rawAssetUrl ?? null;
    if (patch.playbackUrl !== undefined) data.playbackUrl = patch.playbackUrl ?? null;
    if (patch.posterUrl !== undefined) data.posterUrl = patch.posterUrl ?? null;
    if (patch.thumbnailUrls !== undefined) data.thumbnailUrls = [...patch.thumbnailUrls];
    if (patch.priceCoins !== undefined) data.priceCoins = patch.priceCoins ?? null;
    if (patch.minSubscriberTier !== undefined) data.minSubscriberTier = patch.minSubscriberTier ?? null;
    if (patch.publishedAt !== undefined) data.publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : null;
    const r = await this.db.replay.update({ where: { id: replayId }, data });
    return toReplay(r);
  }

  async listByCreator(creatorId: string): Promise<Replay[]> {
    const rows = await this.db.replay.findMany({ where: { creatorId } });
    return rows.map(toReplay);
  }

  async listDiscoverable(visibility?: ReplayVisibility): Promise<Replay[]> {
    const rows = await this.db.replay.findMany({
      where: { pushedToDiscovery: true, ...(visibility ? { visibility } : {}) },
    });
    return rows.map(toReplay);
  }

  async incrementViews(replayId: string): Promise<void> {
    await this.db.replay.update({ where: { id: replayId }, data: { viewCount: { increment: 1 } } });
  }
}
