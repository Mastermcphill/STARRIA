// ---------------------------------------------------------------------------
// PrismaCoinLedgerRepository
// Implements CoinLedgerPort (from gifting-core) against the Prisma Wallet model.
// Uses a serialised Prisma transaction per debit/credit to prevent double-spend.
// ---------------------------------------------------------------------------

import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CoinLedgerPort, CoinMovementInput, CoinBalance } from '@starria/gifting-core';
import { PrismaService } from '../../prisma/prisma.service';
import { appendWalletEntry } from './wallet-ledger';

// Both debit and credit read the current balance and then write a new absolute
// value, so they MUST run under Serializable isolation — otherwise two
// concurrent debits can both read the same balance and lost-update, letting a
// user spend the same coins twice (double-spend).
const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

@Injectable()
export class PrismaCoinLedgerRepository implements CoinLedgerPort {
  constructor(private readonly db: PrismaService) {}

  async getBalance(userId: string): Promise<CoinBalance> {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException(`Wallet not found for user ${userId}`);
    return { userId, balance: wallet.coinBalance };
  }

  async debit(input: CoinMovementInput): Promise<CoinBalance> {
    return this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      if (!wallet) throw new NotFoundException(`Wallet not found for user ${input.userId}`);

      // Idempotency: if this key was already applied, return current balance
      const existing = await tx.walletEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { userId: input.userId, balance: wallet.coinBalance };

      if (wallet.coinBalance < input.amount) {
        throw new UnprocessableEntityException(
          `Insufficient coins: have ${wallet.coinBalance}, need ${input.amount}`,
        );
      }

      const newBalance = wallet.coinBalance - input.amount;
      await appendWalletEntry(tx, {
        walletId: wallet.id,
        type: 'DEBIT',
        coinAmount: input.amount,
        description: input.reason,
        idempotencyKey: input.idempotencyKey,
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: newBalance },
      });

      return { userId: input.userId, balance: updated.coinBalance };
    }, SERIALIZABLE);
  }

  async credit(input: CoinMovementInput): Promise<CoinBalance> {
    return this.db.$transaction(async (tx) => {
      // For platform account, upsert the wallet
      let wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: input.userId, coinBalance: 0 },
        });
      }

      const existing = await tx.walletEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { userId: input.userId, balance: wallet.coinBalance };

      const newBalance = wallet.coinBalance + input.amount;
      await appendWalletEntry(tx, {
        walletId: wallet.id,
        type: 'CREDIT',
        coinAmount: input.amount,
        description: input.reason,
        idempotencyKey: input.idempotencyKey,
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: newBalance },
      });

      return { userId: input.userId, balance: updated.coinBalance };
    }, SERIALIZABLE);
  }
}
