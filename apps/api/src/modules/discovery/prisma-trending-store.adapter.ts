// Implements discovery-core TrendingStorePort against Prisma.

import { Injectable } from '@nestjs/common';
import type { TrendingStorePort, TrendingItem, Genre } from '@starria/discovery-core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaTrendingStoreAdapter implements TrendingStorePort {
  constructor(private readonly db: PrismaService) {}

  async listTrending(scope: string, limit: number): Promise<TrendingItem[]> {
    const rows = await this.db.trendingScore.findMany({
      where: { scope, video: { status: 'PUBLISHED' } },
      orderBy: { rank: 'asc' },
      take: limit,
      include: {
        video: { include: { discoveryScore: { select: { score: true } } } },
      },
    });

    return rows.map(t => ({
      scope: t.scope,
      rank: t.rank,
      videoId: t.videoId,
      starProfileId: t.video.starProfileId,
      title: t.video.title,
      genre: t.video.genre as Genre,
      country: t.video.country ?? undefined,
      language: t.video.language ?? undefined,
      thumbnailUrl: t.video.thumbnailUrl ?? undefined,
      playbackUrl: t.video.playbackUrl ?? undefined,
      score: t.score,
      tapCount: t.video.tapCount,
      viewCount: t.video.viewCount,
    }));
  }
}
