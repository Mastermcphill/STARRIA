// ---------------------------------------------------------------------------
// domain-events — star-core events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const STAR_PROFILE_CREATED   = 'star.profile.created';
export const STAR_TIER_UPGRADED     = 'star.tier.upgraded';
export const STAR_VERIFIED          = 'star.verified';
export const STAR_VERIFICATION_REJECTED = 'star.verification.rejected';
export const STAR_FOLLOWED          = 'star.followed';
export const STAR_UNFOLLOWED        = 'star.unfollowed';
export const STAR_SUBSCRIBER_ADDED  = 'star.subscriber.added';
export const STAR_SUBSCRIBER_REMOVED = 'star.subscriber.removed';

export interface StarProfileCreatedPayload {
  readonly starId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly username: string;
}

export interface StarTierUpgradedPayload {
  readonly starId: string;
  readonly previousTier: string;
  readonly newTier: string;
  readonly subscriberCount: number;
}

export interface StarVerifiedPayload {
  readonly starId: string;
  readonly requestId: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

export interface StarVerificationRejectedPayload {
  readonly starId: string;
  readonly requestId: string;
  readonly reviewedBy: string;
  readonly reason: string;
}

export interface StarFollowedPayload {
  readonly starId: string;
  readonly followerId: string;
  readonly followerCount: number;
}

export interface StarUnfollowedPayload {
  readonly starId: string;
  readonly followerId: string;
  readonly followerCount: number;
}

export interface StarSubscriberAddedPayload {
  readonly starId: string;
  readonly supporterId: string;
  readonly subscriptionTier: string;
  readonly subscriberCount: number;
}

export interface StarSubscriberRemovedPayload {
  readonly starId: string;
  readonly supporterId: string;
  readonly subscriberCount: number;
}

export type StarProfileCreatedEvent        = DomainEvent<StarProfileCreatedPayload>;
export type StarTierUpgradedEvent          = DomainEvent<StarTierUpgradedPayload>;
export type StarVerifiedEvent              = DomainEvent<StarVerifiedPayload>;
export type StarVerificationRejectedEvent  = DomainEvent<StarVerificationRejectedPayload>;
export type StarFollowedEvent              = DomainEvent<StarFollowedPayload>;
export type StarUnfollowedEvent            = DomainEvent<StarUnfollowedPayload>;
export type StarSubscriberAddedEvent       = DomainEvent<StarSubscriberAddedPayload>;
export type StarSubscriberRemovedEvent     = DomainEvent<StarSubscriberRemovedPayload>;
