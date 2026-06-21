import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NestMessagingService } from './messaging.service';
import type { DMGateContext, DMAccessLevel } from '@starria/messaging-core';
import type { PatronTier } from '@starria/patron-core';

@Controller()
export class MessagingController {
  constructor(private readonly svc: NestMessagingService) {}

  /** GET /messages/requests?recipientId=:id */
  @Get('messages/requests')
  async getPendingRequests(@Query('recipientId') recipientId: string) {
    if (!recipientId) throw new BadRequestException('recipientId required');
    return this.svc.core.getPendingRequests(recipientId);
  }

  /** POST /messages/request */
  @Post('messages/request')
  async sendRequest(
    @Body() body: {
      senderId: string;
      recipientId: string;
      senderPatronTier: PatronTier;
      openingMessage: string;
      dmGateContext: DMGateContext;
    },
  ) {
    try {
      return await this.svc.core.sendRequest(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /messages/accept */
  @Post('messages/accept')
  async acceptRequest(@Body() body: { requestId: string; recipientId: string }) {
    try {
      return await this.svc.core.acceptRequest(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /messages/decline */
  @Post('messages/decline')
  async declineRequest(@Body() body: { requestId: string; recipientId: string }) {
    try {
      return await this.svc.core.declineRequest(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** GET /conversations/:id */
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conv = await this.svc.core.getConversation(id);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  /** GET /conversations/:id/messages */
  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.svc.core.getMessages(id, limit ? parseInt(limit) : undefined);
  }

  /** POST /messages/send */
  @Post('messages/send')
  async sendMessage(
    @Body() body: {
      conversationId: string;
      senderId: string;
      recipientId: string;
      type?: 'TEXT' | 'IMAGE' | 'GIFT_NOTIFICATION' | 'SYSTEM';
      body: string;
    },
  ) {
    try {
      return await this.svc.core.sendMessage({
        conversationId: body.conversationId,
        senderId: body.senderId,
        recipientId: body.recipientId,
        type: body.type ?? 'TEXT',
        body: body.body,
      });
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** GET /inbox?userId=:id */
  @Get('inbox')
  async getInbox(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId required');
    return this.svc.core.getInbox(userId);
  }

  /** GET /dm-permissions/:userId */
  @Get('dm-permissions/:userId')
  async getDMPermission(@Param('userId') userId: string) {
    return this.svc.core.getDMPermission(userId);
  }

  /** PATCH /dm-permissions */
  @Patch('dm-permissions')
  async updateDMPermission(
    @Body() body: {
      userId: string;
      accessLevel: DMAccessLevel;
      customThresholdUsdCents?: number;
      allowedUserIds?: string[];
    },
  ) {
    return this.svc.core.updateDMPermission(body);
  }
}
