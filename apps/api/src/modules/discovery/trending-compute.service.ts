// ---------------------------------------------------------------------------
// TrendingComputeService
// Batch-recomputes trending scores + ranks for the GLOBAL rail and each region
// rail, persists TrendingScore rows, and asks discovery-core's TrendingService
// to emit Local/GlobalTrendTriggeredEvent when thresholds are crossed.
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TrendingService,
  computeTrendingScore,
  GLOBAL_SCOPE,
} from '@starria/discovery-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTrendingStoreAdapter } from './prisma-trending-store.adapter';

const RECENT_TAP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrendingComputeService {
  private readonly logger = new Logger(TrendingComputeService.name);
  private readonly trending: TrendingService;

  constructor(
    private readonly db: PrismaService,
    trendingStore: PrismaTrendingStoreAdapter,
    @Inject(EVENT_BUS) eventBus: EventBus,
  ) {
    this.trending = new TrendingService(trendingStore, eventBus);
  }

  async recomputeAll(): Promise<{ global: number; regional: number }> {
    const now = Date.now();
    const since = new Date(now - RECENT_TAP_WINDOW_MS);

    const videos = await this.db.video.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        publishedAt: true,
        discoveryScore: { select: { score: true } },
      },
    });
    if (videos.length === 0) return { global: 0, regional: 0 };

    // Recent weighted taps per video (global).
    const tapAgg = await this.db.contentTap.groupBy({
      by: ['videoId'],
      where: { createdAt: { gte: since } },
      _sum: { weight: true },
    });
    const recentByVideo = new Map(tapAgg.map(t => [t.videoId, t._sum.weight ?? 0]));

    // ── Global rail ────────────────────────────────────────────────────────
    const globalScored = videos.map(v => {
      const hoursSincePublish = v.publishedAt ? (now - v.publishedAt.getTime()) / 3_600_000 : 9999;
      const score = computeTrendingScore({
        discoveryScore: v.discoveryScore?.score ?? 0,
        recentWeightedTaps: recentByVideo.get(v.id) ?? 0,
        hoursSincePublish,
      });
      return { videoId: v.id, score };
    }).sort((a, b) => b.score - a.score);

    let rank = 1;
    for (const row of globalScored) {
      await this.db.trendingScore.upsert({
        where: { videoId_scope: { videoId: row.videoId, scope: GLOBAL_SCOPE } },
        create: { videoId: row.videoId, scope: GLOBAL_SCOPE, score: row.score, rank },
        update: { score: row.score, rank },
      });
      this.trending.evaluateTrend({ entityId: row.videoId, scope: GLOBAL_SCOPE, score: row.score, rank });
      rank++;
    }

    // ── Regional rails ───────────────────────────────────────────────────────
    const boosts = await this.db.regionalTapBoost.findMany({
      select: { videoId: true, region: true, boostScore: true },
    });
    const scoreByVideo = new Map(videos.map(v => [v.id, v.discoveryScore?.score ?? 0]));
    const publishedAtByVideo = new Map(videos.map(v => [v.id, v.publishedAt]));

    const byRegion = new Map<string, Array<{ videoId: string; score: number }>>();
    for (const b of boosts) {
      if (!scoreByVideo.has(b.videoId)) continue; // only published videos
      const publishedAt = publishedAtByVideo.get(b.videoId);
      const hoursSincePublish = publishedAt ? (now - publishedAt.getTime()) / 3_600_000 : 9999;
      const score = computeTrendingScore({
        discoveryScore: scoreByVideo.get(b.videoId) ?? 0,
        recentWeightedTaps: b.boostScore,
        hoursSincePublish,
      });
      const list = byRegion.get(b.region) ?? [];
      list.push({ videoId: b.videoId, score });
      byRegion.set(b.region, list);
    }

    let regionalCount = 0;
    for (const [region, list] of byRegion) {
      list.sort((a, b) => b.score - a.score);
      let r = 1;
      for (const row of list) {
        await this.db.trendingScore.upsert({
          where: { videoId_scope: { videoId: row.videoId, scope: region } },
          create: { videoId: row.videoId, scope: region, score: row.score, rank: r },
          update: { score: row.score, rank: r },
        });
        this.trending.evaluateTrend({ entityId: row.videoId, scope: region, score: row.score, rank: r });
        r++;
        regionalCount++;
      }
    }

    this.logger.log(`Trending recompute: ${globalScored.length} global, ${regionalCount} regional`);
    return { global: globalScored.length, regional: regionalCount };
  }
}
