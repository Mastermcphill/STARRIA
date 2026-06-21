// ---------------------------------------------------------------------------
// companion — Prisma adapter for AgeGateStorePort (Sprint 10).
// Replaces the in-memory Maps with the AgeGateProfile / ConsentRecord tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AgeGateProfile,
  ConsentRecord,
  AgeGateStorePort,
  ConsentType,
  AgeGateStatus,
  VerificationMethod,
} from '@starria/age-gate-core';
import type { AgeGateLevel } from '@starria/domain-events';
import type { AgeGateProfile as DbProfile, ConsentRecord as DbConsent } from '@prisma/client';

function toProfile(p: DbProfile): AgeGateProfile {
  return {
    userId: p.userId,
    level: p.level as AgeGateLevel,
    status: p.status as AgeGateStatus,
    verificationMethod: (p.verificationMethod as VerificationMethod | null) ?? undefined,
    verifiedAt: p.verifiedAt?.toISOString(),
    expiresAt: p.expiresAt?.toISOString(),
    safeModeEnabled: p.safeModeEnabled,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toConsent(c: DbConsent): ConsentRecord {
  return {
    id: c.id,
    userId: c.userId,
    consentType: c.consentType as ConsentType,
    granted: c.granted,
    recordedAt: c.recordedAt.toISOString(),
    ipAddress: c.ipAddress ?? undefined,
    userAgent: c.userAgent ?? undefined,
  };
}

@Injectable()
export class PrismaAgeGateRepository implements AgeGateStorePort {
  constructor(private readonly db: PrismaService) {}

  async find(userId: string): Promise<AgeGateProfile | null> {
    const p = await this.db.ageGateProfile.findUnique({ where: { userId } });
    return p ? toProfile(p) : null;
  }

  async upsert(profile: AgeGateProfile): Promise<AgeGateProfile> {
    const data = {
      level: profile.level,
      status: profile.status,
      verificationMethod: profile.verificationMethod ?? null,
      verifiedAt: profile.verifiedAt ? new Date(profile.verifiedAt) : null,
      expiresAt: profile.expiresAt ? new Date(profile.expiresAt) : null,
      safeModeEnabled: profile.safeModeEnabled,
      updatedAt: new Date(profile.updatedAt),
    };
    const p = await this.db.ageGateProfile.upsert({
      where: { userId: profile.userId },
      create: { userId: profile.userId, ...data },
      update: data,
    });
    return toProfile(p);
  }

  async appendConsent(record: Omit<ConsentRecord, 'id'>): Promise<ConsentRecord> {
    const c = await this.db.consentRecord.create({
      data: {
        userId: record.userId,
        consentType: record.consentType,
        granted: record.granted,
        recordedAt: new Date(record.recordedAt),
        ipAddress: record.ipAddress ?? null,
        userAgent: record.userAgent ?? null,
      },
    });
    return toConsent(c);
  }

  async getConsents(userId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.consentRecord.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } });
    return rows.map(toConsent);
  }

  async hasConsented(userId: string, type: ConsentType): Promise<boolean> {
    const c = await this.db.consentRecord.findFirst({
      where: { userId, consentType: type, granted: true },
    });
    return c !== null;
  }
}
