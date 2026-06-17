// ---------------------------------------------------------------------------
// gifting-core — fiat gifting engine (NGN / any currency)
// Extracted from LifeNest tipping/tipping.service.ts.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  GiftCommissionConfig,
  SendFiatGiftInput,
  FiatGiftResult,
  GiftTargetType,
} from './types';
import { normalizeGiftTargetType, calculateGiftSplit } from './types';
import { buildFiatGiftSentEvent } from './events';

// ---------------------------------------------------------------------------
// Wallet port (wire to @starria/wallet-core WalletService or equivalent)
// ---------------------------------------------------------------------------

export interface FiatGiftWalletPort {
  debit(params: { accountId: string; amount: number; currency: string; reference: string; reason?: string; metadata?: Record<string, unknown> }): Promise<void>;
  credit(params: { accountId: string; amount: number; currency: string; reference: string; reason?: string; metadata?: Record<string, unknown> }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistence port
// ---------------------------------------------------------------------------

export interface FiatGiftRecord {
  readonly id: string;
  readonly senderId?: string;
  readonly recipientId?: string;
  readonly currency: string;
  readonly grossAmount: number;
  readonly platformFee: number;
  readonly creatorAmount: number;
  readonly targetType: GiftTargetType;
  readonly contentId?: string;
  readonly roomId?: string;
  readonly reference: string;
  readonly note?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface FiatGiftPersistencePort {
  /** Return existing record if reference already persisted (idempotency). */
  findByReference(reference: string): Promise<FiatGiftRecord | undefined>;
  save(record: FiatGiftRecord): Promise<FiatGiftRecord>;
  listByFilter(filter: {
    senderId?: string;
    recipientId?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<FiatGiftRecord[]>;
}

// ---------------------------------------------------------------------------
// FiatGiftingService
// ---------------------------------------------------------------------------

const PLATFORM_FEES_ACCOUNT = 'platform:fees';

export class FiatGiftingService {
  constructor(
    private readonly wallet: FiatGiftWalletPort,
    private readonly persistence?: FiatGiftPersistencePort,
    private readonly commission?: GiftCommissionConfig,
    private readonly eventBus?: EventBus,
  ) {}

  async sendGift(input: SendFiatGiftInput): Promise<FiatGiftResult> {
    const senderId = (input.senderId ?? '').trim();
    const recipientId = (input.recipientId ?? '').trim();
    if (!senderId) throw new Error('senderId is required');
    if (!recipientId) throw new Error('recipientId is required');
    if (!input.amount || input.amount <= 0) throw new Error('amount must be > 0');

    const currency = (input.currency ?? 'NGN').toUpperCase();
    const reference = (input.idempotencyKey ?? `gift:${randomUUID()}`).trim();
    const targetType: GiftTargetType = normalizeGiftTargetType(input.targetType) ?? 'REEL';

    // Idempotency check
    const existing = await this.persistence?.findByReference(reference);
    if (existing) {
      return {
        status: 'accepted',
        accepted: true,
        giftId: existing.id,
        reference: existing.reference,
        amount: existing.grossAmount,
        currency: existing.currency,
        platformFee: existing.platformFee,
        creatorAmount: existing.creatorAmount,
        targetType: existing.targetType,
        deduped: true,
      };
    }

    const platformPercent = this.commission?.getPercent() ?? 40;
    const { platformFee, creatorAmount } = calculateGiftSplit(input.amount, platformPercent);

    // Atomic debit sender, credit creator, credit platform
    await this.wallet.debit({
      accountId: senderId,
      amount: input.amount,
      currency,
      reference,
      reason: 'payment_split',
      metadata: { targetType, recipientId, note: input.note },
    });
    await this.wallet.credit({
      accountId: recipientId,
      amount: creatorAmount,
      currency,
      reference: `${reference}:creator`,
      reason: 'payment_split',
    });
    await this.wallet.credit({
      accountId: PLATFORM_FEES_ACCOUNT,
      amount: platformFee,
      currency,
      reference: `${reference}:platform`,
      reason: 'payment_split',
    });

    const giftId = randomUUID();
    const now = new Date().toISOString();

    const record: FiatGiftRecord = {
      id: giftId,
      senderId,
      recipientId,
      currency,
      grossAmount: input.amount,
      platformFee,
      creatorAmount,
      targetType,
      contentId: input.contentId,
      roomId: input.roomId,
      reference,
      note: input.note,
      metadata: input.metadata,
      createdAt: now,
    };

    await this.persistence?.save(record);

    void this.eventBus?.publish(buildFiatGiftSentEvent({
      giftId,
      reference,
      senderId,
      recipientId,
      amount: input.amount,
      currency,
      platformFee,
      creatorAmount,
      targetType,
      roomId: input.roomId,
    }));

    return {
      status: 'accepted',
      accepted: true,
      giftId,
      reference,
      amount: input.amount,
      currency,
      platformFee,
      creatorAmount,
      targetType,
      deduped: false,
    };
  }
}
