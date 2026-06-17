// ---------------------------------------------------------------------------
// Prisma adapter stub — TicketAttribution repository
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { TicketAttribution, TicketAttributionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TicketAttributionRepository {
  constructor(private readonly db: PrismaService) {}

  async create(data: {
    ticketPurchaseId: string;
    attributedToUserId?: string;
    attributionType?: TicketAttributionType;
    promoCode?: string;
    campaignId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TicketAttribution> {
    return this.db.ticketAttribution.create({ data });
  }

  async findByTicketPurchase(ticketPurchaseId: string): Promise<TicketAttribution | null> {
    return this.db.ticketAttribution.findUnique({ where: { ticketPurchaseId } });
  }

  async listByCampaign(campaignId: string): Promise<TicketAttribution[]> {
    return this.db.ticketAttribution.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByReferrer(attributedToUserId: string): Promise<TicketAttribution[]> {
    return this.db.ticketAttribution.findMany({
      where: { attributedToUserId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
