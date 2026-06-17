import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WatchService } from './watch.service';
import { StartWatchDto, CompleteWatchDto } from './dto/watch.dto';

@ApiTags('watch')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('watch')
export class WatchController {
  constructor(private readonly watchService: WatchService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a watch session (emits WatchStartedEvent)' })
  start(@Request() req: { user: { userId: string } }, @Body() dto: StartWatchDto) {
    return this.watchService.startWatch(req.user.userId, dto.videoId, dto.country);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Complete a watch session (emits WatchCompletedEvent)' })
  complete(@Request() req: { user: { userId: string } }, @Body() dto: CompleteWatchDto) {
    return this.watchService.completeWatch(req.user.userId, dto.watchId, dto.watchSeconds, dto.durationSeconds);
  }
}
