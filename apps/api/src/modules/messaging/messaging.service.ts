import { Injectable, Inject } from '@nestjs/common';
import { MessagingService } from '@starria/messaging-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import {
  PrismaMessageRepository,
  PrismaDMPermissionRepository,
} from './prisma-messaging.repository';

@Injectable()
export class NestMessagingService {
  private readonly messagingService: MessagingService;

  constructor(
    private readonly messageRepo: PrismaMessageRepository,
    private readonly permRepo: PrismaDMPermissionRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.messagingService = new MessagingService(messageRepo, permRepo, eventBus);
  }

  get core(): MessagingService {
    return this.messagingService;
  }
}
