import { Inject, Injectable } from '@nestjs/common';
import type {
  ContentSafetyPort,
  ContentSafetyAssessment,
  ModerationSignal,
} from '@starria/moderation-core';
import {
  CONTENT_SAFETY_PROVIDER,
  ContentSafetyProvider,
} from './content-safety.port';

/**
 * Bridges the configured {@link ContentSafetyProvider} into moderation-core's
 * text-only {@link ContentSafetyPort}, so `ModerationService.assessContent`
 * returns real verdicts instead of the previous always-allow stub.
 *
 * Depends on the provider (not {@link ContentSafetyService}) to avoid a DI cycle
 * — the service depends on moderation for takedown.
 */
@Injectable()
export class ModerationSafetyAdapter implements ContentSafetyPort {
  constructor(
    @Inject(CONTENT_SAFETY_PROVIDER)
    private readonly provider: ContentSafetyProvider,
  ) {}

  async assess(content: string): Promise<ContentSafetyAssessment> {
    const verdict = await this.provider.scanText(content);
    const signals: ModerationSignal[] = verdict.findings.map((f) => ({
      code: f.category,
      severity: f.severity,
      matchedTerms: f.matchedTerms,
      message: `${f.category} detected (score ${f.score.toFixed(2)})`,
    }));
    return {
      allowed: verdict.decision === 'allow',
      signals,
      requiresHumanReview: verdict.decision === 'review',
      requiresEscalation: verdict.decision === 'block',
      overallSeverity: verdict.severity,
    };
  }
}
