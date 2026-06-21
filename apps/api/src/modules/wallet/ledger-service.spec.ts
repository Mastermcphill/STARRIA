// Unit tests for wallet-core LedgerService double-entry logic, using an
// in-memory fake LedgerStorePort that applies postings the way the Prisma
// adapter does. No DB.

import {
  LedgerService,
  type LedgerStorePort,
  type LedgerPosting,
  type LedgerResult,
  type LedgerBalance,
} from '@starria/wallet-core';

function makeFakeStore(): LedgerStorePort & { _balance: (id: string) => LedgerBalance } {
  const balances = new Map<string, { available: number; reserved: number; version: number }>();
  const applied = new Map<string, LedgerResult>();
  const bal = (id: string) => balances.get(id) ?? { available: 0, reserved: 0, version: 0 };

  return {
    _balance: (id: string) => ({ accountId: id, currency: 'COINS', ...bal(id) }),
    async findResultByIdempotencyKey(key) {
      return applied.get(key) ?? null;
    },
    async getBalance(accountId, currency) {
      return { accountId, currency, ...bal(accountId) };
    },
    async post(posting: LedgerPosting) {
      // enforce preconditions
      for (const r of posting.requireFunds) {
        const b = bal(r.accountId);
        const have = r.sub === 'available' ? b.available : b.reserved;
        if (have < r.amount) throw new Error(`insufficient ${r.sub} for ${r.accountId}`);
      }
      // apply legs
      for (const leg of posting.legs) {
        const b = { ...bal(leg.accountId) };
        const delta = leg.direction === 'credit' ? leg.amount : -leg.amount;
        if (leg.sub === 'available') b.available += delta;
        else b.reserved += delta;
        b.version += 1;
        balances.set(leg.accountId, b);
      }
      const accounts = [...new Set(posting.legs.map((l) => l.accountId))];
      const result: LedgerResult = {
        reference: posting.reference,
        idempotencyKey: posting.idempotencyKey,
        txnType: posting.txnType,
        currency: posting.currency,
        deduped: false,
        balances: accounts.map((a) => ({ accountId: a, currency: posting.currency, ...bal(a) })),
      };
      applied.set(posting.idempotencyKey, result);
      return result;
    },
  };
}

describe('LedgerService (double-entry)', () => {
  it('credit increases available; balanced posting', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('user1', 1000, { idempotencyKey: 'k1', reason: 'manual_credit' });
    expect(store._balance('user1').available).toBe(1000);
  });

  it('debit requires sufficient funds', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('user1', 100, { idempotencyKey: 'k1' });
    await expect(ledger.debit('user1', 500, { idempotencyKey: 'k2' })).rejects.toThrow(/insufficient/);
    await ledger.debit('user1', 60, { idempotencyKey: 'k3' });
    expect(store._balance('user1').available).toBe(40);
  });

  it('reserve moves available → reserved; release reverses it', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('user1', 1000, { idempotencyKey: 'k1' });
    await ledger.reserve('user1', 300, { idempotencyKey: 'k2' });
    expect(store._balance('user1')).toMatchObject({ available: 700, reserved: 300 });
    await ledger.release('user1', 300, { idempotencyKey: 'k3' });
    expect(store._balance('user1')).toMatchObject({ available: 1000, reserved: 0 });
  });

  it('settle splits gross into recipient + platform fee from reserved escrow', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('patron', 1000, { idempotencyKey: 'c1' });
    await ledger.reserve('patron', 1000, { idempotencyKey: 'r1' });
    await ledger.settle(
      { payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformPercentage: 20, fromReserved: true },
      { idempotencyKey: 's1' },
    );
    expect(store._balance('patron')).toMatchObject({ available: 0, reserved: 0 });
    expect(store._balance('creator').available).toBe(800);
    expect(store._balance('platform:starria').available).toBe(200);
  });

  it('refund reverses a settlement back to the payer', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('patron', 1000, { idempotencyKey: 'c1' });
    await ledger.settle(
      { payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformPercentage: 20 },
      { idempotencyKey: 's1' },
    );
    await ledger.refund(
      { originalReference: 's1', payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformFee: 200 },
      { idempotencyKey: 'rf1' },
    );
    expect(store._balance('patron').available).toBe(1000);
    expect(store._balance('creator').available).toBe(0);
    expect(store._balance('platform:starria').available).toBe(0);
  });

  it('is idempotent on the idempotency key (no double credit)', async () => {
    const store = makeFakeStore();
    const ledger = new LedgerService(store);
    await ledger.credit('user1', 500, { idempotencyKey: 'dup' });
    const second = await ledger.credit('user1', 500, { idempotencyKey: 'dup' });
    expect(second.deduped).toBe(true);
    expect(store._balance('user1').available).toBe(500);
  });

  it('rejects non-positive and non-integer amounts', async () => {
    const ledger = new LedgerService(makeFakeStore());
    await expect(ledger.credit('u', 0, { idempotencyKey: 'a' })).rejects.toThrow(/positive integer/);
    await expect(ledger.credit('u', 1.5, { idempotencyKey: 'b' })).rejects.toThrow(/positive integer/);
  });
});
