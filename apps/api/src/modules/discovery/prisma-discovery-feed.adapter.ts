// Implements discovery-core DiscoveryFeedPort against Prisma.

import { Injectable } from '@nestjs/common';
import type { DiscoveryFeedPort, DiscoveryItem, Genre } from '@starria/discovery-core';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaDiscoveryFeedAdapter implements DiscoveryFeedPort {
  constructor(private readonly db: PrismaService) {}

  async listByGenre(params: {
    genre: Genre;
    country?: string;
    language?: string;
    excludeVideoIds?: string[];
    limit: number;
    offset: number;
  }): Promise<DiscoveryItem[]> {
    const where: Prisma.VideoWhereInput = {
      status: 'PUBLISHED',
      genre: params.genre as Prisma.VideoWhereInput['genre'],
    };
    if (params.country) where.country = params.country;
    if (params.language) where.language = params.language;
    if (params.excludeVideoIds?.length) where.id = { notIn: params.excludeVideoIds };

    const rows = await this.db.video.findMany({
      where,
      orderBy: { discoveryScore: { score: 'desc' } },
      take: params.limit,
      skip: params.offset,
      include: { discoveryScore: { select: { score: true } } },
    });

    return rows.map(v => ({
      videoId: v.id,
      starProfileId: v.starProfileId,
      title: v.title,
      genre: v.genre as Genre,
      country: v.country ?? undefined,
      language: v.language ?? undefined,
      thumbnailUrl: v.thumbnailUrl ?? undefined,
      playbackUrl: v.playbackUrl ?? undefined,
      score: v.discoveryScore?.score ?? 0,
      tapCount: v.tapCount,
      viewCount: v.viewCount,
    }));
  }
}
