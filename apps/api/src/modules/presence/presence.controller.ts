import { Controller, Get, Patch, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { PresenceService, PresenceState } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(private readonly svc: PresenceService) {}

  /** GET /presence?userId=:id */
  @Get()
  async getPresence(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId required');
    return this.svc.getPresence(userId);
  }

  /** PATCH /presence */
  @Patch()
  async updatePresence(
    @Body() body: { userId: string; state: PresenceState; roomId?: string },
  ) {
    return this.svc.updatePresence(body.userId, body.state, body.roomId);
  }

  /** POST /presence/typing */
  @Post('typing')
  async setTyping(
    @Body() body: { userId: string; conversationId: string; isTyping: boolean },
  ) {
    await this.svc.setTyping(body.userId, body.conversationId, body.isTyping);
    return { ok: true };
  }
}
