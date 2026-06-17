// ---------------------------------------------------------------------------
// discovery-core — TrendingService
// Reads trending rails and decides when a video crosses the local/global trend
// thresholds, emitting the corresponding events.
// ---------------------------------------------------------------------------

import type { EventBus, DiscoveryEntityType } from '@starria/domain-events';
import type { TrendingStorePort } from './ports';
import type { TrendingItem } from './types';
import { GLOBAL_SCOPE } from './types';
import { TREND_THRESHOLDS } from './ranking';
import {
  buildLocalTrendTriggeredEvent,
  buildGlobalTrendTriggeredEvent,
} from './events';

export class TrendingService {
  constructor(
    private readonly trending: TrendingStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async getGlobalTrending(limit = 20): Promise<TrendingItem[]> {
    return this.trending.listTrending(GLOBAL_SCOPE, Math.min(limit, 50));
  }

  async getLocalTrending(region: string, limit = 20): Promise<TrendingItem[]> {
    return this.trending.listTrending(region.trim().toUpperCase(), Math.min(limit, 50));
  }

  /**
   * Called by the aggregation job after recomputing a (video, scope) trending
   * score. Emits LocalTrendTriggeredEvent / GlobalTrendTriggeredEvent when the
   * score crosses the respective threshold.
   */
  evaluateTrend(params: {
    entityId: string;
    entityType?: DiscoveryEntityType;
    scope: string; // 'GLOBAL' or region/country
    score: number; // 0..1
    rank: number;
  }): { triggered: boolean; level?: 'local' | 'global' } {
    const entityType = params.entityType ?? 'video';
    if (params.scope === GLOBAL_SCOPE) {
      if (params.score >= TREND_THRESHOLDS.global) {
        void this.eventBus?.publish(buildGlobalTrendTriggeredEvent({
          entityId: params.entityId,
          entityType,
          score: params.score,
          rank: params.rank,
        }));
        return { triggered: true, level: 'global' };
      }
    } else if (params.score >= TREND_THRESHOLDS.local) {
      void this.eventBus?.publish(buildLocalTrendTriggeredEvent({
        entityId: params.entityId,
        entityType,
        region: params.scope,
        score: params.score,
        rank: params.rank,
      }));
      return { triggered: true, level: 'local' };
    }
    return { triggered: false };
  }
}
