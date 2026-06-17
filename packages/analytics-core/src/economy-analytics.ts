// ---------------------------------------------------------------------------
// analytics-core — EconomyAnalyticsService
// Extracted from LifeNest analytics/economy-analytics.service.ts.
// ---------------------------------------------------------------------------

import type { CreatorEarningsSummary, PlatformRevenueSummary } from './types';

// ---------------------------------------------------------------------------
// Economy data port (wire to Prisma / aggregation layer)
// ---------------------------------------------------------------------------

export interface EconomyDataPort {
  getCreatorTipsTotal(creatorId: string, since: string, until: string): Promise<number>;
  getCreatorGiftsTotal(creatorId: string, since: string, until: string): Promise<number>;
  getCreatorSubscriptionRevenue(creatorId: string, since: string, until: string): Promise<number>;
  getCreatorPayoutsTotal(creatorId: string, since: string, until: string): Promise<number>;
  getCreatorPendingPayouts(creatorId: string): Promise<number>;

  getPlatformFeesTotal(since: string, until: string): Promise<number>;
  getPlatformTransactionVolume(since: string, until: string): Promise<number>;
  getPlatformActiveCreators(since: string, until: string): Promise<number>;
  getPlatformActiveSubscriptions(since: string, until: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// EconomyAnalyticsService
// ---------------------------------------------------------------------------

export class EconomyAnalyticsService {
  constructor(
    private readonly data: EconomyDataPort,
    private readonly defaultCurrency = 'NGN',
  ) {}

  async creatorDashboard(
    creatorId: string,
    since: string,
    until: string,
  ): Promise<CreatorEarningsSummary> {
    const [tips, gifts, subscriptions, payouts, pending] = await Promise.all([
      this.data.getCreatorTipsTotal(creatorId, since, until).catch(() => 0),
      this.data.getCreatorGiftsTotal(creatorId, since, until).catch(() => 0),
      this.data.getCreatorSubscriptionRevenue(creatorId, since, until).catch(() => 0),
      this.data.getCreatorPayoutsTotal(creatorId, since, until).catch(() => 0),
      this.data.getCreatorPendingPayouts(creatorId).catch(() => 0),
    ]);

    return {
      creatorId,
      totalTips: tips,
      totalGifts: gifts,
      totalSubscriptionRevenue: subscriptions,
      totalPayouts: payouts,
      pendingPayouts: pending,
      currency: this.defaultCurrency,
      periodStart: since,
      periodEnd: until,
    };
  }

  async platformDashboard(since: string, until: string): Promise<PlatformRevenueSummary> {
    const [fees, volume, creators, subscriptions] = await Promise.all([
      this.data.getPlatformFeesTotal(since, until).catch(() => 0),
      this.data.getPlatformTransactionVolume(since, until).catch(() => 0),
      this.data.getPlatformActiveCreators(since, until).catch(() => 0),
      this.data.getPlatformActiveSubscriptions(since, until).catch(() => 0),
    ]);

    return {
      totalPlatformFees: fees,
      totalTransactionVolume: volume,
      totalActiveCreators: creators,
      totalSubscriptions: subscriptions,
      currency: this.defaultCurrency,
      periodStart: since,
      periodEnd: until,
    };
  }
}
