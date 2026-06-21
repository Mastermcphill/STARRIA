import type { ModerationSeverity } from '@starria/moderation-core';

/**
 * Provider-agnostic content-safety contract. Implemented by the rule-based
 * {@link ManualSafetyProvider} (default) and the {@link CloudProviderAdapter}
 * (selected when a cloud vision/text moderation endpoint is configured).
 */
export const CONTENT_SAFETY_PROVIDER = 'CONTENT_SAFETY_PROVIDER';

/** A single moderation signal raised against a payload. */
export interface SafetyFinding {
  /** Image: 'nudity' | 'violence' | 'abuse'. Text: 'hate' | 'threats' | 'spam'. */
  category: string;
  severity: ModerationSeverity;
  /** 0..1 confidence from the provider (rule-based ≈ 1 on match). */
  score: number;
  matchedTerms?: string[];
}

export type SafetyDecision = 'allow' | 'review' | 'block';

export interface SafetyVerdict {
  decision: SafetyDecision;
  findings: SafetyFinding[];
  /** Highest severity across findings, if any. */
  severity?: ModerationSeverity;
}

export interface ContentSafetyProvider {
  /** Stable identifier persisted on each scan ('manual' | 'cloud' | ...). */
  readonly name: string;
  /** Classify free text for hate / threats / spam. */
  scanText(text: string): Promise<SafetyVerdict>;
  /** Classify an image (by URL) for nudity / violence / abuse. */
  scanImage(imageUrl: string): Promise<SafetyVerdict>;
}

/** Severity ranking helper shared by providers + service. */
export const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function highestSeverity(
  findings: SafetyFinding[],
): ModerationSeverity | undefined {
  if (findings.length === 0) return undefined;
  return findings.reduce<ModerationSeverity>(
    (acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
    'low',
  );
}

/**
 * Map a set of findings to a decision. critical → block, high/medium → review,
 * low or none → allow. Centralised so every provider returns consistent
 * decisions from the same findings.
 */
export function decideFromFindings(findings: SafetyFinding[]): SafetyVerdict {
  const severity = highestSeverity(findings);
  let decision: SafetyDecision = 'allow';
  if (severity === 'critical') decision = 'block';
  else if (severity === 'high' || severity === 'medium') decision = 'review';
  return { decision, findings, severity };
}
