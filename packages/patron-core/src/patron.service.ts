// ---------------------------------------------------------------------------
// patron-core — PatronService
// Handles profile creation, spend recording, tier evaluation, achievements,
// milestones, and creator relationships. Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  PatronProfile,
  PatronHistory,
  CreatorRelationship,
  PatronAchievement,
  PatronMilestone,
  PatronAchievementType,
  PatronStorePort,
  CreatePatronProfileInput,
  RecordSpendInput,
  RecordSpendResult,
} from './types';
import { resolvePatronTier, getPatronTierConfig } from './types';
import {
  buildPatronProfileCreated,
  buildPatronTierUpgraded,
  buildPatronAchievementUnlocked,
  buildPatronMilestoneReached,
  buildPatronRelationshipCreated,
  buildPatronSpendRecorded,
} from './events';
import type { PatronTier } from './types';

// Milestone definitions keyed by creator-scoped spend in USD cents
const MILESTONE_DEFS: Array<{
  type: PatronMilestone['milestoneType'];
  thresholdUsdCents: number;
}> = [
  { type: 'SPEND_10',  thresholdUsdCents: 1_000 },
  { type: 'SPEND_50',  thresholdUsdCents: 5_000 },
  { type: 'SPEND_100', thresholdUsdCents: 10_000 },
  { type: 'SPEND_500', thresholdUsdCents: 50_000 },
  { type: 'SPEND_1000', thresholdUsdCents: 100_000 },
];

// Achievement rules evaluated after every spend
interface AchievementRule {
  type: PatronAchievementType;
  title: string;
  description: string;
  badge: string;
  check(profile: PatronProfile, rel: CreatorRelationship): boolean;
}

const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    type: 'FIRST_SUPPORT',
    title: 'First Support',
    description: 'Made your first contribution to a creator.',
    badge: '🌟',
    check: (p) => p.lifetimeUsdCents > 0,
  },
  {
    type: 'HUNDRED_DOLLAR_CLUB',
    title: '$100 Club',
    description: 'Spent $100+ lifetime across the platform.',
    badge: '💯',
    check: (p) => p.lifetimeUsdCents >= 10_000,
  },
  {
    type: 'THOUSAND_DOLLAR_PATRON',
    title: 'Thousand-Dollar Patron',
    description: 'Spent $1,000+ lifetime.',
    badge: '💜',
    check: (p) => p.lifetimeUsdCents >= 100_000,
  },
  {
    type: 'FIVE_K_BENEFACTOR',
    title: 'Five-K Benefactor',
    description: 'Spent $5,000+ lifetime.',
    badge: '⭐',
    check: (p) => p.lifetimeUsdCents >= 500_000,
  },
  {
    type: 'OG_STATUS',
    title: 'OG',
    description: 'Spent $50,000+ lifetime. True original.',
    badge: '👑',
    check: (p) => p.lifetimeUsdCents >= 5_000_000,
  },
  {
    type: 'MULTI_CREATOR',
    title: 'Multi-Creator Supporter',
    description: 'Supported 5 or more distinct creators.',
    badge: '🌐',
    check: (p) => p.supportDiversity >= 5,
  },
];

export class PatronService {
  constructor(
    private readonly store: PatronStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async createProfile(input: CreatePatronProfileInput): Promise<PatronProfile> {
    const now = new Date().toISOString();
    const profile = await this.store.create({
      userId: input.userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      tier: 'VISITOR',
      lifetimeUsdCents: 0,
      lifetimeCoins: 0,
      supportDiversity: 0,
      accountAgeDays: input.accountAgeDays ?? 0,
      moderationStrikes: 0,
      isPublic: true,
    });

    void this.eventBus?.publish(buildPatronProfileCreated({
      patronId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      createdAt: now,
    }));

    return profile;
  }

  async getProfile(patronId: string): Promise<PatronProfile | null> {
    return this.store.findById(patronId);
  }

  async getProfileByUserId(userId: string): Promise<PatronProfile | null> {
    return this.store.findByUserId(userId);
  }

  async getRelationships(patronId: string): Promise<CreatorRelationship[]> {
    return this.store.findRelationshipsByPatron(patronId);
  }

  async getAchievements(patronId: string): Promise<PatronAchievement[]> {
    return this.store.getAchievements(patronId);
  }

  async getMilestones(patronId: string, starId?: string): Promise<PatronMilestone[]> {
    return this.store.getMilestones(patronId, starId);
  }

  async recordSpend(input: RecordSpendInput): Promise<RecordSpendResult> {
    const now = new Date().toISOString();

    // ── Load patron profile ──────────────────────────────────────────────────
    let profile = await this.store.findById(input.patronId);
    if (!profile) throw new Error(`PatronProfile not found: ${input.patronId}`);

    // ── Append history entry ─────────────────────────────────────────────────
    await this.store.appendHistory({
      patronId: input.patronId,
      starId: input.starId,
      action: input.action,
      coinsAmount: input.coinsAmount,
      usdCents: input.usdCents,
      recordedAt: now,
    });

    // ── Update global patron profile ─────────────────────────────────────────
    const previousTier = profile.tier;
    const newLifetimeUsdCents = profile.lifetimeUsdCents + input.usdCents;
    const newLifetimeCoins    = profile.lifetimeCoins + input.coinsAmount;

    // Determine if this is a new creator relationship
    const existingRel = await this.store.findRelationship(input.patronId, input.starId);
    const newSupportDiversity = existingRel
      ? profile.supportDiversity
      : profile.supportDiversity + 1;

    const newTierConfig = resolvePatronTier(newLifetimeUsdCents);
    const newTier = newTierConfig.tier;

    profile = await this.store.update(input.patronId, {
      lifetimeUsdCents: newLifetimeUsdCents,
      lifetimeCoins: newLifetimeCoins,
      supportDiversity: newSupportDiversity,
      tier: newTier,
    });

    // ── Upsert creator relationship ──────────────────────────────────────────
    const creatorLifetimeUsdCents = (existingRel?.creatorLifetimeUsdCents ?? 0) + input.usdCents;
    const creatorLifetimeCoins    = (existingRel?.creatorLifetimeCoins ?? 0) + input.coinsAmount;
    const creatorTierConfig = resolvePatronTier(creatorLifetimeUsdCents);

    const isNewRelationship = !existingRel;
    const relationship = await this.store.upsertRelationship({
      id: existingRel?.id,
      patronId: input.patronId,
      starId: input.starId,
      creatorLifetimeUsdCents,
      creatorLifetimeCoins,
      creatorTier: creatorTierConfig.tier,
      isMuted: existingRel?.isMuted ?? false,
      firstSupportedAt: existingRel?.firstSupportedAt ?? now,
      lastSupportedAt: now,
    });

    // ── Emit spend recorded ──────────────────────────────────────────────────
    void this.eventBus?.publish(buildPatronSpendRecorded({
      patronId: input.patronId,
      starId: input.starId,
      coinsSpent: input.coinsAmount,
      fiatUsdCents: input.usdCents,
      lifetimeUsdCents: newLifetimeUsdCents,
      creatorLifetimeUsdCents,
      recordedAt: now,
    }));

    // ── Emit relationship created (first time only) ──────────────────────────
    if (isNewRelationship) {
      void this.eventBus?.publish(buildPatronRelationshipCreated({
        patronId: input.patronId,
        starId: input.starId,
        initialTier: creatorTierConfig.tier,
        createdAt: now,
      }));
    }

    // ── Tier change ──────────────────────────────────────────────────────────
    const tierChanged = newTier !== previousTier;
    if (tierChanged) {
      void this.eventBus?.publish(buildPatronTierUpgraded({
        patronId: input.patronId,
        userId: profile.userId,
        previousTier,
        newTier,
        lifetimeSpendUsd: newLifetimeUsdCents / 100,
        upgradedAt: now,
      }));
    }

    // ── Achievements ─────────────────────────────────────────────────────────
    const newAchievements: PatronAchievement[] = [];
    for (const rule of ACHIEVEMENT_RULES) {
      const alreadyHas = await this.store.hasAchievement(input.patronId, rule.type);
      if (!alreadyHas && rule.check(profile, relationship)) {
        const achievementId = randomUUID();
        const achievement = await this.store.appendAchievement({
          patronId: input.patronId,
          achievementType: rule.type,
          title: rule.title,
          description: rule.description,
          badge: rule.badge,
          unlockedAt: now,
        });
        newAchievements.push(achievement);

        void this.eventBus?.publish(buildPatronAchievementUnlocked({
          patronId: input.patronId,
          achievementId: achievement.id,
          achievementType: rule.type,
          title: rule.title,
          unlockedAt: now,
        }));
      }
    }

    // ── Milestones (per creator) ──────────────────────────────────────────────
    const newMilestones: PatronMilestone[] = [];
    const existingMilestones = await this.store.getMilestones(input.patronId, input.starId);
    const existingMilestoneTypes = new Set(existingMilestones.map(m => m.milestoneType));

    // Check first-support milestone
    if (isNewRelationship && !existingMilestoneTypes.has('FIRST_SUPPORT')) {
      const milestone = await this.store.appendMilestone({
        patronId: input.patronId,
        starId: input.starId,
        milestoneType: 'FIRST_SUPPORT',
        thresholdUsdCents: 0,
        reachedAt: now,
      });
      newMilestones.push(milestone);

      void this.eventBus?.publish(buildPatronMilestoneReached({
        patronId: input.patronId,
        starId: input.starId,
        milestoneId: milestone.id,
        milestoneType: 'FIRST_SUPPORT',
        totalSpendUsd: creatorLifetimeUsdCents / 100,
        reachedAt: now,
      }));
    }

    // Check spend milestones
    for (const def of MILESTONE_DEFS) {
      if (
        creatorLifetimeUsdCents >= def.thresholdUsdCents &&
        !existingMilestoneTypes.has(def.type)
      ) {
        const milestone = await this.store.appendMilestone({
          patronId: input.patronId,
          starId: input.starId,
          milestoneType: def.type,
          thresholdUsdCents: def.thresholdUsdCents,
          reachedAt: now,
        });
        newMilestones.push(milestone);

        void this.eventBus?.publish(buildPatronMilestoneReached({
          patronId: input.patronId,
          starId: input.starId,
          milestoneId: milestone.id,
          milestoneType: def.type,
          totalSpendUsd: creatorLifetimeUsdCents / 100,
          reachedAt: now,
        }));
      }
    }

    return {
      profile,
      relationship,
      tierChanged,
      previousTier,
      newTier,
      newAchievements,
      newMilestones,
    };
  }
}
