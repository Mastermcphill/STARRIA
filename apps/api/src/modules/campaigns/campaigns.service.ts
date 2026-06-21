import { Injectable, Inject } from '@nestjs/common';
import { CampaignService } from '@starria/campaign-core';
import type { CreateCampaignInput, CampaignScope, PromotableType } from '@starria/campaign-core';
import { PrismaCampaignRepository } from './prisma-campaign.repository';
import { InMemoryCampaignLedger } from './in-memory-campaign.repository';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';

@Injectable()
export class CampaignsService {
  private readonly core: CampaignService;

  constructor(
    private readonly store: PrismaCampaignRepository,
    private readonly ledger: InMemoryCampaignLedger,
    @Inject(EVENT_BUS) eventBus: EventBus,
  ) {
    this.core = new CampaignService(store, ledger, eventBus);
  }

  async create(input: CreateCampaignInput) {
    return this.core.createCampaign(input);
  }

  async getMyCampaigns(starId: string) {
    return this.core.getMyCampaigns(starId);
  }

  async getById(id: string) {
    return this.core.getCampaignById(id);
  }

  async getAnalytics(campaignId: string) {
    return this.core.getAnalytics(campaignId);
  }

  async cancel(campaignId: string, starId: string) {
    return this.core.cancelCampaign(campaignId, starId);
  }

  async recordImpression(campaignId: string) {
    return this.core.recordImpression(campaignId);
  }

  async recordClick(campaignId: string) {
    return this.core.recordClick(campaignId);
  }

  /** Seed coins for testing without going through wallet service */
  seedCoins(userId: string, coins: number) {
    this.ledger.seed(userId, coins);
  }
}
