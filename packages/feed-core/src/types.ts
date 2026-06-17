// ---------------------------------------------------------------------------
// feed-core — types & interfaces
// Extracted from LifeNest feeds/feed.service.ts and analytics/analytics.service.ts.
// LifeNest-specific districts are replaced with generic string tags.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Feed item
// ---------------------------------------------------------------------------

/** Generic content type tags. Extend with app-specific values. */
export type FeedItemType =
  | 'live_room'
  | 'support_group'
  | 'replay'
  | 'professional'
  | 'storefront'
  | 'video'
  | 'photo'
  | 'reel'
  | string;

export interface FeedItem {
  readonly id: string;
  readonly type: FeedItemType;
  /** App-specific category / vertical / district. */
  readonly category: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly route?: string;
  /** Higher = shown earlier. */
  readonly priority: number;
  readonly tags: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt?: string;
}

// ---------------------------------------------------------------------------
// Feed request / response
// ---------------------------------------------------------------------------

export interface FeedRequest {
  userId?: string;
  category?: string;
  tags?: string[];
  cursor?: string;
  limit?: number;
  /** If true, apply personalised ranking to results. */
  personalised?: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

// ---------------------------------------------------------------------------
// Engagement signals (used by personalisation)
// ---------------------------------------------------------------------------

export type EngagementSignalType =
  | 'view'
  | 'like'
  | 'comment'
  | 'share'
  | 'save'
  | 'watch_complete'
  | 'skip'
  | 'click'
  | 'follow';

export interface EngagementSignal {
  readonly userId: string;
  readonly itemId: string;
  readonly itemType: FeedItemType;
  readonly signal: EngagementSignalType;
  readonly durationMs?: number;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: string;
}

// ---------------------------------------------------------------------------
// Personalisation inputs (used by ranking)
// ---------------------------------------------------------------------------

export interface UserFeedProfile {
  readonly userId: string;
  readonly activeDays: number;
  readonly returningUser: boolean;
  readonly tagAffinity: Record<string, number>;
  readonly categoryAffinity: Record<string, number>;
  readonly creatorAffinity: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Video preloading hint
// ---------------------------------------------------------------------------

export interface VideoPreloadHint {
  readonly itemId: string;
  readonly videoUrl: string;
  readonly priority: 'high' | 'low' | 'idle';
  readonly durationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Watch time record
// ---------------------------------------------------------------------------

export interface WatchTimeRecord {
  readonly userId?: string;
  readonly itemId: string;
  readonly itemType: FeedItemType;
  readonly durationSeconds: number;
  readonly completionPct: number;
  readonly sessionId?: string;
  readonly occurredAt: string;
}
