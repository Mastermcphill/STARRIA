import {
  Body, Controller, Get, Param, Post, Query, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import type { ModerationCaseStatus, ModerationSeverity } from '@starria/moderation-core';
import { SuspendUserDto, UnsuspendUserDto } from './dto/admin.dto';

type AuthedReq = { user: { userId: string } };

/**
 * Operator console. The whole controller is admin-only — RolesGuard enforces
 * @Roles(ADMIN) at the class level, so every route inherits it.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  // ─── Users ─────────────────────────────────────────────────────────────────

  @Get('users/lookup')
  @ApiOperation({ summary: 'Look up a user by id, email, or username' })
  @ApiQuery({ name: 'q', required: true })
  lookupUser(@Query('q') q: string) {
    return this.svc.lookupUser(q);
  }

  @Post('users/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a user account' })
  suspend(@Request() req: AuthedReq, @Body() dto: SuspendUserDto) {
    return this.svc.suspendUser(req.user.userId, dto.userId, dto.reason);
  }

  @Post('users/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift a user suspension' })
  unsuspend(@Request() req: AuthedReq, @Body() dto: UnsuspendUserDto) {
    return this.svc.unsuspendUser(req.user.userId, dto.userId);
  }

  // ─── Audits ────────────────────────────────────────────────────────────────

  @Get('battles')
  @ApiOperation({ summary: 'Audit battles' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  battles(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.auditBattles(status, num(limit, 50), num(offset, 0));
  }

  @Get('battles/:id')
  @ApiOperation({ summary: 'Audit a single battle in full detail' })
  battle(@Param('id') id: string) {
    return this.svc.auditBattle(id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Audit wallet transactions (optionally for one user)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  transactions(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.auditTransactions(userId, num(limit, 50), num(offset, 0));
  }

  @Get('replays')
  @ApiOperation({ summary: 'Audit replays' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  replays(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.auditReplays(status, num(limit, 50), num(offset, 0));
  }

  @Get('moderation/queue')
  @ApiOperation({ summary: 'View the moderation queue' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  moderationQueue(
    @Query('status') status?: ModerationCaseStatus,
    @Query('severity') severity?: ModerationSeverity,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.moderationQueue({
      status,
      severity,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}

function num(v: string | undefined, fallback: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
