// ---------------------------------------------------------------------------
// age-gate-core — domain types
// 18+/21+ verification, explicit consent, safe mode, content warnings.
// Companion Discovery is a completely separate surface from standard STARRIA.
// ---------------------------------------------------------------------------

import type { AgeGateLevel } from '@starria/domain-events';
export type { AgeGateLevel };

// ── AgeGateProfile ────────────────────────────────────────────────────────────

export type VerificationMethod = 'SELF_DECLARE' | 'DOCUMENT' | 'BIOMETRIC';
export type AgeGateStatus      = 'NOT_VERIFIED' | 'PENDING' | 'PASSED' | 'FAILED' | 'EXPIRED';
export type ConsentType        = 'COMPANION_DISCOVERY' | 'ADULT_CONTENT' | 'SESSION_RECORDING';

export interface AgeGateProfile {
  readonly userId: string;
  readonly level: AgeGateLevel;
  readonly status: AgeGateStatus;
  readonly verificationMethod?: VerificationMethod;
  readonly verifiedAt?: string;
  readonly expiresAt?: string;    // re-verify after 1 year
  readonly safeModeEnabled: boolean;
  readonly updatedAt: string;
}

// ── ConsentRecord ─────────────────────────────────────────────────────────────

export interface ConsentRecord {
  readonly id: string;
  readonly userId: string;
  readonly consentType: ConsentType;
  readonly granted: boolean;
  readonly recordedAt: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// ── Content warning ───────────────────────────────────────────────────────────

export type ContentWarningType =
  | 'MATURE_CONTENT'
  | 'STRONG_LANGUAGE'
  | 'SUGGESTIVE_CONTENT'
  | 'INTIMACY'
  | 'SENSITIVE_TOPICS';

export interface ContentWarning {
  readonly type: ContentWarningType;
  readonly label: string;
  readonly description: string;
}

export const CONTENT_WARNINGS: Record<ContentWarningType, ContentWarning> = {
  MATURE_CONTENT:     { type: 'MATURE_CONTENT',     label: 'Mature Content',     description: 'This session may contain content suitable for adults only.' },
  STRONG_LANGUAGE:    { type: 'STRONG_LANGUAGE',    label: 'Strong Language',    description: 'This session may include strong or explicit language.' },
  SUGGESTIVE_CONTENT: { type: 'SUGGESTIVE_CONTENT', label: 'Suggestive Content', description: 'This session may contain suggestive themes or behavior.' },
  INTIMACY:           { type: 'INTIMACY',           label: 'Intimacy',           description: 'This session may involve intimate conversation or roleplay.' },
  SENSITIVE_TOPICS:   { type: 'SENSITIVE_TOPICS',   label: 'Sensitive Topics',   description: 'This session may cover emotionally sensitive topics.' },
};

// ── Gate check result ─────────────────────────────────────────────────────────

export interface AgeGateCheckResult {
  readonly passed: boolean;
  readonly reason?: string;
  readonly requiredLevel: AgeGateLevel;
  readonly currentStatus: AgeGateStatus;
}

export function checkAgeGate(
  profile: AgeGateProfile | null,
  requiredLevel: AgeGateLevel,
): AgeGateCheckResult {
  if (!profile || profile.status !== 'PASSED') {
    return {
      passed: false,
      reason: `Age verification (${requiredLevel}) required to access Companion Discovery.`,
      requiredLevel,
      currentStatus: profile?.status ?? 'NOT_VERIFIED',
    };
  }

  // Check level sufficiency: 21+ requires exactly 21+
  if (requiredLevel === '21+' && profile.level !== '21+') {
    return {
      passed: false,
      reason: 'This content requires 21+ verification.',
      requiredLevel,
      currentStatus: profile.status,
    };
  }

  // Check expiry
  if (profile.expiresAt && new Date(profile.expiresAt) < new Date()) {
    return {
      passed: false,
      reason: 'Your age verification has expired. Please re-verify.',
      requiredLevel,
      currentStatus: 'EXPIRED',
    };
  }

  return {
    passed: true,
    requiredLevel,
    currentStatus: profile.status,
  };
}

// ── Persistence ports ─────────────────────────────────────────────────────────

export interface AgeGateStorePort {
  find(userId: string): Promise<AgeGateProfile | null>;
  upsert(profile: AgeGateProfile): Promise<AgeGateProfile>;

  appendConsent(record: Omit<ConsentRecord, 'id'>): Promise<ConsentRecord>;
  getConsents(userId: string): Promise<ConsentRecord[]>;
  hasConsented(userId: string, type: ConsentType): Promise<boolean>;
}

// ── Service I/O ───────────────────────────────────────────────────────────────

export interface SubmitAgeVerificationInput {
  readonly userId: string;
  readonly level: AgeGateLevel;
  readonly method: VerificationMethod;
  readonly selfDeclaredDob?: string;  // ISO date 'YYYY-MM-DD' for SELF_DECLARE
}

export interface RecordConsentInput {
  readonly userId: string;
  readonly consentType: ConsentType;
  readonly granted: boolean;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
