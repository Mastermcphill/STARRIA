// ---------------------------------------------------------------------------
// analytics-core — types
// Extracted from LifeNest analytics/analytics.service.ts and
// analytics/economy-analytics.service.ts.
// ---------------------------------------------------------------------------

export type AnalyticsEntityType =
  | 'room'
  | 'replay'
  | 'creator'
  | 'subscription'
  | 'recommendation'
  | 'user'
  | 'search'
  | 'post'
  | 'video'
  | 'comment'
  | string;

// ---------------------------------------------------------------------------
// Raw event
// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  readonly id: string;
  readonly userId?: string;
  readonly creatorId?: string;
  readonly sessionId?: string;
  readonly eventName: string;
  readonly category?: string;
  readonly entityId?: string;
  readonly entityType?: AnalyticsEntityType;
  readonly roomId?: string;
  readonly value?: number;
  readonly durationSeconds?: number;
  readonly metadata: Record<string, unknown>;
  readonly occurredAt: string;
  readonly createdAt: string;
}

export type AnalyticsEventInput = Partial<Omit<AnalyticsEvent, 'id' | 'createdAt' | 'metadata'>> & {
  eventName: string;
  metadata?: Record<string, unknown>;
};

export interface AnalyticsEventFilter {
  userId?: string;
  creatorId?: string;
  entityId?: string;
  entityType?: AnalyticsEntityType;
  roomId?: string;
  eventName?: string;
  category?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Watch time / retention
// ---------------------------------------------------------------------------

export interface WatchTimeAggregate {
  readonly entityId: string;
  readonly entityType: AnalyticsEntityType;
  readonly totalWatchSeconds: number;
  readonly uniqueViewers: number;
  readonly averageWatchSeconds: number;
  readonly completionRate: number;
}

export interface RetentionMetric {
  readonly cohortDate: string;
  readonly userCount: number;
  readonly retainedDay1: number;
  readonly retainedDay7: number;
  readonly retainedDay30: number;
}

// ---------------------------------------------------------------------------
// Engagement metrics
// ---------------------------------------------------------------------------

export interface EngagementMetrics {
  readonly entityId: string;
  readonly entityType: AnalyticsEntityType;
  readonly views: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly saves: number;
  readonly completions: number;
  readonly engagementRate: number;
}

// ---------------------------------------------------------------------------
// Creator dashboard
// ---------------------------------------------------------------------------

export interface CreatorEarningsSummary {
  readonly creatorId: string;
  readonly totalTips: number;
  readonly totalGifts: number;
  readonly totalSubscriptionRevenue: number;
  readonly totalPayouts: number;
  readonly pendingPayouts: number;
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

// ---------------------------------------------------------------------------
// Platform dashboard
// ---------------------------------------------------------------------------

export interface PlatformRevenueSummary {
  readonly totalPlatformFees: number;
  readonly totalTransactionVolume: number;
  readonly totalActiveCreators: number;
  readonly totalSubscriptions: number;
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

// ---------------------------------------------------------------------------
// Active entity (for ranking)
// ---------------------------------------------------------------------------

export interface ActiveEntity {
  readonly id: string;
  readonly type: 'room' | 'replay' | string;
  readonly title: string;
  readonly creatorId?: string;
  readonly category?: string;
  readonly score: number;
  readonly rankReasons: string[];
  readonly metrics: Record<string, number>;
  readonly lastActivityAt?: string;
}
