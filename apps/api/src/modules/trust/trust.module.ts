import { Module } from '@nestjs/common';
import { TrustController } from './trust.controller';
import { NestTrustService } from './trust.service';
import { PrismaTrustRepository } from './prisma-trust.repository';

@Module({
  controllers: [TrustController],
  providers: [NestTrustService, PrismaTrustRepository],
  exports: [NestTrustService],
})
export class TrustModule {}
