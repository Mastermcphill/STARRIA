// ---------------------------------------------------------------------------
// wallet-core — hash-chained ledger utilities
// Pure functions; no framework or DB dependency.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'crypto';
import type { WalletLedgerDirection, WalletLedgerEntry, WalletLedgerReason, WalletAccountType } from './types';

/** The first entry in any wallet's chain uses this sentinel. */
export const LEDGER_GENESIS_HASH = 'wallet-genesis';

/**
 * Compute the SHA-256 chain hash for a ledger entry.
 * Mirrors the algorithm in LifeNest wallet.service.ts exactly so that
 * hashes produced here are compatible with the original chain.
 */
export function computeLedgerEntryHash(params: {
  id: string;
  sequence: number;
  accountId: string;
  direction: WalletLedgerDirection;
  amount: number;
  currency: string;
  balanceAfter: number;
  reference: string;
  reason: WalletLedgerReason;
  previousHash: string;
  createdAt: string;
}): string {
  const payload = [
    params.id,
    String(params.sequence),
    params.accountId,
    params.direction,
    String(params.amount),
    params.currency,
    String(params.balanceAfter),
    params.reference,
    params.reason,
    params.previousHash,
    params.createdAt,
  ].join(':');

  return createHash('sha256').update(payload).digest('hex');
}

export interface BuildLedgerEntryInput {
  sequence: number;
  accountId: string;
  accountType: WalletAccountType;
  direction: WalletLedgerDirection;
  amount: number;
  currency: string;
  balanceAfter: number;
  reference: string;
  reason: WalletLedgerReason;
  previousHash: string;
  metadata?: Record<string, unknown>;
}

/** Build a signed, immutable ledger entry ready for persistence. */
export function buildLedgerEntry(input: BuildLedgerEntryInput): WalletLedgerEntry {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const hash = computeLedgerEntryHash({ ...input, id, createdAt });

  return Object.freeze({
    id,
    sequence: input.sequence,
    accountId: input.accountId,
    accountType: input.accountType,
    direction: input.direction,
    amount: input.amount,
    currency: input.currency,
    balanceAfter: input.balanceAfter,
    reference: input.reference,
    reason: input.reason,
    previousHash: input.previousHash,
    hash,
    createdAt,
    metadata: input.metadata,
  });
}

/** Verify a chain of entries for hash integrity. Returns `true` if valid. */
export function verifyLedgerChain(entries: readonly WalletLedgerEntry[]): boolean {
  let previousHash = LEDGER_GENESIS_HASH;

  for (const entry of entries) {
    if (entry.previousHash !== previousHash) return false;
    const expected = computeLedgerEntryHash({
      id: entry.id,
      sequence: entry.sequence,
      accountId: entry.accountId,
      direction: entry.direction,
      amount: entry.amount,
      currency: entry.currency,
      balanceAfter: entry.balanceAfter,
      reference: entry.reference,
      reason: entry.reason,
      previousHash: entry.previousHash,
      createdAt: entry.createdAt,
    });
    if (entry.hash !== expected) return false;
    previousHash = entry.hash;
  }

  return true;
}
