// ---------------------------------------------------------------------------
// gifting-core — coin gifting engine
// Extracted from LifeNest coins/coin-tipping.service.ts.
// App-specific dependencies (NestJS, Prisma, AuditService) are replaced with
// injectable interfaces.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type { GiftCommissionConfig, SendCoinGiftInput, CoinGiftResult, GiftTargetType } from './types';
import { normalizeGiftTargetType } from './types';
import { buildCoinGiftSentEvent } from './events';

// ---------------------------------------------------------------------------
// Coin ledger interface (implement with Prisma / Redis / in-memory)
// ---------------------------------------------------------------------------

export interface CoinMovementInput {
  readonly userId: string;
  readonly amount: number;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly referenceId?: string;
}

export interface CoinBalance {
  readonly userId: string;
  readonly balance: number;
}

export interface CoinLedgerPort {
  debit(input: CoinMovementInput): Promise<CoinBalance>;
  credit(input: CoinMovementInput): Promise<CoinBalance>;
  getBalance(userId: string): Promise<CoinBalance>;
}

// ---------------------------------------------------------------------------
// Notification port
// ---------------------------------------------------------------------------

export interface GiftNotificationPort {
  sendTipReceived(params: { recipientId: string; senderId: string; amount: number; currency: string; reference: string }): Promise<void>;
}

// ---------------------------------------------------------------------------
// CoinGiftingService
// ---------------------------------------------------------------------------

export const PLATFORM_COINS_ACCOUNT = 'platform:coins';

export class CoinGiftingService {
  constructor(
    private readonly ledger: CoinLedgerPort,
    private readonly commission?: GiftCommissionConfig,
    private readonly notifications?: GiftNotificationPort,
    private readonly eventBus?: EventBus,
  ) {}

  async sendCoinGift(input: SendCoinGiftInput): Promise<CoinGiftResult> {
    const senderId = this.require(input.senderId, 'senderId');
    const recipientId = this.require(input.recipientId, 'recipientId');

    if (senderId === recipientId) {
      throw new Error('Coin gifts cannot be sent to yourself');
    }
    if (!Number.isInteger(input.coins) || input.coins <= 0) {
      throw new Error('Coin gift amount must be a positive integer');
    }

    const reference = (input.idempotencyKey || input.reference || `coin_gift:${randomUUID()}`).trim();
    const targetType: GiftTargetType = normalizeGiftTargetType(input.targetType) ?? 'REEL';
    const platformPercentage = this.commission?.getPercent() ?? 40;
    // floor keeps coin amounts integral; creator gets the remainder so coins are conserved.
    const platformCut = Math.floor((input.coins * platformPercentage) / 100);
    const creatorAmount = input.coins - platformCut;

    const senderResult = await this.ledger.debit({
      userId: senderId,
      amount: input.coins,
      reason: 'tip_sent',
      idempotencyKey: `${reference}:debit`,
      referenceId: reference,
    });

    if (creatorAmount > 0) {
      await this.ledger.credit({
        userId: recipientId,
        amount: creatorAmount,
        reason: 'tip_received',
        idempotencyKey: `${reference}:credit`,
        referenceId: reference,
      });
    }
    if (platformCut > 0) {
      await this.ledger.credit({
        userId: PLATFORM_COINS_ACCOUNT,
        amount: platformCut,
        reason: 'tip_received',
        idempotencyKey: `${reference}:platform`,
        referenceId: reference,
      });
    }

    const creatorResult = await this.ledger.getBalance(recipientId);

    await this.notifications?.sendTipReceived({
      recipientId,
      senderId,
      amount: input.coins,
      currency: 'COINS',
      reference,
    });

    void this.eventBus?.publish(buildCoinGiftSentEvent({
      reference,
      senderId,
      recipientId,
      coins: input.coins,
      platformCut,
      creatorAmount,
      platformPercentage,
      targetType,
      contentId: input.contentId,
      idempotencyKey: input.idempotencyKey,
    }));

    return {
      status: 'accepted',
      reference,
      currency: 'COINS',
      targetType,
      coins: input.coins,
      platformCut,
      creatorAmount,
      platformPercentage,
      senderBalance: senderResult.balance,
      creatorBalance: creatorResult.balance,
    };
  }

  private require(value: string | undefined, field: string): string {
    const v = (value ?? '').trim();
    if (!v) throw new Error(`${field} is required`);
    return v;
  }
}
