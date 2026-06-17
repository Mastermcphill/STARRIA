// ---------------------------------------------------------------------------
// support-core — SupporterService
// Orchestrates supporter profile lifecycle and subscription management.
// All persistence and side-effects are injected via port interfaces.
// Business logic: TODO (wire ports in consuming app)
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  SupporterProfile,
  CreateSupporterProfileInput,
  UpdateSupporterProfileInput,
  Subscription,
  SubscribeInput,
  CancelSubscriptionInput,
  SupporterListFilter,
  SubscriptionListFilter,
  SupporterTier,
} from './types';
import { computeSupporterTier, DEFAULT_TIER_CONFIG } from './types';
import type {
  SupporterStorePort,
  SubscriptionStorePort,
  SupporterGiftingSummaryPort,
  SupporterNotificationPort,
} from './ports';
import {
  buildSupporterProfileCreatedEvent,
  buildSpendRecordedEvent,
  buildSupporterTierUpgradedEvent,
  buildSubscriptionCreatedEvent,
  buildSubscriptionCancelledEvent,
} from './events';

export class SupporterService {
  constructor(
    private readonly supporters: SupporterStorePort,
    private readonly subscriptions: SubscriptionStorePort,
    private readonly giftingSummary?: SupporterGiftingSummaryPort,
    private readonly notifications?: SupporterNotificationPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Profile ──────────────────────────────────────────────────────────────

  async getById(supporterId: string): Promise<SupporterProfile | undefined> {
    return this.supporters.findById(supporterId);
  }

  async getByUserId(userId: string): Promise<SupporterProfile | undefined> {
    return this.supporters.findByUserId(userId);
  }

  async createProfile(input: CreateSupporterProfileInput): Promise<SupporterProfile> {
    const profile = await this.supporters.create(input);
    void this.eventBus?.publish(buildSupporterProfileCreatedEvent({
      supporterId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
    }));
    return profile;
  }

  async updateProfile(supporterId: string, input: UpdateSupporterProfileInput): Promise<SupporterProfile> {
    return this.supporters.update(supporterId, input);
  }

  /**
   * Called by tap-core after each successful Tap to keep lifetime totals
   * and tier up-to-date. Idempotent if called with same values.
   */
  async recordSpend(supporterId: string, coins: number, fiatMinorUnits: number): Promise<{ profile: SupporterProfile; tierChanged: boolean; newTier?: SupporterTier }> {
    const prevProfile = await this.supporters.findById(supporterId);
    const updated = await this.supporters.incrementSpend(supporterId, coins, fiatMinorUnits);
    const newTier = computeSupporterTier(updated.lifetimeCoinsSpent);
    const tierChanged = prevProfile?.tier !== newTier;

    void this.eventBus?.publish(buildSpendRecordedEvent({
      supporterId,
      coinsSpent: coins,
      fiatMinorUnitsSpent: fiatMinorUnits,
      lifetimeCoinsSpent: updated.lifetimeCoinsSpent,
      lifetimeFiatSpent: updated.lifetimeFiatSpent,
    }));

    if (tierChanged) {
      await this.notifications?.onTierUpgraded({ supporterId, newTier });
      void this.eventBus?.publish(buildSupporterTierUpgradedEvent({
        supporterId,
        previousTier: prevProfile?.tier ?? 'free',
        newTier,
      }));
    }
    return { profile: updated, tierChanged, newTier: tierChanged ? newTier : undefined };
  }

  async list(filter: SupporterListFilter) {
    return this.supporters.list(filter);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  async subscribe(input: SubscribeInput): Promise<{ subscription: Subscription; deduped: boolean }> {
    const existing = await this.subscriptions.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { subscription: existing, deduped: true };

    const active = await this.subscriptions.findActive(input.supporterId, input.starId);
    if (active) return { subscription: active, deduped: true };

    const now = new Date().toISOString();
    const endsAt = input.durationDays
      ? new Date(Date.now() + input.durationDays * 86_400_000).toISOString()
      : undefined;

    const sub = await this.subscriptions.create({
      supporterId: input.supporterId,
      starId: input.starId,
      tier: input.tier,
      status: 'active',
      startedAt: now,
      endsAt,
      renewalEnabled: !!endsAt,
      idempotencyKey: input.idempotencyKey,
    });

    await this.notifications?.onSubscribed({ supporterId: input.supporterId, starId: input.starId, tier: input.tier });
    void this.eventBus?.publish(buildSubscriptionCreatedEvent({
      subscriptionId: sub.id,
      supporterId: input.supporterId,
      starId: input.starId,
      tier: input.tier,
      startedAt: now,
      endsAt,
    }));
    return { subscription: sub, deduped: false };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<Subscription> {
    const now = new Date().toISOString();
    const sub = await this.subscriptions.updateStatus(
      input.subscriptionId,
      'cancelled',
      { cancelledAt: now, endsAt: input.immediate ? now : undefined, renewalEnabled: false },
    );
    await this.notifications?.onCancelled({ supporterId: input.supporterId, starId: sub.starId });
    void this.eventBus?.publish(buildSubscriptionCancelledEvent({
      subscriptionId: input.subscriptionId,
      supporterId: input.supporterId,
      starId: sub.starId,
      cancelledAt: now,
      immediate: input.immediate ?? false,
    }));
    return sub;
  }

  async listSubscriptions(filter: SubscriptionListFilter) {
    return this.subscriptions.list(filter);
  }

  async hasActiveSubscription(supporterId: string, starId: string): Promise<boolean> {
    const sub = await this.subscriptions.findActive(supporterId, starId);
    return !!sub;
  }

  async subscriberCount(starId: string): Promise<number> {
    return this.subscriptions.countActive(starId);
  }

  // ── Gifting summary ───────────────────────────────────────────────────────

  async getGiftingSummary(supporterId: string, starId: string) {
    return this.giftingSummary?.getSummary(supporterId, starId);
  }

  async getTopSupporters(starId: string, limit = 10) {
    return this.giftingSummary?.listTopSupporters(starId, limit) ?? [];
  }
}
