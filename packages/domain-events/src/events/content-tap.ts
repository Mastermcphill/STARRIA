// ---------------------------------------------------------------------------
// domain-events — discovery "content tap" events
// A content tap is a weighted discovery signal (upvote/like) on a video.
// Distinct from the payment Tap in tap-core (tap.completed / tap.failed).
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const CONTENT_TAP_RECORDED   = 'discovery.tap.recorded';
export const CONTENT_TAP_REJECTED   = 'discovery.tap.rejected';
export const REGIONAL_BOOST_UPDATED = 'discovery.boost.updated';

export interface ContentTapRecordedPayload {
  readonly tapId: string;
  readonly userId: string;
  readonly videoId: string;
  readonly starProfileId: string;
  readonly weight: number;
  readonly region: string;
  readonly country?: string;
  readonly recordedAt: string;
}

export type ContentTapRejectReason =
  | 'self_tap'
  | 'limit_exceeded'
  | 'rate_limited'
  | 'low_trust'
  | 'fraud_suspected'
  | 'video_not_published';

export interface ContentTapRejectedPayload {
  readonly userId: string;
  readonly videoId: string;
  readonly reason: ContentTapRejectReason;
  readonly rejectedAt: string;
}

export interface RegionalBoostUpdatedPayload {
  readonly videoId: string;
  readonly region: string;
  readonly previousBoost: number;
  readonly newBoost: number;
  readonly tapCount: number;
  readonly updatedAt: string;
}

export type ContentTapRecordedEvent   = DomainEvent<ContentTapRecordedPayload>;
export type ContentTapRejectedEvent   = DomainEvent<ContentTapRejectedPayload>;
export type RegionalBoostUpdatedEvent = DomainEvent<RegionalBoostUpdatedPayload>;
