import {
  Controller, Get, Post, Delete, Param, Body, Query, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import type { CampaignScope, PromotableType } from '@starria/campaign-core';

class CreateCampaignDto {
  starId!: string;
  promotableType!: PromotableType;
  promotableId!: string;
  scope!: CampaignScope;
  durationHours?: number;
  idempotencyKey!: string;
}

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a visibility campaign (deducts coins)' })
  @ApiResponse({ status: 201, description: 'Campaign created and activated' })
  async create(@Body() dto: CreateCampaignDto) {
    return this.svc.create(dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get authenticated star's campaigns" })
  async getMyCampaigns(@Query('starId') starId: string) {
    return this.svc.getMyCampaigns(starId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  async getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get campaign analytics (impressions, clicks, CTR)' })
  async getAnalytics(@Param('id') id: string) {
    return this.svc.getAnalytics(id);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a campaign (50% refund within 12 hours)' })
  async cancel(@Param('id') id: string, @Query('starId') starId: string) {
    return this.svc.cancel(id, starId);
  }

  @Post(':id/impression')
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a campaign impression (called by feed service)' })
  async recordImpression(@Param('id') id: string) {
    await this.svc.recordImpression(id);
  }

  @Post(':id/click')
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a campaign click' })
  async recordClick(@Param('id') id: string) {
    await this.svc.recordClick(id);
  }
}
