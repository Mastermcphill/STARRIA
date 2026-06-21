import { Module } from '@nestjs/common';
import { CreatorOsController, ClipsController } from './creator-os.controller';
import { NestCreatorOsService } from './creator-os.service';
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

@Module({
  controllers: [CreatorOsController, ClipsController],
  providers: [
    NestCreatorOsService,
    InMemoryCreatorLedger,
    StubPosterGenerator,
    StubClipGenerator,
    PrismaCalendarStore,
    PrismaCommerceStore,
    PrismaClipStore,
    StubAnalyticsSource,
  ],
  exports: [NestCreatorOsService],
})
export class CreatorOsModule {}
