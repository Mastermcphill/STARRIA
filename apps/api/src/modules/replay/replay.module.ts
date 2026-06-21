import { Module } from '@nestjs/common';
import { ReplayController } from './replay.controller';
import { NestReplayService } from './replay.service';
import { PrismaReplayRepository } from './prisma-replay.repository';
import { ReplayMediaProcessor } from './replay-media.processor';
import { ReplayCapabilityService } from './replay-capability.service';
import { MediaModule } from '../media/media.module';
import {
  InMemoryDiscoveryPublisher,
  InMemoryReplayAccess,
} from './in-memory-replay.repository';

@Module({
  imports: [MediaModule],
  controllers: [ReplayController],
  providers: [
    NestReplayService,
    PrismaReplayRepository,
    ReplayMediaProcessor,
    ReplayCapabilityService,
    InMemoryDiscoveryPublisher,
    InMemoryReplayAccess,
  ],
  exports: [NestReplayService, ReplayCapabilityService],
})
export class ReplayModule {}
