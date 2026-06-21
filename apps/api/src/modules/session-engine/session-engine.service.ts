import { Injectable, Inject } from '@nestjs/common';
import { SessionEngineService } from '@starria/session-engine-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaSessionEngineRepository } from './prisma-session-engine.repository';
import {
  InMemorySessionBilling,
  StubLiveKitProvider,
} from './in-memory-session-engine.repository';

@Injectable()
export class NestSessionEngineService {
  readonly engine: SessionEngineService;

  constructor(
    private readonly store: PrismaSessionEngineRepository,
    readonly billing: InMemorySessionBilling,
    private readonly livekit: StubLiveKitProvider,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.engine = new SessionEngineService({
      store,
      billing,
      livekit,
      eventBus,
    });
  }
}
