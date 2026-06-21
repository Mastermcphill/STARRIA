import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NestCreatorOsService } from './creator-os.service';
import type {
  PosterRequest,
  ShowPlanRequest,
  ListCommerceItemInput,
  PurchaseCommerceItemInput,
  GenerateClipsInput,
} from '@starria/creator-os-core';

@ApiTags('creator-os')
@Controller('creator-os')
export class CreatorOsController {
  constructor(private readonly svc: NestCreatorOsService) {}

  // ── Poster Studio ─────────────────────────────────────────────────────────────
  @Post('poster')
  @ApiOperation({ summary: 'Generate an AI poster (comedy/movie/live-show/arena) — charges coins' })
  async poster(@Body() body: PosterRequest) {
    if (!body?.creatorId || !body?.posterType) throw new BadRequestException('creatorId and posterType required');
    return this.svc.poster.generate(body);
  }

  // ── Show Planner ────────────────────────────────────────────────────────────────
  @Post('show-plan')
  @ApiOperation({ summary: 'Generate a segment breakdown for a show' })
  showPlan(@Body() body: ShowPlanRequest) {
    if (!body?.showType || !body?.durationMinutes) throw new BadRequestException('showType and durationMinutes required');
    return this.svc.showPlanner.generate(body);
  }

  // ── Analytics & Insights ─────────────────────────────────────────────────────────
  @Get('analytics')
  @ApiOperation({ summary: 'Audience + revenue analytics + derived insights' })
  async analytics(@Query('creatorId') creatorId: string, @Query('periodDays') periodDays?: string) {
    if (!creatorId) throw new BadRequestException('creatorId required');
    const days = periodDays ? parseInt(periodDays, 10) : 30;
    const [audience, revenue, insights] = await Promise.all([
      this.svc.analytics.audience(creatorId),
      this.svc.analytics.revenue(creatorId, days),
      this.svc.analytics.insights(creatorId),
    ]);
    return { audience, revenue, insights };
  }

  // ── Content Calendar / Release Scheduler ──────────────────────────────────────────
  @Post('calendar')
  @ApiOperation({ summary: 'Schedule a content/release calendar entry' })
  schedule(@Body() body: { creatorId: string; title: string; kind: string; scheduledFor: string; metadata?: Record<string, unknown> }) {
    if (!body?.creatorId || !body?.scheduledFor) throw new BadRequestException('creatorId and scheduledFor required');
    return this.svc.calendar.schedule(body);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'List a creator’s calendar entries' })
  listCalendar(@Query('creatorId') creatorId: string) {
    if (!creatorId) throw new BadRequestException('creatorId required');
    return this.svc.calendar.list(creatorId);
  }

  // ── Live Commerce ─────────────────────────────────────────────────────────────────
  @Post('commerce/list')
  @ApiOperation({ summary: 'List a sellable item (ticket/replay/sub/digital/merch)' })
  listItem(@Body() body: ListCommerceItemInput) {
    if (!body?.creatorId || !body?.itemType) throw new BadRequestException('creatorId and itemType required');
    return this.svc.commerce.list(body);
  }

  @Post('commerce/purchase')
  @ApiOperation({ summary: 'Purchase a live-commerce item (idempotent)' })
  purchase(@Body() body: PurchaseCommerceItemInput) {
    if (!body?.itemId || !body?.buyerId || !body?.idempotencyKey) {
      throw new BadRequestException('itemId, buyerId and idempotencyKey required');
    }
    return this.svc.commerce.purchase(body);
  }

  @Get('commerce/room/:roomId')
  @ApiOperation({ summary: 'List commerce items active in a room' })
  itemsByRoom(@Param('roomId') roomId: string) {
    return this.svc.commerce.listByRoom(roomId);
  }

  @Post('commerce/gift-overlay')
  @ApiOperation({ summary: 'Trigger a live gifting overlay' })
  async giftOverlay(@Body() body: { roomId: string; gifterId: string; giftId: string; coins: number }) {
    await this.svc.commerce.showGiftOverlay(body);
    return { ok: true };
  }
}

// ---------------------------------------------------------------------------
// Discovery flywheel — clip generation (Phase 7 contract: POST /clips/generate)
// ---------------------------------------------------------------------------
@ApiTags('creator-os')
@Controller('clips')
export class ClipsController {
  constructor(private readonly svc: NestCreatorOsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Auto-generate 15/30/60s clips from a replay' })
  generate(@Body() body: GenerateClipsInput) {
    if (!body?.sourceReplayId || body?.durationSeconds == null) {
      throw new BadRequestException('sourceReplayId and durationSeconds required');
    }
    return this.svc.clips.generateClips(body);
  }

  @Post('teaser')
  @ApiOperation({ summary: 'Generate a single short teaser from a replay' })
  teaser(@Body() body: { sourceReplayId: string; creatorId: string; durationSeconds: number }) {
    if (!body?.sourceReplayId) throw new BadRequestException('sourceReplayId required');
    return this.svc.clips.generateTeaser(body);
  }

  @Get('replay/:replayId')
  @ApiOperation({ summary: 'List clips generated from a replay' })
  byReplay(@Param('replayId') replayId: string) {
    return this.svc.clips.listByReplay(replayId);
  }
}
