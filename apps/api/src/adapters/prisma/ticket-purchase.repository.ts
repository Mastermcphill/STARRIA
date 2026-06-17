// ---------------------------------------------------------------------------
// Prisma adapter stub — TicketPurchase repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { TicketPurchase, TicketPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TicketPurchaseRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    userId: string;
    eventId: string;
    quantity: number;
    unitPriceFiatMinorUnits: number;
    currency: string;
    totalFiatMinorUnits: number;
    reference: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<TicketPurchase> {
    return this.db.ticketPurchase.create({ data });
  }

  async findById(id: string): Promise<TicketPurchase | null> {
    return this.db.ticketPurchase.findUnique({ where: { id } });
  }

  async findByIdempotencyKey(key: string): Promise<TicketPurchase | null> {
    return this.db.ticketPurchase.findUnique({ where: { idempotencyKey: key } });
  }

  async updateStatus(
    id: string,
    status: TicketPurchaseStatus,
    refundedAt?: Date,
  ): Promise<TicketPurchase> {
    return this.db.ticketPurchase.update({
      where: { id },
      data: { status, ...(refundedAt ? { refundedAt } : {}) },
    });
  }

  async listByUser(
    userId: string,
    opts?: { status?: TicketPurchaseStatus; limit?: number; cursor?: string },
  ): Promise<TicketPurchase[]> {
    return this.db.ticketPurchase.findMany({
      where: { userId, ...(opts?.status ? { status: opts.status } : {}) },
      take: opts?.limit ?? 20,
      cursor: opts?.cursor ? { id: opts.cursor } : undefined,
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async listByEvent(eventId: string): Promise<TicketPurchase[]> {
    return this.db.ticketPurchase.findMany({
      where: { eventId },
      orderBy: { purchasedAt: 'desc' },
    });
  }
}
