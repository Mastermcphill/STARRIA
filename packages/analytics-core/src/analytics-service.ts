// ---------------------------------------------------------------------------
// analytics-core — AnalyticsService
// Generalised from LifeNest analytics/analytics.service.ts.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsEventFilter,
  WatchTimeAggregate,
  EngagementMetrics,
} from './types';

// ---------------------------------------------------------------------------
// Storage port
// ---------------------------------------------------------------------------

export interface AnalyticsStorePort {
  insert(event: AnalyticsEvent): Promise<void>;
  query(filter: AnalyticsEventFilter): Promise<AnalyticsEvent[]>;
  aggregateWatchTime(entityId: string, entityType: string): Promise<WatchTimeAggregate | undefined>;
  aggregateEngagement(entityId: string, entityType: string): Promise<EngagementMetrics | undefined>;
}

// ---------------------------------------------------------------------------
// AnalyticsService
// ---------------------------------------------------------------------------

export class AnalyticsService {
  constructor(private readonly store: AnalyticsStorePort) {}

  async track(input: AnalyticsEventInput): Promise<void> {
    const now = new Date().toISOString();
    const event: AnalyticsEvent = {
      id: randomUUID(),
      userId: input.userId,
      creatorId: input.creatorId,
      sessionId: input.sessionId,
      eventName: input.eventName,
      category: input.category,
      entityId: input.entityId,
      entityType: input.entityType,
      roomId: input.roomId,
      value: input.value,
      durationSeconds: input.durationSeconds,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
    };
    await this.store.insert(event);
  }

  async query(filter: AnalyticsEventFilter): Promise<AnalyticsEvent[]> {
    return this.store.query(filter);
  }

  async getWatchTime(entityId: string, entityType: string): Promise<WatchTimeAggregate | undefined> {
    return this.store.aggregateWatchTime(entityId, entityType);
  }

  async getEngagement(entityId: string, entityType: string): Promise<EngagementMetrics | undefined> {
    return this.store.aggregateEngagement(entityId, entityType);
  }
}
