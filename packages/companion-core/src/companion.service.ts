// ---------------------------------------------------------------------------
// companion-core — CompanionService
// Manages companion profiles, rates, availability, reviews, discovery, safety.
// Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  CompanionProfile,
  CompanionRate,
  CompanionAvailabilitySlot,
  CompanionReview,
  CompanionStorePort,
  CreateCompanionInput,
  UpdateCompanionInput,
  SetRatesInput,
  LeaveReviewInput,
  BlockCompanionInput,
  ReportCompanionInput,
  CompanionDiscoveryFilter,
} from './types';
import {
  buildCompanionProfileCreated,
  buildCompanionVerified,
  buildCompanionSuspended,
  buildCompanionBlocked,
  buildCompanionReported,
} from './events';

export class CompanionService {
  constructor(
    private readonly store: CompanionStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async createProfile(input: CreateCompanionInput): Promise<CompanionProfile> {
    const now = new Date().toISOString();

    const existing = await this.store.findByUserId(input.userId);
    if (existing) throw new Error('Companion profile already exists for this user.');

    const profile = await this.store.create({
      userId: input.userId,
      displayName: input.displayName,
      bio: input.bio,
      nationality: input.nationality,
      languages: input.languages,
      timezone: input.timezone,
      heightCm: input.heightCm,
      hobbies: input.hobbies ?? [],
      interests: input.interests ?? [],
      sessionTypes: input.sessionTypes,
      activities: input.activities,
      verificationStatus: 'UNVERIFIED',
      verificationBadge: false,
      ageVerified: false,
      introImageUrls: [],
      status: 'INACTIVE',
      isAvailableNow: false,
      averageRating: 0,
      reviewCount: 0,
      totalSessionMinutes: 0,
    });

    void this.eventBus?.publish(buildCompanionProfileCreated({
      companionId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      createdAt: now,
    }));

    return profile;
  }

  async getProfile(companionId: string): Promise<CompanionProfile | null> {
    return this.store.findById(companionId);
  }

  async getProfileByUserId(userId: string): Promise<CompanionProfile | null> {
    return this.store.findByUserId(userId);
  }

  async updateProfile(input: UpdateCompanionInput): Promise<CompanionProfile> {
    const existing = await this.store.findById(input.companionId);
    if (!existing) throw new Error(`CompanionProfile not found: ${input.companionId}`);

    return this.store.update(input.companionId, {
      bio: input.bio ?? existing.bio,
      languages: input.languages ?? existing.languages,
      hobbies: input.hobbies ?? existing.hobbies,
      interests: input.interests ?? existing.interests,
      heightCm: input.heightCm ?? existing.heightCm,
      sessionTypes: input.sessionTypes ?? existing.sessionTypes,
      activities: input.activities ?? existing.activities,
      introVideoUrl: input.introVideoUrl ?? existing.introVideoUrl,
    });
  }

  async markVerified(
    companionId: string,
    verificationType: 'IDENTITY' | 'AGE' | 'BOTH',
  ): Promise<CompanionProfile> {
    const now = new Date().toISOString();
    const updated = await this.store.update(companionId, {
      verificationStatus: 'VERIFIED',
      verificationBadge: true,
      ageVerified: verificationType === 'AGE' || verificationType === 'BOTH',
      status: 'ACTIVE',
    });

    void this.eventBus?.publish(buildCompanionVerified({
      companionId,
      verificationType,
      verifiedAt: now,
    }));

    return updated;
  }

  async setAvailableNow(companionId: string, available: boolean): Promise<CompanionProfile> {
    return this.store.update(companionId, { isAvailableNow: available });
  }

  async setRates(input: SetRatesInput): Promise<CompanionRate[]> {
    const results: CompanionRate[] = [];
    for (const rate of input.rates) {
      const saved = await this.store.upsertRate({
        companionId: input.companionId,
        sessionType: rate.sessionType,
        durationMinutes: rate.durationMinutes,
        coinCost: rate.coinCost,
        maxParticipants: rate.maxParticipants,
        isEnabled: true,
      });
      results.push(saved);
    }
    return results;
  }

  async getRates(companionId: string): Promise<CompanionRate[]> {
    return this.store.getRates(companionId);
  }

  async setAvailabilitySlots(
    companionId: string,
    slots: Array<Omit<CompanionAvailabilitySlot, 'id' | 'companionId'>>,
  ): Promise<CompanionAvailabilitySlot[]> {
    return Promise.all(
      slots.map(slot => this.store.upsertAvailabilitySlot({ ...slot, companionId })),
    );
  }

  async discover(filter: CompanionDiscoveryFilter): Promise<CompanionProfile[]> {
    return this.store.discover(filter);
  }

  async leaveReview(input: LeaveReviewInput): Promise<CompanionReview> {
    const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
    const review = await this.store.createReview({
      companionId: input.companionId,
      reviewerId: input.reviewerId,
      sessionId: input.sessionId,
      rating,
      comment: input.comment,
      isHidden: false,
      createdAt: new Date().toISOString(),
    });

    // Recalculate average rating
    const allReviews = await this.store.getReviews(input.companionId);
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await this.store.update(input.companionId, {
      averageRating: Math.round(avg * 10) / 10,
      reviewCount: allReviews.length,
    });

    return review;
  }

  async getReviews(companionId: string, limit = 20): Promise<CompanionReview[]> {
    return this.store.getReviews(companionId, limit);
  }

  async suspend(companionId: string, reason: string, expiresAt?: string): Promise<CompanionProfile> {
    const now = new Date().toISOString();
    const updated = await this.store.update(companionId, {
      status: 'SUSPENDED',
      isAvailableNow: false,
    });

    void this.eventBus?.publish(buildCompanionSuspended({
      companionId,
      reason,
      suspendedAt: now,
      expiresAt,
    }));

    return updated;
  }

  async blockCompanion(input: BlockCompanionInput): Promise<void> {
    await this.store.createBlock({
      blockerId: input.blockerId,
      blockedId: input.blockedId,
      blockedAt: new Date().toISOString(),
    });

    void this.eventBus?.publish(buildCompanionBlocked({
      blockerId: input.blockerId,
      blockedId: input.blockedId,
      blockedAt: new Date().toISOString(),
    }));
  }

  async reportCompanion(input: ReportCompanionInput): Promise<void> {
    await this.store.createReport({
      reporterId: input.reporterId,
      reportedId: input.reportedId,
      sessionId: input.sessionId,
      reason: input.reason,
      status: 'PENDING',
      reportedAt: new Date().toISOString(),
    });

    void this.eventBus?.publish(buildCompanionReported({
      reporterId: input.reporterId,
      reportedId: input.reportedId,
      sessionId: input.sessionId,
      reason: input.reason,
      reportedAt: new Date().toISOString(),
    }));
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return this.store.isBlocked(blockerId, blockedId);
  }
}
