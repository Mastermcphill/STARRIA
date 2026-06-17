import { Inject, Injectable } from '@nestjs/common';
import { SupporterService } from '@starria/support-core';
import type { CreateSupporterProfileInput, UpdateSupporterProfileInput, SubscribeInput, CancelSubscriptionInput, SupporterListFilter, SubscriptionListFilter } from '@starria/support-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaSupporterStore } from './prisma-supporter.store';
import { PrismaSubscriptionStore } from './prisma-subscription.store';

@Injectable()
export class SupportersService {
  private readonly service: SupporterService;

  constructor(
    private readonly supporterStore: PrismaSupporterStore,
    private readonly subscriptionStore: PrismaSubscriptionStore,
    @Inject(EVENT_BUS) eventBus: EventBus,
  ) {
    this.service = new SupporterService(supporterStore, subscriptionStore, undefined, undefined, eventBus);
  }

  getByUserId(userId: string) { return this.service.getByUserId(userId); }
  getById(supporterId: string) { return this.service.getById(supporterId); }
  createProfile(input: CreateSupporterProfileInput) { return this.service.createProfile(input); }
  updateProfile(supporterId: string, input: UpdateSupporterProfileInput) { return this.service.updateProfile(supporterId, input); }
  recordSpend(supporterId: string, coins: number, fiatMinorUnits: number) { return this.service.recordSpend(supporterId, coins, fiatMinorUnits); }
  list(filter: SupporterListFilter) { return this.service.list(filter); }
  subscribe(input: SubscribeInput) { return this.service.subscribe(input); }
  cancelSubscription(input: CancelSubscriptionInput) { return this.service.cancelSubscription(input); }
  listSubscriptions(filter: SubscriptionListFilter) { return this.service.listSubscriptions(filter); }
  hasActiveSubscription(supporterId: string, starId: string) { return this.service.hasActiveSubscription(supporterId, starId); }
  subscriberCount(starId: string) { return this.service.subscriberCount(starId); }
}
