// ---------------------------------------------------------------------------
// Prisma adapter — implements TicketStorePort + TicketCoinLedgerPort
// Uses existing TicketPurchase / WalletEntry tables via PrismaService.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Ticket, TicketPurchaseRecord, TicketLedgerEntry, EventReminder, RefundRequest,
  TicketStorePort, TicketCoinLedgerPort,
} from '@starria/ticketing-core';

@Injectable()
export class PrismaTicketRepository implements TicketStorePort, TicketCoinLedgerPort {
  constructor(private readonly db: PrismaService) {}

  // ── Ticket ─────────────────────────────────────────────────────────────────

  async createTicket(input: Omit<Ticket, 'quantitySold' | 'updatedAt'>): Promise<Ticket> {
    // Persist as a metadata JSON on the Event (no dedicated Ticket table yet).
    // In a future migration, promote to a first-class table.
    // For now, return the input enriched with defaults.
    return { ...input, quantitySold: 0, updatedAt: input.createdAt };
  }

  async findTicketById(_id: string): Promise<Ticket | null> {
    // Stub — implemented via in-memory cache in TicketingService for this sprint.
    return null;
  }

  async findTicketsByEvent(_eventId: string): Promise<Ticket[]> {
    return [];
  }

  async updateTicket(id: string, patch: Partial<Ticket>): Promise<Ticket> {
    return { id, ...patch } as Ticket;
  }

  // ── TicketPurchase ─────────────────────────────────────────────────────────

  async createPurchase(record: TicketPurchaseRecord): Promise<TicketPurchaseRecord> {
    await this.db.ticketPurchase.create({
      data: {
        id: record.id,
        userId: record.userId,
        eventId: record.eventId,
        quantity: record.quantity,
        unitPriceFiatMinorUnits: 0,
        currency: 'NGN',
        totalFiatMinorUnits: 0,
        status: 'CONFIRMED',
        reference: record.idempotencyKey,
        idempotencyKey: record.idempotencyKey,
        purchasedAt: new Date(record.purchasedAt),
        metadata: {
          ticketId: record.ticketId,
          starId: record.starId,
          tier: record.tier,
          coinsSpent: record.coinsSpent,
          creatorCoinsPayout: record.creatorCoinsPayout,
          platformCoinsFee: record.platformCoinsFee,
        },
      },
    });
    return record;
  }

  async findPurchaseById(id: string): Promise<TicketPurchaseRecord | null> {
    const row = await this.db.ticketPurchase.findUnique({ where: { id } });
    return row ? this.mapPurchase(row) : null;
  }

  async findPurchaseByIdempotencyKey(key: string): Promise<TicketPurchaseRecord | null> {
    const row = await this.db.ticketPurchase.findUnique({ where: { idempotencyKey: key } });
    return row ? this.mapPurchase(row) : null;
  }

  async findPurchasesByUser(userId: string): Promise<TicketPurchaseRecord[]> {
    const rows = await this.db.ticketPurchase.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
    });
    return rows.map(r => this.mapPurchase(r));
  }

  async findPurchaseByUserAndEvent(userId: string, eventId: string): Promise<TicketPurchaseRecord | null> {
    const row = await this.db.ticketPurchase.findFirst({
      where: { userId, eventId },
      orderBy: { purchasedAt: 'desc' },
    });
    return row ? this.mapPurchase(row) : null;
  }

  async updatePurchase(id: string, patch: Partial<TicketPurchaseRecord>): Promise<TicketPurchaseRecord> {
    const row = await this.db.ticketPurchase.update({
      where: { id },
      data: {
        status: patch.status as 'PENDING' | 'CONFIRMED' | 'REFUNDED' | 'CANCELLED' | undefined,
        refundedAt: patch.refundedAt ? new Date(patch.refundedAt) : undefined,
      },
    });
    return this.mapPurchase(row);
  }

  // ── Ledger / Reminders / Refund (in-memory stubs for this sprint) ──────────

  async createLedgerEntry(entry: TicketLedgerEntry): Promise<TicketLedgerEntry> {
    return entry;
  }

  async createReminder(reminder: EventReminder): Promise<EventReminder> {
    return reminder;
  }

  async findRemindersByPurchase(_purchaseId: string): Promise<EventReminder[]> {
    return [];
  }

  async markReminderSent(_id: string): Promise<void> {}

  async createRefundRequest(req: RefundRequest): Promise<RefundRequest> {
    return req;
  }

  async findRefundByPurchase(_purchaseId: string): Promise<RefundRequest | null> {
    return null;
  }

  async updateRefundRequest(_id: string, patch: Partial<RefundRequest>): Promise<RefundRequest> {
    return patch as RefundRequest;
  }

  // ── CoinLedger (delegates to wallet tables) ────────────────────────────────

  async debit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }) {
    return this.moveCoins(input.userId, -input.amount, input.reason, input.idempotencyKey);
  }

  async credit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }) {
    return this.moveCoins(input.userId, input.amount, input.reason, input.idempotencyKey);
  }

  async getBalance(userId: string): Promise<{ userId: string; balance: number }> {
    const wallet = await this.db.wallet.findUnique({ where: { userId } });
    return { userId, balance: wallet?.coinBalance ?? 0 };
  }

  private async moveCoins(
    userId: string,
    delta: number,
    reason: string,
    idempotencyKey: string,
  ): Promise<{ userId: string; balance: number }> {
    return this.db.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId, coinBalance: 0 } });

      const existing = await tx.walletEntry.findUnique({ where: { idempotencyKey } });
      if (existing) return { userId, balance: wallet.coinBalance };

      if (delta < 0 && wallet.coinBalance < Math.abs(delta)) {
        throw new Error('Insufficient coin balance');
      }

      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: delta > 0 ? 'CREDIT' : 'DEBIT',
          coinAmount: Math.abs(delta),
          description: reason,
          previousHash: 'wallet-genesis',
          hash: randomUUID(),
          idempotencyKey,
        },
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: { increment: delta } },
      });

      return { userId, balance: updated.coinBalance };
    });
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private mapPurchase(row: {
    id: string; userId: string; eventId: string; quantity: number;
    status: string; idempotencyKey: string; purchasedAt: Date; refundedAt: Date | null;
    metadata: unknown;
  }): TicketPurchaseRecord {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      ticketId: (meta['ticketId'] as string) ?? '',
      eventId: row.eventId,
      userId: row.userId,
      starId: (meta['starId'] as string) ?? '',
      tier: ((meta['tier'] as string) ?? 'STANDARD') as TicketPurchaseRecord['tier'],
      quantity: row.quantity,
      coinsSpent: (meta['coinsSpent'] as number) ?? 0,
      creatorCoinsPayout: (meta['creatorCoinsPayout'] as number) ?? 0,
      platformCoinsFee: (meta['platformCoinsFee'] as number) ?? 0,
      status: row.status as TicketPurchaseRecord['status'],
      idempotencyKey: row.idempotencyKey,
      purchasedAt: row.purchasedAt.toISOString(),
      refundedAt: row.refundedAt?.toISOString(),
    };
  }
}
