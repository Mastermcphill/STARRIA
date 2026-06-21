import {
  Controller, Get, Post, Param, Body, Query, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PrestigeService } from './prestige.service';
import type { LeaderboardCategory, LeaderboardPeriod } from '@starria/star-core';
import { Public } from '../auth/public.decorator';

@ApiTags('stars')
@Public()
@Controller('stars')
export class PrestigeController {
  constructor(private readonly svc: PrestigeService) {}

  // GET /stars/me — current user's prestige summary (auth stubbed)
  @Get('me')
  @ApiOperation({ summary: 'Get my prestige profile (white star + gold star + fee)' })
  @ApiResponse({ status: 200, description: 'Prestige summary' })
  async getMyPrestige(@Query('starId') starId: string) {
    return this.svc.getPrestigeSummary(starId);
  }

  // GET /stars/:creatorId
  @Get(':creatorId')
  @ApiOperation({ summary: 'Get creator prestige by starId' })
  async getCreatorPrestige(@Param('creatorId') creatorId: string) {
    return this.svc.getPrestigeSummary(creatorId);
  }

  // GET /stars/:creatorId/history
  @Get(':creatorId/history')
  @ApiOperation({ summary: 'Get white-star score history' })
  async getStarHistory(@Param('creatorId') creatorId: string) {
    return this.svc.getWhiteStarHistory(creatorId);
  }

  // GET /stars/:creatorId/achievements
  @Get(':creatorId/achievements')
  @ApiOperation({ summary: 'Get legacy achievements' })
  async getAchievements(@Param('creatorId') creatorId: string) {
    return this.svc.getAchievements(creatorId);
  }

  // GET /stars/:creatorId/upload-status
  @Get(':creatorId/upload-status')
  @ApiOperation({ summary: 'Check weekly upload allowance' })
  async getUploadStatus(@Param('creatorId') creatorId: string) {
    return this.svc.checkUpload(creatorId);
  }

  // POST /stars/:creatorId/recalculate (internal — called by nightly job)
  @Post(':creatorId/recalculate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger prestige recalculation (admin/cron use)' })
  async recalculate(
    @Param('creatorId') creatorId: string,
    @Body() body: {
      supporterCount?: number;
      giftVolumeCoins?: number;
      watchTimeMinutes?: number;
      averageRetentionPct?: number;
      tapVelocityPerDay?: number;
    },
  ) {
    const ws = await this.svc.recalculateWhiteStar(creatorId, {
      supporterCount:       body.supporterCount ?? 0,
      giftVolumeCoins:      body.giftVolumeCoins ?? 0,
      watchTimeMinutes:     body.watchTimeMinutes ?? 0,
      averageRetentionPct:  body.averageRetentionPct ?? 0,
      tapVelocityPerDay:    body.tapVelocityPerDay ?? 0,
    });
    return { whiteStar: ws };
  }
}

@ApiTags('leaderboards')
@Controller('leaderboards')
export class LeaderboardController {
  constructor(private readonly svc: PrestigeService) {}

  @Get()
  @ApiOperation({ summary: 'Get creator leaderboard' })
  @ApiQuery({ name: 'category', required: false, enum: ['MOST_SUPPORTERS','MOST_GIFTED','MOST_WATCHED','FASTEST_RISING','BEST_LIVE_PERFORMER'] })
  @ApiQuery({ name: 'period',   required: false, enum: ['WEEKLY','MONTHLY','ALL_TIME'] })
  @ApiQuery({ name: 'limit',    required: false, type: Number })
  async getLeaderboard(
    @Query('category') category: LeaderboardCategory = 'MOST_GIFTED',
    @Query('period')   period: LeaderboardPeriod = 'WEEKLY',
    @Query('limit')    limit = 50,
  ) {
    return this.svc.lbRepo.getLeaderboard(category, period, Number(limit));
  }
}
