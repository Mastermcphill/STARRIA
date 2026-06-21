import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NestModerationService } from '../moderation.service';
import {
  CONTENT_SAFETY_PROVIDER,
  ContentSafetyProvider,
  SafetyVerdict,
} from './content-safety.port';

export interface ScanInput {
  targetType: string;
  targetId: string;
  kind: 'TEXT' | 'IMAGE';
  /** Required when kind === 'TEXT'. */
  text?: string;
  /** Required when kind === 'IMAGE'. */
  imageUrl?: string;
  submittedBy?: string;
}

type ScanStatus = 'PENDING' | 'ALLOWED' | 'FLAGGED' | 'BLOCKED' | 'ERROR';

const SYSTEM_ACTOR = 'system:content-safety';

/**
 * Content-safety automation pipeline.
 *
 * Submitting content creates a persistent {@link ContentScan} row, runs it
 * through the configured {@link ContentSafetyProvider}, and acts on the verdict:
 *  - allow  → status ALLOWED, no further action
 *  - review → status FLAGGED, the row becomes a human-review queue entry + audit
 *  - block  → status BLOCKED, automatic takedown + audit
 *
 * Errors leave the row in ERROR so the queue worker ({@link processPending})
 * can retry — content is never silently allowed on provider failure.
 */
@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);

  constructor(
    @Inject(CONTENT_SAFETY_PROVIDER) private readonly provider: ContentSafetyProvider,
    private readonly db: PrismaService,
    private readonly moderation: NestModerationService,
  ) {}

  /** Enqueue content for scanning without processing it (returns PENDING row). */
  async enqueue(input: ScanInput) {
    return this.db.contentScan.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        kind: input.kind,
        provider: this.provider.name,
        status: 'PENDING',
        submittedBy: input.submittedBy ?? null,
        payload:
          input.kind === 'IMAGE'
            ? ({ imageUrl: input.imageUrl ?? '' } as Prisma.InputJsonValue)
            : ({ text: input.text ?? '' } as Prisma.InputJsonValue),
      },
    });
  }

  /** Submit content and scan it immediately. Returns the resolved scan row. */
  async scan(input: ScanInput) {
    const row = await this.enqueue(input);
    return this.runScan(row);
  }

  /**
   * Queue worker: pick up PENDING/ERROR scans and process them from their stored
   * payload. Returns the number processed. Driven by a scheduler or on demand.
   */
  async processPending(limit = 50): Promise<number> {
    const pending = await this.db.contentScan.findMany({
      where: { status: { in: ['PENDING', 'ERROR'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const row of pending) {
      await this.runScan(row);
    }
    return pending.length;
  }

  /**
   * Bridge used by report-time content assessment: classify free text and return
   * the raw verdict without persisting a scan row.
   */
  async assessText(text: string): Promise<SafetyVerdict> {
    return this.provider.scanText(text);
  }

  private async runScan(row: {
    id: string;
    targetType: string;
    targetId: string;
    kind: string;
    payload: unknown;
  }) {
    const payload = (row.payload ?? {}) as { text?: string; imageUrl?: string };
    let verdict: SafetyVerdict;
    try {
      verdict =
        row.kind === 'IMAGE'
          ? await this.provider.scanImage(payload.imageUrl ?? '')
          : await this.provider.scanText(payload.text ?? '');
    } catch (e) {
      this.logger.error(
        `Scan ${row.id} provider error: ${(e as Error).message} — left for retry`,
      );
      return this.db.contentScan.update({
        where: { id: row.id },
        data: { status: 'ERROR', scannedAt: new Date() },
      });
    }

    const status: ScanStatus =
      verdict.decision === 'block'
        ? 'BLOCKED'
        : verdict.decision === 'review'
          ? 'FLAGGED'
          : 'ALLOWED';

    if (status === 'BLOCKED') {
      // Auto-takedown closes any open reports against the target and audits.
      await this.moderation.takedown(
        SYSTEM_ACTOR,
        row.targetType,
        row.targetId,
        `auto-block: ${verdict.severity} ${verdict.findings.map((f) => f.category).join(',')}`,
      );
    } else if (status === 'FLAGGED') {
      await this.audit('content_flagged', row.targetType, row.targetId, verdict);
    }

    return this.db.contentScan.update({
      where: { id: row.id },
      data: {
        status,
        severity: verdict.severity ?? null,
        findings: (verdict.findings as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        scannedAt: new Date(),
      },
    });
  }

  private async audit(
    action: string,
    targetType: string,
    targetId: string,
    verdict: SafetyVerdict,
  ): Promise<void> {
    await this.db.moderationAuditLog.create({
      data: {
        actorId: SYSTEM_ACTOR,
        action,
        targetType,
        targetId,
        reason: verdict.severity,
        metadata: { findings: verdict.findings } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
