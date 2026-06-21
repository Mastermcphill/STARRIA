// ---------------------------------------------------------------------------
// domain-events — Creator OS studio events (Sprint 7)
// Poster studio, show planner, live commerce, discovery flywheel / clips.
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

// ── Show planner ────────────────────────────────────────────────────────────────

export type ShowType = 'STANDUP' | 'RAP_BATTLE' | 'SING_OFF' | 'QA' | 'AI_PREMIERE';

export const SHOW_PLAN_GENERATED = 'creator-os.show-plan.generated';
export const POSTER_STUDIO_GENERATED = 'creator-os.poster-studio.generated';

export interface ShowPlanGeneratedPayload {
  readonly planId: string;
  readonly creatorId: string;
  readonly showType: ShowType;
  readonly durationMinutes: number;
  readonly audienceSize: number;
  readonly segmentCount: number;
  readonly generatedAt: string;
}

export interface PosterStudioGeneratedPayload {
  readonly posterId: string;
  readonly creatorId: string;
  readonly posterType: string;
  readonly resultImageUrl: string;
  readonly coinsCharged: number;
  readonly generatedAt: string;
}

// ── Live commerce ───────────────────────────────────────────────────────────────

export type CommerceItemType = 'TICKET' | 'PREMIUM_REPLAY' | 'SUBSCRIPTION' | 'DIGITAL_ITEM' | 'MERCHANDISE';

export const COMMERCE_ITEM_LISTED = 'creator-os.commerce.listed';
export const COMMERCE_ITEM_SOLD   = 'creator-os.commerce.sold';
export const GIFTING_OVERLAY_SHOWN = 'creator-os.gifting-overlay.shown';

export interface CommerceItemListedPayload {
  readonly itemId: string;
  readonly creatorId: string;
  readonly roomId?: string;
  readonly itemType: CommerceItemType;
  readonly priceCoins: number;
  readonly title: string;
  readonly listedAt: string;
}

export interface CommerceItemSoldPayload {
  readonly itemId: string;
  readonly creatorId: string;
  readonly buyerId: string;
  readonly itemType: CommerceItemType;
  readonly priceCoins: number;
  readonly soldAt: string;
}

export interface GiftingOverlayShownPayload {
  readonly roomId: string;
  readonly gifterId: string;
  readonly giftId: string;
  readonly coins: number;
  readonly at: string;
}

// ── Discovery flywheel / clips ───────────────────────────────────────────────────

export type ClipLength = 15 | 30 | 60;

export const CLIP_GENERATED      = 'creator-os.clip.generated';
export const TEASER_GENERATED    = 'creator-os.teaser.generated';

export interface ClipGeneratedPayload {
  readonly clipId: string;
  readonly sourceReplayId: string;
  readonly creatorId: string;
  readonly lengthSeconds: ClipLength;
  readonly clipUrl: string;
  readonly startOffsetSeconds: number;
  readonly generatedAt: string;
}

export interface TeaserGeneratedPayload {
  readonly teaserId: string;
  readonly sourceReplayId: string;
  readonly creatorId: string;
  readonly teaserUrl: string;
  readonly generatedAt: string;
}

export type ShowPlanGeneratedEvent       = DomainEvent<ShowPlanGeneratedPayload>;
export type PosterStudioGeneratedEvent   = DomainEvent<PosterStudioGeneratedPayload>;
export type CommerceItemListedEvent      = DomainEvent<CommerceItemListedPayload>;
export type CommerceItemSoldEvent        = DomainEvent<CommerceItemSoldPayload>;
export type GiftingOverlayShownEvent     = DomainEvent<GiftingOverlayShownPayload>;
export type ClipGeneratedEvent           = DomainEvent<ClipGeneratedPayload>;
export type TeaserGeneratedEvent         = DomainEvent<TeaserGeneratedPayload>;
