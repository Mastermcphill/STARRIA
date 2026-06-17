// ---------------------------------------------------------------------------
// tap-core — port interfaces
// ---------------------------------------------------------------------------

import type {
  TapRecord,
  TapHistoryFilter,
  TapPage,
  LeaderboardEntry,
  LeaderboardQuery,
  TapSnapshot,
  TapTargetType,
} from './types';

// ---------------------------------------------------------------------------
// Gift execution port — replaces the direct @starria/gifting-core imports.
// Implement in the app layer by adapting CoinGiftingService / FiatGiftingService.
// ---------------------------------------------------------------------------

export interface CoinGiftPortResult {
  readonly reference: string;
  readonly targetType: TapTargetType;
  readonly platformCut: number;
  readonly creatorAmount: number;
  readonly platformPercentage: number;
  readonly senderBalance: number;
  readonly creatorBalance: number;
}

export interface FiatGiftPortResult {
  readonly giftId: string;
  readonly reference: string;
  readonly platformFee: number;
  readonly creatorAmount: number;
  readonly targetType: TapTargetType;
}

export interface TapGiftPort {
  sendCoinGift(input: {
    senderId: string;
    recipientId: string;
    coins: number;
    targetType: TapTargetType;
    contentId?: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<CoinGiftPortResult>;

  sendFiatGift(input: {
    senderId: string;
    recipientId: string;
    amount: number;
    currency: string;
    targetType: TapTargetType;
    roomId?: string;
    note?: string;
    idempotencyKey: string;
  }): Promise<FiatGiftPortResult>;
}

// ---------------------------------------------------------------------------
// Tap persistence port
// ---------------------------------------------------------------------------

export interface TapStorePort {
  findById(tapId: string): Promise<TapRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<TapRecord | undefined>;
  create(tap: Omit<TapRecord, 'id' | 'createdAt'>): Promise<TapRecord>;
  updateStatus(tapId: string, status: TapRecord['status'], settledAt?: string): Promise<TapRecord>;
  list(filter: TapHistoryFilter): Promise<TapPage>;
  sumByContext(contextType: string, contextId: string): Promise<{ totalCoins: number; totalFiat: number; tapCount: number }>;
}

// ---------------------------------------------------------------------------
// Leaderboard port
// ---------------------------------------------------------------------------

export interface TapLeaderboardPort {
  getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]>;
  /** Increment running totals for a supporter on a given leaderboard. */
  recordContribution(params: {
    starId: string;
    supporterId: string;
    coins: number;
    fiatMinorUnits: number;
    contextType?: string;
    contextId?: string;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Analytics port (writes to analytics-core)
// ---------------------------------------------------------------------------

export interface TapAnalyticsPort {
  trackTap(tap: TapRecord): Promise<void>;
  getSnapshot(contextType: string, contextId: string, since: string, until: string): Promise<TapSnapshot | undefined>;
}

// ---------------------------------------------------------------------------
// Notification port (tap received push)
// ---------------------------------------------------------------------------

export interface TapNotificationPort {
  onTapReceived(params: {
    receiverId: string;
    senderId: string;
    tapId: string;
    grossAmount: number;
    currency: string;
    contextType?: string;
    contextId?: string;
    message?: string;
  }): Promise<void>;
}
