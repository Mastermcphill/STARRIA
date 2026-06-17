// ---------------------------------------------------------------------------
// star-core — StarService
// Orchestrates Star (creator) profile lifecycle, tier progression,
// discovery, follows, and verification.
// Business logic: TODO (wire ports in consuming app)
// ---------------------------------------------------------------------------

import type {
  StarProfile,
  CreateStarProfileInput,
  UpdateStarProfileInput,
  StarDiscoveryFilter,
  StarDiscoveryResult,
  SubmitVerificationInput,
  StarVerificationRequest,
  StarFollow,
} from './types';
import { computeStarTier } from './types';
import type { EventBus } from '@starria/domain-events';
import type {
  StarStorePort,
  StarDiscoveryPort,
  StarVerificationStorePort,
  StarFollowPort,
  StarNotificationPort,
} from './ports';
import {
  buildStarProfileCreatedEvent,
  buildStarTierUpgradedEvent,
  buildStarVerifiedEvent,
  buildStarVerificationRejectedEvent,
  buildStarFollowedEvent,
  buildStarUnfollowedEvent,
  buildStarSubscriberAddedEvent,
  buildStarSubscriberRemovedEvent,
} from './events';

export class StarService {
  constructor(
    private readonly stars: StarStorePort,
    private readonly discovery: StarDiscoveryPort,
    private readonly verification?: StarVerificationStorePort,
    private readonly follows?: StarFollowPort,
    private readonly notifications?: StarNotificationPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Profile ───────────────────────────────────────────────────────────────

  async getById(starId: string): Promise<StarProfile | undefined> {
    return this.stars.findById(starId);
  }

  async getByUserId(userId: string): Promise<StarProfile | undefined> {
    return this.stars.findByUserId(userId);
  }

  async getByUsername(username: string): Promise<StarProfile | undefined> {
    return this.stars.findByUsername(username);
  }

  async createProfile(input: CreateStarProfileInput): Promise<StarProfile> {
    const profile = await this.stars.create(input);
    void this.eventBus?.publish(buildStarProfileCreatedEvent({
      starId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      username: profile.username,
    }));
    return profile;
  }

  async updateProfile(starId: string, input: UpdateStarProfileInput): Promise<StarProfile> {
    return this.stars.update(starId, input);
  }

  /**
   * Recalculate and persist tier when subscriber count changes.
   * Called by support-core after a subscribe/cancel.
   */
  async syncTier(starId: string): Promise<{ changed: boolean; newTier: StarProfile['tier'] }> {
    const star = await this.stars.findById(starId);
    if (!star) throw new Error(`Star not found: ${starId}`);
    const newTier = computeStarTier(star.subscriberCount);
    if (newTier === star.tier) return { changed: false, newTier };
    await this.stars.updateTier(starId, newTier);
    await this.notifications?.onTierUpgraded(starId, newTier);
    void this.eventBus?.publish(buildStarTierUpgradedEvent({
      starId,
      previousTier: star.tier,
      newTier,
      subscriberCount: star.subscriberCount,
    }));
    return { changed: true, newTier };
  }

  async setLiveStatus(starId: string, isLive: boolean): Promise<void> {
    await this.stars.updateLiveStatus(starId, isLive);
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  async search(filter: StarDiscoveryFilter): Promise<{ items: StarDiscoveryResult[]; nextCursor?: string; hasMore: boolean }> {
    return this.discovery.search(filter);
  }

  async listByCategory(category: string, limit: number, cursor?: string) {
    return this.discovery.listByCategory(category, limit, cursor);
  }

  async listTrending(limit = 20) {
    return this.discovery.listTrending(limit);
  }

  async listLive(limit = 20) {
    return this.discovery.listLive(limit);
  }

  // ── Follows ───────────────────────────────────────────────────────────────

  async follow(followerId: string, starId: string): Promise<StarFollow> {
    const f = await this.follows!.follow(followerId, starId);
    await this.stars.incrementFollowers(starId, 1);
    await this.notifications?.onNewFollower(starId, followerId);
    const updated = await this.stars.findById(starId);
    void this.eventBus?.publish(buildStarFollowedEvent({
      starId,
      followerId,
      followerCount: updated?.followerCount ?? 0,
    }));
    return f;
  }

  async unfollow(followerId: string, starId: string): Promise<void> {
    await this.follows!.unfollow(followerId, starId);
    await this.stars.incrementFollowers(starId, -1);
    const updated = await this.stars.findById(starId);
    void this.eventBus?.publish(buildStarUnfollowedEvent({
      starId,
      followerId,
      followerCount: updated?.followerCount ?? 0,
    }));
  }

  async isFollowing(followerId: string, starId: string): Promise<boolean> {
    return this.follows?.isFollowing(followerId, starId) ?? false;
  }

  async listFollowers(starId: string, limit: number, cursor?: string) {
    return this.follows?.listFollowers(starId, limit, cursor);
  }

  // ── Verification ──────────────────────────────────────────────────────────

  async submitVerification(input: SubmitVerificationInput): Promise<StarVerificationRequest> {
    const existing = await this.verification?.findPending(input.starId);
    if (existing) return existing;
    return this.verification!.create(input);
  }

  async approveVerification(requestId: string, reviewerId: string): Promise<StarVerificationRequest> {
    const reviewedAt = new Date().toISOString();
    const req = await this.verification!.updateStatus(requestId, 'approved', {
      reviewedAt,
      reviewedBy: reviewerId,
    });
    await this.stars.update(req.starId, {});
    await this.notifications?.onVerificationApproved(req.starId);
    void this.eventBus?.publish(buildStarVerifiedEvent({
      starId: req.starId,
      requestId,
      reviewedBy: reviewerId,
      reviewedAt,
    }));
    return req;
  }

  async rejectVerification(requestId: string, reviewerId: string, reason: string): Promise<StarVerificationRequest> {
    const req = await this.verification!.updateStatus(requestId, 'rejected', {
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
      rejectionReason: reason,
    });
    await this.notifications?.onVerificationRejected(req.starId, reason);
    void this.eventBus?.publish(buildStarVerificationRejectedEvent({
      starId: req.starId,
      requestId,
      reviewedBy: reviewerId,
      reason,
    }));
    return req;
  }

  // ── Subscriber count hooks (called by support-core) ───────────────────────

  async onSubscriberAdded(starId: string, supporterId: string, tier: string): Promise<void> {
    await this.stars.incrementSubscribers(starId, 1);
    await this.notifications?.onNewSubscriber(starId, supporterId, tier);
    const updated = await this.stars.findById(starId);
    void this.eventBus?.publish(buildStarSubscriberAddedEvent({
      starId,
      supporterId,
      subscriptionTier: tier,
      subscriberCount: updated?.subscriberCount ?? 0,
    }));
    await this.syncTier(starId);
  }

  async onSubscriberRemoved(starId: string, supporterId?: string): Promise<void> {
    await this.stars.incrementSubscribers(starId, -1);
    const updated = await this.stars.findById(starId);
    void this.eventBus?.publish(buildStarSubscriberRemovedEvent({
      starId,
      supporterId: supporterId ?? '',
      subscriberCount: updated?.subscriberCount ?? 0,
    }));
    await this.syncTier(starId);
  }
}
