import { Module } from '@nestjs/common';
import { LiveController, LiveWebhookController } from './live.controller';
import { LiveService } from './live.service';
import { PrismaLiveStoreRepository } from './prisma-live-store.repository';
import { LiveKitAdapterService } from './livekit-adapter.service';
import { LiveKitEgressService } from './livekit-egress.service';
import { LiveWebhookService } from './live-webhook.service';
import { PrismaTicketRepository } from '../ticketing/prisma-ticket-store.repository';
import { ReplayModule } from '../replay/replay.module';

@Module({
  imports: [ReplayModule],
  controllers: [LiveController, LiveWebhookController],
  providers: [
    LiveService,
    PrismaLiveStoreRepository,
    LiveKitAdapterService,
    LiveKitEgressService,
    LiveWebhookService,
    PrismaTicketRepository,
  ],
  exports: [LiveService, LiveKitAdapterService, LiveKitEgressService],
})
export class LiveModule {}
