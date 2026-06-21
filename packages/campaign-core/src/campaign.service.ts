// ---------------------------------------------------------------------------
// campaign-core — CampaignService
// Handles visibility campaign creation, activation, expiry, and analytics.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  CampaignStorePort,
  CampaignCoinLedgerPort,
  CreateCampaignInput,
  CreateCampaignResult,
  VisibilityCampaign,
  CampaignAnalytics,
} from './types';
import { getCampaignCost } from './types';
import {
  buildCampaignCreatedEvent,
  buildCampaignActivatedEvent,
  buildCampaignExpiredEvent,
  buildCampaignCancelledEvent,
} from './events';

const DEFAULT_DURATION_HOURS = 48;

export class CampaignService {
  constructor(
    private readonly store: CampaignStorePort,
    private readonly ledger: CampaignCoinLedgerPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Create campaign ───────────────────────────────────────────────────────

  async createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
    // Idempotency check
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      const ledger = await this.store.getLedger(existing.id);
      const balance = await this.ledger.getBalance(input.starId);
      return {
        campaign: existing,
        ledgerEntry: ledger[0],
        starCoinBalance: balance.balance,
        deduped: true,
      };
    }

    const coins = getCampaignCost(input.scope, input.promotableType);
    const now = new Date();
    const durationHours = input.durationHours ?? DEFAULT_DURATION_HOURS;
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();

    // Debit coins before creating campaign
    const balanceResult = await this.ledger.debit({
      userId: input.starId,
      amount: coins,
      reason: `campaign:${input.scope}:${input.promotableType}`,
      idempotencyKey: `campaign-charge:${input.idempotencyKey}`,
    });

    const campaign = await this.store.create({
      starId: input.starId,
      promotableType: input.promotableType,
      promotableId: input.promotableId,
      scope: input.scope,
      status: 'ACTIVE',
      coinsSpent: coins,
      idempotencyKey: input.idempotencyKey,
      startsAt: now.toISOString(),
      expiresAt,
    });

    const ledgerEntry = await this.store.appendLedger({
      campaignId: campaign.id,
      starId: input.starId,
      action: 'CHARGE',
      coinsAmount: coins,
      note: `${input.scope} ${input.promotableType} campaign (${durationHours}h)`,
    });

    // Seed zero analytics
    await this.store.upsertAnalytics({
      campaignId: campaign.id,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: 0,
    });

    void this.eventBus?.publish(buildCampaignCreatedEvent({
      campaignId: campaign.id,
      starId: input.starId,
      promotableType: input.promotableType,
      promotableId: input.promotableId,
      scope: input.scope,
      coinsSpent: coins,
      startsAt: campaign.startsAt,
      expiresAt,
    }));

    void this.eventBus?.publish(buildCampaignActivatedEvent({
      campaignId: campaign.id,
      starId: input.starId,
      promotableType: input.promotableType,
      scope: input.scope,
      activatedAt: now.toISOString(),
    }));

    return {
      campaign,
      ledgerEntry,
      starCoinBalance: balanceResult.balance,
      deduped: false,
    };
  }

  // ── Get campaigns ─────────────────────────────────────────────────────────

  async getMyCampaigns(starId: string): Promise<VisibilityCampaign[]> {
    return this.store.findByStarId(starId);
  }

  async getCampaignById(id: string): Promise<VisibilityCampaign | null> {
    return this.store.findById(id);
  }

  async getAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    return this.store.getAnalytics(campaignId);
  }

  // ── Expire campaign (called by scheduler) ─────────────────────────────────

  async expireCampaign(campaignId: string): Promise<VisibilityCampaign> {
    const campaign = await this.store.findById(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    if (campaign.status !== 'ACTIVE') return campaign;

    const analytics = await this.store.getAnalytics(campaignId);
    const updated = await this.store.updateStatus(campaignId, 'EXPIRED');

    void this.eventBus?.publish(buildCampaignExpiredEvent({
      campaignId,
      starId: campaign.starId,
      impressions: analytics?.impressions ?? 0,
      clicks: analytics?.clicks ?? 0,
      expiredAt: new Date().toISOString(),
    }));

    return updated;
  }

  // ── Cancel campaign ───────────────────────────────────────────────────────

  async cancelCampaign(campaignId: string, starId: string): Promise<VisibilityCampaign> {
    const campaign = await this.store.findById(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    if (campaign.starId !== starId) throw new Error('Not authorised');
    if (campaign.status !== 'ACTIVE' && campaign.status !== 'PENDING') {
      throw new Error(`Cannot cancel campaign in status: ${campaign.status}`);
    }

    // Partial refund: 50% back if cancelled within first 12 hours
    const hoursElapsed = (Date.now() - Date.parse(campaign.startsAt)) / 3600000;
    const refundCoins = hoursElapsed < 12 ? Math.floor(campaign.coinsSpent * 0.5) : 0;

    if (refundCoins > 0) {
      await this.ledger.credit({
        userId: starId,
        amount: refundCoins,
        reason: 'campaign_cancellation_refund',
        idempotencyKey: `campaign-refund:${campaignId}`,
      });
      await this.store.appendLedger({
        campaignId,
        starId,
        action: 'REFUND',
        coinsAmount: refundCoins,
        note: `Partial refund (${hoursElapsed.toFixed(1)}h elapsed)`,
      });
    }

    const updated = await this.store.updateStatus(campaignId, 'CANCELLED');

    void this.eventBus?.publish(buildCampaignCancelledEvent({
      campaignId,
      starId,
      coinsRefunded: refundCoins,
      cancelledAt: new Date().toISOString(),
    }));

    return updated;
  }

  // ── Analytics impression/click recording (called by feed/discovery) ───────

  async recordImpression(campaignId: string): Promise<void> {
    const analytics = await this.store.getAnalytics(campaignId);
    if (!analytics) return;
    const impressions = analytics.impressions + 1;
    const ctr = impressions > 0 ? analytics.clicks / impressions : 0;
    await this.store.upsertAnalytics({ ...analytics, impressions, ctr });
  }

  async recordClick(campaignId: string): Promise<void> {
    const analytics = await this.store.getAnalytics(campaignId);
    if (!analytics) return;
    const clicks = analytics.clicks + 1;
    const ctr = analytics.impressions > 0 ? clicks / analytics.impressions : 0;
    await this.store.upsertAnalytics({ ...analytics, clicks, ctr });
  }
}
