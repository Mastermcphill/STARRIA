// ---------------------------------------------------------------------------
// feed-core — FeedEngine
// Framework-agnostic FYP / infinite-scroll engine.
// Extracted / generalised from LifeNest feeds/feed.service.ts.
// ---------------------------------------------------------------------------

import type {
  FeedItem,
  FeedPage,
  FeedRequest,
  EngagementSignal,
  UserFeedProfile,
  WatchTimeRecord,
} from './types';

// ---------------------------------------------------------------------------
// Content source port (implement per app)
// ---------------------------------------------------------------------------

export interface FeedContentPort {
  /** Return items matching optional category / tag filter. */
  listItems(filter: {
    category?: string;
    tags?: string[];
    limit: number;
    offset: number;
  }): Promise<FeedItem[]>;
  countItems(filter: { category?: string; tags?: string[] }): Promise<number>;
}

// ---------------------------------------------------------------------------
// Personalisation port (optional — omit for chronological feeds)
// ---------------------------------------------------------------------------

export interface FeedPersonalisationPort {
  getUserProfile(userId: string): Promise<UserFeedProfile | undefined>;
  rankItems(items: FeedItem[], profile: UserFeedProfile): FeedItem[];
}

// ---------------------------------------------------------------------------
// Engagement port (optional — for signal recording)
// ---------------------------------------------------------------------------

export interface FeedEngagementPort {
  record(signal: EngagementSignal): Promise<void>;
  recordWatchTime(record: WatchTimeRecord): Promise<void>;
}

// ---------------------------------------------------------------------------
// Cursor utilities
// ---------------------------------------------------------------------------

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    return Math.max(0, parseInt(Buffer.from(cursor, 'base64url').toString(), 10));
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// FeedEngine
// ---------------------------------------------------------------------------

export class FeedEngine {
  constructor(
    private readonly content: FeedContentPort,
    private readonly personalisation?: FeedPersonalisationPort,
    private readonly engagement?: FeedEngagementPort,
  ) {}

  async getPage(request: FeedRequest): Promise<FeedPage> {
    const limit = Math.min(request.limit ?? 20, 100);
    const offset = decodeCursor(request.cursor);

    let items = await this.content.listItems({
      category: request.category,
      tags: request.tags,
      limit: limit + 1,
      offset,
    });

    const hasMore = items.length > limit;
    if (hasMore) items = items.slice(0, limit);

    // Apply personalisation if requested and available
    if (request.personalised && request.userId && this.personalisation) {
      const profile = await this.personalisation.getUserProfile(request.userId);
      if (profile) {
        items = this.personalisation.rankItems(items, profile);
      }
    } else {
      // Default: sort descending by priority
      items = [...items].sort((a, b) => b.priority - a.priority);
    }

    return {
      items,
      hasMore,
      nextCursor: hasMore ? encodeCursor(offset + limit) : undefined,
    };
  }

  async recordEngagement(signal: EngagementSignal): Promise<void> {
    await this.engagement?.record(signal);
  }

  async recordWatchTime(record: WatchTimeRecord): Promise<void> {
    await this.engagement?.recordWatchTime(record);
  }
}
