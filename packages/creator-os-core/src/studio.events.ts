// ---------------------------------------------------------------------------
// creator-os-core — Studio domain event builders (Sprint 7)
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  ShowPlanGeneratedEvent,
  PosterStudioGeneratedEvent,
  CommerceItemListedEvent,
  CommerceItemSoldEvent,
  GiftingOverlayShownEvent,
  ClipGeneratedEvent,
  TeaserGeneratedEvent,
  ShowPlanGeneratedPayload,
  PosterStudioGeneratedPayload,
  CommerceItemListedPayload,
  CommerceItemSoldPayload,
  GiftingOverlayShownPayload,
  ClipGeneratedPayload,
  TeaserGeneratedPayload,
} from '@starria/domain-events';
import {
  SHOW_PLAN_GENERATED,
  POSTER_STUDIO_GENERATED,
  COMMERCE_ITEM_LISTED,
  COMMERCE_ITEM_SOLD,
  GIFTING_OVERLAY_SHOWN,
  CLIP_GENERATED,
  TEASER_GENERATED,
} from '@starria/domain-events';

export function buildShowPlanGenerated(p: ShowPlanGeneratedPayload): ShowPlanGeneratedEvent {
  return createEvent({ id: randomUUID(), type: SHOW_PLAN_GENERATED, aggregateId: p.planId, aggregateType: 'ShowPlan', payload: p });
}
export function buildPosterStudioGenerated(p: PosterStudioGeneratedPayload): PosterStudioGeneratedEvent {
  return createEvent({ id: randomUUID(), type: POSTER_STUDIO_GENERATED, aggregateId: p.posterId, aggregateType: 'Poster', payload: p });
}
export function buildCommerceItemListed(p: CommerceItemListedPayload): CommerceItemListedEvent {
  return createEvent({ id: randomUUID(), type: COMMERCE_ITEM_LISTED, aggregateId: p.itemId, aggregateType: 'CommerceItem', payload: p });
}
export function buildCommerceItemSold(p: CommerceItemSoldPayload): CommerceItemSoldEvent {
  return createEvent({ id: randomUUID(), type: COMMERCE_ITEM_SOLD, aggregateId: p.itemId, aggregateType: 'CommerceItem', payload: p });
}
export function buildGiftingOverlayShown(p: GiftingOverlayShownPayload): GiftingOverlayShownEvent {
  return createEvent({ id: randomUUID(), type: GIFTING_OVERLAY_SHOWN, aggregateId: p.roomId, aggregateType: 'SessionRoom', payload: p });
}
export function buildClipGenerated(p: ClipGeneratedPayload): ClipGeneratedEvent {
  return createEvent({ id: randomUUID(), type: CLIP_GENERATED, aggregateId: p.clipId, aggregateType: 'Clip', payload: p });
}
export function buildTeaserGenerated(p: TeaserGeneratedPayload): TeaserGeneratedEvent {
  return createEvent({ id: randomUUID(), type: TEASER_GENERATED, aggregateId: p.teaserId, aggregateType: 'Teaser', payload: p });
}
