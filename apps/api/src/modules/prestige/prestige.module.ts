import { Module } from '@nestjs/common';
import { PrestigeController, LeaderboardController } from './prestige.controller';
import { PrestigeService } from './prestige.service';
import {
  PrismaWhiteStarRepository,
  PrismaGoldStarRepository,
  PrismaLeaderboardRepository,
} from './prisma-prestige.repository';

@Module({
  controllers: [PrestigeController, LeaderboardController],
  providers: [
    PrestigeService,
    PrismaWhiteStarRepository,
    PrismaGoldStarRepository,
    PrismaLeaderboardRepository,
  ],
  exports: [PrestigeService],
})
export class PrestigeModule {}
