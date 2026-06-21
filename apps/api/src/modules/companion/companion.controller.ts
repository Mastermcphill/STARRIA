import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NestCompanionService } from './companion.service';
import type { CompanionDiscoveryFilter, CreateCompanionInput } from '@starria/companion-core';
import type { BookSessionInput } from '@starria/session-core';
import type { SessionType } from '@starria/domain-events';
import { COMPANION_DISCOVERY_REQUIRED_LEVEL } from '@starria/age-gate-core';

// ---------------------------------------------------------------------------
// Age-gated companion discovery — completely separate from standard discovery
// ---------------------------------------------------------------------------
@Controller('companion')
export class CompanionDiscoveryController {
  constructor(private readonly svc: NestCompanionService) {}

  /**
   * GET /companion/discovery
   * Requires age verification + explicit consent. NEVER served from /discovery.
   */
  @Get('discovery')
  async discover(
    @Query('userId') userId: string,
    @Query('sessionType') sessionType?: SessionType,
    @Query('language') language?: string,
    @Query('availableNow') availableNow?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) throw new BadRequestException('userId required');

    // Age gate check
    const gateResult = await this.svc.ageGate.checkAccess(userId, COMPANION_DISCOVERY_REQUIRED_LEVEL);
    if (!gateResult.passed) throw new ForbiddenException(gateResult.reason);

    // Consent check
    const hasConsent = await this.svc.ageGate.hasConsentedToCompanionDiscovery(userId);
    if (!hasConsent) {
      throw new ForbiddenException('Explicit consent to Companion Discovery is required.');
    }

    const filter: CompanionDiscoveryFilter = {
      sessionType: sessionType as any,
      language,
      availableNow: availableNow === 'true' ? true : availableNow === 'false' ? false : undefined,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    };

    return this.svc.companion.discover(filter);
  }

  /** GET /companion/recommendations?userId= — loneliness-based (private score, never exposed) */
  @Get('recommendations')
  async getRecommendations(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId required');
    const gateResult = await this.svc.ageGate.checkAccess(userId);
    if (!gateResult.passed) throw new ForbiddenException(gateResult.reason);

    const { companions, reason } = await this.svc.loneliness.getRecommendations(
      userId,
      limit ? parseInt(limit) : 5,
    );
    // Only return companions and reason — NEVER the loneliness score
    return { companions, reason };
  }
}

@Controller('companions')
export class CompanionProfileController {
  constructor(private readonly svc: NestCompanionService) {}

  /** GET /companions — discovery (requires age gate) */
  @Get()
  async list(
    @Query('userId') userId: string,
    @Query('sessionType') sessionType?: string,
    @Query('availableNow') availableNow?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId required');
    const gate = await this.svc.ageGate.checkAccess(userId);
    if (!gate.passed) throw new ForbiddenException(gate.reason);
    return this.svc.companion.discover({
      sessionType: sessionType as any,
      availableNow: availableNow === 'true' ? true : undefined,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /** GET /companions/:id */
  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const profile = await this.svc.companion.getProfile(id);
    if (!profile) throw new NotFoundException('Companion not found');
    const [rates, media, reviews] = await Promise.all([
      this.svc.companion.getRates(id),
      Promise.resolve([]),
      this.svc.companion.getReviews(id),
    ]);
    return { profile, rates, reviews };
  }

  /** POST /companions — create companion profile */
  @Post()
  async create(@Body() body: CreateCompanionInput) {
    return this.svc.companion.createProfile(body);
  }

  /** PATCH /companions/:id/availability */
  @Patch(':id/availability')
  async setAvailability(
    @Param('id') id: string,
    @Body() body: { available: boolean },
  ) {
    return this.svc.companion.setAvailableNow(id, body.available);
  }

  /** POST /companions/:id/rates */
  @Post(':id/rates')
  async setRates(
    @Param('id') id: string,
    @Body() body: { rates: any[] },
  ) {
    return this.svc.companion.setRates({ companionId: id, rates: body.rates });
  }

  /** POST /companions/:id/review */
  @Post(':id/review')
  async leaveReview(
    @Param('id') companionId: string,
    @Body() body: { reviewerId: string; sessionId: string; rating: number; comment?: string },
  ) {
    return this.svc.companion.leaveReview({ companionId, ...body });
  }

  /** POST /companions/:id/block */
  @Post(':id/block')
  async block(
    @Param('id') blockedId: string,
    @Body() body: { blockerId: string },
  ) {
    await this.svc.companion.blockCompanion({ blockerId: body.blockerId, blockedId });
    return { ok: true };
  }

  /** POST /companions/:id/report */
  @Post(':id/report')
  async report(
    @Param('id') reportedId: string,
    @Body() body: { reporterId: string; sessionId?: string; reason: string },
  ) {
    await this.svc.companion.reportCompanion({ reportedId, ...body });
    return { ok: true };
  }
}

@Controller('bookings')
export class BookingController {
  constructor(private readonly svc: NestCompanionService) {}

  /** POST /bookings */
  @Post()
  async book(@Body() body: BookSessionInput) {
    try {
      return await this.svc.session.bookSession(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /bookings/:id/cancel */
  @Post(':id/cancel')
  async cancel(
    @Param('id') bookingId: string,
    @Body() body: { cancelledBy: string; reason?: string },
  ) {
    try {
      return await this.svc.session.cancelBooking(bookingId, body.cancelledBy, body.reason);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /bookings/:id/extend */
  @Post(':id/extend')
  async extend(
    @Param('id') bookingId: string,
    @Body() body: { sessionId: string; patronId: string; addedMinutes: 15 | 30 | 45 | 60; coinCostPerMinute: number },
  ) {
    try {
      return await this.svc.session.extendSession({
        sessionId: body.sessionId,
        patronId: body.patronId,
        addedMinutes: body.addedMinutes,
        coinCostPerMinute: body.coinCostPerMinute,
      });
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}

@Controller('sessions')
export class SessionController {
  constructor(private readonly svc: NestCompanionService) {}

  /** POST /sessions/start */
  @Post('start')
  async start(@Body() body: { sessionId: string }) {
    try {
      return await this.svc.session.startSession(body.sessionId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /sessions/end */
  @Post('end')
  async end(@Body() body: { sessionId: string }) {
    try {
      return await this.svc.session.endSession(body.sessionId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /sessions/invite */
  @Post('invite')
  async invite(
    @Body() body: { sessionId: string; invitedBy: string; userId: string; role: 'GUEST' | 'CO_HOST' },
  ) {
    try {
      return await this.svc.session.inviteParticipant(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** POST /sessions/panic-leave */
  @Post('panic-leave')
  async panicLeave(@Body() body: { sessionId: string; userId: string }) {
    await this.svc.session.panicLeave(body.sessionId, body.userId);
    return { ok: true };
  }

  /** POST /sessions/flag */
  @Post('flag')
  async flag(@Body() body: { sessionId: string; flaggedBy: string; reason: string }) {
    await this.svc.session.flagSession(body.sessionId, body.flaggedBy, body.reason);
    return { ok: true };
  }
}

@Controller('age-gate')
export class AgeGateController {
  constructor(private readonly svc: NestCompanionService) {}

  /** GET /age-gate?userId= */
  @Get()
  async getProfile(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId required');
    return this.svc.ageGate.getProfile(userId);
  }

  /** POST /age-gate/verify */
  @Post('verify')
  async verify(
    @Body() body: {
      userId: string;
      level: '18+' | '21+';
      method: 'SELF_DECLARE' | 'DOCUMENT' | 'BIOMETRIC';
      selfDeclaredDob?: string;
    },
  ) {
    return this.svc.ageGate.submitVerification(body);
  }

  /** POST /age-gate/consent */
  @Post('consent')
  async recordConsent(
    @Body() body: {
      userId: string;
      consentType: 'COMPANION_DISCOVERY' | 'ADULT_CONTENT' | 'SESSION_RECORDING';
      granted: boolean;
    },
  ) {
    return this.svc.ageGate.recordConsent(body);
  }

  /** PATCH /age-gate/safe-mode */
  @Patch('safe-mode')
  async setSafeMode(@Body() body: { userId: string; enabled: boolean }) {
    return this.svc.ageGate.setSafeMode(body.userId, body.enabled);
  }
}
