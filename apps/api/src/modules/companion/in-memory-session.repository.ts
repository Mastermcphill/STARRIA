// ---------------------------------------------------------------------------
// companion — Session coin escrow ledger adapter (SessionCoinLedgerPort).
// The session STORE is now Prisma-backed (see prisma-session.repository.ts).
// This remaining adapter is the coin escrow ledger, deliberately kept as a
// wallet-adapter stub with a `seed()` test helper; routing it through the real
// Wallet ledger is a separate wallet-integration concern (see Sprint 10 audit).
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { SessionCoinLedgerPort } from '@starria/session-core';

const COIN_BALANCES = new Map<string, number>();
const ESCROW_HOLD = new Map<string, number>(); // bookingId → coins

@Injectable()
export class InMemorySessionLedger implements SessionCoinLedgerPort {
  async debitEscrow(patronId: string, coins: number, bookingId: string): Promise<void> {
    const balance = COIN_BALANCES.get(patronId) ?? 100_000;
    if (balance < coins) throw new Error('Insufficient coin balance for escrow');
    COIN_BALANCES.set(patronId, balance - coins);
    ESCROW_HOLD.set(bookingId, (ESCROW_HOLD.get(bookingId) ?? 0) + coins);
  }

  async releaseEscrow(bookingId: string): Promise<{ coins: number }> {
    const coins = ESCROW_HOLD.get(bookingId) ?? 0;
    ESCROW_HOLD.delete(bookingId);
    return { coins };
  }

  async refundEscrow(bookingId: string, _refundCoins: number): Promise<void> {
    ESCROW_HOLD.delete(bookingId);
  }

  async creditCompanion(companionId: string, coins: number): Promise<void> {
    COIN_BALANCES.set(companionId, (COIN_BALANCES.get(companionId) ?? 0) + coins);
  }

  async creditSplit(userId: string, coins: number): Promise<void> {
    COIN_BALANCES.set(userId, (COIN_BALANCES.get(userId) ?? 0) + coins);
  }

  /** Test helper: seed balance */
  seed(userId: string, coins: number): void {
    COIN_BALANCES.set(userId, coins);
  }
}
