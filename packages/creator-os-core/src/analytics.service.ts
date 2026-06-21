// ---------------------------------------------------------------------------
// creator-os-core — AnalyticsService + CalendarService (Sprint 7, Phase 4)
// Audience/revenue analytics, creator insights, content calendar & scheduler.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  AudienceAnalytics,
  RevenueAnalytics,
  CreatorInsights,
  CalendarEntry,
  AnalyticsSourcePort,
  CalendarStorePort,
} from './studio.types';

export interface AnalyticsDeps {
  source: AnalyticsSourcePort;
}

export class CreatorAnalyticsService {
  constructor(private readonly deps: AnalyticsDeps) {}

  audience(creatorId: string): Promise<AudienceAnalytics> {
    return this.deps.source.audience(creatorId);
  }

  revenue(creatorId: string, periodDays = 30): Promise<RevenueAnalytics> {
    return this.deps.source.revenue(creatorId, periodDays);
  }

  /** Derive lightweight, deterministic insights from the analytics sources. */
  async insights(creatorId: string): Promise<CreatorInsights> {
    const [audience, revenue] = await Promise.all([
      this.deps.source.audience(creatorId),
      this.deps.source.revenue(creatorId, 30),
    ]);

    const recommendations: string[] = [];
    if (audience.retentionPct < 40) {
      recommendations.push('Retention is low — tighten your intro segment and hook viewers in the first 2 minutes.');
    }
    if (audience.activeSupporters > 0 && audience.patrons / Math.max(1, audience.activeSupporters) < 0.05) {
      recommendations.push('Few supporters convert to patrons — add a patron-only segment or perk.');
    }
    if (revenue.breakdown.find((b) => b.source === 'REPLAY')?.coins ?? 0) {
      recommendations.push('Replays are earning — publish clips to drive more replay traffic.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Healthy metrics — keep a consistent schedule to compound growth.');
    }

    // Best posting hour: peak of the revenue trend mapped to a UTC hour bucket.
    const peakDayIdx = revenue.trend.reduce((best, cur, i, arr) => (cur.coins > arr[best].coins ? i : best), 0);
    const bestPostingHourUtc = (18 + peakDayIdx) % 24;

    return {
      creatorId,
      headline: `You earned ${revenue.netCoins} coins from ${audience.activeSupporters} active supporters this period.`,
      recommendations,
      bestPostingHourUtc,
    };
  }
}

export interface CalendarDeps {
  store: CalendarStorePort;
}

export class ContentCalendarService {
  constructor(private readonly deps: CalendarDeps) {}

  schedule(params: {
    creatorId: string; title: string; kind: string; scheduledFor: string; metadata?: Record<string, unknown>;
  }): Promise<CalendarEntry> {
    return this.deps.store.create({
      id: randomUUID(),
      creatorId: params.creatorId,
      title: params.title,
      kind: params.kind,
      scheduledFor: params.scheduledFor,
      status: 'SCHEDULED',
      metadata: params.metadata,
    });
  }

  list(creatorId: string): Promise<CalendarEntry[]> {
    return this.deps.store.list(creatorId);
  }

  publish(entryId: string): Promise<CalendarEntry> {
    return this.deps.store.update(entryId, { status: 'PUBLISHED' });
  }

  cancel(entryId: string): Promise<CalendarEntry> {
    return this.deps.store.update(entryId, { status: 'CANCELLED' });
  }
}
