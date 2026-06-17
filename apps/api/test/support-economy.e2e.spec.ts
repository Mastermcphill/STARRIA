/**
 * Integration spec — Support Economy vertical slice.
 *
 * Uses InMemoryEventBus, an in-memory coin ledger, and SupporterService
 * directly (no HTTP layer) to validate the full flow:
 *
 *   User purchases coins
 *   → Wallet credited
 *   → User gifts creator
 *   → Creator receives earnings
 *   → CoinGiftSentEvent emitted
 *   → SupportRelationship created
 *   → Milestone evaluated
 *   → SupporterProfile spend updated
 */

import { InMemoryEventBus, GIFT_COIN_SENT } from '@starria/domain-events';
import { CoinGiftingService, createCommissionConfig, CoinLedgerPort, CoinBalance } from '@starria/gifting-core';
import { SupporterService } from '@starria/support-core';
import { computePatronLevel } from '../src/modules/supporters/patron-level';
import { getPlatformFeePct } from '../src/modules/gifting/platform-fee';
import { GIFT_CATALOG } from '../src/modules/gifting/gift-catalog';

// ── In-memory coin ledger ────────────────────────────────────────────────────

function makeInMemLedger(initial: Record<string, number> = {}): CoinLedgerPort & { balances: Record<string, number> } {
  const balances: Record<string, number> = { ...initial };
  const applied = new Set<string>();

  return {
    balances,
    async getBalance(userId: string): Promise<CoinBalance> {
      return { userId, balance: balances[userId] ?? 0 };
    },
    async debit({ userId, amount, idempotencyKey }: { userId: string; amount: number; idempotencyKey: string }): Promise<CoinBalance> {
      if (applied.has(idempotencyKey)) return { userId, balance: balances[userId] ?? 0 };
      const bal = balances[userId] ?? 0;
      if (bal < amount) throw new Error(`Insufficient coins: have ${bal}, need ${amount}`);
      balances[userId] = bal - amount;
      applied.add(idempotencyKey);
      return { userId, balance: balances[userId] };
    },
    async credit({ userId, amount, idempotencyKey }: { userId: string; amount: number; idempotencyKey: string }): Promise<CoinBalance> {
      if (applied.has(idempotencyKey)) return { userId, balance: balances[userId] ?? 0 };
      balances[userId] = (balances[userId] ?? 0) + amount;
      applied.add(idempotencyKey);
      return { userId, balance: balances[userId] };
    },
  };
}

// ── In-memory supporter store ─────────────────────────────────────────────────

import type { SupporterStorePort, SubscriptionStorePort, SupporterProfile, Subscription, SupporterListFilter, SubscriptionListFilter } from '@starria/support-core';
import { computeSupporterTier } from '@starria/support-core';
import { randomUUID } from 'crypto';

function makeInMemSupporterStore(): SupporterStorePort {
  const profiles = new Map<string, SupporterProfile>();
  return {
    async findById(id) { return profiles.get(id); },
    async findByUserId(userId) { return [...profiles.values()].find(p => p.userId === userId); },
    async create(input) {
      const p: SupporterProfile = {
        id: randomUUID(), userId: input.userId, displayName: input.displayName,
        avatarUrl: input.avatarUrl, bio: input.bio, tier: 'free',
        lifetimeCoinsSpent: 0, lifetimeFiatSpent: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      profiles.set(p.id, p);
      return p;
    },
    async update(id, input) {
      const p = profiles.get(id)!;
      const updated = { ...p, ...input, updatedAt: new Date().toISOString() };
      profiles.set(id, updated);
      return updated;
    },
    async incrementSpend(id, coins, fiat) {
      const p = profiles.get(id)!;
      const newCoins = p.lifetimeCoinsSpent + coins;
      const updated: SupporterProfile = {
        ...p, lifetimeCoinsSpent: newCoins, lifetimeFiatSpent: p.lifetimeFiatSpent + fiat,
        tier: computeSupporterTier(newCoins), updatedAt: new Date().toISOString(),
      };
      profiles.set(id, updated);
      return updated;
    },
    async list(_filter: SupporterListFilter) { return { items: [...profiles.values()], hasMore: false }; },
  };
}

function makeInMemSubscriptionStore(): SubscriptionStorePort {
  const subs = new Map<string, Subscription>();
  return {
    async findById(id) { return subs.get(id); },
    async findActive(supporterId, starId) {
      return [...subs.values()].find(s => s.supporterId === supporterId && s.starId === starId && s.status === 'active');
    },
    async findByIdempotencyKey(key) { return [...subs.values()].find(s => s.idempotencyKey === key); },
    async create(sub) {
      const s: Subscription = { ...sub, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      subs.set(s.id, s);
      return s;
    },
    async updateStatus(id, status, patch) {
      const s = subs.get(id)!;
      const updated = { ...s, status, ...patch, updatedAt: new Date().toISOString() };
      subs.set(id, updated);
      return updated;
    },
    async list(_f: SubscriptionListFilter) { return { items: [...subs.values()], hasMore: false }; },
    async countActive(starId) { return [...subs.values()].filter(s => s.starId === starId && s.status === 'active').length; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Support Economy — end-to-end integration', () => {
  let bus: InMemoryEventBus;
  let ledger: ReturnType<typeof makeInMemLedger>;
  let supporterService: SupporterService;
  let giftService: CoinGiftingService;

  const CREATOR_USER_ID = 'creator-001';
  const FAN_USER_ID     = 'fan-001';

  beforeEach(() => {
    bus = new InMemoryEventBus();
    // Fan starts with 500 coins (simulates successful coin purchase)
    ledger = makeInMemLedger({ [FAN_USER_ID]: 500 });

    supporterService = new SupporterService(
      makeInMemSupporterStore(),
      makeInMemSubscriptionStore(),
      undefined,
      undefined,
      bus,
    );

    // Creator is VERIFIED tier → 30% platform fee
    const platformPct = getPlatformFeePct('VERIFIED');
    giftService = new CoinGiftingService(ledger, createCommissionConfig(platformPct), undefined, bus);
  });

  it('fan wallet starts at 500 coins (coin purchase step)', async () => {
    const balance = await ledger.getBalance(FAN_USER_ID);
    expect(balance.balance).toBe(500);
  });

  it('fan can gift a crown (100 coins) to creator', async () => {
    const crown = GIFT_CATALOG.find(g => g.id === 'crown')!;

    const result = await giftService.sendCoinGift({
      senderId: FAN_USER_ID,
      recipientId: CREATOR_USER_ID,
      coins: crown.coins,
      idempotencyKey: 'gift:crown:1',
    });

    expect(result.status).toBe('accepted');
    expect(result.coins).toBe(100);
  });

  it('creator receives 70 coins (30% fee on 100 coin crown)', async () => {
    const result = await giftService.sendCoinGift({
      senderId: FAN_USER_ID, recipientId: CREATOR_USER_ID, coins: 100, idempotencyKey: 'gift:crown:2',
    });

    expect(result.creatorAmount).toBe(70);
    expect(result.platformCut).toBe(30);
    expect(result.creatorBalance).toBe(70);
    expect(result.senderBalance).toBe(400);
  });

  it('emits CoinGiftSentEvent after gift', async () => {
    const events: unknown[] = [];
    bus.subscribe(GIFT_COIN_SENT, e => events.push(e));

    await giftService.sendCoinGift({
      senderId: FAN_USER_ID, recipientId: CREATOR_USER_ID, coins: 50, idempotencyKey: 'gift:rocket:1',
    });
    await new Promise(r => setTimeout(r, 20));

    expect(events).toHaveLength(1);
    expect((events[0] as { payload: { senderId: string } }).payload.senderId).toBe(FAN_USER_ID);
  });

  it('fan becomes a supporter — profile created and spend recorded', async () => {
    // Create supporter profile
    const profile = await supporterService.createProfile({
      userId: FAN_USER_ID,
      displayName: 'Super Fan',
    });
    expect(profile.tier).toBe('free');

    // Record spend after gift
    const { tierChanged, profile: updated } = await supporterService.recordSpend(profile.id, 100, 0);
    expect(updated.lifetimeCoinsSpent).toBe(100);
    expect(tierChanged).toBe(true); // 100 coins crosses into 'fan' tier
    expect(updated.tier).toBe('fan');
  });

  it('patron level escalates as coins gifted to star increase', () => {
    expect(computePatronLevel(0)).toBe('supporter');
    expect(computePatronLevel(100)).toBe('supporter');
    expect(computePatronLevel(500)).toBe('patron');
    expect(computePatronLevel(2000)).toBe('champion');
    expect(computePatronLevel(10000)).toBe('benefactor');
    expect(computePatronLevel(50000)).toBe('legendary_patron');
  });

  it('subscriber count increases after subscription', async () => {
    const profile = await supporterService.createProfile({ userId: FAN_USER_ID, displayName: 'Fan' });
    await supporterService.subscribe({ supporterId: profile.id, starId: 'star-001', tier: 'basic', idempotencyKey: 'sub:1' });

    const count = await supporterService.subscriberCount('star-001');
    expect(count).toBe(1);
  });

  it('subscription is idempotent — duplicate key returns same record', async () => {
    const profile = await supporterService.createProfile({ userId: FAN_USER_ID, displayName: 'Fan' });

    const { subscription: s1 } = await supporterService.subscribe({ supporterId: profile.id, starId: 'star-001', tier: 'basic', idempotencyKey: 'sub:dedup' });
    const { subscription: s2, deduped } = await supporterService.subscribe({ supporterId: profile.id, starId: 'star-001', tier: 'basic', idempotencyKey: 'sub:dedup' });

    expect(s1.id).toBe(s2.id);
    expect(deduped).toBe(true);
  });

  it('insufficient balance throws before any ledger mutation', async () => {
    ledger.balances[FAN_USER_ID] = 5;

    await expect(
      giftService.sendCoinGift({
        senderId: FAN_USER_ID, recipientId: CREATOR_USER_ID, coins: 100, idempotencyKey: 'gift:fail:1',
      }),
    ).rejects.toThrow('Insufficient coins');

    // Creator balance unchanged
    const creatorBal = await ledger.getBalance(CREATOR_USER_ID);
    expect(creatorBal.balance).toBe(0);
  });
});
