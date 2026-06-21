// ---------------------------------------------------------------------------
// PrismaLedgerStore — Prisma adapter for wallet-core's LedgerStorePort.
//
// Persists double-entry postings atomically: one immutable, hash-chained
// WalletTransaction row per leg, an upserted WalletBalanceSnapshot per
// (account, currency), and WalletSettlement / WalletRefund records where
// present. All work happens inside a single serializable transaction so the
// requireFunds preconditions are enforced against committed balances and a
// posting is all-or-nothing. Idempotent on `idempotencyKey`.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeLedgerEntryHash,
  LEDGER_GENESIS_HASH,
  type LedgerStorePort,
  type LedgerPosting,
  type LedgerResult,
  type LedgerBalance,
  type LedgerLeg,
} from '@starria/wallet-core';

@Injectable()
export class PrismaLedgerStore implements LedgerStorePort {
  constructor(private readonly db: PrismaService) {}

  async findResultByIdempotencyKey(key: string): Promise<LedgerResult | null> {
    const rows = await this.db.walletTransaction.findMany({ where: { idempotencyKey: key } });
    if (rows.length === 0) return null;
    const accounts = [...new Set(rows.map((r) => r.accountId))];
    const currency = rows[0].currency;
    const balances = await Promise.all(accounts.map((a) => this.getBalance(a, currency)));
    return {
      reference: rows[0].reference,
      idempotencyKey: key,
      txnType: rows[0].txnType as LedgerResult['txnType'],
      currency,
      deduped: true,
      balances,
    };
  }

  async getBalance(accountId: string, currency: string): Promise<LedgerBalance> {
    const snap = await this.db.walletBalanceSnapshot.findUnique({
      where: { accountId_currency: { accountId, currency } },
    });
    return {
      accountId,
      currency,
      available: snap?.available ?? 0,
      reserved: snap?.reserved ?? 0,
      version: snap?.version ?? 0,
    };
  }

  async post(posting: LedgerPosting): Promise<LedgerResult> {
    const postingId = randomUUID();
    return this.db.$transaction(
      async (tx) => {
        // Idempotency guard inside the transaction.
        const dup = await tx.walletTransaction.findFirst({
          where: { idempotencyKey: posting.idempotencyKey },
        });
        if (dup) {
          const accounts = [...new Set(posting.legs.map((l) => l.accountId))];
          const balances = await Promise.all(
            accounts.map((a) => this.readBalanceTx(tx, a, posting.currency)),
          );
          return {
            reference: dup.reference,
            idempotencyKey: posting.idempotencyKey,
            txnType: dup.txnType as LedgerResult['txnType'],
            currency: posting.currency,
            deduped: true,
            balances,
          };
        }

        // Enforce fund preconditions against committed balances.
        for (const req of posting.requireFunds) {
          const bal = await this.readBalanceTx(tx, req.accountId, posting.currency);
          const have = req.sub === 'available' ? bal.available : bal.reserved;
          if (have < req.amount) {
            throw new Prisma.PrismaClientKnownRequestError(
              `Insufficient ${req.sub} balance for ${req.accountId}: have ${have}, need ${req.amount}`,
              { code: 'P2000', clientVersion: 'ledger' } as never,
            );
          }
        }

        // Working balance map so multiple legs on the same bucket compound.
        const working = new Map<string, { available: number; reserved: number; version: number }>();
        const keyOf = (accountId: string) => `${accountId}:${posting.currency}`;
        const ensure = async (accountId: string) => {
          const k = keyOf(accountId);
          if (!working.has(k)) {
            const b = await this.readBalanceTx(tx, accountId, posting.currency);
            working.set(k, { available: b.available, reserved: b.reserved, version: b.version });
          }
          return working.get(k)!;
        };

        for (const leg of posting.legs) {
          const bucket = await ensure(leg.accountId);
          const delta = leg.direction === 'credit' ? leg.amount : -leg.amount;
          if (leg.sub === 'available') bucket.available += delta;
          else bucket.reserved += delta;
          const balanceAfter = leg.sub === 'available' ? bucket.available : bucket.reserved;

          const previousHash = await this.lastHashTx(tx, leg.accountId, leg.sub);
          const id = randomUUID();
          const createdAt = new Date().toISOString();
          const hash = computeLedgerEntryHash({
            id,
            sequence: 0,
            accountId: leg.accountId,
            direction: leg.direction,
            amount: leg.amount,
            currency: posting.currency,
            balanceAfter,
            reference: posting.reference,
            reason: 'payment_split',
            previousHash,
            createdAt,
          });

          await tx.walletTransaction.create({
            data: {
              id,
              postingId,
              idempotencyKey: posting.idempotencyKey,
              reference: posting.reference,
              reason: posting.reason,
              txnType: posting.txnType,
              accountId: leg.accountId,
              accountType: leg.accountType,
              sub: leg.sub,
              direction: leg.direction,
              amount: leg.amount,
              currency: posting.currency,
              balanceAfter,
              previousHash,
              hash,
              metadata: (posting.metadata as Prisma.InputJsonValue) ?? undefined,
            },
          });
        }

        // Persist updated balance snapshots.
        for (const leg of dedupeAccounts(posting.legs)) {
          const bucket = working.get(keyOf(leg.accountId))!;
          await tx.walletBalanceSnapshot.upsert({
            where: { accountId_currency: { accountId: leg.accountId, currency: posting.currency } },
            create: {
              accountId: leg.accountId,
              currency: posting.currency,
              accountType: leg.accountType,
              available: bucket.available,
              reserved: bucket.reserved,
              version: 1,
            },
            update: {
              available: bucket.available,
              reserved: bucket.reserved,
              version: { increment: 1 },
            },
          });
        }

        if (posting.settlement) {
          await tx.walletSettlement.create({
            data: {
              idempotencyKey: posting.idempotencyKey,
              reference: posting.reference,
              payerAccountId: posting.settlement.payerAccountId,
              recipientAccountId: posting.settlement.recipientAccountId,
              grossAmount: posting.settlement.grossAmount,
              platformFee: posting.settlement.platformFee,
              recipientAmount: posting.settlement.recipientAmount,
              platformPercentage: posting.settlement.platformPercentage,
              currency: posting.currency,
            },
          });
        }

        if (posting.refund) {
          await tx.walletRefund.create({
            data: {
              idempotencyKey: posting.idempotencyKey,
              reference: posting.reference,
              originalReference: posting.refund.originalReference,
              payerAccountId: posting.refund.payerAccountId,
              amount: posting.refund.amount,
              currency: posting.currency,
            },
          });
        }

        const accounts = [...new Set(posting.legs.map((l) => l.accountId))];
        const balances = accounts.map((a): LedgerBalance => {
          const b = working.get(keyOf(a))!;
          return { accountId: a, currency: posting.currency, available: b.available, reserved: b.reserved, version: b.version + 1 };
        });

        return {
          reference: posting.reference,
          idempotencyKey: posting.idempotencyKey,
          txnType: posting.txnType,
          currency: posting.currency,
          deduped: false,
          balances,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async readBalanceTx(
    tx: Prisma.TransactionClient,
    accountId: string,
    currency: string,
  ): Promise<LedgerBalance> {
    const snap = await tx.walletBalanceSnapshot.findUnique({
      where: { accountId_currency: { accountId, currency } },
    });
    return {
      accountId,
      currency,
      available: snap?.available ?? 0,
      reserved: snap?.reserved ?? 0,
      version: snap?.version ?? 0,
    };
  }

  private async lastHashTx(
    tx: Prisma.TransactionClient,
    accountId: string,
    sub: string,
  ): Promise<string> {
    const last = await tx.walletTransaction.findFirst({
      where: { accountId, sub },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    return last?.hash ?? LEDGER_GENESIS_HASH;
  }
}

/** Distinct legs by accountId (keeps the first leg's accountType for snapshot creation). */
function dedupeAccounts(legs: readonly LedgerLeg[]): LedgerLeg[] {
  const seen = new Set<string>();
  const out: LedgerLeg[] = [];
  for (const leg of legs) {
    if (seen.has(leg.accountId)) continue;
    seen.add(leg.accountId);
    out.push(leg);
  }
  return out;
}
