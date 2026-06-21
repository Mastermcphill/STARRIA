import { Injectable, Inject } from '@nestjs/common';
import { ReplayService } from '@starria/replay-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaReplayRepository } from './prisma-replay.repository';
import { ReplayMediaProcessor } from './replay-media.processor';
import {
  InMemoryDiscoveryPublisher,
  InMemoryReplayAccess,
} from './in-memory-replay.repository';

@Injectable()
export class NestReplayService {
  readonly replays: ReplayService;

  constructor(
    private readonly store: PrismaReplayRepository,
    private readonly processor: ReplayMediaProcessor,
    private readonly discovery: InMemoryDiscoveryPublisher,
    readonly access: InMemoryReplayAccess,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.replays = new ReplayService({
      store,
      processor,
      discovery,
      access,
      eventBus,
    });
  }
}
