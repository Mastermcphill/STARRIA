// ---------------------------------------------------------------------------
// RegionalBoostService — accumulates weighted taps into a per-(video, region)
// time-decayed boost and emits RegionalBoostUpdatedEvent.
// ---------------------------------------------------------------------------

import { Inject, Injectable } from '@nestjs/common';
import { applyTapToRegionalBoost, buildRegionalBoostUpdatedEvent } from '@starria/discovery-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RegionalBoostService {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async applyTap(videoId: string, region: string, tapWeight: number): Promise<number> {
    const now = new Date();
    const existing = await this.db.regionalTapBoost.findUnique({
      where: { videoId_region: { videoId, region } },
    });

    const previousBoost = existing?.boostScore ?? 0;
    const secondsSinceLastTap = existing
      ? Math.max(0, (now.getTime() - existing.lastTapAt.getTime()) / 1000)
      : 0;

    const newBoost = applyTapToRegionalBoost({ previousBoost, tapWeight, secondsSinceLastTap });

    const updated = await this.db.regionalTapBoost.upsert({
      where: { videoId_region: { videoId, region } },
      create: { videoId, region, boostScore: newBoost, tapCount: 1, lastTapAt: now },
      update: { boostScore: newBoost, tapCount: { increment: 1 }, lastTapAt: now },
    });

    void this.eventBus.publish(buildRegionalBoostUpdatedEvent({
      videoId,
      region,
      previousBoost,
      newBoost,
      tapCount: updated.tapCount,
    }));

    return newBoost;
  }
}
