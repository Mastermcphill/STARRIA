// ---------------------------------------------------------------------------
// Prisma adapter stub — TapStorm repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { Prisma, TapStorm, TapStormStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TapStormRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    starProfileId: string;
    title: string;
    description?: string;
    contextType?: string;
    contextId?: string;
    startsAt: Date;
    endsAt: Date;
    goalCoins: number;
  }): Promise<TapStorm> {
    return this.db.tapStorm.create({ data });
  }

  async findById(id: string): Promise<TapStorm | null> {
    return this.db.tapStorm.findUnique({ where: { id } });
  }

  async findActive(starProfileId: string): Promise<TapStorm | null> {
    return this.db.tapStorm.findFirst({
      where: { starProfileId, status: 'ACTIVE' },
      orderBy: { startsAt: 'asc' },
    });
  }

  async incrementProgress(
    id: string,
    coins: number,
  ): Promise<TapStorm> {
    return this.db.tapStorm.update({
      where: { id },
      data: {
        totalCoinsCollected: { increment: coins },
        tapCount:            { increment: 1 },
      },
    });
  }

  async transitionStatus(id: string, status: TapStormStatus): Promise<TapStorm> {
    return this.db.tapStorm.update({ where: { id }, data: { status } });
  }

  async listByContext(contextType: string, contextId: string): Promise<TapStorm[]> {
    return this.db.tapStorm.findMany({
      where: { contextType, contextId },
      orderBy: { startsAt: 'desc' },
    });
  }
}
