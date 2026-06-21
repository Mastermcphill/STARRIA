// ---------------------------------------------------------------------------
// trust — Prisma adapter for TrustStorePort (Sprint 10).
// Replaces the in-memory Maps with the TrustProfile / TrustFlag /
// TrustRestrictionRecord tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  TrustProfile,
  TrustFlag,
  TrustRestrictionRecord,
  TrustStorePort,
  TrustSignals,
  TrustRestriction,
  TrustFlagType,
} from '@starria/trust-core';
import type {
  TrustProfile as DbProfile,
  TrustFlag as DbFlag,
  TrustRestrictionRecord as DbRestriction,
} from '@prisma/client';

function toProfile(p: DbProfile): TrustProfile {
  return {
    userId: p.userId,
    score: p.score,
    signals: p.signals as unknown as TrustSignals,
    restrictions: p.restrictions as TrustRestriction[],
    flags: p.flags as unknown as TrustFlag[],
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toFlag(f: DbFlag): TrustFlag {
  return {
    id: f.id,
    userId: f.userId,
    flagType: f.flagType as TrustFlagType,
    raisedBy: f.raisedBy,
    raisedAt: f.raisedAt.toISOString(),
  };
}

function toRestriction(r: DbRestriction): TrustRestrictionRecord {
  return {
    id: r.id,
    userId: r.userId,
    restriction: r.restriction as TrustRestriction,
    reason: r.reason,
    expiresAt: r.expiresAt?.toISOString(),
    setAt: r.setAt.toISOString(),
  };
}

@Injectable()
export class PrismaTrustRepository implements TrustStorePort {
  constructor(private readonly db: PrismaService) {}

  async find(userId: string): Promise<TrustProfile | null> {
    const p = await this.db.trustProfile.findUnique({ where: { userId } });
    return p ? toProfile(p) : null;
  }

  async upsert(profile: TrustProfile): Promise<TrustProfile> {
    const data = {
      score: profile.score,
      signals: profile.signals as unknown as object,
      restrictions: [...profile.restrictions],
      flags: profile.flags as unknown as object,
      updatedAt: new Date(profile.updatedAt),
    };
    const p = await this.db.trustProfile.upsert({
      where: { userId: profile.userId },
      create: { userId: profile.userId, ...data },
      update: data,
    });
    return toProfile(p);
  }

  async appendFlag(flag: Omit<TrustFlag, 'id'>): Promise<TrustFlag> {
    const f = await this.db.trustFlag.create({
      data: {
        userId: flag.userId,
        flagType: flag.flagType,
        raisedBy: flag.raisedBy,
        raisedAt: new Date(flag.raisedAt),
      },
    });
    return toFlag(f);
  }

  async getFlags(userId: string): Promise<TrustFlag[]> {
    const rows = await this.db.trustFlag.findMany({ where: { userId }, orderBy: { raisedAt: 'asc' } });
    return rows.map(toFlag);
  }

  async appendRestriction(rec: Omit<TrustRestrictionRecord, 'id'>): Promise<TrustRestrictionRecord> {
    const r = await this.db.trustRestrictionRecord.create({
      data: {
        userId: rec.userId,
        restriction: rec.restriction,
        reason: rec.reason,
        expiresAt: rec.expiresAt ? new Date(rec.expiresAt) : null,
        setAt: new Date(rec.setAt),
      },
    });
    return toRestriction(r);
  }

  async getRestrictions(userId: string): Promise<TrustRestrictionRecord[]> {
    const rows = await this.db.trustRestrictionRecord.findMany({
      where: { userId },
      orderBy: { setAt: 'asc' },
    });
    return rows.map(toRestriction);
  }
}
