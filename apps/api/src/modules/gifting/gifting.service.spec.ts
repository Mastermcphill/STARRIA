import { CoinGiftingService, CoinLedgerPort, CoinBalance } from '@starria/gifting-core';
import { InMemoryEventBus } from '@starria/domain-events';
import { GIFT_COIN_SENT } from '@starria/domain-events';
import { createCommissionConfig } from '@starria/gifting-core';
import { GIFT_CATALOG } from './gift-catalog';
import { getPlatformFeePct } from './platform-fee';

// In-memory ledger for testing
function makeLedger(initialBalances: Record<string, number> = {}): CoinLedgerPort {
  const balances = { ...initialBalances };
  const applied = new Set<string>();

  return {
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

describe('Gift Catalog', () => {
  it('contains exactly 5 items', () => {
    expect(GIFT_CATALOG).toHaveLength(5);
  });

  it('star gift costs 10 coins', () => {
    expect(GIFT_CATALOG.find(g => g.id === 'star')?.coins).toBe(10);
  });

  it('supernova gift costs 1000 coins', () => {
    expect(GIFT_CATALOG.find(g => g.id === 'supernova')?.coins).toBe(1000);
  });
});

describe('Platform Fee Ladder', () => {
  it('charges 50% for creators with no profile', () => {
    expect(getPlatformFeePct(null)).toBe(50);
  });

  it('charges 40% for RISING tier', () => {
    expect(getPlatformFeePct('RISING')).toBe(40);
  });

  it('charges 30% for VERIFIED tier', () => {
    expect(getPlatformFeePct('VERIFIED')).toBe(30);
  });

  it('charges 20% for ELITE tier', () => {
    expect(getPlatformFeePct('ELITE')).toBe(20);
  });

  it('charges 10% for Gold Star creators', () => {
    expect(getPlatformFeePct('ELITE', true)).toBe(10);
  });
});

describe('CoinGiftingService', () => {
  describe('gift creator', () => {
    it('debits sender, credits creator net and platform cut', async () => {
      const bus = new InMemoryEventBus();
      const ledger = makeLedger({ sender: 200 });
      const service = new CoinGiftingService(ledger, createCommissionConfig(40), undefined, bus);

      const result = await service.sendCoinGift({
        senderId: 'sender',
        recipientId: 'creator',
        coins: 100,
        idempotencyKey: 'test:1',
      });

      expect(result.status).toBe('accepted');
      expect(result.coins).toBe(100);
      expect(result.platformCut).toBe(40);
      expect(result.creatorAmount).toBe(60);
      expect(result.senderBalance).toBe(100);
      expect(result.creatorBalance).toBe(60);
    });
  });

  describe('insufficient balance', () => {
    it('throws when sender has fewer coins than gift amount', async () => {
      const ledger = makeLedger({ sender: 5 });
      const service = new CoinGiftingService(ledger, createCommissionConfig(40));

      await expect(
        service.sendCoinGift({ senderId: 'sender', recipientId: 'creator', coins: 100, idempotencyKey: 'test:2' }),
      ).rejects.toThrow('Insufficient coins');
    });
  });

  describe('platform fee correctness', () => {
    it.each([
      [50, 100, 50, 50],
      [40, 100, 40, 60],
      [30, 100, 30, 70],
      [20, 100, 20, 80],
      [10, 100, 10, 90],
    ])('%i%% fee on 100 coins → platform=%i creator=%i', async (pct, coins, expectedPlatform, expectedCreator) => {
      const ledger = makeLedger({ sender: 1000 });
      const service = new CoinGiftingService(ledger, createCommissionConfig(pct));
      const result = await service.sendCoinGift({
        senderId: 'sender', recipientId: 'creator', coins, idempotencyKey: `fee_test:${pct}`,
      });
      expect(result.platformCut).toBe(expectedPlatform);
      expect(result.creatorAmount).toBe(expectedCreator);
    });
  });

  describe('creator earnings correctness', () => {
    it('creator balance increases by creatorAmount after gift', async () => {
      const ledger = makeLedger({ sender: 500, creator: 0 });
      const service = new CoinGiftingService(ledger, createCommissionConfig(30));

      const result = await service.sendCoinGift({
        senderId: 'sender', recipientId: 'creator', coins: 100, idempotencyKey: 'earnings:1',
      });

      expect(result.creatorBalance).toBe(70);
    });
  });

  describe('event emission', () => {
    it('emits CoinGiftSentEvent after successful gift', async () => {
      const bus = new InMemoryEventBus();
      const events: unknown[] = [];
      bus.subscribe(GIFT_COIN_SENT, e => events.push(e));

      const ledger = makeLedger({ sender: 200 });
      const service = new CoinGiftingService(ledger, createCommissionConfig(40), undefined, bus);

      await service.sendCoinGift({ senderId: 'sender', recipientId: 'creator', coins: 50, idempotencyKey: 'event:1' });
      await new Promise(r => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect((events[0] as { type: string }).type).toBe(GIFT_COIN_SENT);
    });
  });
});
