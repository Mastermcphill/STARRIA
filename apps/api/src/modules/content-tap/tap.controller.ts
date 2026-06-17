import { Body, Controller, Get, Headers, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ContentTapService } from './content-tap.service';
import { TapAggregationJob } from './tap-aggregation.job';
import { ContentTapDto } from './dto/tap.dto';

@ApiTags('content-taps')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('content-taps')
export class TapController {
  constructor(
    private readonly tapService: ContentTapService,
    private readonly aggregation: TapAggregationJob,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tap a video (weighted discovery signal). Anti-spam + geo-aware.' })
  tap(
    @Request() req: { user: { userId: string } },
    @Body() dto: ContentTapDto,
    @Headers('x-country') headerCountry?: string,
  ) {
    return this.tapService.tap(req.user.userId, dto.videoId, { country: dto.country ?? headerCountry });
  }

  @Get(':videoId/count')
  @ApiOperation({ summary: 'How many taps the caller has contributed to a video' })
  async count(@Request() req: { user: { userId: string } }, @Param('videoId') videoId: string) {
    return { count: await this.tapService.tapCount(req.user.userId, videoId) };
  }

  @Post('aggregate/run')
  @ApiOperation({ summary: 'Manually trigger a trending aggregation pass (admin/testing)' })
  runAggregation() {
    return this.aggregation.runOnce();
  }
}
