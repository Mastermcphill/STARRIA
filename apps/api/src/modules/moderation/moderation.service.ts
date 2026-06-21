import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModerationService } from '@starria/moderation-core';
import type {
  ModerationReportRecord,
  ModerationQueueItem,
  ModerationQueueFilter,
  BlockRecord,
} from '@starria/moderation-core';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModerationStore } from './prisma-moderation.store';
import { ModerationSafetyAdapter } from './content-safety/moderation-safety.adapter';

/**
 * Nest-facing moderation facade. Delegates report/block/queue mechanics to
 * moderation-core (the shared domain service) over a Prisma-backed store, and
 * owns the API-specific concerns: privileged takedown + an immutable audit log
 * of every moderator/admin action.
 */
@Injectable()
export class NestModerationService {
  private readonly core: ModerationService;

  constructor(
    private readonly store: PrismaModerationStore,
    private readonly db: PrismaService,
    safety: ModerationSafetyAdapter,
  ) {
    this.core = new ModerationService(store, safety);
  }

  /** Assess free text against the configured content-safety provider. */
  async assessContent(content: string, context?: Record<string, unknown>) {
    return this.core.assessContent(content, context);
  }

  // ─── Reporting (any authenticated user) ─────────────────────────────────────

  async report(
    reporterId: string,
    input: { targetId: string; targetType: string; reason: string; caseType?: string; severity?: string },
  ): Promise<ModerationReportRecord> {
    return this.core.report({
      reporterId,
      targetId: input.targetId,
      targetType: input.targetType,
      reason: input.reason,
      // ModerationReportInput has no severity/caseType fields, so carry both in
      // metadata; PrismaModerationStore reads them back out when persisting.
      metadata: { caseType: input.caseType, severity: input.severity },
    });
  }

  // ─── Blocking (any authenticated user) ──────────────────────────────────────

  async block(blockerId: string, blockedId: string, reason?: string): Promise<BlockRecord> {
    const record = await this.core.block({ blockerId, blockedId, reason });
    await this.audit(blockerId, 'block', 'user', blockedId, reason);
    return record;
  }

  async unblock(blockerId: string, blockedId: string): Promise<{ unblocked: boolean }> {
    await this.core.unblock(blockerId, blockedId);
    await this.audit(blockerId, 'unblock', 'user', blockedId);
    return { unblocked: true };
  }

  // ─── Moderator review workflow ──────────────────────────────────────────────

  async listReports(filter?: ModerationQueueFilter): Promise<ModerationQueueItem[]> {
    return this.core.listQueue(filter);
  }

  async resolveReport(
    actorId: string,
    caseId: string,
    outcome: 'approved' | 'rejected',
  ): Promise<ModerationQueueItem> {
    await this.requireReport(caseId);
    const item = await this.core.resolveCase(caseId, actorId, outcome);
    await this.audit(actorId, 'resolve', item.targetType, item.targetId, outcome);
    return item;
  }

  async escalateReport(actorId: string, caseId: string, assignTo?: string): Promise<ModerationQueueItem> {
    await this.requireReport(caseId);
    const item = await this.core.escalateCase(caseId, assignTo);
    await this.audit(actorId, 'escalate', item.targetType, item.targetId);
    return item;
  }

  // ─── Admin takedown ─────────────────────────────────────────────────────────

  /**
   * Resolve every open/in-review report against a target and write an audit
   * record. This is the content-removal decision point; it does not delete the
   * underlying row (that is owned by each content module) but closes the
   * moderation cases and records who acted.
   */
  async takedown(
    actorId: string,
    targetType: string,
    targetId: string,
    reason?: string,
  ): Promise<{ targetType: string; targetId: string; reportsResolved: number }> {
    const open = await this.db.moderationReport.findMany({
      where: {
        targetType,
        targetId,
        status: { in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] },
      },
      select: { id: true },
    });
    for (const r of open) {
      await this.store.updateQueueStatus(r.id, 'resolved', { assignedTo: actorId });
    }
    await this.audit(actorId, 'takedown', targetType, targetId, reason, {
      reportsResolved: open.length,
    });
    return { targetType, targetId, reportsResolved: open.length };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async requireReport(caseId: string): Promise<void> {
    const exists = await this.db.moderationReport.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Moderation case ${caseId} not found`);
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.moderationAuditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        reason,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
