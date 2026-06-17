// ---------------------------------------------------------------------------
// moderation-core — types
// Extracted from LifeNest moderation/moderation.service.ts.
// LifeNest-specific healthcare escalation types are kept as optional
// extensions; standard social platform types are the baseline.
// ---------------------------------------------------------------------------

export type ModerationCaseStatus =
  | 'open'
  | 'in_review'
  | 'escalated'
  | 'resolved'
  | 'dismissed';

export type ModerationCaseAction =
  | 'approve'
  | 'reject'
  | 'escalate'
  | 'resolve'
  | 'lock'
  | 'unlock';

export type ModerationCaseType =
  | 'content_safety'
  | 'harmful_content'
  | 'spam'
  | 'impersonation'
  | 'misinformation'
  | 'credential_review'
  | 'crisis_escalation'
  | string;

export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ModerationReportTarget =
  | 'post'
  | 'comment'
  | 'message'
  | 'profile'
  | 'room'
  | 'group'
  | string;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ModerationReportInput {
  reporterId?: string;
  targetId?: string;
  targetType?: ModerationReportTarget;
  reason?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface ModerationReportRecord {
  readonly id: string;
  readonly reporterId?: string;
  readonly targetId?: string;
  readonly targetType: ModerationReportTarget;
  readonly reason: string;
  readonly status: ModerationCaseStatus;
  readonly severity?: ModerationSeverity;
  readonly resolvedBy?: string;
  readonly resolvedAt?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

export interface BlockInput {
  blockerId: string;
  blockedId: string;
  reason?: string;
}

export interface BlockRecord {
  readonly id: string;
  readonly blockerId: string;
  readonly blockedId: string;
  readonly reason?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Moderation queue
// ---------------------------------------------------------------------------

export interface ModerationQueueItem {
  readonly id: string;
  readonly type: ModerationCaseType;
  readonly targetId: string;
  readonly targetType: ModerationReportTarget;
  readonly severity: ModerationSeverity;
  readonly status: ModerationCaseStatus;
  readonly assignedTo?: string;
  readonly reportCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModerationQueueFilter {
  status?: ModerationCaseStatus;
  severity?: ModerationSeverity;
  type?: ModerationCaseType;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Content safety signal
// ---------------------------------------------------------------------------

export interface ModerationSignal {
  code: string;
  severity: ModerationSeverity;
  matchedTerms?: string[];
  message: string;
}

export interface ContentSafetyAssessment {
  allowed: boolean;
  signals: ModerationSignal[];
  requiresHumanReview: boolean;
  requiresEscalation: boolean;
  overallSeverity?: ModerationSeverity;
}
