import { Module } from '@nestjs/common';
import { SupportersController } from './supporters.controller';
import { SupportersService } from './supporters.service';
import { SupportGraphService } from './support-graph.service';
import { SupportGraphListeners } from './support-graph.listeners';
import { PrismaSupporterStore } from './prisma-supporter.store';
import { PrismaSubscriptionStore } from './prisma-subscription.store';

@Module({
  controllers: [SupportersController],
  providers: [
    SupportersService,
    SupportGraphService,
    SupportGraphListeners,
    PrismaSupporterStore,
    PrismaSubscriptionStore,
  ],
  exports: [SupportersService, SupportGraphService],
})
export class SupportersModule {}
