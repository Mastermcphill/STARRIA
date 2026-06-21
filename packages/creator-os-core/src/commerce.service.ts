// ---------------------------------------------------------------------------
// creator-os-core — LiveCommerceService (Sprint 7, Phase 6)
// List & sell tickets, premium replays, subscriptions, digital items, merch
// during live sessions. Supports live gifting overlays.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  CommerceItem,
  ListCommerceItemInput,
  PurchaseCommerceItemInput,
  CommerceStorePort,
  CreatorCoinLedgerPort,
} from './studio.types';
import {
  buildCommerceItemListed,
  buildCommerceItemSold,
  buildGiftingOverlayShown,
} from './studio.events';

export interface CommerceDeps {
  store: CommerceStorePort;
  ledger: CreatorCoinLedgerPort;
  platformFeePct?: number;
  eventBus?: EventBus;
}

export class LiveCommerceService {
  private readonly platformFeePct: number;

  constructor(private readonly deps: CommerceDeps) {
    this.platformFeePct = deps.platformFeePct ?? 20;
  }

  async list(input: ListCommerceItemInput): Promise<CommerceItem> {
    const now = new Date().toISOString();
    const item = await this.deps.store.create({
      id: randomUUID(),
      creatorId: input.creatorId,
      roomId: input.roomId,
      itemType: input.itemType,
      title: input.title,
      priceCoins: input.priceCoins,
      inventory: input.inventory,
      sold: 0,
      active: true,
      listedAt: now,
    });

    this.deps.eventBus?.publish(buildCommerceItemListed({
      itemId: item.id, creatorId: item.creatorId, roomId: item.roomId,
      itemType: item.itemType, priceCoins: item.priceCoins, title: item.title, listedAt: now,
    }));
    return item;
  }

  async purchase(input: PurchaseCommerceItemInput): Promise<{ item: CommerceItem; creatorCoins: number; platformCoins: number }> {
    // Idempotency.
    const existing = await this.deps.store.findPurchaseByKey(input.idempotencyKey);
    if (existing) {
      const item = await this.deps.store.get(existing.itemId);
      if (!item) throw new Error('Item not found.');
      const platformCoins = Math.floor((item.priceCoins * this.platformFeePct) / 100);
      return { item, creatorCoins: item.priceCoins - platformCoins, platformCoins };
    }

    const item = await this.deps.store.get(input.itemId);
    if (!item) throw new Error(`Commerce item not found: ${input.itemId}`);
    if (!item.active) throw new Error('Item is no longer available.');
    if (item.inventory !== undefined && item.sold >= item.inventory) {
      throw new Error('Item is sold out.');
    }

    // Charge buyer, split to creator.
    await this.deps.ledger.charge(input.buyerId, item.priceCoins, `commerce:${item.id}`);
    const platformCoins = Math.floor((item.priceCoins * this.platformFeePct) / 100);
    const creatorCoins = item.priceCoins - platformCoins;
    await this.deps.ledger.credit(item.creatorId, creatorCoins, `commerce.sale:${item.id}`);

    await this.deps.store.recordPurchase(input.idempotencyKey, item.id, input.buyerId);
    const updated = await this.deps.store.update(item.id, {
      sold: item.sold + 1,
      active: item.inventory !== undefined ? item.sold + 1 < item.inventory : true,
    });

    this.deps.eventBus?.publish(buildCommerceItemSold({
      itemId: item.id, creatorId: item.creatorId, buyerId: input.buyerId,
      itemType: item.itemType, priceCoins: item.priceCoins, soldAt: new Date().toISOString(),
    }));

    return { item: updated, creatorCoins, platformCoins };
  }

  /** Emit a live gifting overlay event (visual overlay handled client-side). */
  async showGiftOverlay(params: { roomId: string; gifterId: string; giftId: string; coins: number }): Promise<void> {
    this.deps.eventBus?.publish(buildGiftingOverlayShown({
      roomId: params.roomId, gifterId: params.gifterId, giftId: params.giftId,
      coins: params.coins, at: new Date().toISOString(),
    }));
  }

  listByRoom(roomId: string) { return this.deps.store.listByRoom(roomId); }
}
