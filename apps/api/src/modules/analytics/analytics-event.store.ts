// ---------------------------------------------------------------------------
// AnalyticsEventStore (Sprint 11) — durable capture of product analytics
// events (views, sessions, purchases, gifts, retention, engagement) into the
// AnalyticsEvent table. Replaces the synthetic StubAnalyticsSource as the
// source of truth; the aggregator rolls these up for creator dashboards.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AnalyticsEventType =
  | 'VIEW'
  | 'SESSION'
  | 'PURCHASE'
  | 'GIFT'
  | 'RETENTION'
  | 'ENGAGEMENT';

export interface RecordAnalyticsEventInput {
  eventType: AnalyticsEventType | string;
  creatorId?: string;
  actorId?: string;
  subjectId?: string;
  subjectType?: string;
  /** Numeric weight for the event (coins gifted, seconds watched, …). Defaults to 1. */
  value?: number;
  metadata?: Record<string, unknown>;
  /** ISO timestamp the event occurred; defaults to now in the DB. */
  occurredAt?: string;
}

export interface AnalyticsEventRecord {
  id: string;
  eventType: string;
  creatorId?: string;
  actorId?: string;
  subjectId?: string;
  subjectType?: string;
  value: number;
  occurredAt: string;
}

@Injectable()
export class AnalyticsEventStore {
  constructor(private readonly db: PrismaService) {}

  async record(input: RecordAnalyticsEventInput): Promise<AnalyticsEventRecord> {
    const row = await this.db.analyticsEvent.create({
      data: {
        eventType: input.eventType,
        creatorId: input.creatorId ?? null,
        actorId: input.actorId ?? null,
        subjectId: input.subjectId ?? null,
        subjectType: input.subjectType ?? null,
        value: input.value ?? 1,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
      },
    });
    return {
      id: row.id,
      eventType: row.eventType,
      creatorId: row.creatorId ?? undefined,
      actorId: row.actorId ?? undefined,
      subjectId: row.subjectId ?? undefined,
      subjectType: row.subjectType ?? undefined,
      value: row.value,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  /** Bulk record (single round-trip) for high-volume capture paths. */
  async recordMany(inputs: RecordAnalyticsEventInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const res = await this.db.analyticsEvent.createMany({
      data: inputs.map((input) => ({
        eventType: input.eventType,
        creatorId: input.creatorId ?? null,
        actorId: input.actorId ?? null,
        subjectId: input.subjectId ?? null,
        subjectType: input.subjectType ?? null,
        value: input.value ?? 1,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
      })),
    });
    return res.count;
  }

  async listForCreator(
    creatorId: string,
    opts: { eventType?: string; from?: string; to?: string; limit?: number } = {},
  ): Promise<AnalyticsEventRecord[]> {
    const rows = await this.db.analyticsEvent.findMany({
      where: {
        creatorId,
        ...(opts.eventType ? { eventType: opts.eventType } : {}),
        ...(opts.from || opts.to
          ? { occurredAt: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: opts.limit ?? 200,
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      creatorId: row.creatorId ?? undefined,
      actorId: row.actorId ?? undefined,
      subjectId: row.subjectId ?? undefined,
      subjectType: row.subjectType ?? undefined,
      value: row.value,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}
