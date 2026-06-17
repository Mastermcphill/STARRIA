// ---------------------------------------------------------------------------
// Prisma adapter stub — GoldStarProfile repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { GoldStarProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoldStarProfileRepository {
  constructor(private readonly db: PrismaService) {}

  async findByStarProfileId(starProfileId: string): Promise<GoldStarProfile | null> {
    return this.db.goldStarProfile.findUnique({ where: { starProfileId } });
  }

  async grant(data: {
    starProfileId: string;
    grantedByUserId: string;
    expiresAt?: Date;
    reason?: string;
    benefits?: Record<string, unknown>;
  }): Promise<GoldStarProfile> {
    return this.db.goldStarProfile.create({ data });
  }

  async revoke(
    starProfileId: string,
    revokedByUserId: string,
    reason?: string,
  ): Promise<GoldStarProfile> {
    return this.db.goldStarProfile.update({
      where: { starProfileId },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedByUserId, reason },
    });
  }

  async expireStale(): Promise<Prisma.BatchPayload> {
    return this.db.goldStarProfile.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }
}
