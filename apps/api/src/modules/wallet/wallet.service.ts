import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import type { EventBus } from '@starria/domain-events';
import { appendWalletEntry, verifyWalletChain } from './wallet-ledger';

@Injectable()
export class WalletService {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async createWallet(userId: string) {
    const existing = await this.db.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.db.wallet.create({ data: { userId, coinBalance: 0 } });
  }

  async getBalance(userId: string) {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return { walletId: wallet.id, userId, coinBalance: wallet.coinBalance, updatedAt: wallet.updatedAt.toISOString() };
  }

  async getTransactions(userId: string, limit = 50, offset = 0) {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const [items, total] = await Promise.all([
      this.db.walletEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.db.walletEntry.count({ where: { walletId: wallet.id } }),
    ]);

    return { items, total };
  }

  async verifyLedgerIntegrity(userId: string): Promise<boolean> {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const entries = await this.db.walletEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { sequence: 'asc' },
    });

    return verifyWalletChain(entries);
  }

  async creditCoins(userId: string, coins: number, reference: string): Promise<void> {
    await this.db.$transaction(
      async (tx) => {
        let wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) wallet = await tx.wallet.create({ data: { userId, coinBalance: 0 } });

        const existing = await tx.walletEntry.findUnique({ where: { idempotencyKey: reference } });
        if (existing) return;

        await appendWalletEntry(tx, {
          walletId: wallet.id,
          type: 'CREDIT',
          coinAmount: coins,
          description: 'coin_purchase',
          idempotencyKey: reference,
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { coinBalance: { increment: coins } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
