// ---------------------------------------------------------------------------
// DiscoveryListeners — event-driven re-scoring.
//   VIDEO_PUBLISHED      → seed an empty discovery score
//   CONTENT_TAP_RECORDED → recompute that video's discovery score (immediate)
//   WATCH_COMPLETED      → recompute that video's discovery score (immediate)
// Trending ranks are recomputed in batch by TapAggregationJob.
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventBus } from '@starria/domain-events';
import {
  VIDEO_PUBLISHED,
  CONTENT_TAP_RECORDED,
  WATCH_COMPLETED,
} from '@starria/domain-events';
import type {
  VideoPublishedEvent,
  ContentTapRecordedEvent,
  WatchCompletedEvent,
} from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { DiscoveryScoringService } from './discovery-scoring.service';

@Injectable()
export class DiscoveryListeners implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryListeners.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly scoring: DiscoveryScoringService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<VideoPublishedEvent>(VIDEO_PUBLISHED, async (e) => {
      try {
        await this.scoring.initForVideo(e.payload.videoId);
        await this.scoring.recomputeForVideo(e.payload.videoId);
      } catch (err) { this.logger.error('VIDEO_PUBLISHED handler failed', err); }
    });

    this.eventBus.subscribe<ContentTapRecordedEvent>(CONTENT_TAP_RECORDED, async (e) => {
      try {
        await this.scoring.recomputeForVideo(e.payload.videoId);
      } catch (err) { this.logger.error('CONTENT_TAP_RECORDED handler failed', err); }
    });

    this.eventBus.subscribe<WatchCompletedEvent>(WATCH_COMPLETED, async (e) => {
      try {
        await this.scoring.recomputeForVideo(e.payload.videoId);
      } catch (err) { this.logger.error('WATCH_COMPLETED handler failed', err); }
    });

    this.logger.log('Discovery re-scoring listeners registered');
  }
}
