import { Injectable, Inject } from '@nestjs/common';
import { TrustService } from '@starria/trust-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaTrustRepository } from './prisma-trust.repository';

@Injectable()
export class NestTrustService {
  private readonly trustService: TrustService;

  constructor(
    private readonly repo: PrismaTrustRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.trustService = new TrustService(repo, eventBus);
  }

  get core(): TrustService {
    return this.trustService;
  }
}
