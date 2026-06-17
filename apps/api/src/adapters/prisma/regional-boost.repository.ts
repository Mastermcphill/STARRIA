// ---------------------------------------------------------------------------
// Prisma adapter stub — RegionalBoost repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { Prisma, RegionalBoost, RegionalEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RegionalBoostRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    entityType: RegionalEntityType;
    entityId: string;
    region: string;
    boostScore?: number;
    expiresAt?: Date;
    authorizedByUserId: string;
    reason?: string;
  }): Promise<RegionalBoost> {
    return this.db.regionalBoost.create({ data });
  }

  async listActive(entityType: RegionalEntityType, entityId: string): Promise<RegionalBoost[]> {
    return this.db.regionalBoost.findMany({
      where: {
        entityType,
        entityId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async listActiveByRegion(region: string, entityType?: RegionalEntityType): Promise<RegionalBoost[]> {
    return this.db.regionalBoost.findMany({
      where: {
        region,
        isActive: true,
        ...(entityType ? { entityType } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { boostScore: 'desc' },
    });
  }

  async deactivate(id: string): Promise<RegionalBoost> {
    return this.db.regionalBoost.update({ where: { id }, data: { isActive: false } });
  }

  async expireStale(): Promise<Prisma.BatchPayload> {
    return this.db.regionalBoost.updateMany({
      where: { isActive: true, expiresAt: { lt: new Date() } },
      data: { isActive: false },
    });
  }
}
