import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TicketingService as CoreTicketingService } from '@starria/ticketing-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTicketRepository } from './prisma-ticket-store.repository';
import type { PurchaseTicketDto } from './dto/purchase-ticket.dto';

@Injectable()
export class TicketingService {
  private readonly core: CoreTicketingService;

  constructor(
    private readonly db: PrismaService,
    private readonly repo: PrismaTicketRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.core = new CoreTicketingService(repo, repo, eventBus);
  }

  async purchaseTicket(userId: string, dto: PurchaseTicketDto) {
    const key = dto.idempotencyKey ?? `ticket:${randomUUID()}`;

    // Verify event exists
    const event = await this.db.event.findUnique({
      where: { id: dto.eventId },
      select: { id: true, starProfile: { select: { userId: true } } },
    });
    if (!event) throw new NotFoundException(`Event ${dto.eventId} not found`);

    // Build a transient Ticket record (proper Ticket table migration is Sprint 4)
    const ticket = {
      id: dto.ticketId,
      eventId: dto.eventId,
      starId: dto.starId,
      tier: 'STANDARD' as const,
      title: 'Event Ticket',
      priceCoins: 0,
      priceFiatMinorUnits: 0,
      currency: 'NGN',
      status: 'ACTIVE' as const,
      quantitySold: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Inject the transient ticket into the repo's findTicketById for this call
    const originalFind = this.repo.findTicketById.bind(this.repo);
    this.repo.findTicketById = async (id: string) => (id === ticket.id ? ticket : originalFind(id));

    try {
      return await this.core.purchaseTicket({
        ticketId: dto.ticketId,
        eventId: dto.eventId,
        userId,
        starId: dto.starId,
        quantity: dto.quantity,
        idempotencyKey: key,
      });
    } finally {
      this.repo.findTicketById = originalFind;
    }
  }

  async getMyTickets(userId: string) {
    const purchases = await this.db.ticketPurchase.findMany({
      where: { userId, status: 'CONFIRMED' },
      include: {
        event: {
          select: {
            id: true, title: true, type: true, status: true,
            scheduledAt: true, startedAt: true, thumbnailUrl: true,
            starProfile: { select: { id: true, user: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    });

    return purchases.map(p => ({
      purchaseId: p.id,
      eventId: p.eventId,
      quantity: p.quantity,
      status: p.status,
      purchasedAt: p.purchasedAt.toISOString(),
      event: p.event,
    }));
  }

  async refundTicket(userId: string, purchaseId: string, reason?: string) {
    return this.core.refundTicket({ purchaseId, userId, reason });
  }

  async verifyOwnership(userId: string, eventId: string) {
    return this.core.verifyOwnership({ userId, eventId });
  }
}
