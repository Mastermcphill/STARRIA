// Implements SupporterStorePort from @starria/support-core against Prisma.

import { Injectable } from '@nestjs/common';
import type {
  SupporterStorePort,
  SupporterProfile,
  CreateSupporterProfileInput,
  UpdateSupporterProfileInput,
  SupporterListFilter,
} from '@starria/support-core';
import { computeSupporterTier } from '@starria/support-core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaSupporterStore implements SupporterStorePort {
  constructor(private readonly db: PrismaService) {}

  async findById(supporterId: string): Promise<SupporterProfile | undefined> {
    const row = await this.db.supporterProfile.findUnique({ where: { id: supporterId } });
    return row ? this.toProfile(row) : undefined;
  }

  async findByUserId(userId: string): Promise<SupporterProfile | undefined> {
    const row = await this.db.supporterProfile.findUnique({ where: { userId } });
    return row ? this.toProfile(row) : undefined;
  }

  async create(input: CreateSupporterProfileInput): Promise<SupporterProfile> {
    const row = await this.db.supporterProfile.create({
      data: {
        userId: input.userId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        bio: input.bio,
        tier: 'free',
        lifetimeCoinsSpent: 0,
        lifetimeFiatSpent: 0,
      },
    });
    return this.toProfile(row);
  }

  async update(supporterId: string, input: UpdateSupporterProfileInput): Promise<SupporterProfile> {
    const row = await this.db.supporterProfile.update({
      where: { id: supporterId },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.bio !== undefined && { bio: input.bio }),
      },
    });
    return this.toProfile(row);
  }

  async incrementSpend(supporterId: string, coins: number, fiatMinorUnits: number): Promise<SupporterProfile> {
    const row = await this.db.supporterProfile.update({
      where: { id: supporterId },
      data: {
        lifetimeCoinsSpent: { increment: coins },
        lifetimeFiatSpent: { increment: fiatMinorUnits },
      },
    });
    const newTier = computeSupporterTier(row.lifetimeCoinsSpent);
    if (row.tier !== newTier) {
      const updated = await this.db.supporterProfile.update({
        where: { id: supporterId },
        data: { tier: newTier },
      });
      return this.toProfile(updated);
    }
    return this.toProfile(row);
  }

  async list(filter: SupporterListFilter) {
    const rows = await this.db.supporterProfile.findMany({
      where: { ...(filter.tier ? { tier: filter.tier } : {}) },
      take: filter.limit ?? 20,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const nextCursor = rows.length === (filter.limit ?? 20) ? rows[rows.length - 1]?.id : undefined;
    return {
      items: rows.map(r => this.toProfile(r)),
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  private toProfile(row: {
    id: string; userId: string; displayName: string; avatarUrl: string | null; bio: string | null;
    tier: string; lifetimeCoinsSpent: number; lifetimeFiatSpent: number;
    createdAt: Date; updatedAt: Date;
  }): SupporterProfile {
    return {
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? undefined,
      bio: row.bio ?? undefined,
      tier: row.tier as SupporterProfile['tier'],
      lifetimeCoinsSpent: row.lifetimeCoinsSpent,
      lifetimeFiatSpent: row.lifetimeFiatSpent,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
