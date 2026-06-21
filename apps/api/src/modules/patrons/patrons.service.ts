import { Injectable, Inject } from '@nestjs/common';
import { PatronService } from '@starria/patron-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaPatronRepository } from './prisma-patron.repository';

@Injectable()
export class PatronsService {
  private readonly patronService: PatronService;

  constructor(
    private readonly repo: PrismaPatronRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.patronService = new PatronService(repo, eventBus);
  }

  get core(): PatronService {
    return this.patronService;
  }
}
