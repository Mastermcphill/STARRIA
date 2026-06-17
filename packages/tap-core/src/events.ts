// ---------------------------------------------------------------------------
// tap-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type { TapCompletedEvent, TapFailedEvent, TapRefundedEvent } from '@starria/domain-events';
import { TAP_COMPLETED, TAP_FAILED, TAP_REFUNDED } from '@starria/domain-events';

export function buildTapCompletedEvent(params: {
  tapId: string;
  senderId: string;
  receiverId: string;
  type: 'COIN_GIFT' | 'FIAT_TIP';
  currency: string;
  grossAmount: number;
  platformFee: number;
  creatorNet: number;
  reference: string;
  contextType?: string;
  contextId?: string;
  message?: string;
}): TapCompletedEvent {
  return createEvent({
    id: randomUUID(),
    type: TAP_COMPLETED,
    aggregateId: params.tapId,
    aggregateType: 'Tap',
    payload: params,
  });
}

export function buildTapFailedEvent(params: {
  tapId: string;
  senderId: string;
  receiverId: string;
  type: 'COIN_GIFT' | 'FIAT_TIP';
  reason: string;
  idempotencyKey: string;
}): TapFailedEvent {
  return createEvent({
    id: randomUUID(),
    type: TAP_FAILED,
    aggregateId: params.tapId,
    aggregateType: 'Tap',
    payload: params,
  });
}

export function buildTapRefundedEvent(params: {
  tapId: string;
  senderId: string;
  receiverId: string;
  grossAmount: number;
  currency: string;
  refundedAt: string;
}): TapRefundedEvent {
  return createEvent({
    id: randomUUID(),
    type: TAP_REFUNDED,
    aggregateId: params.tapId,
    aggregateType: 'Tap',
    payload: params,
  });
}
