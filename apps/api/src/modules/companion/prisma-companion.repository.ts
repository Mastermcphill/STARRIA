// ---------------------------------------------------------------------------
// companion — Prisma adapters for CompanionStorePort + LonelinessStorePort
// (Sprint 10). Replaces the in-memory Maps with the CompanionProfile / rate /
// availability / review / media / block / report + LonelinessProfile tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CompanionProfile,
  CompanionRate,
  CompanionAvailabilitySlot,
  CompanionReview,
  CompanionMedia,
  CompanionBlock,
  CompanionReport,
  CompanionStorePort,
  CompanionDiscoveryFilter,
  CompanionStatus,
  CompanionVerificationStatus,
  SessionTypeOffered,
  SessionActivity,
  MediaType,
} from '@starria/companion-core';
import type { LonelinessProfile, LonelinessStorePort, LonelinessSignals } from '@starria/companion-core';
import type {
  CompanionProfile as DbProfile,
  CompanionRate as DbRate,
  CompanionAvailabilitySlot as DbSlot,
  CompanionReview as DbReview,
  CompanionMedia as DbMedia,
  CompanionBlock as DbBlock,
  CompanionReport as DbReport,
  LonelinessProfile as DbLoneliness,
} from '@prisma/client';

// ── Row → domain mappers ──────────────────────────────────────────────────────

function toProfile(p: DbProfile): CompanionProfile {
  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    bio: p.bio ?? undefined,
    nationality: p.nationality,
    languages: p.languages,
    timezone: p.timezone,
    heightCm: p.heightCm ?? undefined,
    hobbies: p.hobbies,
    interests: p.interests,
    sessionTypes: p.sessionTypes as SessionTypeOffered[],
    activities: p.activities as SessionActivity[],
    verificationStatus: p.verificationStatus as CompanionVerificationStatus,
    verificationBadge: p.verificationBadge,
    ageVerified: p.ageVerified,
    introVideoUrl: p.introVideoUrl ?? undefined,
    introImageUrls: p.introImageUrls,
    status: p.status as CompanionStatus,
    isAvailableNow: p.isAvailableNow,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    totalSessionMinutes: p.totalSessionMinutes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toRate(r: DbRate): CompanionRate {
  return {
    companionId: r.companionId,
    sessionType: r.sessionType as SessionTypeOffered,
    durationMinutes: r.durationMinutes as CompanionRate['durationMinutes'],
    coinCost: r.coinCost,
    maxParticipants: r.maxParticipants,
    isEnabled: r.isEnabled,
  };
}

function toSlot(s: DbSlot): CompanionAvailabilitySlot {
  return {
    id: s.id,
    companionId: s.companionId,
    day: s.day as CompanionAvailabilitySlot['day'],
    startHour: s.startHour,
    endHour: s.endHour,
  };
}

function toReview(r: DbReview): CompanionReview {
  return {
    id: r.id,
    companionId: r.companionId,
    reviewerId: r.reviewerId,
    sessionId: r.sessionId,
    rating: r.rating,
    comment: r.comment ?? undefined,
    isHidden: r.isHidden,
    createdAt: r.createdAt.toISOString(),
  };
}

function toMedia(m: DbMedia): CompanionMedia {
  return {
    id: m.id,
    companionId: m.companionId,
    type: m.type as MediaType,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    isApproved: m.isApproved,
    sortOrder: m.sortOrder,
    uploadedAt: m.uploadedAt.toISOString(),
  };
}

function toBlock(b: DbBlock): CompanionBlock {
  return { id: b.id, blockerId: b.blockerId, blockedId: b.blockedId, blockedAt: b.blockedAt.toISOString() };
}

function toReport(r: DbReport): CompanionReport {
  return {
    id: r.id,
    reporterId: r.reporterId,
    reportedId: r.reportedId,
    sessionId: r.sessionId ?? undefined,
    reason: r.reason,
    status: r.status as CompanionReport['status'],
    reportedAt: r.reportedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString(),
  };
}

function toLoneliness(l: DbLoneliness): LonelinessProfile {
  return {
    userId: l.userId,
    score: l.score,
    signals: l.signals as unknown as LonelinessSignals,
    updatedAt: l.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaCompanionRepository implements CompanionStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(input: Omit<CompanionProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<CompanionProfile> {
    const p = await this.db.companionProfile.create({
      data: {
        userId: input.userId,
        displayName: input.displayName,
        bio: input.bio ?? null,
        nationality: input.nationality,
        languages: [...input.languages],
        timezone: input.timezone,
        heightCm: input.heightCm ?? null,
        hobbies: [...input.hobbies],
        interests: [...input.interests],
        sessionTypes: [...input.sessionTypes],
        activities: [...input.activities],
        verificationStatus: input.verificationStatus,
        verificationBadge: input.verificationBadge,
        ageVerified: input.ageVerified,
        introVideoUrl: input.introVideoUrl ?? null,
        introImageUrls: [...input.introImageUrls],
        status: input.status,
        isAvailableNow: input.isAvailableNow,
        averageRating: input.averageRating,
        reviewCount: input.reviewCount,
        totalSessionMinutes: input.totalSessionMinutes,
      },
    });
    return toProfile(p);
  }

  async findById(id: string): Promise<CompanionProfile | null> {
    const p = await this.db.companionProfile.findUnique({ where: { id } });
    return p ? toProfile(p) : null;
  }

  async findByUserId(userId: string): Promise<CompanionProfile | null> {
    const p = await this.db.companionProfile.findUnique({ where: { userId } });
    return p ? toProfile(p) : null;
  }

  async update(id: string, patch: Partial<CompanionProfile>): Promise<CompanionProfile> {
    const data: Record<string, unknown> = {};
    const assign = <K extends keyof CompanionProfile>(k: K) => {
      if (patch[k] !== undefined) data[k as string] = patch[k];
    };
    (['displayName', 'nationality', 'timezone', 'verificationStatus', 'verificationBadge',
      'ageVerified', 'status', 'isAvailableNow', 'averageRating', 'reviewCount',
      'totalSessionMinutes'] as const).forEach(assign);
    if (patch.bio !== undefined) data.bio = patch.bio ?? null;
    if (patch.heightCm !== undefined) data.heightCm = patch.heightCm ?? null;
    if (patch.introVideoUrl !== undefined) data.introVideoUrl = patch.introVideoUrl ?? null;
    if (patch.languages !== undefined) data.languages = [...patch.languages];
    if (patch.hobbies !== undefined) data.hobbies = [...patch.hobbies];
    if (patch.interests !== undefined) data.interests = [...patch.interests];
    if (patch.sessionTypes !== undefined) data.sessionTypes = [...patch.sessionTypes];
    if (patch.activities !== undefined) data.activities = [...patch.activities];
    if (patch.introImageUrls !== undefined) data.introImageUrls = [...patch.introImageUrls];

    const p = await this.db.companionProfile.update({ where: { id }, data });
    return toProfile(p);
  }

  async discover(filter: CompanionDiscoveryFilter): Promise<CompanionProfile[]> {
    const where: Record<string, unknown> = { status: 'ACTIVE' };
    if (filter.sessionType) where.sessionTypes = { has: filter.sessionType };
    if (filter.activity) where.activities = { has: filter.activity };
    if (filter.language) where.languages = { has: filter.language };
    if (filter.availableNow !== undefined) where.isAvailableNow = filter.availableNow;
    if (filter.nationality) where.nationality = filter.nationality;

    const rows = await this.db.companionProfile.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 20,
    });
    return rows.map(toProfile);
  }

  async upsertRate(rate: CompanionRate): Promise<CompanionRate> {
    const r = await this.db.companionRate.upsert({
      where: {
        companionId_sessionType_durationMinutes: {
          companionId: rate.companionId,
          sessionType: rate.sessionType,
          durationMinutes: rate.durationMinutes,
        },
      },
      create: {
        companionId: rate.companionId,
        sessionType: rate.sessionType,
        durationMinutes: rate.durationMinutes,
        coinCost: rate.coinCost,
        maxParticipants: rate.maxParticipants,
        isEnabled: rate.isEnabled,
      },
      update: {
        coinCost: rate.coinCost,
        maxParticipants: rate.maxParticipants,
        isEnabled: rate.isEnabled,
      },
    });
    return toRate(r);
  }

  async getRates(companionId: string): Promise<CompanionRate[]> {
    const rows = await this.db.companionRate.findMany({ where: { companionId } });
    return rows.map(toRate);
  }

  async getRate(
    companionId: string,
    sessionType: SessionTypeOffered,
    durationMinutes: number,
  ): Promise<CompanionRate | null> {
    const r = await this.db.companionRate.findUnique({
      where: { companionId_sessionType_durationMinutes: { companionId, sessionType, durationMinutes } },
    });
    return r ? toRate(r) : null;
  }

  async upsertAvailabilitySlot(
    slot: Omit<CompanionAvailabilitySlot, 'id'>,
  ): Promise<CompanionAvailabilitySlot> {
    const r = await this.db.companionAvailabilitySlot.upsert({
      where: {
        companionId_day_startHour: {
          companionId: slot.companionId,
          day: slot.day,
          startHour: slot.startHour,
        },
      },
      create: { companionId: slot.companionId, day: slot.day, startHour: slot.startHour, endHour: slot.endHour },
      update: { endHour: slot.endHour },
    });
    return toSlot(r);
  }

  async getAvailability(companionId: string): Promise<CompanionAvailabilitySlot[]> {
    const rows = await this.db.companionAvailabilitySlot.findMany({ where: { companionId } });
    return rows.map(toSlot);
  }

  async createReview(review: Omit<CompanionReview, 'id'>): Promise<CompanionReview> {
    const r = await this.db.companionReview.create({
      data: {
        companionId: review.companionId,
        reviewerId: review.reviewerId,
        sessionId: review.sessionId,
        rating: review.rating,
        comment: review.comment ?? null,
        isHidden: review.isHidden,
        createdAt: new Date(review.createdAt),
      },
    });
    return toReview(r);
  }

  async getReviews(companionId: string, limit = 20): Promise<CompanionReview[]> {
    const rows = await this.db.companionReview.findMany({
      where: { companionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toReview);
  }

  async createMedia(media: Omit<CompanionMedia, 'id'>): Promise<CompanionMedia> {
    const r = await this.db.companionMedia.create({
      data: {
        companionId: media.companionId,
        type: media.type,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl ?? null,
        isApproved: media.isApproved,
        sortOrder: media.sortOrder,
        uploadedAt: new Date(media.uploadedAt),
      },
    });
    return toMedia(r);
  }

  async getMedia(companionId: string): Promise<CompanionMedia[]> {
    const rows = await this.db.companionMedia.findMany({
      where: { companionId },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toMedia);
  }

  async createBlock(block: Omit<CompanionBlock, 'id'>): Promise<CompanionBlock> {
    const r = await this.db.companionBlock.create({
      data: { blockerId: block.blockerId, blockedId: block.blockedId, blockedAt: new Date(block.blockedAt) },
    });
    return toBlock(r);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const r = await this.db.companionBlock.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return r !== null;
  }

  async createReport(report: Omit<CompanionReport, 'id'>): Promise<CompanionReport> {
    const r = await this.db.companionReport.create({
      data: {
        reporterId: report.reporterId,
        reportedId: report.reportedId,
        sessionId: report.sessionId ?? null,
        reason: report.reason,
        status: report.status,
        reportedAt: new Date(report.reportedAt),
        reviewedAt: report.reviewedAt ? new Date(report.reviewedAt) : null,
      },
    });
    return toReport(r);
  }

  async getPendingReports(limit = 50): Promise<CompanionReport[]> {
    const rows = await this.db.companionReport.findMany({
      where: { status: 'PENDING' },
      orderBy: { reportedAt: 'asc' },
      take: limit,
    });
    return rows.map(toReport);
  }
}

@Injectable()
export class PrismaLonelinessRepository implements LonelinessStorePort {
  constructor(private readonly db: PrismaService) {}

  async find(userId: string): Promise<LonelinessProfile | null> {
    const l = await this.db.lonelinessProfile.findUnique({ where: { userId } });
    return l ? toLoneliness(l) : null;
  }

  async upsert(profile: LonelinessProfile): Promise<LonelinessProfile> {
    const l = await this.db.lonelinessProfile.upsert({
      where: { userId: profile.userId },
      create: {
        userId: profile.userId,
        score: profile.score,
        signals: profile.signals as unknown as object,
        updatedAt: new Date(profile.updatedAt),
      },
      update: {
        score: profile.score,
        signals: profile.signals as unknown as object,
        updatedAt: new Date(profile.updatedAt),
      },
    });
    return toLoneliness(l);
  }
}
