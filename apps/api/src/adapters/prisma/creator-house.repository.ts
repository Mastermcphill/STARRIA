// ---------------------------------------------------------------------------
// Prisma adapter stub — CreatorHouse + CreatorHouseMember repositories
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { CreatorHouse, CreatorHouseMember } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CreatorHouseRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    ownerStarProfileId: string;
  }): Promise<CreatorHouse> {
    return this.db.creatorHouse.create({ data });
  }

  async findById(id: string): Promise<CreatorHouse | null> {
    return this.db.creatorHouse.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<CreatorHouse | null> {
    return this.db.creatorHouse.findUnique({ where: { slug } });
  }

  async incrementMemberCount(id: string, delta: number): Promise<CreatorHouse> {
    return this.db.creatorHouse.update({
      where: { id },
      data: { memberCount: { increment: delta } },
    });
  }

  async archive(id: string): Promise<CreatorHouse> {
    return this.db.creatorHouse.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  async addMember(data: {
    creatorHouseId: string;
    starProfileId: string;
    userId: string;
    role?: string;
  }): Promise<CreatorHouseMember> {
    return this.db.creatorHouseMember.create({ data });
  }

  async removeMember(
    creatorHouseId: string,
    starProfileId: string,
  ): Promise<CreatorHouseMember> {
    return this.db.creatorHouseMember.update({
      where: { creatorHouseId_starProfileId: { creatorHouseId, starProfileId } },
      data: { leftAt: new Date() },
    });
  }

  async listMembers(
    creatorHouseId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<CreatorHouseMember[]> {
    return this.db.creatorHouseMember.findMany({
      where: { creatorHouseId, leftAt: null },
      take: opts?.limit ?? 50,
      cursor: opts?.cursor ? { id: opts.cursor } : undefined,
      orderBy: { joinedAt: 'asc' },
    });
  }
}
