// ---------------------------------------------------------------------------
// tap-core — TapService
// Orchestrates the full Tap flow via TapGiftPort (no direct gifting-core
// dependency) and publishes domain events after every successful Tap.
// ---------------------------------------------------------------------------

import type { EventBus } from '@starria/domain-events';
import type {
  TapRecord,
  SendCoinTapInput,
  SendFiatTapInput,
  TapResult,
  TapHistoryFilter,
  TapPage,
  LeaderboardQuery,
  LeaderboardEntry,
} from './types';
import type {
  TapStorePort,
  TapLeaderboardPort,
  TapAnalyticsPort,
  TapNotificationPort,
  TapGiftPort,
} from './ports';
import { buildTapCompletedEvent } from './events';

export class TapService {
  constructor(
    private readonly store: TapStorePort,
    private readonly gifts: TapGiftPort,
    private readonly leaderboard?: TapLeaderboardPort,
    private readonly analytics?: TapAnalyticsPort,
    private readonly notifications?: TapNotificationPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Coin Tap ──────────────────────────────────────────────────────────────

  async sendCoinTap(input: SendCoinTapInput): Promise<TapResult> {
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        tapId: existing.id,
        status: existing.status,
        reference: existing.reference,
        type: existing.type,
        grossAmount: existing.grossAmount,
        platformFee: existing.platformFee,
        creatorNet: existing.creatorNet,
        deduped: true,
      };
    }

    // Execute coin transfer via injected port (decoupled from gifting-core)
    const giftResult = await this.gifts.sendCoinGift({
      senderId: input.senderId,
      recipientId: input.receiverId,
      coins: input.coins,
      targetType: input.contextType === 'arena' ? 'LIVESTREAM' : 'PROFILE',
      contentId: input.contextId,
      idempotencyKey: input.idempotencyKey,
      note: input.message,
    });

    const tap = await this.store.create({
      senderId: input.senderId,
      receiverId: input.receiverId,
      type: 'COIN_GIFT',
      status: 'COMPLETED',
      currency: 'COINS',
      grossAmount: input.coins,
      platformFee: giftResult.platformCut,
      creatorNet: giftResult.creatorAmount,
      platformPercentage: giftResult.platformPercentage,
      contextType: input.contextType,
      contextId: input.contextId,
      targetType: giftResult.targetType,
      message: input.message,
      giftType: input.giftType,
      idempotencyKey: input.idempotencyKey,
      reference: giftResult.reference,
    });

    // Side-effects (fire-and-forget)
    void this.leaderboard?.recordContribution({
      starId: input.receiverId,
      supporterId: input.senderId,
      coins: input.coins,
      fiatMinorUnits: 0,
      contextType: input.contextType,
      contextId: input.contextId,
    });
    void this.analytics?.trackTap(tap);
    void this.notifications?.onTapReceived({
      receiverId: input.receiverId,
      senderId: input.senderId,
      tapId: tap.id,
      grossAmount: input.coins,
      currency: 'COINS',
      contextType: input.contextType,
      contextId: input.contextId,
      message: input.message,
    });
    void this.eventBus?.publish(buildTapCompletedEvent({
      tapId: tap.id,
      senderId: input.senderId,
      receiverId: input.receiverId,
      type: 'COIN_GIFT',
      currency: 'COINS',
      grossAmount: input.coins,
      platformFee: giftResult.platformCut,
      creatorNet: giftResult.creatorAmount,
      reference: giftResult.reference,
      contextType: input.contextType,
      contextId: input.contextId,
      message: input.message,
    }));

    return {
      tapId: tap.id,
      status: tap.status,
      reference: tap.reference,
      type: 'COIN_GIFT',
      grossAmount: input.coins,
      platformFee: giftResult.platformCut,
      creatorNet: giftResult.creatorAmount,
      senderBalanceAfter: giftResult.senderBalance,
      deduped: false,
    };
  }

  // ── Fiat Tap ──────────────────────────────────────────────────────────────

  async sendFiatTap(input: SendFiatTapInput): Promise<TapResult> {
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        tapId: existing.id,
        status: existing.status,
        reference: existing.reference,
        type: existing.type,
        grossAmount: existing.grossAmount,
        platformFee: existing.platformFee,
        creatorNet: existing.creatorNet,
        deduped: true,
      };
    }

    const giftResult = await this.gifts.sendFiatGift({
      senderId: input.senderId,
      recipientId: input.receiverId,
      amount: input.amount,
      currency: input.currency,
      targetType: 'LIVESTREAM',
      roomId: input.contextId,
      note: input.message,
      idempotencyKey: input.idempotencyKey,
    });

    const tap = await this.store.create({
      senderId: input.senderId,
      receiverId: input.receiverId,
      type: 'FIAT_TIP',
      status: 'COMPLETED',
      currency: input.currency,
      grossAmount: input.amount,
      platformFee: giftResult.platformFee,
      creatorNet: giftResult.creatorAmount,
      platformPercentage: 40,
      contextType: input.contextType,
      contextId: input.contextId,
      targetType: giftResult.targetType,
      message: input.message,
      idempotencyKey: input.idempotencyKey,
      reference: giftResult.reference,
    });

    void this.leaderboard?.recordContribution({
      starId: input.receiverId,
      supporterId: input.senderId,
      coins: 0,
      fiatMinorUnits: input.amount,
      contextType: input.contextType,
      contextId: input.contextId,
    });
    void this.analytics?.trackTap(tap);
    void this.notifications?.onTapReceived({
      receiverId: input.receiverId,
      senderId: input.senderId,
      tapId: tap.id,
      grossAmount: input.amount,
      currency: input.currency,
      contextType: input.contextType,
      contextId: input.contextId,
      message: input.message,
    });
    void this.eventBus?.publish(buildTapCompletedEvent({
      tapId: tap.id,
      senderId: input.senderId,
      receiverId: input.receiverId,
      type: 'FIAT_TIP',
      currency: input.currency,
      grossAmount: input.amount,
      platformFee: giftResult.platformFee,
      creatorNet: giftResult.creatorAmount,
      reference: giftResult.reference,
      contextType: input.contextType,
      contextId: input.contextId,
      message: input.message,
    }));

    return {
      tapId: tap.id,
      status: tap.status,
      reference: tap.reference,
      type: 'FIAT_TIP',
      grossAmount: input.amount,
      platformFee: giftResult.platformFee,
      creatorNet: giftResult.creatorAmount,
      deduped: false,
    };
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getById(tapId: string): Promise<TapRecord | undefined> {
    return this.store.findById(tapId);
  }

  async list(filter: TapHistoryFilter): Promise<TapPage> {
    return this.store.list(filter);
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────

  async getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    return this.leaderboard?.getLeaderboard(query) ?? [];
  }

  // ── Context summary ───────────────────────────────────────────────────────

  async getContextSummary(contextType: string, contextId: string) {
    return this.store.sumByContext(contextType, contextId);
  }
}
