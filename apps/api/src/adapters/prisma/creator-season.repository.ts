// ---------------------------------------------------------------------------
// Prisma adapter stub — CreatorSeason repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { CreatorSeason, CreatorSeasonStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CreatorSeasonRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    starProfileId: string;
    name: string;
    number: number;
    description?: string;
    coverImageUrl?: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<CreatorSeason> {
    return this.db.creatorSeason.create({ data });
  }

  async findById(id: string): Promise<CreatorSeason | null> {
    return this.db.creatorSeason.findUnique({ where: { id } });
  }

  async findActive(starProfileId: string): Promise<CreatorSeason | null> {
    return this.db.creatorSeason.findFirst({
      where: { starProfileId, status: 'ACTIVE' },
    });
  }

  async transitionStatus(id: string, status: CreatorSeasonStatus): Promise<CreatorSeason> {
    return this.db.creatorSeason.update({ where: { id }, data: { status } });
  }

  async incrementTotals(
    id: string,
    coins: number,
    events = 0,
  ): Promise<CreatorSeason> {
    return this.db.creatorSeason.update({
      where: { id },
      data: {
        totalCoinsEarned: { increment: coins },
        totalEvents:      { increment: events },
      },
    });
  }

  async listByStar(
    starProfileId: string,
    opts?: { status?: CreatorSeasonStatus },
  ): Promise<CreatorSeason[]> {
    return this.db.creatorSeason.findMany({
      where: { starProfileId, ...(opts?.status ? { status: opts.status } : {}) },
      orderBy: { number: 'desc' },
    });
  }
}
