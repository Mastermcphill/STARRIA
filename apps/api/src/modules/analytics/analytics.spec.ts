// Unit tests for the analytics pipeline: pure period-key bucketing and the
// CreatorAnalyticsAggregator rollup logic (with an in-memory fake PrismaService).

import { periodKeyFor } from './period-key';
import { CreatorAnalyticsAggregator } from './creator-analytics.aggregator';
import { AnalyticsEventStore } from './analytics-event.store';
import type { PrismaService } from '../../prisma/prisma.service';

describe('periodKeyFor', () => {
  it('buckets day/week/month from a UTC timestamp', () => {
    const iso = '2026-06-18T13:45:00.000Z'; // Thursday, ISO week 25
    expect(periodKeyFor('DAY', iso)).toBe('2026-06-18');
    expect(periodKeyFor('MONTH', iso)).toBe('2026-06');
    expect(periodKeyFor('WEEK', iso)).toBe('2026-W25');
  });
});

function makeFakeDb() {
  const events: any[] = [];
  const rollups = new Map<string, any>();
  return {
    analyticsEvent: {
      create: async ({ data }: any) => {
        const row = { id: `e${events.length + 1}`, occurredAt: data.occurredAt ?? new Date(), ...data };
        events.push(row);
        return row;
      },
      createMany: async ({ data }: any) => { data.forEach((d: any) => events.push({ id: `e${events.length + 1}`, occurredAt: d.occurredAt ?? new Date(), ...d })); return { count: data.length }; },
      findMany: async ({ where }: any) =>
        events.filter((e) =>
          e.creatorId === where.creatorId &&
          (where.occurredAt ? e.occurredAt >= where.occurredAt.gte && e.occurredAt <= where.occurredAt.lte : true),
        ),
    },
    analyticsRollup: {
      upsert: async ({ where, create, update }: any) => {
        const w = where.creatorId_period_periodKey_metric;
        const k = `${w.creatorId}:${w.period}:${w.periodKey}:${w.metric}`;
        const row = rollups.has(k) ? { ...rollups.get(k), ...update } : { ...create };
        rollups.set(k, row);
        return row;
      },
      findMany: async ({ where }: any) =>
        [...rollups.values()].filter((r) => r.creatorId === where.creatorId && r.period === where.period),
    },
    _rollups: rollups,
  } as unknown as PrismaService & { _rollups: Map<string, any> };
}

describe('CreatorAnalyticsAggregator', () => {
  it('rolls events up into daily buckets per metric, summing value and count', async () => {
    const db = makeFakeDb();
    const store = new AnalyticsEventStore(db);
    await store.record({ eventType: 'GIFT', creatorId: 'c1', value: 100, occurredAt: '2026-06-18T01:00:00.000Z' });
    await store.record({ eventType: 'GIFT', creatorId: 'c1', value: 50, occurredAt: '2026-06-18T02:00:00.000Z' });
    await store.record({ eventType: 'VIEW', creatorId: 'c1', value: 1, occurredAt: '2026-06-18T03:00:00.000Z' });
    await store.record({ eventType: 'GIFT', creatorId: 'c1', value: 999, occurredAt: '2026-06-19T01:00:00.000Z' });

    const buckets = await new CreatorAnalyticsAggregator(db).rollup('c1', 'DAY', {
      from: '2026-06-18T00:00:00.000Z',
      to: '2026-06-18T23:59:59.000Z',
    });

    const gift = buckets.find((b) => b.metric === 'GIFT' && b.periodKey === '2026-06-18');
    expect(gift).toMatchObject({ value: 150, count: 2 });
    const view = buckets.find((b) => b.metric === 'VIEW');
    expect(view).toMatchObject({ value: 1, count: 1 });
    // the 2026-06-19 gift is outside the window
    expect(buckets.find((b) => b.periodKey === '2026-06-19')).toBeUndefined();
  });

  it('rollup is idempotent — re-running yields the same stored values', async () => {
    const db = makeFakeDb();
    const store = new AnalyticsEventStore(db);
    await store.record({ eventType: 'PURCHASE', creatorId: 'c1', value: 10, occurredAt: '2026-06-18T01:00:00.000Z' });
    const agg = new CreatorAnalyticsAggregator(db);
    const range = { from: '2026-06-18T00:00:00.000Z', to: '2026-06-18T23:59:59.000Z' };
    await agg.rollup('c1', 'DAY', range);
    await agg.rollup('c1', 'DAY', range);
    const stored = await agg.getRollups('c1', 'DAY');
    expect(stored.filter((r) => r.metric === 'PURCHASE')).toHaveLength(1);
    expect(stored.find((r) => r.metric === 'PURCHASE')).toMatchObject({ value: 10, count: 1 });
  });
});
