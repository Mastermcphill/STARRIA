// ---------------------------------------------------------------------------
// ContentTapService — the discovery Tap Engine.
//
// Rules enforced:
//   • Creator cannot tap own content      (self_tap)
//   • Max 10,000 taps per user / video    (limit_exceeded)
//   • Geo-aware taps                       (region captured + geo-diversity)
//   • Anti-spam: trust threshold + AI-Brain fraud + rate limit
//
// Weight = trust_score × account_age × geo_diversity × engagement_quality
// ---------------------------------------------------------------------------

import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { computeTapWeight, validateTap } from '@starria/discovery-core';
import { buildContentTapRecordedEvent, buildContentTapRejectedEvent } from '@starria/discovery-core';
import type { ContentTapRejectReason } from '@starria/domain-events';
import { resolveLocation, geoDiversityMultiplier } from '@starria/geo-core';
import type { GeoRegion } from '@starria/geo-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { FraudSignalsAdapter } from './fraud-signals.adapter';
import { RegionalBoostService } from './regional-boost.service';

const RATE_WINDOW_MS = 10_000;
const RATE_MAX_PER_WINDOW = 5; // per user / video

export interface TapResult {
  readonly recorded: true;
  readonly tapId: string;
  readonly weight: number;
  readonly region: string;
  readonly regionalBoost: number;
  readonly tapCount: number;
}

@Injectable()
export class ContentTapService {
  constructor(
    private readonly db: PrismaService,
    private readonly fraud: FraudSignalsAdapter,
    private readonly regionalBoost: RegionalBoostService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async tap(userId: string, videoId: string, opts: { country?: string } = {}): Promise<TapResult> {
    const video = await this.db.video.findUnique({
      where: { id: videoId },
      select: { id: true, status: true, uploaderUserId: true, starProfileId: true },
    });
    if (!video) throw new NotFoundException('Video not found');

    const [existingTapCount, fraud, user] = await Promise.all([
      this.db.contentTap.count({ where: { userId, videoId } }),
      this.fraud.evaluate({ userId, videoId }),
      this.db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    ]);

    // 1) IO-free rule validation
    const validation = validateTap({
      tapperUserId: userId,
      creatorUserId: video.uploaderUserId,
      existingTapCount,
      trustScore: fraud.trustScore,
      videoPublished: video.status === 'PUBLISHED',
    });
    if (!validation.ok) {
      this.reject(userId, videoId, validation.reason!);
      throw this.toException(validation.reason!);
    }

    // 2) Fraud
    if (fraud.suspected) {
      this.reject(userId, videoId, 'fraud_suspected');
      throw new ForbiddenException('fraud_suspected');
    }

    // 3) Rate limit
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const recent = await this.db.contentTap.count({ where: { userId, videoId, createdAt: { gte: since } } });
    if (recent >= RATE_MAX_PER_WINDOW) {
      this.reject(userId, videoId, 'rate_limited');
      throw new HttpException('rate_limited', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 4) Resolve geo + factors
    const loc = resolveLocation({ country: opts.country });
    const regionCounts = await this.regionCounts(videoId);
    const geoDiversity = geoDiversityMultiplier(loc.region as GeoRegion, regionCounts);

    const accountAgeDays = user ? (Date.now() - user.createdAt.getTime()) / 86_400_000 : 0;
    const engagementQuality = await this.engagementQuality(userId, videoId);

    const weight = computeTapWeight({
      trustScore: fraud.trustScore,
      accountAgeDays,
      geoDiversity,
      engagementQuality,
    });

    // 5) Persist tap + bump counters
    const tap = await this.db.contentTap.create({
      data: { userId, videoId, weight, trustScore: fraud.trustScore, region: loc.region, country: loc.country },
    });
    const updatedVideo = await this.db.video.update({
      where: { id: videoId },
      data: { tapCount: { increment: 1 } },
      select: { tapCount: true },
    });

    // 6) Regional boost (emits RegionalBoostUpdatedEvent)
    const regionalBoost = await this.regionalBoost.applyTap(videoId, loc.region, weight);

    // 7) Emit recorded event (→ discovery score recompute via listener)
    void this.eventBus.publish(buildContentTapRecordedEvent({
      tapId: tap.id,
      userId,
      videoId,
      starProfileId: video.starProfileId,
      weight,
      region: loc.region,
      country: loc.country,
    }));

    return {
      recorded: true,
      tapId: tap.id,
      weight,
      region: loc.region,
      regionalBoost,
      tapCount: updatedVideo.tapCount,
    };
  }

  async tapCount(userId: string, videoId: string): Promise<number> {
    return this.db.contentTap.count({ where: { userId, videoId } });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private reject(userId: string, videoId: string, reason: ContentTapRejectReason): void {
    void this.eventBus.publish(buildContentTapRejectedEvent({ userId, videoId, reason }));
  }

  private toException(reason: ContentTapRejectReason): HttpException {
    switch (reason) {
      case 'self_tap': return new ForbiddenException('self_tap');
      case 'limit_exceeded': return new UnprocessableEntityException('limit_exceeded');
      case 'low_trust': return new ForbiddenException('low_trust');
      case 'video_not_published': return new UnprocessableEntityException('video_not_published');
      default: return new ForbiddenException(reason);
    }
  }

  private async regionCounts(videoId: string): Promise<Record<string, number>> {
    const rows = await this.db.contentTap.groupBy({
      by: ['region'],
      where: { videoId },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.region] = r._count._all;
    return out;
  }

  /** Engagement quality from the user's best watch of this video (0.3 floor). */
  private async engagementQuality(userId: string, videoId: string): Promise<number> {
    const best = await this.db.videoWatch.findFirst({
      where: { userId, videoId },
      orderBy: { retention: 'desc' },
      select: { retention: true },
    });
    return Math.max(0.3, best?.retention ?? 0);
  }
}
