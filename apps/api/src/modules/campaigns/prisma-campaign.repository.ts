// ---------------------------------------------------------------------------
// campaigns — Prisma adapter for CampaignStorePort (Sprint 10).
// Replaces the in-memory Maps with the VisibilityCampaign / CampaignLedgerEntry /
// CampaignAnalytics tables (migration 20260619000000_domain_persistence) so
// campaigns survive restart. The coin ledger (CampaignCoinLedgerPort) remains a
// separate wallet-adapter concern and is unchanged.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CampaignStorePort,
  VisibilityCampaign,
  CampaignLedgerEntry,
  CampaignAnalytics,
  CampaignStatus,
  CampaignScope,
  PromotableType,
} from '@starria/campaign-core';
import type {
  VisibilityCampaign as DbCampaign,
  CampaignLedgerEntry as DbLedgerEntry,
  CampaignAnalytics as DbAnalytics,
} from '@prisma/client';

// ── Row → domain mappers ──────────────────────────────────────────────────────

function toCampaign(c: DbCampaign): VisibilityCampaign {
  return {
    id: c.id,
    starId: c.starId,
    promotableType: c.promotableType as PromotableType,
    promotableId: c.promotableId,
    scope: c.scope as CampaignScope,
    status: c.status as CampaignStatus,
    coinsSpent: c.coinsSpent,
    idempotencyKey: c.idempotencyKey,
    startsAt: c.startsAt.toISOString(),
    expiresAt: c.expiresAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toLedgerEntry(e: DbLedgerEntry): CampaignLedgerEntry {
  return {
    id: e.id,
    campaignId: e.campaignId,
    starId: e.starId,
    action: e.action as CampaignLedgerEntry['action'],
    coinsAmount: e.coinsAmount,
    note: e.note ?? undefined,
    createdAt: e.createdAt.toISOString(),
  };
}

function toAnalytics(a: DbAnalytics): CampaignAnalytics {
  return {
    id: a.id,
    campaignId: a.campaignId,
    impressions: a.impressions,
    clicks: a.clicks,
    conversions: a.conversions,
    ctr: a.ctr,
    updatedAt: a.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaCampaignRepository implements CampaignStorePort {
  constructor(private readonly db: PrismaService) {}

  async findById(id: string): Promise<VisibilityCampaign | null> {
    const c = await this.db.visibilityCampaign.findUnique({ where: { id } });
    return c ? toCampaign(c) : null;
  }

  async findByIdempotencyKey(key: string): Promise<VisibilityCampaign | null> {
    const c = await this.db.visibilityCampaign.findUnique({ where: { idempotencyKey: key } });
    return c ? toCampaign(c) : null;
  }

  async findByStarId(starId: string): Promise<VisibilityCampaign[]> {
    const rows = await this.db.visibilityCampaign.findMany({
      where: { starId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCampaign);
  }

  async findActive(scope?: CampaignScope): Promise<VisibilityCampaign[]> {
    const rows = await this.db.visibilityCampaign.findMany({
      where: { status: 'ACTIVE', ...(scope ? { scope } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCampaign);
  }

  async create(
    campaign: Omit<VisibilityCampaign, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<VisibilityCampaign> {
    const c = await this.db.visibilityCampaign.create({
      data: {
        starId: campaign.starId,
        promotableType: campaign.promotableType,
        promotableId: campaign.promotableId,
        scope: campaign.scope,
        status: campaign.status,
        coinsSpent: campaign.coinsSpent,
        idempotencyKey: campaign.idempotencyKey,
        startsAt: new Date(campaign.startsAt),
        expiresAt: new Date(campaign.expiresAt),
      },
    });
    return toCampaign(c);
  }

  async updateStatus(id: string, status: CampaignStatus): Promise<VisibilityCampaign> {
    const c = await this.db.visibilityCampaign.update({ where: { id }, data: { status } });
    return toCampaign(c);
  }

  async appendLedger(
    entry: Omit<CampaignLedgerEntry, 'id' | 'createdAt'>,
  ): Promise<CampaignLedgerEntry> {
    const e = await this.db.campaignLedgerEntry.create({
      data: {
        campaignId: entry.campaignId,
        starId: entry.starId,
        action: entry.action,
        coinsAmount: entry.coinsAmount,
        note: entry.note ?? null,
      },
    });
    return toLedgerEntry(e);
  }

  async getLedger(campaignId: string): Promise<CampaignLedgerEntry[]> {
    const rows = await this.db.campaignLedgerEntry.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toLedgerEntry);
  }

  async getAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    const a = await this.db.campaignAnalytics.findUnique({ where: { campaignId } });
    return a ? toAnalytics(a) : null;
  }

  async upsertAnalytics(
    analytics: Omit<CampaignAnalytics, 'id' | 'updatedAt'> & { id?: string },
  ): Promise<CampaignAnalytics> {
    const a = await this.db.campaignAnalytics.upsert({
      where: { campaignId: analytics.campaignId },
      create: {
        campaignId: analytics.campaignId,
        impressions: analytics.impressions,
        clicks: analytics.clicks,
        conversions: analytics.conversions,
        ctr: analytics.ctr,
      },
      update: {
        impressions: analytics.impressions,
        clicks: analytics.clicks,
        conversions: analytics.conversions,
        ctr: analytics.ctr,
      },
    });
    return toAnalytics(a);
  }
}
