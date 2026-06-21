// ---------------------------------------------------------------------------
// PrismaModerationStore — implements moderation-core's ModerationStorePort
// against the Prisma ModerationReport + UserBlock models.
//
// moderation-core speaks lowercase status unions ('open' | 'in_review' | ...);
// the database uses the ModerationCaseStatus enum (OPEN | UNDER_REVIEW | ...).
// The two map helpers below are the single translation boundary.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { ModerationCaseStatus as DbStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ModerationStorePort,
  ModerationReportRecord,
  ModerationQueueItem,
  ModerationQueueFilter,
  ModerationCaseStatus,
  BlockRecord,
} from '@starria/moderation-core';

const TO_DB: Record<ModerationCaseStatus, DbStatus> = {
  open: DbStatus.OPEN,
  in_review: DbStatus.UNDER_REVIEW,
  escalated: DbStatus.ESCALATED,
  resolved: DbStatus.RESOLVED,
  dismissed: DbStatus.DISMISSED,
};

const FROM_DB: Record<DbStatus, ModerationCaseStatus> = {
  OPEN: 'open',
  UNDER_REVIEW: 'in_review',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

const TERMINAL: DbStatus[] = [DbStatus.RESOLVED, DbStatus.DISMISSED];

type ReportRow = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  caseType: string;
  reason: string | null;
  status: DbStatus;
  severity: string | null;
  assignedTo: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaModerationStore implements ModerationStorePort {
  constructor(private readonly db: PrismaService) {}

  // ─── Reports / queue ───────────────────────────────────────────────────────

  async saveReport(record: ModerationReportRecord): Promise<ModerationReportRecord> {
    const caseType = (record.metadata?.['caseType'] as string) ?? 'user_report';
    const severity =
      record.severity ?? (record.metadata?.['severity'] as string | undefined) ?? null;
    const row = await this.db.moderationReport.create({
      data: {
        id: record.id,
        // reporterId is a required FK; the controller always supplies the
        // authenticated caller, so it is present in practice.
        reporterId: record.reporterId ?? '',
        targetType: record.targetType,
        targetId: record.targetId ?? '',
        caseType,
        reason: record.reason,
        status: TO_DB[record.status],
        severity,
      },
    });
    return this.toRecord(row);
  }

  async findReport(id: string): Promise<ModerationReportRecord | undefined> {
    const row = await this.db.moderationReport.findUnique({ where: { id } });
    return row ? this.toRecord(row) : undefined;
  }

  async listQueue(filter?: ModerationQueueFilter): Promise<ModerationQueueItem[]> {
    const where: Prisma.ModerationReportWhereInput = {};
    if (filter?.status) where.status = TO_DB[filter.status];
    if (filter?.severity) where.severity = filter.severity;
    if (filter?.type) where.caseType = filter.type;
    if (filter?.assignedTo) where.assignedTo = filter.assignedTo;

    const rows = await this.db.moderationReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter?.limit ?? 100,
      skip: filter?.offset ?? 0,
    });
    return rows.map((r) => this.toQueueItem(r));
  }

  async updateQueueStatus(
    id: string,
    status: ModerationCaseStatus,
    patch?: Partial<ModerationQueueItem>,
  ): Promise<ModerationQueueItem> {
    const dbStatus = TO_DB[status];
    const data: Prisma.ModerationReportUpdateInput = { status: dbStatus };
    if (patch?.assignedTo !== undefined) {
      data.assignedTo = patch.assignedTo;
      // The actor that moves a case to a terminal state is also the resolver.
      if (TERMINAL.includes(dbStatus)) {
        data.resolvedBy = patch.assignedTo;
        data.resolvedAt = new Date();
      }
    } else if (TERMINAL.includes(dbStatus)) {
      data.resolvedAt = new Date();
    }
    const row = await this.db.moderationReport.update({ where: { id }, data });
    return this.toQueueItem(row);
  }

  // ─── Blocks ─────────────────────────────────────────────────────────────────

  async saveBlock(record: BlockRecord): Promise<BlockRecord> {
    const row = await this.db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: record.blockerId, blockedId: record.blockedId } },
      create: {
        id: record.id,
        blockerId: record.blockerId,
        blockedId: record.blockedId,
        reason: record.reason,
      },
      update: {},
    });
    return this.toBlock(row);
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.db.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  async findBlock(blockerId: string, blockedId: string): Promise<BlockRecord | undefined> {
    const row = await this.db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return row ? this.toBlock(row) : undefined;
  }

  async listBlocked(blockerId: string): Promise<BlockRecord[]> {
    const rows = await this.db.userBlock.findMany({ where: { blockerId } });
    return rows.map((r) => this.toBlock(r));
  }

  // ─── Mappers ─────────────────────────────────────────────────────────────────

  private toRecord(row: ReportRow): ModerationReportRecord {
    return {
      id: row.id,
      reporterId: row.reporterId,
      targetId: row.targetId,
      targetType: row.targetType,
      reason: row.reason ?? 'unspecified',
      status: FROM_DB[row.status],
      severity: (row.severity as ModerationReportRecord['severity']) ?? undefined,
      resolvedBy: row.resolvedBy ?? undefined,
      resolvedAt: row.resolvedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toQueueItem(row: ReportRow): ModerationQueueItem {
    return {
      id: row.id,
      type: row.caseType,
      targetId: row.targetId,
      targetType: row.targetType,
      severity: (row.severity as ModerationQueueItem['severity']) ?? 'low',
      status: FROM_DB[row.status],
      assignedTo: row.assignedTo ?? undefined,
      reportCount: 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBlock(row: { id: string; blockerId: string; blockedId: string; reason: string | null; createdAt: Date }): BlockRecord {
    return {
      id: row.id,
      blockerId: row.blockerId,
      blockedId: row.blockedId,
      reason: row.reason ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
