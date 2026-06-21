import {
  Body, Controller, Get, Param, Post, Query, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { NestModerationService } from './moderation.service';
import { ContentSafetyService } from './content-safety/content-safety.service';
import { Roles } from '../auth/roles.decorator';
import type { ModerationCaseStatus, ModerationSeverity } from '@starria/moderation-core';
import {
  ReportDto,
  BlockDto,
  UnblockDto,
  TakedownDto,
  ResolveReportDto,
  ScanContentDto,
} from './dto/moderation.dto';

type AuthedReq = { user: { userId: string } };

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly svc: NestModerationService,
    private readonly safety: ContentSafetyService,
  ) {}

  // ─── User-level actions (any authenticated user) ───────────────────────────

  @Post('report')
  @ApiOperation({ summary: 'Report an entity for moderation review' })
  report(@Request() req: AuthedReq, @Body() dto: ReportDto) {
    return this.svc.report(req.user.userId, dto);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block another user' })
  block(@Request() req: AuthedReq, @Body() dto: BlockDto) {
    return this.svc.block(req.user.userId, dto.blockedId, dto.reason);
  }

  @Post('unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock a previously blocked user' })
  unblock(@Request() req: AuthedReq, @Body() dto: UnblockDto) {
    return this.svc.unblock(req.user.userId, dto.blockedId);
  }

  // ─── Moderator / admin actions ─────────────────────────────────────────────

  @Get('reports')
  @Roles(UserRole.MODERATOR)
  @ApiOperation({ summary: 'List the moderation queue (moderator+)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  listReports(
    @Query('status') status?: ModerationCaseStatus,
    @Query('severity') severity?: ModerationSeverity,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listReports({
      status,
      severity,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('reports/:id/resolve')
  @Roles(UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve or dismiss a moderation case (moderator+)' })
  resolve(@Request() req: AuthedReq, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.svc.resolveReport(req.user.userId, id, dto.outcome);
  }

  @Post('reports/:id/escalate')
  @Roles(UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate a moderation case (moderator+)' })
  escalate(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.svc.escalateReport(req.user.userId, id);
  }

  @Post('takedown')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take down a target and close its open cases (admin only)' })
  takedown(@Request() req: AuthedReq, @Body() dto: TakedownDto) {
    return this.svc.takedown(req.user.userId, dto.targetType, dto.targetId, dto.reason);
  }

  // ─── Content-safety automation ─────────────────────────────────────────────

  @Post('scan')
  @Roles(UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run content-safety automation on a payload (moderator+)' })
  scan(@Request() req: AuthedReq, @Body() dto: ScanContentDto) {
    return this.safety.scan({
      targetType: dto.targetType,
      targetId: dto.targetId,
      kind: dto.kind,
      text: dto.text,
      imageUrl: dto.imageUrl,
      submittedBy: req.user.userId,
    });
  }

  @Post('scan/process-pending')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process queued (PENDING/ERROR) content scans (admin only)' })
  processPending(@Query('limit') limit?: string) {
    return this.safety
      .processPending(limit ? parseInt(limit, 10) : undefined)
      .then((processed) => ({ processed }));
  }
}
