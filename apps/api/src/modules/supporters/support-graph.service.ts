// ---------------------------------------------------------------------------
// SupportGraphService — manages SupportRelationship lifecycle.
// Created automatically on first gift; tracks tap count, coins gifted,
// patron level, streaks, and anniversary milestones.
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { computePatronLevel } from './patron-level';
import {
  buildStreakAchievedEvent,
  buildAnniversaryEvent,
} from '@starria/support-core';

// A streak continues if the gap between consecutive gifts is ≤ 25 hours.
// The extra hour absorbs small clock drift and timezone edge cases.
const STREAK_WINDOW_MS = 25 * 60 * 60 * 1000;

// Streak milestones (days) that earn a badge and emit an event.
const STREAK_MILESTONES = [7, 30, 100, 365] as const;

// Anniversary milestones (whole years since relationship.startedAt).
const ANNIVERSARY_YEARS = [1, 2, 3, 5, 10] as const;

interface GiftContext {
  senderUserId: string;
  recipientUserId: string;
  coinsGifted: number;
  fiatMinorUnits?: number;
}

@Injectable()
export class SupportGraphService {
  private readonly logger = new Logger(SupportGraphService.name);

  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async handleGift(ctx: GiftContext): Promise<void> {
    const [supporterProfile, starProfile] = await Promise.all([
      this.db.supporterProfile.findUnique({ where: { userId: ctx.senderUserId } }),
      this.db.starProfile.findUnique({ where: { userId: ctx.recipientUserId }, select: { id: true } }),
    ]);

    if (!supporterProfile || !starProfile) {
      this.logger.warn(
        `SupportGraph.handleGift: missing profile — supporter=${!!supporterProfile} star=${!!starProfile}`,
      );
      return;
    }

    const existing = await this.db.supportRelationship.findUnique({
      where: {
        supporterProfileId_starProfileId: {
          supporterProfileId: supporterProfile.id,
          starProfileId: starProfile.id,
        },
      },
      include: { streak: true },
    });

    const isFirstGift = !existing;

    const relationship = await this.db.supportRelationship.upsert({
      where: {
        supporterProfileId_starProfileId: {
          supporterProfileId: supporterProfile.id,
          starProfileId: starProfile.id,
        },
      },
      create: {
        supporterProfileId: supporterProfile.id,
        starProfileId: starProfile.id,
        status: 'ACTIVE',
        totalCoinsGifted: ctx.coinsGifted,
        totalFiatGifted: ctx.fiatMinorUnits ?? 0,
        tapCount: 1,
        milestoneLevel: 0,
      },
      update: {
        totalCoinsGifted: { increment: ctx.coinsGifted },
        totalFiatGifted: { increment: ctx.fiatMinorUnits ?? 0 },
        tapCount: { increment: 1 },
        status: 'ACTIVE',
      },
      include: { streak: true },
    });

    const now = new Date();

    // Update streak record
    const updatedStreak = await this.updateStreak(relationship, existing?.streak ?? null, now);

    // Evaluate all milestone types in one pass
    await this.evaluateMilestones(relationship, updatedStreak, isFirstGift, now);
  }

  // ── Streak ──────────────────────────────────────────────────────────────────

  private async updateStreak(
    rel: { id: string },
    existingStreak: { id: string; currentStreakDays: number; longestStreakDays: number; lastGiftAt: Date; streakStartedAt: Date } | null,
    now: Date,
  ): Promise<{ currentStreakDays: number; longestStreakDays: number; streakStartedAt: Date }> {
    if (!existingStreak) {
      // First gift — create streak record
      const streak = await this.db.supportStreak.create({
        data: {
          supportRelationshipId: rel.id,
          currentStreakDays: 1,
          longestStreakDays: 1,
          lastGiftAt: now,
          streakStartedAt: now,
        },
      });
      return { currentStreakDays: 1, longestStreakDays: 1, streakStartedAt: streak.streakStartedAt };
    }

    const gapMs = now.getTime() - existingStreak.lastGiftAt.getTime();
    const streakContinues = gapMs <= STREAK_WINDOW_MS;

    let newCurrent: number;
    let newStreakStartedAt: Date;

    if (streakContinues) {
      // Only increment once per calendar day — ignore same-day repeat gifts
      const sameDay =
        now.getUTCFullYear() === existingStreak.lastGiftAt.getUTCFullYear() &&
        now.getUTCMonth()    === existingStreak.lastGiftAt.getUTCMonth() &&
        now.getUTCDate()     === existingStreak.lastGiftAt.getUTCDate();

      newCurrent = sameDay ? existingStreak.currentStreakDays : existingStreak.currentStreakDays + 1;
      newStreakStartedAt = existingStreak.streakStartedAt;
    } else {
      // Streak broken — reset to 1
      newCurrent = 1;
      newStreakStartedAt = now;
    }

    const newLongest = Math.max(existingStreak.longestStreakDays, newCurrent);

    await this.db.supportStreak.update({
      where: { id: existingStreak.id },
      data: {
        currentStreakDays: newCurrent,
        longestStreakDays: newLongest,
        lastGiftAt: now,
        streakStartedAt: newStreakStartedAt,
      },
    });

    return { currentStreakDays: newCurrent, longestStreakDays: newLongest, streakStartedAt: newStreakStartedAt };
  }

  // ── Milestones ───────────────────────────────────────────────────────────────

  private async evaluateMilestones(
    rel: {
      id: string;
      supporterProfileId: string;
      starProfileId: string;
      totalCoinsGifted: number;
      tapCount: number;
      milestoneLevel: number;
      startedAt: Date;
    },
    streak: { currentStreakDays: number; longestStreakDays: number; streakStartedAt: Date },
    isFirstGift: boolean,
    now: Date,
  ): Promise<void> {
    const toCreate: Array<{ type: string; thresholdValue: number }> = [];

    // ── FIRST_TAP ──────────────────────────────────────────────────────────────
    if (isFirstGift) {
      const exists = await this.db.supportMilestone.findFirst({
        where: { supportRelationshipId: rel.id, type: 'FIRST_TAP' },
      });
      if (!exists) toCreate.push({ type: 'FIRST_TAP', thresholdValue: 1 });
    }

    // ── TAP_COUNT ─────────────────────────────────────────────────────────────
    for (const threshold of [10, 50, 100, 500]) {
      if (rel.tapCount >= threshold) {
        const exists = await this.db.supportMilestone.findFirst({
          where: { supportRelationshipId: rel.id, type: 'TAP_COUNT', thresholdValue: threshold },
        });
        if (!exists) toCreate.push({ type: 'TAP_COUNT', thresholdValue: threshold });
      }
    }

    // ── COIN_THRESHOLD ────────────────────────────────────────────────────────
    for (const threshold of [500, 2000, 10000, 50000]) {
      if (rel.totalCoinsGifted >= threshold) {
        const exists = await this.db.supportMilestone.findFirst({
          where: { supportRelationshipId: rel.id, type: 'COIN_THRESHOLD', thresholdValue: threshold },
        });
        if (!exists) toCreate.push({ type: 'COIN_THRESHOLD', thresholdValue: threshold });
      }
    }

    // ── STREAK ────────────────────────────────────────────────────────────────
    for (const days of STREAK_MILESTONES) {
      if (streak.currentStreakDays >= days) {
        const exists = await this.db.supportMilestone.findFirst({
          where: { supportRelationshipId: rel.id, type: 'STREAK', thresholdValue: days },
        });
        if (!exists) {
          toCreate.push({ type: 'STREAK', thresholdValue: days });
        }
      }
    }

    // ── ANNIVERSARY ───────────────────────────────────────────────────────────
    const ageMs = now.getTime() - rel.startedAt.getTime();
    const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
    for (const years of ANNIVERSARY_YEARS) {
      if (ageYears >= years) {
        const exists = await this.db.supportMilestone.findFirst({
          where: { supportRelationshipId: rel.id, type: 'ANNIVERSARY', thresholdValue: years },
        });
        if (!exists) toCreate.push({ type: 'ANNIVERSARY', thresholdValue: years });
      }
    }

    // ── Persist + emit ────────────────────────────────────────────────────────
    if (toCreate.length === 0) return;

    await this.db.supportMilestone.createMany({
      data: toCreate.map(m => ({
        id: randomUUID(),
        supportRelationshipId: rel.id,
        type: m.type as 'FIRST_TAP' | 'COIN_THRESHOLD' | 'TAP_COUNT' | 'STREAK' | 'ANNIVERSARY',
        thresholdValue: m.thresholdValue,
      })),
      skipDuplicates: true,
    });

    for (const m of toCreate) {
      if (m.type === 'STREAK') {
        void this.eventBus.publish(buildStreakAchievedEvent({
          supporterProfileId: rel.supporterProfileId,
          starProfileId: rel.starProfileId,
          relationshipId: rel.id,
          streakDays: m.thresholdValue,
          longestStreakDays: streak.longestStreakDays,
          streakStartedAt: streak.streakStartedAt.toISOString(),
        }));
      } else if (m.type === 'ANNIVERSARY') {
        const years = m.thresholdValue;
        void this.eventBus.publish(buildAnniversaryEvent({
          supporterProfileId: rel.supporterProfileId,
          starProfileId: rel.starProfileId,
          relationshipId: rel.id,
          years,
          relationshipStartedAt: rel.startedAt.toISOString(),
          message: `You've been a supporter for ${years} ${years === 1 ? 'year' : 'years'}! 🎉`,
        }));
      } else {
        void this.eventBus.publish({
          id: randomUUID(),
          type: 'starria.support.milestone_reached',
          aggregateId: rel.id,
          aggregateType: 'SupportRelationship',
          occurredAt: now.toISOString(),
          version: 1,
          payload: {
            relationshipId: rel.id,
            supporterProfileId: rel.supporterProfileId,
            starProfileId: rel.starProfileId,
            milestoneType: m.type,
            thresholdValue: m.thresholdValue,
            patronLevel: computePatronLevel(rel.totalCoinsGifted),
          },
        });
      }
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getRelationship(supporterProfileId: string, starProfileId: string) {
    const rel = await this.db.supportRelationship.findUnique({
      where: { supporterProfileId_starProfileId: { supporterProfileId, starProfileId } },
      include: {
        milestones: { orderBy: { achievedAt: 'desc' }, take: 20 },
        streak: true,
      },
    });
    if (!rel) return null;
    return { ...rel, patronLevel: computePatronLevel(rel.totalCoinsGifted) };
  }

  async getTopSupporters(starProfileId: string, limit = 10) {
    const rels = await this.db.supportRelationship.findMany({
      where: { starProfileId, status: 'ACTIVE' },
      orderBy: { totalCoinsGifted: 'desc' },
      take: limit,
      include: { streak: true },
    });
    return rels.map(r => ({ ...r, patronLevel: computePatronLevel(r.totalCoinsGifted) }));
  }
}
