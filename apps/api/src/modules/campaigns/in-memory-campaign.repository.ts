// ---------------------------------------------------------------------------
// campaigns — Coin ledger adapter (CampaignCoinLedgerPort).
// The campaign STORE is now Prisma-backed (see prisma-campaign.repository.ts).
// This remaining adapter is the coin payment ledger, deliberately kept as a
// wallet-adapter stub with a `seed()` test helper; routing it through the real
// Wallet ledger is a separate wallet-integration concern (see Sprint 10 audit).
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { CampaignCoinLedgerPort } from '@starria/campaign-core';

const BALANCES = new Map<string, number>();
const IDEM_OPS = new Set<string>();

@Injectable()
export class InMemoryCampaignLedger implements CampaignCoinLedgerPort {
  async getBalance(userId: string) {
    return { balance: BALANCES.get(userId) ?? 0 };
  }

  async debit({ userId, amount, idempotencyKey }: { userId: string; amount: number; reason: string; idempotencyKey: string }) {
    if (IDEM_OPS.has(idempotencyKey)) return this.getBalance(userId);
    const bal = BALANCES.get(userId) ?? 0;
    if (bal < amount) throw new Error(`Insufficient coins: have ${bal}, need ${amount}`);
    BALANCES.set(userId, bal - amount);
    IDEM_OPS.add(idempotencyKey);
    return { balance: BALANCES.get(userId)! };
  }

  async credit({ userId, amount, idempotencyKey }: { userId: string; amount: number; reason: string; idempotencyKey: string }) {
    if (IDEM_OPS.has(idempotencyKey)) return this.getBalance(userId);
    BALANCES.set(userId, (BALANCES.get(userId) ?? 0) + amount);
    IDEM_OPS.add(idempotencyKey);
    return { balance: BALANCES.get(userId)! };
  }

  /** Test/dev helper — seed a balance without going through the wallet service. */
  seed(userId: string, coins: number) {
    BALANCES.set(userId, coins);
  }
}
