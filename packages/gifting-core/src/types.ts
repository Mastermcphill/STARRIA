// ---------------------------------------------------------------------------
// gifting-core — shared types
// Extracted from LifeNest tipping + coins + livestream-gifts modules.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gift target
// ---------------------------------------------------------------------------

/** Canonical content type a gift can target. */
export type GiftTargetType =
  | 'VIDEO'
  | 'PHOTO'
  | 'REEL'
  | 'PROFILE'
  | 'LIVESTREAM';

/** Maps LifeNest / legacy aliases → GiftTargetType. Extend per app. */
export const GIFT_TARGET_ALIASES: Record<string, GiftTargetType> = {
  video: 'VIDEO',
  photo: 'PHOTO',
  reel: 'REEL',
  nestreel: 'REEL',
  post: 'REEL',
  profile: 'PROFILE',
  livestream: 'LIVESTREAM',
  live: 'LIVESTREAM',
};

export function normalizeGiftTargetType(raw?: string): GiftTargetType | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toUpperCase() as GiftTargetType;
  const validTypes: GiftTargetType[] = ['VIDEO', 'PHOTO', 'REEL', 'PROFILE', 'LIVESTREAM'];
  if (validTypes.includes(normalized)) return normalized;
  return GIFT_TARGET_ALIASES[raw.trim().toLowerCase()];
}

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

export interface GiftCommissionConfig {
  /** Platform cut in percent (0–100). Default: 40. */
  getPercent(): number;
  setPercent(pct: number): void;
}

/** Create a simple in-process commission config (env-backed or overridable). */
export function createCommissionConfig(defaultPct = 40): GiftCommissionConfig {
  let pct = Math.max(0, Math.min(100, defaultPct));
  return {
    getPercent: () => pct,
    setPercent: (v) => { pct = Math.max(0, Math.min(100, v)); },
  };
}

/** Calculate the platform ↔ creator split for a given gross amount. */
export function calculateGiftSplit(
  gross: number,
  platformPercent: number,
): { platformFee: number; creatorAmount: number } {
  const platformFee = Math.round(gross * platformPercent) / 100;
  return { platformFee, creatorAmount: gross - platformFee };
}

// ---------------------------------------------------------------------------
// Fiat gift (NGN / any currency)
// ---------------------------------------------------------------------------

export type GiftRecipientType = 'creator' | 'professional';

export interface SendFiatGiftInput {
  readonly idempotencyKey?: string;
  readonly senderId?: string;
  readonly senderRole?: string;
  readonly recipientId?: string;
  readonly recipientType?: GiftRecipientType;
  readonly amount?: number;
  readonly currency?: string;
  readonly targetType?: string;
  readonly contentId?: string;
  readonly roomId?: string;
  readonly note?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface FiatGiftResult {
  readonly status: 'accepted';
  readonly accepted: true;
  readonly giftId: string;
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
  readonly platformFee: number;
  readonly creatorAmount: number;
  readonly targetType: GiftTargetType;
  readonly deduped: boolean;
}

// ---------------------------------------------------------------------------
// Coin gift
// ---------------------------------------------------------------------------

export interface SendCoinGiftInput {
  readonly senderId: string;
  readonly recipientId: string;
  readonly coins: number;
  readonly targetType?: string;
  readonly contentId?: string;
  readonly reference?: string;
  readonly idempotencyKey?: string;
  readonly note?: string;
}

export interface CoinGiftResult {
  readonly status: 'accepted';
  readonly reference: string;
  readonly currency: 'COINS';
  readonly targetType: GiftTargetType;
  readonly coins: number;
  readonly platformCut: number;
  readonly creatorAmount: number;
  readonly platformPercentage: number;
  readonly senderBalance: number;
  readonly creatorBalance: number;
}

// ---------------------------------------------------------------------------
// Livestream gift
// ---------------------------------------------------------------------------

export type LivestreamGiftCurrency = 'COINS' | 'NGN' | string;

export interface SendLivestreamGiftInput {
  readonly senderId: string;
  readonly recipientId: string;
  readonly roomId: string;
  readonly currency: LivestreamGiftCurrency;
  readonly amount: number;
  readonly giftType?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LivestreamGiftRecord {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly roomId: string;
  readonly currency: LivestreamGiftCurrency;
  readonly amount: number;
  readonly platformCut: number;
  readonly creatorAmount: number;
  readonly giftType?: string;
  readonly reference: string;
  readonly sentAt: string;
}

// ---------------------------------------------------------------------------
// Gift history
// ---------------------------------------------------------------------------

export interface GiftHistoryFilter {
  senderId?: string;
  recipientId?: string;
  roomId?: string;
  currency?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}
