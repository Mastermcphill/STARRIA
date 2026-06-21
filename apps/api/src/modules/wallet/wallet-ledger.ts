// ---------------------------------------------------------------------------
// Wallet ledger — the single, canonical hash-chain implementation for the
// WalletEntry table. Every writer (coin credit, gift debit/credit, payout
// finalize) appends through `appendWalletEntry` so the chain stays consistent
// and `verifyWalletChain` can detect any tampering.
//
// Chain hash (per spec):
//   SHA256(previousHash : id : walletId : type : amount : createdAt)
// walletId + type are folded in beyond the minimum so an attacker cannot move
// an entry between wallets or flip a CREDIT to a DEBIT without breaking the hash.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'crypto';
import { Prisma, WalletEntryType } from '@prisma/client';

export const WALLET_GENESIS_HASH = 'wallet-genesis';

export interface WalletChainRow {
  id: string;
  walletId: string;
  type: WalletEntryType;
  coinAmount: number | null;
  sequence: number;
  previousHash: string | null;
  hash: string;
  createdAt: Date;
}

export function computeWalletEntryHash(input: {
  previousHash: string;
  id: string;
  walletId: string;
  type: WalletEntryType;
  coinAmount: number;
  createdAt: string;
}): string {
  const payload = [
    input.previousHash,
    input.id,
    input.walletId,
    input.type,
    String(input.coinAmount),
    input.createdAt,
  ].join(':');
  return createHash('sha256').update(payload).digest('hex');
}

export interface AppendWalletEntryInput {
  walletId: string;
  type: WalletEntryType;
  coinAmount: number;
  description?: string;
  idempotencyKey: string;
  tapId?: string;
}

/**
 * Append a hash-chained entry to a wallet's ledger. MUST be called inside a
 * Serializable transaction so the read-last-then-append is race-free; the
 * caller owns the transaction. The createdAt is pinned explicitly so the stored
 * timestamp is exactly the one folded into the hash.
 */
export async function appendWalletEntry(
  tx: Prisma.TransactionClient,
  input: AppendWalletEntryInput,
): Promise<WalletChainRow> {
  const last = await tx.walletEntry.findFirst({
    where: { walletId: input.walletId },
    orderBy: { sequence: 'desc' },
    select: { hash: true, sequence: true },
  });
  const previousHash = last?.hash ?? WALLET_GENESIS_HASH;
  const sequence = (last?.sequence ?? -1) + 1;
  const createdAt = new Date();
  const createdAtIso = createdAt.toISOString();
  // Prisma generates the uuid on create, but we need the id to compute the hash
  // up front, so generate it here and pass it explicitly.
  const id = randomUUID();
  const hash = computeWalletEntryHash({
    previousHash,
    id,
    walletId: input.walletId,
    type: input.type,
    coinAmount: input.coinAmount,
    createdAt: createdAtIso,
  });

  const row = await tx.walletEntry.create({
    data: {
      id,
      walletId: input.walletId,
      type: input.type,
      coinAmount: input.coinAmount,
      description: input.description,
      tapId: input.tapId,
      sequence,
      previousHash,
      hash,
      idempotencyKey: input.idempotencyKey,
      createdAt,
    },
  });
  return row;
}

/** Recompute the chain and confirm every link. Returns false on any tampering. */
export function verifyWalletChain(entries: readonly WalletChainRow[]): boolean {
  let previousHash = WALLET_GENESIS_HASH;
  for (const e of entries) {
    if (e.previousHash !== previousHash) return false;
    const expected = computeWalletEntryHash({
      previousHash,
      id: e.id,
      walletId: e.walletId,
      type: e.type,
      coinAmount: e.coinAmount ?? 0,
      createdAt: e.createdAt.toISOString(),
    });
    if (e.hash !== expected) return false;
    previousHash = e.hash;
  }
  return true;
}
