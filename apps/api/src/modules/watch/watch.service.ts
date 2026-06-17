import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createEvent } from '@starria/domain-events';
import type { EventBus } from '@starria/domain-events';
import { WATCH_STARTED, WATCH_COMPLETED } from '@starria/domain-events';
import { resolveLocation } from '@starria/geo-core';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';

/** retention >= this fraction counts as a "completion". */
const COMPLETION_THRESHOLD = 0.9;

@Injectable()
export class WatchService {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async startWatch(userId: string, videoId: string, country?: string) {
    const video = await this.db.video.findUnique({
      where: { id: videoId },
      select: { id: true, starProfileId: true },
    });
    if (!video) throw new NotFoundException('Video not found');

    const loc = resolveLocation({ country });
    const watch = await this.db.videoWatch.create({
      data: { userId, videoId, country: loc.country, region: loc.region },
    });
    await this.db.video.update({ where: { id: videoId }, data: { viewCount: { increment: 1 } } });

    void this.eventBus.publish(createEvent({
      id: watch.id,
      type: WATCH_STARTED,
      aggregateId: watch.id,
      aggregateType: 'VideoWatch',
      payload: {
        watchId: watch.id,
        userId,
        videoId,
        starProfileId: video.starProfileId,
        country: loc.country,
        startedAt: watch.startedAt.toISOString(),
      },
    }));

    return { watchId: watch.id, region: loc.region };
  }

  async completeWatch(userId: string, watchId: string, watchSeconds: number, durationSeconds: number) {
    const watch = await this.db.videoWatch.findUnique({ where: { id: watchId } });
    if (!watch) throw new NotFoundException('Watch session not found');

    const retention = durationSeconds > 0 ? Math.min(1, watchSeconds / durationSeconds) : 0;
    const completed = retention >= COMPLETION_THRESHOLD;

    const updated = await this.db.videoWatch.update({
      where: { id: watchId },
      data: { watchSeconds, durationSeconds, retention, completed, completedAt: new Date() },
    });

    const video = await this.db.video.findUnique({
      where: { id: watch.videoId },
      select: { starProfileId: true },
    });

    void this.eventBus.publish(createEvent({
      id: updated.id,
      type: WATCH_COMPLETED,
      aggregateId: updated.id,
      aggregateType: 'VideoWatch',
      payload: {
        watchId: updated.id,
        userId,
        videoId: watch.videoId,
        starProfileId: video?.starProfileId ?? '',
        watchSeconds,
        durationSeconds,
        retention,
        completed,
        completedAt: new Date().toISOString(),
      },
    }));

    return { watchId, retention, completed };
  }
}
