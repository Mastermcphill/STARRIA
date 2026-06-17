// ---------------------------------------------------------------------------
// Prisma adapter stub — SupportRelationship repository
// Wire to SupporterService.supportRelationships port at module startup.
// Business logic: NOT HERE — belongs in support-core.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { Prisma, SupportRelationship } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportRelationshipRepository {
  constructor(private readonly db: PrismaService) {}

  async findById(id: string): Promise<SupportRelationship | null> {
    return this.db.supportRelationship.findUnique({ where: { id } });
  }

  async findBySupporterAndStar(
    supporterProfileId: string,
    starProfileId: string,
  ): Promise<SupportRelationship | null> {
    return this.db.supportRelationship.findUnique({
      where: { supporterProfileId_starProfileId: { supporterProfileId, starProfileId } },
    });
  }

  async upsert(
    supporterProfileId: string,
    starProfileId: string,
    update: Prisma.SupportRelationshipUpdateInput,
  ): Promise<SupportRelationship> {
    return this.db.supportRelationship.upsert({
      where: { supporterProfileId_starProfileId: { supporterProfileId, starProfileId } },
      create: { supporterProfileId, starProfileId, ...update as Prisma.SupportRelationshipCreateInput },
      update,
    });
  }

  async incrementTotals(
    id: string,
    coins: number,
    fiatMinorUnits: number,
  ): Promise<SupportRelationship> {
    return this.db.supportRelationship.update({
      where: { id },
      data: {
        totalCoinsGifted: { increment: coins },
        totalFiatGifted:  { increment: fiatMinorUnits },
        tapCount:         { increment: 1 },
      },
    });
  }

  async listByStar(
    starProfileId: string,
    opts?: { status?: string; limit?: number; cursor?: string },
  ): Promise<SupportRelationship[]> {
    return this.db.supportRelationship.findMany({
      where: {
        starProfileId,
        ...(opts?.status ? { status: opts.status as SupportRelationship['status'] } : {}),
      },
      take: opts?.limit ?? 50,
      cursor: opts?.cursor ? { id: opts.cursor } : undefined,
      orderBy: { totalCoinsGifted: 'desc' },
    });
  }
}
