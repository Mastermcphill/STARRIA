// Unit tests for PrismaLedgerStore using an in-memory fake of the Prisma
// delegates (incl. $transaction). Exercises the real adapter: balance
// snapshots, hash chaining, settlement/refund records, fund preconditions,
// and idempotency. No DB.

import { PrismaLedgerStore } from './prisma-ledger-store';
import { LedgerService } from '@starria/wallet-core';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakeDb() {
  const txns: any[] = [];
  const snaps = new Map<string, any>();
  const settlements: any[] = [];
  const refunds: any[] = [];
  let seq = 0;

  const delegates = {
    walletTransaction: {
      findFirst: async ({ where, orderBy }: any) => {
        let rows = txns.filter((t) =>
          (where.idempotencyKey ? t.idempotencyKey === where.idempotencyKey : true) &&
          (where.accountId ? t.accountId === where.accountId : true) &&
          (where.sub ? t.sub === where.sub : true),
        );
        if (orderBy?.createdAt === 'desc') rows = rows.slice().sort((a, b) => b._seq - a._seq);
        return rows[0] ?? null;
      },
      findMany: async ({ where }: any) => txns.filter((t) => t.idempotencyKey === where.idempotencyKey),
      create: async ({ data }: any) => {
        const row = { ...data, _seq: ++seq };
        txns.push(row);
        return row;
      },
    },
    walletBalanceSnapshot: {
      findUnique: async ({ where }: any) => snaps.get(`${where.accountId_currency.accountId}:${where.accountId_currency.currency}`) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = `${where.accountId_currency.accountId}:${where.accountId_currency.currency}`;
        const existing = snaps.get(k);
        let row;
        if (existing) {
          row = { ...existing, ...update };
          if (update.version?.increment) row.version = existing.version + update.version.increment;
        } else {
          row = { ...create };
        }
        snaps.set(k, row);
        return row;
      },
    },
    walletSettlement: { create: async ({ data }: any) => { settlements.push(data); return data; } },
    walletRefund: { create: async ({ data }: any) => { refunds.push(data); return data; } },
  };

  const db = {
    ...delegates,
    $transaction: async (fn: any) => fn(delegates),
    _snaps: snaps,
    _settlements: settlements,
    _refunds: refunds,
    _txns: txns,
  };
  return db as unknown as PrismaService & {
    _snaps: Map<string, any>; _settlements: any[]; _refunds: any[]; _txns: any[];
  };
}

describe('PrismaLedgerStore (adapter)', () => {
  it('persists balanced postings, snapshots, and a hash chain', async () => {
    const db = makeFakeDb();
    const ledger = new LedgerService(new PrismaLedgerStore(db));
    await ledger.credit('user1', 1000, { idempotencyKey: 'k1' });
    const bal = await ledger.balance('user1');
    expect(bal.available).toBe(1000);
    // one posting → two legs (user1 credit + external debit)
    expect(db._txns.filter((t) => t.idempotencyKey === 'k1')).toHaveLength(2);
    const userLeg = db._txns.find((t) => t.accountId === 'user1');
    expect(userLeg.previousHash).toBe('wallet-genesis');
    expect(userLeg.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('settle writes a WalletSettlement and splits funds', async () => {
    const db = makeFakeDb();
    const ledger = new LedgerService(new PrismaLedgerStore(db));
    await ledger.credit('patron', 1000, { idempotencyKey: 'c1' });
    await ledger.settle(
      { payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformPercentage: 25 },
      { idempotencyKey: 's1' },
    );
    expect((await ledger.balance('creator')).available).toBe(750);
    expect((await ledger.balance('platform:starria')).available).toBe(250);
    expect(db._settlements).toHaveLength(1);
    expect(db._settlements[0]).toMatchObject({ platformFee: 250, recipientAmount: 750 });
  });

  it('refund writes a WalletRefund and restores the payer', async () => {
    const db = makeFakeDb();
    const ledger = new LedgerService(new PrismaLedgerStore(db));
    await ledger.credit('patron', 1000, { idempotencyKey: 'c1' });
    await ledger.settle(
      { payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformPercentage: 20 },
      { idempotencyKey: 's1' },
    );
    await ledger.refund(
      { originalReference: 's1', payerAccountId: 'patron', recipientAccountId: 'creator', grossAmount: 1000, platformFee: 200 },
      { idempotencyKey: 'rf1' },
    );
    expect((await ledger.balance('patron')).available).toBe(1000);
    expect(db._refunds).toHaveLength(1);
    expect(db._refunds[0]).toMatchObject({ originalReference: 's1', amount: 1000 });
  });

  it('rejects a debit when funds are insufficient', async () => {
    const db = makeFakeDb();
    const ledger = new LedgerService(new PrismaLedgerStore(db));
    await ledger.credit('u', 50, { idempotencyKey: 'c1' });
    await expect(ledger.debit('u', 100, { idempotencyKey: 'd1' })).rejects.toThrow();
    expect((await ledger.balance('u')).available).toBe(50);
  });

  it('is idempotent on replay (no double application)', async () => {
    const db = makeFakeDb();
    const ledger = new LedgerService(new PrismaLedgerStore(db));
    await ledger.credit('u', 500, { idempotencyKey: 'dup' });
    const again = await ledger.credit('u', 500, { idempotencyKey: 'dup' });
    expect(again.deduped).toBe(true);
    expect((await ledger.balance('u')).available).toBe(500);
  });
});
