import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreatorAnalyticsAggregator } from './creator-analytics.aggregator';
import type { RollupPeriod } from './period-key';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly aggregator: CreatorAnalyticsAggregator) {}

  @Get('rollups')
  @ApiOperation({ summary: 'Read pre-computed analytics rollups for the authenticated creator' })
  @ApiQuery({ name: 'period', enum: ['DAY', 'WEEK', 'MONTH'], required: false })
  async myRollups(
    @Req() req: { user: { userId: string } },
    @Query('period') period: RollupPeriod = 'DAY',
  ) {
    return this.aggregator.getRollups(req.user.userId, period);
  }

  @Post('rollups/recompute')
  @ApiOperation({ summary: 'Recompute daily/weekly/monthly rollups for the authenticated creator over a window' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async recompute(
    @Req() req: { user: { userId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const buckets = await this.aggregator.rollupAll(req.user.userId, { from, to });
    return { recomputed: buckets.length, buckets };
  }
}
