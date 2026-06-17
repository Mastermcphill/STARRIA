import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import type { EventBus } from '@starria/domain-events';
import { buildPayoutRequestedEvent } from '@starria/wallet-core';
import { verifyLedgerChain } from '@starria/wallet-core';
import type { WithdrawDto } from './dto/withdraw.dto';

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

  async withdraw(userId: string, dto: WithdrawDto) {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (dto.amount <= 0) throw new UnprocessableEntityException('Amount must be positive');

    const payoutId = randomUUID();
    const currency = dto.currency ?? 'NGN';

    void this.eventBus.publish(buildPayoutRequestedEvent({
      payoutId,
      accountId: userId,
      amount: dto.amount,
      currency,
      destinationRef: dto.destination,
    }));

    return { payoutId, status: 'requested', amount: dto.amount, currency };
  }

  async verifyLedgerIntegrity(userId: string): Promise<boolean> {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const entries = await this.db.walletEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'asc' },
    });

    return verifyLedgerChain(entries.map(e => ({
      id: e.id,
      sequence: 0,
      accountId: userId,
      accountType: 'customer' as const,
      direction: (e.type === 'CREDIT' ? 'credit' : 'debit') as 'credit' | 'debit',
      amount: e.coinAmount ?? 0,
      currency: e.currency,
      balanceAfter: 0,
      reference: e.idempotencyKey,
      reason: 'payment_split' as const,
      previousHash: e.previousHash ?? 'wallet-genesis',
      hash: e.hash,
      createdAt: e.createdAt.toISOString(),
    })));
  }

  async creditCoins(userId: string, coins: number, reference: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId, coinBalance: 0 } });

      const existing = await tx.walletEntry.findUnique({ where: { idempotencyKey: reference } });
      if (existing) return;

      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          coinAmount: coins,
          description: 'coin_purchase',
          previousHash: 'wallet-genesis',
          hash: randomUUID(),
          idempotencyKey: reference,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: { increment: coins } },
      });
    });
  }
}
