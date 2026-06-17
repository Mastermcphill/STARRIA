// ---------------------------------------------------------------------------
// DiscoveryScoringService
// Recomputes a video's global discovery score from live signals and persists
// the breakdown. Emits DiscoveryScoreUpdatedEvent. Called by event listeners
// (per-video, immediate) and the aggregation job (batch).
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger } from '@nestjs/common';
import { computeDiscoveryScore } from '@starria/discovery-core';
import { buildDiscoveryScoreUpdatedEvent } from '@starria/discovery-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';

/** Star tier → ranking multiplier in [0, 1]. */
const STAR_MULTIPLIER: Record<string, number> = {
  RISING: 0.4,
  VERIFIED: 0.7,
  ELITE: 1.0,
};

const RECENT_TAP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DiscoveryScoringService {
  private readonly logger = new Logger(DiscoveryScoringService.name);

  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async recomputeForVideo(videoId: string): Promise<number> {
    const video = await this.db.video.findUnique({
      where: { id: videoId },
      select: { id: true, starProfileId: true, starProfile: { select: { tier: true } } },
    });
    if (!video) return 0;

    const since = new Date(Date.now() - RECENT_TAP_WINDOW_MS);

    const [watchAgg, recentTapAgg, supporterCount, prev] = await Promise.all([
      this.db.videoWatch.aggregate({
        where: { videoId },
        _sum: { watchSeconds: true },
        _avg: { retention: true },
      }),
      this.db.contentTap.aggregate({
        where: { videoId, createdAt: { gte: since } },
        _sum: { weight: true },
      }),
      this.db.supportRelationship.count({
        where: { starProfileId: video.starProfileId, status: 'ACTIVE' },
      }),
      this.db.discoveryScore.findUnique({ where: { videoId }, select: { score: true } }),
    ]);

    const breakdown = computeDiscoveryScore({
      totalWatchSeconds: watchAgg._sum.watchSeconds ?? 0,
      supporterCount,
      recentWeightedTaps: recentTapAgg._sum.weight ?? 0,
      averageRetention: watchAgg._avg.retention ?? 0,
      starMultiplier: STAR_MULTIPLIER[video.starProfile?.tier ?? 'RISING'] ?? 0.4,
    });

    await this.db.discoveryScore.upsert({
      where: { videoId },
      create: {
        videoId,
        score: breakdown.score,
        watchTimeScore: breakdown.watchTimeScore,
        supportersScore: breakdown.supportersScore,
        tapVelocityScore: breakdown.tapVelocityScore,
        retentionScore: breakdown.retentionScore,
        starMultiplierScore: breakdown.starMultiplierScore,
      },
      update: {
        score: breakdown.score,
        watchTimeScore: breakdown.watchTimeScore,
        supportersScore: breakdown.supportersScore,
        tapVelocityScore: breakdown.tapVelocityScore,
        retentionScore: breakdown.retentionScore,
        starMultiplierScore: breakdown.starMultiplierScore,
      },
    });

    void this.eventBus.publish(buildDiscoveryScoreUpdatedEvent({
      entityId: videoId,
      entityType: 'video',
      previousScore: prev?.score ?? 0,
      newScore: breakdown.score,
    }));

    this.logger.debug(`Discovery score for ${videoId}: ${breakdown.score.toFixed(4)}`);
    return breakdown.score;
  }

  /** Seed an empty discovery score row when a video is published. */
  async initForVideo(videoId: string): Promise<void> {
    await this.db.discoveryScore.upsert({
      where: { videoId },
      create: { videoId, score: 0 },
      update: {},
    });
  }
}
