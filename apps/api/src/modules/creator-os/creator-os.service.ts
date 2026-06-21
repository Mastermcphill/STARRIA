import { Injectable, Inject } from '@nestjs/common';
import {
  ShowPlannerService,
  PosterStudioService,
  CreatorAnalyticsService,
  ContentCalendarService,
  LiveCommerceService,
  ClipService,
} from '@starria/creator-os-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import {
  InMemoryCreatorLedger,
  StubPosterGenerator,
  StubClipGenerator,
  StubAnalyticsSource,
} from './in-memory-creator-os.repository';
import {
  PrismaCalendarStore,
  PrismaCommerceStore,
  PrismaClipStore,
} from './prisma-creator-os.repository';

@Injectable()
export class NestCreatorOsService {
  readonly showPlanner: ShowPlannerService;
  readonly poster: PosterStudioService;
  readonly analytics: CreatorAnalyticsService;
  readonly calendar: ContentCalendarService;
  readonly commerce: LiveCommerceService;
  readonly clips: ClipService;

  constructor(
    readonly ledger: InMemoryCreatorLedger,
    private readonly posterGen: StubPosterGenerator,
    private readonly clipGen: StubClipGenerator,
    private readonly calendarStore: PrismaCalendarStore,
    private readonly commerceStore: PrismaCommerceStore,
    private readonly clipStore: PrismaClipStore,
    private readonly analyticsSource: StubAnalyticsSource,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.showPlanner = new ShowPlannerService({ eventBus });
    this.poster      = new PosterStudioService({ generator: posterGen, ledger, eventBus });
    this.analytics   = new CreatorAnalyticsService({ source: analyticsSource });
    this.calendar    = new ContentCalendarService({ store: calendarStore });
    this.commerce    = new LiveCommerceService({ store: commerceStore, ledger, eventBus });
    this.clips       = new ClipService({ store: clipStore, generator: clipGen, eventBus });
  }
}
