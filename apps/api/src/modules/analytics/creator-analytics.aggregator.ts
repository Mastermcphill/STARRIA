// ---------------------------------------------------------------------------
// CreatorAnalyticsAggregator (Sprint 11) — rolls AnalyticsEvent rows up into
// daily / weekly / monthly AnalyticsRollup buckets per creator + metric
// (eventType). Idempotent: re-running over the same window recomputes the same
// bucket values (upsert by [creatorId, period, periodKey, metric]).
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { periodKeyFor, type RollupPeriod } from './period-key';

export interface RollupBucket {
  creatorId: string;
  period: RollupPeriod;
  periodKey: string;
  metric: string;
  value: number;
  count: number;
}

@Injectable()
export class CreatorAnalyticsAggregator {
  constructor(private readonly db: PrismaService) {}

  /**
   * Aggregate every event for a creator in [from, to] into rollups for the
   * given period. Returns the buckets written. Pure grouping is done in-process
   * so it is deterministic and DB-portable.
   */
  async rollup(
    creatorId: string,
    period: RollupPeriod,
    range: { from: string; to: string },
  ): Promise<RollupBucket[]> {
    const events = await this.db.analyticsEvent.findMany({
      where: { creatorId, occurredAt: { gte: new Date(range.from), lte: new Date(range.to) } },
      select: { eventType: true, value: true, occurredAt: true },
    });

    const buckets = new Map<string, RollupBucket>();
    for (const e of events) {
      const periodKey = periodKeyFor(period, e.occurredAt.toISOString());
      const k = `${periodKey}::${e.eventType}`;
      const existing = buckets.get(k);
      if (existing) {
        existing.value += e.value;
        existing.count += 1;
      } else {
        buckets.set(k, { creatorId, period, periodKey, metric: e.eventType, value: e.value, count: 1 });
      }
    }

    const out = [...buckets.values()];
    for (const b of out) {
      await this.db.analyticsRollup.upsert({
        where: {
          creatorId_period_periodKey_metric: {
            creatorId: b.creatorId,
            period: b.period,
            periodKey: b.periodKey,
            metric: b.metric,
          },
        },
        create: { creatorId: b.creatorId, period: b.period, periodKey: b.periodKey, metric: b.metric, value: b.value, count: b.count },
        update: { value: b.value, count: b.count },
      });
    }
    return out;
  }

  /** Run daily, weekly and monthly rollups for a window in one call. */
  async rollupAll(creatorId: string, range: { from: string; to: string }): Promise<RollupBucket[]> {
    const periods: RollupPeriod[] = ['DAY', 'WEEK', 'MONTH'];
    const results: RollupBucket[] = [];
    for (const p of periods) results.push(...(await this.rollup(creatorId, p, range)));
    return results;
  }

  /** Read previously-computed rollups for a creator. */
  async getRollups(creatorId: string, period: RollupPeriod): Promise<RollupBucket[]> {
    const rows = await this.db.analyticsRollup.findMany({
      where: { creatorId, period },
      orderBy: { periodKey: 'desc' },
    });
    return rows.map((r) => ({
      creatorId: r.creatorId,
      period: r.period as RollupPeriod,
      periodKey: r.periodKey,
      metric: r.metric,
      value: r.value,
      count: r.count,
    }));
  }
}
