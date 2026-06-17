import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'crypto';
import { SupportersService } from './supporters.service';
import { SupportGraphService } from './support-graph.service';
import {
  CreateSupporterProfileDto,
  UpdateSupporterProfileDto,
  SubscribeDto,
  CancelSubscriptionDto,
} from './dto/supporter.dto';

@ApiTags('supporters')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('supporters')
export class SupportersController {
  constructor(
    private readonly supportersService: SupportersService,
    private readonly supportGraph: SupportGraphService,
  ) {}

  // ── Profile ──────────────────────────────────────────────────────────────

  @Post('profile')
  @ApiOperation({ summary: 'Create a supporter profile for the authenticated user' })
  async createProfile(
    @Request() req: { user: { userId: string; email: string } },
    @Body() dto: CreateSupporterProfileDto,
  ) {
    return this.supportersService.createProfile({ userId: req.user.userId, ...dto });
  }

  @Get('profile/me')
  @ApiOperation({ summary: 'Get own supporter profile' })
  async getMyProfile(@Request() req: { user: { userId: string } }) {
    return this.supportersService.getByUserId(req.user.userId);
  }

  @Put('profile/me')
  @ApiOperation({ summary: 'Update own supporter profile' })
  async updateMyProfile(
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateSupporterProfileDto,
  ) {
    const profile = await this.supportersService.getByUserId(req.user.userId);
    if (!profile) return null;
    return this.supportersService.updateProfile(profile.id, dto);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'Get a supporter profile by ID' })
  async getProfile(@Param('id') id: string) {
    return this.supportersService.getById(id);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to a star creator' })
  async subscribe(
    @Request() req: { user: { userId: string } },
    @Body() dto: SubscribeDto,
  ) {
    const profile = await this.supportersService.getByUserId(req.user.userId);
    if (!profile) return { error: 'Create a supporter profile first' };

    return this.supportersService.subscribe({
      supporterId: profile.id,
      starId: dto.starId,
      tier: dto.tier,
      idempotencyKey: dto.idempotencyKey ?? `sub:${profile.id}:${dto.starId}:${randomUUID()}`,
    });
  }

  @Delete('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  async cancelSubscription(
    @Request() req: { user: { userId: string } },
    @Param('id') subscriptionId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const profile = await this.supportersService.getByUserId(req.user.userId);
    if (!profile) return null;
    return this.supportersService.cancelSubscription({
      subscriptionId,
      supporterId: profile.id,
      reason: dto.reason,
      immediate: dto.immediate,
    });
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List my subscriptions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listSubscriptions(
    @Request() req: { user: { userId: string } },
    @Query('status') status?: 'active' | 'paused' | 'cancelled' | 'expired',
    @Query('limit') limit = 20,
  ) {
    const profile = await this.supportersService.getByUserId(req.user.userId);
    if (!profile) return { items: [], hasMore: false };
    return this.supportersService.listSubscriptions({ supporterId: profile.id, status, limit: +limit });
  }

  // ── Support Graph ────────────────────────────────────────────────────────

  @Get('relationship/:starProfileId')
  @ApiOperation({ summary: 'Get the support relationship between me and a star (includes patron level)' })
  async getRelationship(
    @Request() req: { user: { userId: string } },
    @Param('starProfileId') starProfileId: string,
  ) {
    const profile = await this.supportersService.getByUserId(req.user.userId);
    if (!profile) return null;
    return this.supportGraph.getRelationship(profile.id, starProfileId);
  }

  @Get(':starProfileId/top-supporters')
  @ApiOperation({ summary: 'Get top supporters for a star (patron leaderboard)' })
  @ApiQuery({ name: 'limit', required: false })
  async getTopSupporters(
    @Param('starProfileId') starProfileId: string,
    @Query('limit') limit = 10,
  ) {
    return this.supportGraph.getTopSupporters(starProfileId, +limit);
  }

  @Get(':starProfileId/subscriber-count')
  @ApiOperation({ summary: 'Get active subscriber count for a star' })
  async subscriberCount(@Param('starProfileId') starProfileId: string) {
    return { count: await this.supportersService.subscriberCount(starProfileId) };
  }
}
