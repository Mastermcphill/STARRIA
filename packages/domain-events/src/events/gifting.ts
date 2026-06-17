// ---------------------------------------------------------------------------
// domain-events — gifting-core events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const GIFT_COIN_SENT        = 'gift.coin.sent';
export const GIFT_FIAT_SENT        = 'gift.fiat.sent';
export const GIFT_LIVESTREAM_SENT  = 'gift.livestream.sent';

export interface CoinGiftSentPayload {
  readonly reference: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly coins: number;
  readonly platformCut: number;
  readonly creatorAmount: number;
  readonly platformPercentage: number;
  readonly targetType: string;
  readonly contentId?: string;
  readonly idempotencyKey?: string;
}

export interface FiatGiftSentPayload {
  readonly giftId: string;
  readonly reference: string;
  readonly senderId?: string;
  readonly recipientId?: string;
  readonly amount: number;
  readonly currency: string;
  readonly platformFee: number;
  readonly creatorAmount: number;
  readonly targetType: string;
  readonly roomId?: string;
}

export interface LivestreamGiftSentPayload {
  readonly id: string;
  readonly reference: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly roomId: string;
  readonly currency: string;
  readonly amount: number;
  readonly platformCut: number;
  readonly creatorAmount: number;
  readonly giftType?: string;
}

export type CoinGiftSentEvent       = DomainEvent<CoinGiftSentPayload>;
export type FiatGiftSentEvent       = DomainEvent<FiatGiftSentPayload>;
export type LivestreamGiftSentEvent = DomainEvent<LivestreamGiftSentPayload>;
