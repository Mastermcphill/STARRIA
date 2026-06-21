import { Module } from '@nestjs/common';
import {
  CompanionDiscoveryController,
  CompanionProfileController,
  BookingController,
  SessionController,
  AgeGateController,
} from './companion.controller';
import { NestCompanionService } from './companion.service';
import { PrismaCompanionRepository, PrismaLonelinessRepository } from './prisma-companion.repository';
import { PrismaSessionRepository } from './prisma-session.repository';
import { PrismaAgeGateRepository } from './prisma-age-gate.repository';
import { InMemorySessionLedger } from './in-memory-session.repository';

@Module({
  controllers: [
    CompanionDiscoveryController,
    CompanionProfileController,
    BookingController,
    SessionController,
    AgeGateController,
  ],
  providers: [
    NestCompanionService,
    PrismaCompanionRepository,
    PrismaLonelinessRepository,
    PrismaSessionRepository,
    InMemorySessionLedger,
    PrismaAgeGateRepository,
  ],
  exports: [NestCompanionService],
})
export class CompanionModule {}
