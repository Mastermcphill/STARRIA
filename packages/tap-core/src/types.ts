// ---------------------------------------------------------------------------
// tap-core — types
// A Tap is the STARRIA branded micropayment.
// Gift execution is delegated to TapGiftPort (wired at app layer).
// No direct dependency on gifting-core or wallet-core.
// ---------------------------------------------------------------------------

/** Mirror of gifting-core's GiftTargetType — kept local to avoid package coupling. */
export type TapTargetType = 'VIDEO' | 'PHOTO' | 'REEL' | 'PROFILE' | 'LIVESTREAM';

// ---------------------------------------------------------------------------
// Tap identity
// ---------------------------------------------------------------------------

export type TapCurrency = 'COINS' | string; // 'COINS' = internal, else ISO 4217 fiat

export type TapType = 'COIN_GIFT' | 'FIAT_TIP';

export type TapStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';

export type TapContextType = 'event' | 'arena' | 'profile' | 'replay';

// ---------------------------------------------------------------------------
// Tap record
// ---------------------------------------------------------------------------

export interface TapRecord {
  readonly id: string;
  readonly senderId: string;
  readonly receiverId: string;
  readonly type: TapType;
  readonly status: TapStatus;
  readonly currency: TapCurrency;
  /** Gross amount before commission split. COINS: integer, fiat: minor units. */
  readonly grossAmount: number;
  readonly platformFee: number;
  readonly creatorNet: number;
  readonly platformPercentage: number;
  /** Context in which the Tap was sent. */
  readonly contextType?: TapContextType;
  readonly contextId?: string;
  readonly targetType: TapTargetType;
  readonly message?: string;
  readonly giftType?: string;
  readonly idempotencyKey: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}

// ---------------------------------------------------------------------------
// Send tap inputs
// ---------------------------------------------------------------------------

export interface SendCoinTapInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly coins: number;
  readonly contextType?: TapContextType;
  readonly contextId?: string;
  readonly message?: string;
  readonly giftType?: string;
  readonly idempotencyKey: string;
}

export interface SendFiatTapInput {
  readonly senderId: string;
  readonly receiverId: string;
  /** Minor units (e.g. cents / kobo). */
  readonly amount: number;
  readonly currency: string;
  readonly contextType?: TapContextType;
  readonly contextId?: string;
  readonly message?: string;
  readonly idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Tap result
// ---------------------------------------------------------------------------

export interface TapResult {
  readonly tapId: string;
  readonly status: TapStatus;
  readonly reference: string;
  readonly type: TapType;
  readonly grossAmount: number;
  readonly platformFee: number;
  readonly creatorNet: number;
  readonly senderBalanceAfter?: number;
  readonly deduped: boolean;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  readonly rank: number;
  readonly supporterId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly totalCoins: number;
  readonly totalFiat: number;
  readonly tapCount: number;
}

export interface LeaderboardQuery {
  readonly starId: string;
  readonly contextId?: string;
  readonly contextType?: TapContextType;
  readonly period: LeaderboardPeriod;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Tap history filters
// ---------------------------------------------------------------------------

export interface TapHistoryFilter {
  senderId?: string;
  receiverId?: string;
  contextType?: TapContextType;
  contextId?: string;
  type?: TapType;
  status?: TapStatus;
  since?: string;
  until?: string;
  cursor?: string;
  limit?: number;
}

export interface TapPage {
  readonly items: TapRecord[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly total?: number;
}

// ---------------------------------------------------------------------------
// Tap analytics snapshot
// ---------------------------------------------------------------------------

export interface TapSnapshot {
  readonly entityId: string;
  readonly entityType: TapContextType;
  readonly totalCoins: number;
  readonly totalFiat: number;
  readonly tapCount: number;
  readonly uniqueSenders: number;
  readonly periodStart: string;
  readonly periodEnd: string;
}
