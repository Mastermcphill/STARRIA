import { Module } from '@nestjs/common';
import { RoomsController, SessionRecordingController } from './session-engine.controller';
import { NestSessionEngineService } from './session-engine.service';
import { PrismaSessionEngineRepository } from './prisma-session-engine.repository';
import {
  InMemorySessionBilling,
  StubLiveKitProvider,
} from './in-memory-session-engine.repository';

@Module({
  controllers: [RoomsController, SessionRecordingController],
  providers: [
    NestSessionEngineService,
    PrismaSessionEngineRepository,
    InMemorySessionBilling,
    StubLiveKitProvider,
  ],
  exports: [NestSessionEngineService],
})
export class SessionEngineModule {}
