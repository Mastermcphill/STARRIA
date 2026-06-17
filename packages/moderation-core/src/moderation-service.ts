// ---------------------------------------------------------------------------
// moderation-core — ModerationService
// Generalised from LifeNest moderation/moderation.service.ts.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  ModerationReportInput,
  ModerationReportRecord,
  BlockInput,
  BlockRecord,
  ModerationQueueItem,
  ModerationQueueFilter,
  ContentSafetyAssessment,
  ModerationCaseStatus,
} from './types';

// ---------------------------------------------------------------------------
// Storage port
// ---------------------------------------------------------------------------

export interface ModerationStorePort {
  saveReport(record: ModerationReportRecord): Promise<ModerationReportRecord>;
  findReport(id: string): Promise<ModerationReportRecord | undefined>;
  listQueue(filter?: ModerationQueueFilter): Promise<ModerationQueueItem[]>;
  updateQueueStatus(id: string, status: ModerationCaseStatus, patch?: Partial<ModerationQueueItem>): Promise<ModerationQueueItem>;

  saveBlock(record: BlockRecord): Promise<BlockRecord>;
  removeBlock(blockerId: string, blockedId: string): Promise<void>;
  findBlock(blockerId: string, blockedId: string): Promise<BlockRecord | undefined>;
  listBlocked(blockerId: string): Promise<BlockRecord[]>;
}

// ---------------------------------------------------------------------------
// Content safety port (wire to AI or rule-based service)
// ---------------------------------------------------------------------------

export interface ContentSafetyPort {
  assess(content: string, context?: Record<string, unknown>): Promise<ContentSafetyAssessment>;
}

// ---------------------------------------------------------------------------
// ModerationService
// ---------------------------------------------------------------------------

export class ModerationService {
  constructor(
    private readonly store: ModerationStorePort,
    private readonly safety?: ContentSafetyPort,
  ) {}

  // ─── Reporting ────────────────────────────────────────────────────────────

  async report(input: ModerationReportInput): Promise<ModerationReportRecord> {
    const record: ModerationReportRecord = {
      id: randomUUID(),
      reporterId: input.reporterId,
      targetId: input.targetId,
      targetType: input.targetType ?? 'post',
      reason: (input.reason ?? 'unspecified').trim(),
      status: 'open',
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };
    return this.store.saveReport(record);
  }

  async getReport(id: string): Promise<ModerationReportRecord | undefined> {
    return this.store.findReport(id);
  }

  // ─── Moderation queue ─────────────────────────────────────────────────────

  async listQueue(filter?: ModerationQueueFilter): Promise<ModerationQueueItem[]> {
    return this.store.listQueue(filter);
  }

  async resolveCase(
    caseId: string,
    resolvedBy: string,
    outcome: 'approved' | 'rejected',
  ): Promise<ModerationQueueItem> {
    const status: ModerationCaseStatus = outcome === 'approved' ? 'resolved' : 'dismissed';
    return this.store.updateQueueStatus(caseId, status, { assignedTo: resolvedBy });
  }

  async escalateCase(caseId: string, assignTo?: string): Promise<ModerationQueueItem> {
    return this.store.updateQueueStatus(caseId, 'escalated', { assignedTo: assignTo });
  }

  // ─── Blocking ─────────────────────────────────────────────────────────────

  async block(input: BlockInput): Promise<BlockRecord> {
    const existing = await this.store.findBlock(input.blockerId, input.blockedId);
    if (existing) return existing;

    const record: BlockRecord = {
      id: randomUUID(),
      blockerId: input.blockerId,
      blockedId: input.blockedId,
      reason: input.reason,
      createdAt: new Date().toISOString(),
    };
    return this.store.saveBlock(record);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.store.removeBlock(blockerId, blockedId);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const record = await this.store.findBlock(blockerId, blockedId);
    return record !== undefined;
  }

  async listBlocked(blockerId: string): Promise<BlockRecord[]> {
    return this.store.listBlocked(blockerId);
  }

  // ─── Content safety ───────────────────────────────────────────────────────

  async assessContent(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<ContentSafetyAssessment> {
    if (!this.safety) {
      return { allowed: true, signals: [], requiresHumanReview: false, requiresEscalation: false };
    }
    return this.safety.assess(content, context);
  }
}
