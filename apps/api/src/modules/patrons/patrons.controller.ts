import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { PatronsService } from './patrons.service';

@Controller('patrons')
export class PatronsController {
  constructor(private readonly svc: PatronsService) {}

  /** GET /patrons/me?userId=:userId */
  @Get('me')
  async getMyProfile(@Query('userId') userId: string) {
    const profile = await this.svc.core.getProfileByUserId(userId);
    if (!profile) throw new NotFoundException('Patron profile not found');
    const [relationships, achievements] = await Promise.all([
      this.svc.core.getRelationships(profile.id),
      this.svc.core.getAchievements(profile.id),
    ]);
    return { profile, relationships, achievements };
  }

  /** GET /patrons/:id */
  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const profile = await this.svc.core.getProfile(id);
    if (!profile) throw new NotFoundException('Patron profile not found');
    return { profile };
  }

  /** POST /patrons — create patron profile */
  @Post()
  async createProfile(
    @Body() body: { userId: string; displayName: string; avatarUrl?: string; accountAgeDays?: number },
  ) {
    return this.svc.core.createProfile(body);
  }

  /** POST /patrons/spend — record a spend transaction */
  @Post('spend')
  async recordSpend(
    @Body() body: {
      patronId: string;
      starId: string;
      coinsAmount: number;
      usdCents: number;
      action: 'GIFT' | 'TICKET' | 'SUBSCRIPTION' | 'TIP';
    },
  ) {
    return this.svc.core.recordSpend(body);
  }

  /** GET /patrons/:id/achievements */
  @Get(':id/achievements')
  async getAchievements(@Param('id') id: string) {
    return this.svc.core.getAchievements(id);
  }

  /** GET /patrons/:id/milestones */
  @Get(':id/milestones')
  async getMilestones(
    @Param('id') id: string,
    @Query('starId') starId?: string,
  ) {
    return this.svc.core.getMilestones(id, starId);
  }
}
