// ---------------------------------------------------------------------------
// Prisma adapter stub — SupportMilestone repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { SupportMilestone, SupportMilestoneType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportMilestoneRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    supportRelationshipId: string;
    type: SupportMilestoneType;
    thresholdValue: number;
    metadata?: Record<string, unknown>;
  }): Promise<SupportMilestone> {
    return this.db.supportMilestone.create({ data });
  }

  async markNotified(id: string): Promise<SupportMilestone> {
    return this.db.supportMilestone.update({
      where: { id },
      data: { notifiedAt: new Date() },
    });
  }

  async listByRelationship(
    supportRelationshipId: string,
  ): Promise<SupportMilestone[]> {
    return this.db.supportMilestone.findMany({
      where: { supportRelationshipId },
      orderBy: { achievedAt: 'desc' },
    });
  }

  async existsByType(
    supportRelationshipId: string,
    type: SupportMilestoneType,
    thresholdValue: number,
  ): Promise<boolean> {
    const count = await this.db.supportMilestone.count({
      where: { supportRelationshipId, type, thresholdValue },
    });
    return count > 0;
  }
}
