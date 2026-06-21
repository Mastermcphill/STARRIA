// ---------------------------------------------------------------------------
// creator-os-core — Studio types (Sprint 7)
// Poster studio, show planner, analytics, content calendar, live commerce, clips.
// ---------------------------------------------------------------------------

import type {
  ShowType,
  CommerceItemType,
  ClipLength,
} from '@starria/domain-events';

export type { ShowType, CommerceItemType, ClipLength };

// ── Poster Studio ───────────────────────────────────────────────────────────────

export type PosterType = 'COMEDY' | 'AI_MOVIE' | 'LIVE_SHOW' | 'ARENA';

export interface PosterRequest {
  readonly creatorId: string;
  readonly posterType: PosterType;
  readonly title: string;
  readonly subtitle?: string;
  readonly prompt: string;
  readonly style?: string;
  readonly dateLabel?: string;
}

export interface PosterResult {
  readonly id: string;
  readonly creatorId: string;
  readonly posterType: PosterType;
  readonly resultImageUrl: string;
  readonly thumbnailUrl: string;
  readonly coinsCharged: number;
  readonly generatedAt: string;
}

export const POSTER_COIN_COST: Record<PosterType, number> = {
  COMEDY: 50,
  AI_MOVIE: 120,
  LIVE_SHOW: 60,
  ARENA: 80,
};

// ── Show Planner ────────────────────────────────────────────────────────────────

export interface ShowSegment {
  readonly order: number;
  readonly title: string;
  readonly minutes: number;
  readonly kind: string;        // INTRO | INTERACTION | PERFORMANCE | FINALE | ...
  readonly description: string;
}

export interface ShowPlan {
  readonly id: string;
  readonly creatorId: string;
  readonly showType: ShowType;
  readonly durationMinutes: number;
  readonly audienceSize: number;
  readonly segments: ShowSegment[];
  readonly generatedAt: string;
}

export interface ShowPlanRequest {
  readonly creatorId: string;
  readonly showType: ShowType;
  readonly durationMinutes: number;
  readonly audienceSize: number;
}

// ── Analytics ───────────────────────────────────────────────────────────────────

export interface AudienceAnalytics {
  readonly creatorId: string;
  readonly followers: number;
  readonly activeSupporters: number;
  readonly patrons: number;
  readonly avgConcurrentViewers: number;
  readonly topCountries: { country: string; share: number }[];
  readonly retentionPct: number;
}

export interface RevenueAnalytics {
  readonly creatorId: string;
  readonly periodDays: number;
  readonly grossCoins: number;
  readonly netCoins: number;
  readonly platformFeeCoins: number;
  readonly breakdown: { source: string; coins: number }[];
  readonly trend: { day: string; coins: number }[];
}

export interface CreatorInsights {
  readonly creatorId: string;
  readonly headline: string;
  readonly recommendations: string[];
  readonly bestPostingHourUtc: number;
}

// ── Content Calendar / Release Scheduler ─────────────────────────────────────────

export type CalendarEntryStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED';

export interface CalendarEntry {
  readonly id: string;
  readonly creatorId: string;
  readonly title: string;
  readonly kind: string;           // SHOW | REPLAY | POST | PREMIERE
  readonly scheduledFor: string;   // ISO
  readonly status: CalendarEntryStatus;
  readonly metadata?: Record<string, unknown>;
}

// ── Live Commerce ─────────────────────────────────────────────────────────────

export interface CommerceItem {
  readonly id: string;
  readonly creatorId: string;
  readonly roomId?: string;
  readonly itemType: CommerceItemType;
  readonly title: string;
  readonly priceCoins: number;
  readonly inventory?: number;       // undefined = unlimited
  readonly sold: number;
  readonly active: boolean;
  readonly listedAt: string;
}

export interface ListCommerceItemInput {
  readonly creatorId: string;
  readonly roomId?: string;
  readonly itemType: CommerceItemType;
  readonly title: string;
  readonly priceCoins: number;
  readonly inventory?: number;
}

export interface PurchaseCommerceItemInput {
  readonly itemId: string;
  readonly buyerId: string;
  readonly idempotencyKey: string;
}

// ── Clips / Discovery Flywheel ───────────────────────────────────────────────────

export interface Clip {
  readonly id: string;
  readonly sourceReplayId: string;
  readonly creatorId: string;
  readonly lengthSeconds: ClipLength;
  readonly startOffsetSeconds: number;
  readonly clipUrl: string;
  readonly generatedAt: string;
}

export interface GenerateClipsInput {
  readonly sourceReplayId: string;
  readonly creatorId: string;
  readonly durationSeconds: number;
  readonly lengths?: ClipLength[];     // default [15, 30, 60]
  readonly highlightOffsets?: number[]; // optional explicit highlight points
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface PosterGeneratorPort {
  generate(req: PosterRequest): Promise<{ imageUrl: string; thumbnailUrl: string }>;
}

export interface CreatorCoinLedgerPort {
  charge(userId: string, coins: number, reason: string): Promise<void>;
  credit(userId: string, coins: number, reason: string): Promise<void>;
}

export interface AnalyticsSourcePort {
  audience(creatorId: string): Promise<AudienceAnalytics>;
  revenue(creatorId: string, periodDays: number): Promise<RevenueAnalytics>;
}

export interface CalendarStorePort {
  create(entry: CalendarEntry): Promise<CalendarEntry>;
  list(creatorId: string): Promise<CalendarEntry[]>;
  update(id: string, patch: Partial<CalendarEntry>): Promise<CalendarEntry>;
}

export interface CommerceStorePort {
  create(item: CommerceItem): Promise<CommerceItem>;
  get(id: string): Promise<CommerceItem | null>;
  update(id: string, patch: Partial<CommerceItem>): Promise<CommerceItem>;
  listByRoom(roomId: string): Promise<CommerceItem[]>;
  findPurchaseByKey(key: string): Promise<{ itemId: string; buyerId: string } | null>;
  recordPurchase(key: string, itemId: string, buyerId: string): Promise<void>;
}

export interface ClipStorePort {
  create(clip: Clip): Promise<Clip>;
  listByReplay(replayId: string): Promise<Clip[]>;
}

export interface ClipGeneratorPort {
  cut(replayId: string, startOffsetSeconds: number, lengthSeconds: number): Promise<{ clipUrl: string }>;
}
