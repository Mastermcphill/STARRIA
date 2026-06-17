// Implements SubscriptionStorePort from @starria/support-core against Prisma.

import { Injectable } from '@nestjs/common';
import type { SubscriptionStorePort, Subscription, SubscribeInput, SubscriptionListFilter } from '@starria/support-core';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaSubscription = {
  id: string;
  supporterProfileId: string;
  starProfileId: string;
  tier: string;
  status: string;
  startedAt: Date;
  endsAt: Date | null;
  cancelledAt: Date | null;
  renewalEnabled: boolean;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaSubscriptionStore implements SubscriptionStorePort {
  constructor(private readonly db: PrismaService) {}

  async findById(subscriptionId: string): Promise<Subscription | undefined> {
    const row = await this.db.subscription.findUnique({ where: { id: subscriptionId } }) as PrismaSubscription | null;
    return row ? this.toSubscription(row) : undefined;
  }

  async findActive(supporterId: string, starId: string): Promise<Subscription | undefined> {
    const row = await this.db.subscription.findFirst({
      where: { supporterProfileId: supporterId, starProfileId: starId, status: 'active' },
    }) as PrismaSubscription | null;
    return row ? this.toSubscription(row) : undefined;
  }

  async findByIdempotencyKey(key: string): Promise<Subscription | undefined> {
    const row = await this.db.subscription.findUnique({ where: { idempotencyKey: key } }) as PrismaSubscription | null;
    return row ? this.toSubscription(row) : undefined;
  }

  async create(sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const row = await this.db.subscription.create({
      data: {
        supporterProfileId: sub.supporterId,
        starProfileId: sub.starId,
        tier: sub.tier,
        status: sub.status,
        startedAt: new Date(sub.startedAt),
        endsAt: sub.endsAt ? new Date(sub.endsAt) : null,
        cancelledAt: sub.cancelledAt ? new Date(sub.cancelledAt) : null,
        renewalEnabled: sub.renewalEnabled,
        idempotencyKey: sub.idempotencyKey,
      },
    }) as PrismaSubscription;
    return this.toSubscription(row);
  }

  async updateStatus(
    subscriptionId: string,
    status: Subscription['status'],
    patch?: Partial<Pick<Subscription, 'endsAt' | 'cancelledAt' | 'renewalEnabled'>>,
  ): Promise<Subscription> {
    const row = await this.db.subscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        ...(patch?.endsAt !== undefined && { endsAt: patch.endsAt ? new Date(patch.endsAt) : null }),
        ...(patch?.cancelledAt !== undefined && { cancelledAt: patch.cancelledAt ? new Date(patch.cancelledAt) : null }),
        ...(patch?.renewalEnabled !== undefined && { renewalEnabled: patch.renewalEnabled }),
      },
    }) as PrismaSubscription;
    return this.toSubscription(row);
  }

  async list(filter: SubscriptionListFilter) {
    const where: Record<string, unknown> = {};
    if (filter.supporterId) where['supporterProfileId'] = filter.supporterId;
    if (filter.starId) where['starProfileId'] = filter.starId;
    if (filter.status) where['status'] = filter.status;

    const rows = await this.db.subscription.findMany({
      where,
      take: filter.limit ?? 20,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    }) as PrismaSubscription[];

    const nextCursor = rows.length === (filter.limit ?? 20) ? rows[rows.length - 1]?.id : undefined;
    return { items: rows.map(r => this.toSubscription(r)), nextCursor, hasMore: !!nextCursor };
  }

  async countActive(starId: string): Promise<number> {
    return this.db.subscription.count({ where: { starProfileId: starId, status: 'active' } });
  }

  private toSubscription(row: PrismaSubscription): Subscription {
    return {
      id: row.id,
      supporterId: row.supporterProfileId,
      starId: row.starProfileId,
      tier: row.tier as Subscription['tier'],
      status: row.status as Subscription['status'],
      startedAt: row.startedAt.toISOString(),
      endsAt: row.endsAt?.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString(),
      renewalEnabled: row.renewalEnabled,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
