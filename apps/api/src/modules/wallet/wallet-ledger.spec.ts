import { WalletEntryType } from '@prisma/client';
import {
  computeWalletEntryHash,
  verifyWalletChain,
  WALLET_GENESIS_HASH,
  type WalletChainRow,
} from './wallet-ledger';

/** Build a valid chain of N entries with real hashes. */
function buildChain(specs: Array<{ type: WalletEntryType; amount: number }>): WalletChainRow[] {
  const rows: WalletChainRow[] = [];
  let previousHash = WALLET_GENESIS_HASH;
  specs.forEach((s, i) => {
    const id = `e${i}`;
    const createdAt = new Date(1_700_000_000_000 + i * 1000);
    const hash = computeWalletEntryHash({
      previousHash,
      id,
      walletId: 'w1',
      type: s.type,
      coinAmount: s.amount,
      createdAt: createdAt.toISOString(),
    });
    rows.push({
      id,
      walletId: 'w1',
      type: s.type,
      coinAmount: s.amount,
      sequence: i,
      previousHash,
      hash,
      createdAt,
    });
    previousHash = hash;
  });
  return rows;
}

describe('wallet-ledger', () => {
  it('hash is deterministic for the same inputs', () => {
    const args = {
      previousHash: WALLET_GENESIS_HASH,
      id: 'x',
      walletId: 'w1',
      type: 'CREDIT' as WalletEntryType,
      coinAmount: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(computeWalletEntryHash(args)).toBe(computeWalletEntryHash(args));
    expect(computeWalletEntryHash(args)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a valid chain', () => {
    const chain = buildChain([
      { type: 'CREDIT', amount: 100 },
      { type: 'DEBIT', amount: 30 },
      { type: 'CREDIT', amount: 5 },
    ]);
    expect(verifyWalletChain(chain)).toBe(true);
    expect(verifyWalletChain([])).toBe(true);
  });

  it('detects a tampered amount', () => {
    const chain = buildChain([{ type: 'CREDIT', amount: 100 }, { type: 'DEBIT', amount: 30 }]);
    chain[1] = { ...chain[1], coinAmount: 1 }; // change amount but keep stored hash
    expect(verifyWalletChain(chain)).toBe(false);
  });

  it('detects a flipped direction (CREDIT↔DEBIT)', () => {
    const chain = buildChain([{ type: 'CREDIT', amount: 100 }]);
    chain[0] = { ...chain[0], type: 'DEBIT' };
    expect(verifyWalletChain(chain)).toBe(false);
  });

  it('detects a broken previousHash link', () => {
    const chain = buildChain([{ type: 'CREDIT', amount: 100 }, { type: 'DEBIT', amount: 30 }]);
    chain[1] = { ...chain[1], previousHash: 'forged' };
    expect(verifyWalletChain(chain)).toBe(false);
  });

  it('detects a deleted middle entry', () => {
    const chain = buildChain([
      { type: 'CREDIT', amount: 100 },
      { type: 'DEBIT', amount: 30 },
      { type: 'CREDIT', amount: 5 },
    ]);
    const withHole = [chain[0], chain[2]]; // drop the middle link
    expect(verifyWalletChain(withHole)).toBe(false);
  });
});
