import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { NestTrustService } from './trust.service';
import type { TrustFlagType, TrustRestriction } from '@starria/trust-core';

@Controller('trust')
export class TrustController {
  constructor(private readonly svc: NestTrustService) {}

  /** GET /trust/me?userId=:id */
  @Get('me')
  async getMyTrust(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId required');
    const [profile, eligibility] = await Promise.all([
      this.svc.core.getProfile(userId),
      this.svc.core.checkEligibility(userId),
    ]);
    return { profile, eligibility };
  }

  /** GET /trust/:userId */
  @Get(':userId')
  async getTrust(@Query('userId') userId: string) {
    return this.svc.core.getProfile(userId);
  }

  /** POST /trust/signals — update trust signals */
  @Post('signals')
  async updateSignals(
    @Body() body: { userId: string; signals: Record<string, number> },
  ) {
    return this.svc.core.updateSignals({ userId: body.userId, signals: body.signals as any });
  }

  /** POST /trust/flag */
  @Post('flag')
  async raiseFlag(
    @Body() body: { userId: string; flagType: TrustFlagType; raisedBy: string },
  ) {
    return this.svc.core.raiseFlag(body);
  }

  /** POST /trust/restrict */
  @Post('restrict')
  async setRestriction(
    @Body() body: { userId: string; restriction: TrustRestriction; reason: string; expiresAt?: string },
  ) {
    return this.svc.core.setRestriction(body);
  }

  /** GET /trust/eligibility?userId=:id */
  @Get('eligibility')
  async checkEligibility(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId required');
    return this.svc.core.checkEligibility(userId);
  }
}
