// ---------------------------------------------------------------------------
// Prisma adapter stub — PosterGeneration repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { PosterGeneration, PosterGenerationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PosterGenerationRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    starProfileId: string;
    eventId?: string;
    prompt: string;
    style?: string;
    model?: string;
  }): Promise<PosterGeneration> {
    return this.db.posterGeneration.create({ data });
  }

  async findById(id: string): Promise<PosterGeneration | null> {
    return this.db.posterGeneration.findUnique({ where: { id } });
  }

  async complete(
    id: string,
    resultImageUrl: string,
    storageKey: string,
    generationMs: number,
  ): Promise<PosterGeneration> {
    return this.db.posterGeneration.update({
      where: { id },
      data: { status: 'COMPLETED', resultImageUrl, storageKey, generationMs },
    });
  }

  async fail(id: string): Promise<PosterGeneration> {
    return this.db.posterGeneration.update({ where: { id }, data: { status: 'FAILED' } });
  }

  async listByStar(
    starProfileId: string,
    opts?: { status?: PosterGenerationStatus; limit?: number },
  ): Promise<PosterGeneration[]> {
    return this.db.posterGeneration.findMany({
      where: { starProfileId, ...(opts?.status ? { status: opts.status } : {}) },
      take: opts?.limit ?? 20,
      orderBy: { createdAt: 'desc' },
    });
  }
}
