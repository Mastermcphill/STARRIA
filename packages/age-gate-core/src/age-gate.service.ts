// ---------------------------------------------------------------------------
// age-gate-core — AgeGateService
// Handles age verification, consent recording, safe mode, and gate checks.
// STARRIA Companion is a separate surface — discovery NEVER mixes with standard.
// ---------------------------------------------------------------------------

import type { EventBus } from '@starria/domain-events';
import type { AgeGateLevel } from '@starria/domain-events';
import type {
  AgeGateProfile,
  AgeGateStorePort,
  AgeGateCheckResult,
  SubmitAgeVerificationInput,
  RecordConsentInput,
  ConsentRecord,
} from './types';
import { checkAgeGate } from './types';
import {
  buildAgeGatePassed,
  buildAgeGateFailed,
  buildConsentRecorded,
} from './events';

// Companion Discovery requires 18+ by default
export const COMPANION_DISCOVERY_REQUIRED_LEVEL: AgeGateLevel = '18+';

export class AgeGateService {
  constructor(
    private readonly store: AgeGateStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async getProfile(userId: string): Promise<AgeGateProfile | null> {
    return this.store.find(userId);
  }

  async submitVerification(input: SubmitAgeVerificationInput): Promise<AgeGateProfile> {
    const now = new Date().toISOString();

    // For SELF_DECLARE: validate age from DOB
    if (input.method === 'SELF_DECLARE' && input.selfDeclaredDob) {
      const dob = new Date(input.selfDeclaredDob);
      const ageMs = Date.now() - dob.getTime();
      const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);

      const minAge = input.level === '21+' ? 21 : 18;
      if (ageYears < minAge) {
        const profile = await this.store.upsert({
          userId: input.userId,
          level: input.level,
          status: 'FAILED',
          verificationMethod: input.method,
          safeModeEnabled: true,
          updatedAt: now,
        });

        void this.eventBus?.publish(buildAgeGateFailed({
          userId: input.userId,
          level: input.level,
          reason: `Age requirement not met for ${input.level}`,
          failedAt: now,
        }));

        return profile;
      }
    }

    // One year expiry for self-declarations
    const expiresAt = input.method === 'SELF_DECLARE'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const profile = await this.store.upsert({
      userId: input.userId,
      level: input.level,
      status: 'PASSED',
      verificationMethod: input.method,
      verifiedAt: now,
      expiresAt,
      safeModeEnabled: false,
      updatedAt: now,
    });

    void this.eventBus?.publish(buildAgeGatePassed({
      userId: input.userId,
      level: input.level,
      verificationMethod: input.method,
      passedAt: now,
    }));

    return profile;
  }

  async checkAccess(userId: string, requiredLevel: AgeGateLevel = '18+'): Promise<AgeGateCheckResult> {
    const profile = await this.store.find(userId);
    return checkAgeGate(profile, requiredLevel);
  }

  async recordConsent(input: RecordConsentInput): Promise<ConsentRecord> {
    const now = new Date().toISOString();
    const record = await this.store.appendConsent({
      userId: input.userId,
      consentType: input.consentType,
      granted: input.granted,
      recordedAt: now,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    void this.eventBus?.publish(buildConsentRecorded({
      userId: input.userId,
      consentType: input.consentType,
      granted: input.granted,
      recordedAt: now,
      ipAddress: input.ipAddress,
    }));

    return record;
  }

  async hasConsentedToCompanionDiscovery(userId: string): Promise<boolean> {
    return this.store.hasConsented(userId, 'COMPANION_DISCOVERY');
  }

  async setSafeMode(userId: string, enabled: boolean): Promise<AgeGateProfile> {
    const existing = await this.store.find(userId);
    const now = new Date().toISOString();
    return this.store.upsert({
      userId,
      level: existing?.level ?? '18+',
      status: existing?.status ?? 'NOT_VERIFIED',
      verificationMethod: existing?.verificationMethod,
      verifiedAt: existing?.verifiedAt,
      expiresAt: existing?.expiresAt,
      safeModeEnabled: enabled,
      updatedAt: now,
    });
  }

  async getConsents(userId: string): Promise<ConsentRecord[]> {
    return this.store.getConsents(userId);
  }
}
