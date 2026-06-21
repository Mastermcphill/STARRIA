// ---------------------------------------------------------------------------
// campaign-core — domain types
// Visibility Marketplace: campaigns, ledger, analytics
// ---------------------------------------------------------------------------

import type { CampaignScope, PromotableType } from '@starria/domain-events';

export type { CampaignScope, PromotableType };

export type CampaignStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

// ── Coin cost table ──────────────────────────────────────────────────────────

export const CAMPAIGN_COIN_COSTS: Record<CampaignScope, Record<PromotableType, number>> = {
  LOCAL:   { VIDEO: 50,  CREATOR: 100, LIVE_SESSION: 75,  EVENT: 80,  ARENA: 200 },
  COUNTRY: { VIDEO: 150, CREATOR: 300, LIVE_SESSION: 200, EVENT: 250, ARENA: 500 },
  GLOBAL:  { VIDEO: 400, CREATOR: 800, LIVE_SESSION: 500, EVENT: 600, ARENA: 1200 },
};

export function getCampaignCost(scope: CampaignScope, type: PromotableType): number {
  return CAMPAIGN_COIN_COSTS[scope][type];
}

// ── VisibilityCampaign ───────────────────────────────────────────────────────

export interface VisibilityCampaign {
  readonly id: string;
  readonly starId: string;
  readonly promotableType: PromotableType;
  readonly promotableId: string;
  readonly scope: CampaignScope;
  readonly status: CampaignStatus;
  readonly coinsSpent: number;
  readonly idempotencyKey: string;
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── CampaignLedger ───────────────────────────────────────────────────────────

export interface CampaignLedgerEntry {
  readonly id: string;
  readonly campaignId: string;
  readonly starId: string;
  readonly action: 'CHARGE' | 'REFUND';
  readonly coinsAmount: number;
  readonly note?: string;
  readonly createdAt: string;
}

// ── CampaignAnalytics ────────────────────────────────────────────────────────

export interface CampaignAnalytics {
  readonly id: string;
  readonly campaignId: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly ctr: number; // click-through rate (0–1)
  readonly updatedAt: string;
}

// ── Service I/O ──────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  readonly starId: string;
  readonly promotableType: PromotableType;
  readonly promotableId: string;
  readonly scope: CampaignScope;
  readonly durationHours?: number; // default 48
  readonly idempotencyKey: string;
}

export interface CreateCampaignResult {
  readonly campaign: VisibilityCampaign;
  readonly ledgerEntry: CampaignLedgerEntry;
  readonly starCoinBalance: number;
  readonly deduped: boolean;
}

// ── Persistence port ─────────────────────────────────────────────────────────

export interface CampaignStorePort {
  findById(id: string): Promise<VisibilityCampaign | null>;
  findByIdempotencyKey(key: string): Promise<VisibilityCampaign | null>;
  findByStarId(starId: string): Promise<VisibilityCampaign[]>;
  findActive(scope?: CampaignScope): Promise<VisibilityCampaign[]>;
  create(campaign: Omit<VisibilityCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<VisibilityCampaign>;
  updateStatus(id: string, status: CampaignStatus): Promise<VisibilityCampaign>;
  appendLedger(entry: Omit<CampaignLedgerEntry, 'id' | 'createdAt'>): Promise<CampaignLedgerEntry>;
  getLedger(campaignId: string): Promise<CampaignLedgerEntry[]>;
  getAnalytics(campaignId: string): Promise<CampaignAnalytics | null>;
  upsertAnalytics(analytics: Omit<CampaignAnalytics, 'id' | 'updatedAt'> & { id?: string }): Promise<CampaignAnalytics>;
}

// ── Coin ledger port (mirrors ticketing-core shape) ──────────────────────────

export interface CampaignCoinLedgerPort {
  debit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }): Promise<{ balance: number }>;
  credit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }): Promise<{ balance: number }>;
  getBalance(userId: string): Promise<{ balance: number }>;
}
