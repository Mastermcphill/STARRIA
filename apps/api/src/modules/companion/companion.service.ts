import { Injectable, Inject } from '@nestjs/common';
import {
  CompanionService,
  LonelinessService,
} from '@starria/companion-core';
import { SessionService } from '@starria/session-core';
import { AgeGateService } from '@starria/age-gate-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaCompanionRepository, PrismaLonelinessRepository } from './prisma-companion.repository';
import { PrismaSessionRepository } from './prisma-session.repository';
import { PrismaAgeGateRepository } from './prisma-age-gate.repository';
import { InMemorySessionLedger } from './in-memory-session.repository';

@Injectable()
export class NestCompanionService {
  readonly companion: CompanionService;
  readonly session: SessionService;
  readonly ageGate: AgeGateService;
  readonly loneliness: LonelinessService;

  constructor(
    private readonly companionRepo: PrismaCompanionRepository,
    private readonly lonelinessRepo: PrismaLonelinessRepository,
    private readonly sessionRepo: PrismaSessionRepository,
    readonly sessionLedger: InMemorySessionLedger,
    private readonly ageGateRepo: PrismaAgeGateRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.companion  = new CompanionService(companionRepo, eventBus);
    this.loneliness = new LonelinessService(lonelinessRepo, companionRepo, eventBus);
    this.session    = new SessionService(sessionRepo, sessionLedger, eventBus);
    this.ageGate    = new AgeGateService(ageGateRepo, eventBus);
  }
}
