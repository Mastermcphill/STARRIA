// Implements search-core SearchIndexPort against the Prisma Video table.
// Documents are sourced live from Video (status = PUBLISHED), so upsert/remove
// are no-ops — there is no separate search index table in the MVP.

import { Injectable } from '@nestjs/common';
import type {
  SearchIndexPort,
  NormalisedSearchQuery,
  SearchDocument,
  SearchResult,
} from '@starria/search-core';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaSearchAdapter implements SearchIndexPort {
  constructor(private readonly db: PrismaService) {}

  async upsert(): Promise<void> { /* sourced live from Video */ }
  async remove(): Promise<void> { /* sourced live from Video */ }

  async search(query: NormalisedSearchQuery): Promise<SearchResult> {
    const where: Prisma.VideoWhereInput = { status: 'PUBLISHED' };

    if (query.genre) where.genre = query.genre as Prisma.VideoWhereInput['genre'];
    if (query.country) where.country = query.country;
    if (query.language) where.language = query.language;
    if (query.creatorId) where.starProfileId = query.creatorId;

    // Resolve creator handle (username) → starProfileId
    if (query.creatorHandle) {
      const user = await this.db.user.findUnique({
        where: { username: query.creatorHandle },
        select: { starProfile: { select: { id: true } } },
      });
      where.starProfileId = user?.starProfile?.id ?? '__no_match__';
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { tags: { has: query.q } },
      ];
    }

    const orderBy: Prisma.VideoOrderByWithRelationInput =
      query.sort === 'recent'
        ? { publishedAt: 'desc' }
        : { discoveryScore: { score: 'desc' } };

    const [rows, total] = await Promise.all([
      this.db.video.findMany({
        where,
        orderBy,
        take: query.limit,
        skip: query.offset,
        include: {
          discoveryScore: { select: { score: true } },
          starProfile: { select: { id: true, user: { select: { username: true } } } },
        },
      }),
      this.db.video.count({ where }),
    ]);

    const items: SearchDocument[] = rows.map(v => ({
      id: v.id,
      type: 'video',
      title: v.title,
      creatorId: v.starProfileId,
      creatorHandle: v.starProfile?.user?.username,
      country: v.country ?? undefined,
      language: v.language ?? undefined,
      genre: v.genre,
      tags: v.tags,
      thumbnailUrl: v.thumbnailUrl ?? undefined,
      score: v.discoveryScore?.score ?? 0,
      publishedAt: v.publishedAt?.toISOString(),
    }));

    return { items, total, limit: query.limit, offset: query.offset };
  }
}
