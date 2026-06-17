// ---------------------------------------------------------------------------
// gifting-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  CoinGiftSentEvent,
  FiatGiftSentEvent,
  LivestreamGiftSentEvent,
} from '@starria/domain-events';
import {
  GIFT_COIN_SENT,
  GIFT_FIAT_SENT,
  GIFT_LIVESTREAM_SENT,
} from '@starria/domain-events';

export function buildCoinGiftSentEvent(params: {
  reference: string;
  senderId: string;
  recipientId: string;
  coins: number;
  platformCut: number;
  creatorAmount: number;
  platformPercentage: number;
  targetType: string;
  contentId?: string;
  idempotencyKey?: string;
}): CoinGiftSentEvent {
  return createEvent({
    id: randomUUID(),
    type: GIFT_COIN_SENT,
    aggregateId: params.reference,
    aggregateType: 'CoinGift',
    payload: params,
  });
}

export function buildFiatGiftSentEvent(params: {
  giftId: string;
  reference: string;
  senderId?: string;
  recipientId?: string;
  amount: number;
  currency: string;
  platformFee: number;
  creatorAmount: number;
  targetType: string;
  roomId?: string;
}): FiatGiftSentEvent {
  return createEvent({
    id: randomUUID(),
    type: GIFT_FIAT_SENT,
    aggregateId: params.giftId,
    aggregateType: 'FiatGift',
    payload: params,
  });
}

export function buildLivestreamGiftSentEvent(params: {
  id: string;
  reference: string;
  senderId: string;
  recipientId: string;
  roomId: string;
  currency: string;
  amount: number;
  platformCut: number;
  creatorAmount: number;
  giftType?: string;
}): LivestreamGiftSentEvent {
  return createEvent({
    id: randomUUID(),
    type: GIFT_LIVESTREAM_SENT,
    aggregateId: params.id,
    aggregateType: 'LivestreamGift',
    payload: params,
  });
}
