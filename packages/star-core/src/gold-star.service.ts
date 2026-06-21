// ---------------------------------------------------------------------------
// star-core — GoldStarService
// Slower-moving prestige; account age, retention, reach, moderation history.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type { GoldStarStorePort } from './prestige-ports';
import {
  calculateGoldStarScore,
  resolveGoldStarTier,
  type GoldStarProfile,
  type LegacyAchievement,
} from './prestige-types';
import {
  buildGoldStarUpdatedEvent,
  buildLegacyAchievementUnlockedEvent,
} from './prestige-events';

const GOLD_DECAY_AMOUNT_PER_INACTIVE_MONTH = 5; // very slow decay

export interface GoldStarCalculateInput {
  readonly accountAgeMonths: number;
  readonly supporterRetentionPct: number;
  readonly countryReach: number;
  readonly moderationIncidents: number;
  readonly isVerified: boolean;
}

export class GoldStarService {
  constructor(
    private readonly store: GoldStarStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async recalculate(starId: string, input: GoldStarCalculateInput): Promise<GoldStarProfile> {
    const now = new Date().toISOString();
    const score = calculateGoldStarScore(input);
    const tier = resolveGoldStarTier(score);
    const existing = await this.store.findByStarId(starId);

    const profile = await this.store.upsert({
      id: existing?.id,
      starId,
      score,
      tierLabel: tier.label,
      accountAgeMonths: input.accountAgeMonths,
      supporterRetentionPct: input.supporterRetentionPct,
      countryReach: input.countryReach,
      moderationIncidents: input.moderationIncidents,
      isVerified: input.isVerified,
      lastCalculatedAt: now,
    });

    void this.eventBus?.publish(buildGoldStarUpdatedEvent({
      starId,
      score,
      tier: tier.label,
      updatedAt: now,
    }));

    return profile;
  }

  async getProfile(starId: string): Promise<GoldStarProfile | null> {
    return this.store.findByStarId(starId);
  }

  async getAchievements(starId: string): Promise<LegacyAchievement[]> {
    return this.store.getAchievements(starId);
  }

  async unlockAchievement(
    starId: string,
    type: LegacyAchievement['achievementType'],
    title: string,
    description: string,
  ): Promise<LegacyAchievement | null> {
    const already = await this.store.hasAchievement(starId, type);
    if (already) return null;

    const now = new Date().toISOString();
    const achievement = await this.store.appendAchievement({
      starId,
      achievementType: type,
      title,
      description,
      unlockedAt: now,
    });

    void this.eventBus?.publish(buildLegacyAchievementUnlockedEvent({
      starId,
      achievementId: achievement.id,
      achievementType: type,
      title,
      unlockedAt: now,
    }));

    return achievement;
  }

  async applySlowDecay(starId: string): Promise<GoldStarProfile> {
    const existing = await this.store.findByStarId(starId);
    if (!existing) throw new Error(`GoldStarProfile not found for star: ${starId}`);
    const newScore = Math.max(0, existing.score - GOLD_DECAY_AMOUNT_PER_INACTIVE_MONTH);
    return this.store.upsert({ ...existing, score: newScore, lastCalculatedAt: new Date().toISOString() });
  }
}
