// ---------------------------------------------------------------------------
// Prisma adapter stub — StarHistory repository (append-only audit log)
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { StarHistory, StarHistoryEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StarHistoryRepository {
  constructor(private readonly db: PrismaService) {}

  async append(data: {
    starProfileId: string;
    eventType: StarHistoryEventType;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    changedByUserId?: string;
    reason?: string;
  }): Promise<StarHistory> {
    return this.db.starHistory.create({ data });
  }

  async listByStar(
    starProfileId: string,
    opts?: { limit?: number; cursor?: string; eventType?: StarHistoryEventType },
  ): Promise<StarHistory[]> {
    return this.db.starHistory.findMany({
      where: {
        starProfileId,
        ...(opts?.eventType ? { eventType: opts.eventType } : {}),
      },
      take: opts?.limit ?? 50,
      cursor: opts?.cursor ? { id: opts.cursor } : undefined,
      orderBy: { changedAt: 'desc' },
    });
  }
}
