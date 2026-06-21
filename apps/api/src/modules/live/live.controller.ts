import {
  Body, Controller, Get, Headers, HttpCode, Param, Post,
  RawBodyRequest, Req, Request, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LiveService } from './live.service';
import { LiveKitAdapterService } from './livekit-adapter.service';
import { LiveWebhookService } from './live-webhook.service';
import { WebhookIpAllowlistGuard, WebhookSource } from '../../common/webhook-ip.guard';
import { Public } from '../auth/public.decorator';
import { JoinRoomDto } from './dto/join-room.dto';
import { SendLiveGiftDto } from './dto/send-live-gift.dto';

@ApiTags('live')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('live')
export class LiveController {
  constructor(
    private readonly liveService: LiveService,
    private readonly livekit: LiveKitAdapterService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'LiveKit health — verifies the server is reachable and credentials are valid' })
  @ApiResponse({ status: 200, description: 'LiveKit reachable and credentials accepted' })
  @ApiResponse({ status: 503, description: 'LiveKit unreachable or credentials rejected' })
  async health() {
    const result = await this.livekit.healthCheck();
    if (!result.reachable) {
      throw new ServiceUnavailableException({
        status: 'down',
        livekit: result,
      });
    }
    return { status: 'ok', livekit: result };
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a live room for the given event — returns a LiveKit token' })
  @ApiResponse({ status: 201, description: 'Participant joined; includes livekitToken' })
  join(
    @Request() req: { user: { userId: string } },
    @Param('id') eventId: string,
    @Body() dto: JoinRoomDto,
  ) {
    return this.liveService.joinRoom(eventId, req.user.userId, dto);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a live room' })
  leave(
    @Request() req: { user: { userId: string } },
    @Param('id') eventId: string,
  ) {
    return this.liveService.leaveRoom(eventId, req.user.userId);
  }

  @Post(':id/gift')
  @ApiOperation({ summary: 'Send a live coin gift to the creator during a live session' })
  @ApiResponse({ status: 201, description: 'Gift sent; creator wallet credited' })
  sendGift(
    @Request() req: { user: { userId: string } },
    @Param('id') eventId: string,
    @Body() dto: SendLiveGiftDto,
  ) {
    return this.liveService.sendGift(eventId, req.user.userId, dto);
  }
}

// The /replays namespace is owned by ReplayModule's ReplayController (full
// capture/publish/discover/playback surface). The previous duplicate here
// collided on `GET /replays/:id` at bootstrap and has been removed.

// LiveKit server-to-server webhook receiver. Unauthenticated (no JWT) but
// verified via the SDK's signed Authorization header over the raw body.
// Requires rawBody:true on the app.
@ApiTags('webhooks')
@Controller('webhooks')
export class LiveWebhookController {
  constructor(
    private readonly livekit: LiveKitAdapterService,
    private readonly webhooks: LiveWebhookService,
  ) {}

  @Public()
  @UseGuards(WebhookIpAllowlistGuard)
  @WebhookSource('LIVEKIT_WEBHOOK_IPS')
  @Post('livekit')
  @HttpCode(200)
  @ApiOperation({ summary: 'LiveKit webhook (signature-verified) — updates room & participant state' })
  async livekit_(
    @Req() req: RawBodyRequest<{ body?: unknown }>,
    @Headers('authorization') authHeader?: string,
  ) {
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    const event = await this.livekit.receiveWebhook(raw, authHeader);
    return this.webhooks.handle(event);
  }
}
