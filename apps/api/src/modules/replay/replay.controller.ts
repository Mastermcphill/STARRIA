import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NestReplayService } from './replay.service';
import { ReplayCapabilityService } from './replay-capability.service';
import { ReplaysEnabledGuard } from '../../common/replays-enabled.guard';
import { Public } from '../auth/public.decorator';
import type { CaptureRecordingInput, PublishReplayInput, ReplayVisibility } from '@starria/replay-core';

@ApiTags('replay')
@Controller('replays')
export class ReplayController {
  constructor(
    private readonly svc: NestReplayService,
    private readonly capability: ReplayCapabilityService,
  ) {}

  // Capability reporting is intentionally NOT behind ReplaysEnabledGuard so it
  // can report the disabled state (and reason) instead of returning 503.
  @Public()
  @Get('capability')
  @ApiOperation({ summary: 'Report whether replays are operational and why not' })
  getCapability() {
    return this.capability.describe();
  }

  @Post('capture')
  @UseGuards(ReplaysEnabledGuard)
  @ApiOperation({ summary: 'Capture a finished recording and run process + thumbnails' })
  async capture(@Body() body: CaptureRecordingInput) {
    if (!body?.recordingId || !body?.roomId) throw new BadRequestException('recordingId and roomId required');
    return this.svc.replays.captureAndProcess(body);
  }

  @Post('publish')
  @UseGuards(ReplaysEnabledGuard)
  @ApiOperation({ summary: 'Publish a READY replay at a visibility and push to discovery' })
  async publish(@Body() body: PublishReplayInput) {
    if (!body?.replayId || !body?.visibility) throw new BadRequestException('replayId and visibility required');
    return this.svc.replays.publish(body);
  }

  @Get('discover')
  @UseGuards(ReplaysEnabledGuard)
  @ApiOperation({ summary: 'List discoverable (published) replays' })
  async discover(@Query('visibility') visibility?: ReplayVisibility) {
    return this.svc.replays.listDiscoverable(visibility);
  }

  @Get(':id')
  @UseGuards(ReplaysEnabledGuard)
  @ApiOperation({ summary: 'Get a replay for playback (enforces subscriber/premium gating)' })
  async get(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.svc.replays.getForPlayback(id, userId ?? 'anonymous');
  }
}
