// ---------------------------------------------------------------------------
// patron-core — domain types
// Crown-based patron economy: tiers, relationships, milestones, badges
// ---------------------------------------------------------------------------

import type { PatronTier } from '@starria/domain-events';
export type { PatronTier };

// ── Tier configuration ───────────────────────────────────────────────────────

export interface PatronTierConfig {
  readonly tier: PatronTier;
  readonly label: string;
  readonly badge: string;
  readonly minLifetimeUsdCents: number;   // lifetime platform-wide spend threshold
  readonly dmEligible: boolean;           // can send DM requests to creators
  readonly broadcastEligible: boolean;    // can send global message requests
  readonly roomPresenceBadge: string;     // shown in live rooms / events
  readonly color: string;                 // hex
}

export const PATRON_TIER_CONFIGS: readonly PatronTierConfig[] = [
  {
    tier: 'VISITOR',
    label: 'Visitor',
    badge: '',
    minLifetimeUsdCents: 0,
    dmEligible: false,
    broadcastEligible: false,
    roomPresenceBadge: '',
    color: '#9E9E9E',
  },
  {
    tier: 'SUPPORTER',
    label: 'Supporter',
    badge: '⭐',
    minLifetimeUsdCents: 10_000,           // $100
    dmEligible: false,                      // spend alone ≠ DM access
    broadcastEligible: false,
    roomPresenceBadge: '⭐',
    color: '#64B5F6',
  },
  {
    tier: 'PATRON',
    label: 'Patron',
    badge: '💜',
    minLifetimeUsdCents: 100_000,           // $1,000
    dmEligible: true,
    broadcastEligible: false,
    roomPresenceBadge: '💜',
    color: '#AB47BC',
  },
  {
    tier: 'BENEFACTOR',
    label: 'Benefactor',
    badge: '⭐',
    minLifetimeUsdCents: 500_000,           // $5,000
    dmEligible: true,
    broadcastEligible: false,
    roomPresenceBadge: '⭐',
    color: '#26C6DA',
  },
  {
    tier: 'LEGEND',
    label: 'Legend',
    badge: '💎',
    minLifetimeUsdCents: 2_000_000,         // $20,000
    dmEligible: true,
    broadcastEligible: true,
    roomPresenceBadge: '💎',
    color: '#FFD700',
  },
  {
    tier: 'OG',
    label: 'OG',
    badge: '👑',
    minLifetimeUsdCents: 5_000_000,         // $50,000
    dmEligible: true,
    broadcastEligible: true,
    roomPresenceBadge: '👑',
    color: '#FF6F00',
  },
];

export function resolvePatronTier(lifetimeUsdCents: number): PatronTierConfig {
  const sorted = [...PATRON_TIER_CONFIGS].sort((a, b) => b.minLifetimeUsdCents - a.minLifetimeUsdCents);
  return sorted.find(t => lifetimeUsdCents >= t.minLifetimeUsdCents) ?? PATRON_TIER_CONFIGS[0];
}

export function getPatronTierConfig(tier: PatronTier): PatronTierConfig {
  return PATRON_TIER_CONFIGS.find(t => t.tier === tier) ?? PATRON_TIER_CONFIGS[0];
}

// ── PatronProfile ────────────────────────────────────────────────────────────

export interface PatronProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly tier: PatronTier;
  /** Total lifetime spend across the entire platform in USD cents */
  readonly lifetimeUsdCents: number;
  /** Total lifetime spend in coins (all creators) */
  readonly lifetimeCoins: number;
  /** Number of distinct creators supported */
  readonly supportDiversity: number;
  /** Days since account creation */
  readonly accountAgeDays: number;
  /** Active moderation strikes */
  readonly moderationStrikes: number;
  readonly isPublic: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── PatronHistory ────────────────────────────────────────────────────────────

export interface PatronHistory {
  readonly id: string;
  readonly patronId: string;
  readonly starId: string;
  readonly action: 'GIFT' | 'TICKET' | 'SUBSCRIPTION' | 'TIP';
  readonly coinsAmount: number;
  readonly usdCents: number;
  readonly recordedAt: string;
}

// ── CreatorRelationship ──────────────────────────────────────────────────────

export interface CreatorRelationship {
  readonly id: string;
  readonly patronId: string;
  readonly starId: string;
  /** Spend specific to this creator, in USD cents */
  readonly creatorLifetimeUsdCents: number;
  readonly creatorLifetimeCoins: number;
  /** Creator-scoped patron tier (may be higher than global if concentrated spend) */
  readonly creatorTier: PatronTier;
  readonly isMuted: boolean;
  readonly rank?: number;           // rank within star's supporter list
  readonly firstSupportedAt: string;
  readonly lastSupportedAt: string;
  readonly updatedAt: string;
}

// ── PatronAchievement ────────────────────────────────────────────────────────

export type PatronAchievementType =
  | 'FIRST_SUPPORT'
  | 'HUNDRED_DOLLAR_CLUB'
  | 'THOUSAND_DOLLAR_PATRON'
  | 'FIVE_K_BENEFACTOR'
  | 'OG_STATUS'
  | 'MULTI_CREATOR'        // supported 5+ distinct creators
  | 'LOYALTY_30_DAYS'
  | 'LOYALTY_90_DAYS'
  | 'LOYALTY_1_YEAR'
  | 'TOP_SUPPORTER';

export interface PatronAchievement {
  readonly id: string;
  readonly patronId: string;
  readonly achievementType: PatronAchievementType;
  readonly title: string;
  readonly description: string;
  readonly badge: string;
  readonly unlockedAt: string;
}

// ── PatronMilestone ──────────────────────────────────────────────────────────

export interface PatronMilestone {
  readonly id: string;
  readonly patronId: string;
  readonly starId: string;
  readonly milestoneType: 'FIRST_SUPPORT' | 'SPEND_10' | 'SPEND_50' | 'SPEND_100' | 'SPEND_500' | 'SPEND_1000' | 'TOP_3';
  readonly thresholdUsdCents: number;
  readonly reachedAt: string;
}

// ── Service I/O ──────────────────────────────────────────────────────────────

export interface CreatePatronProfileInput {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly accountAgeDays?: number;
}

export interface RecordSpendInput {
  readonly patronId: string;
  readonly starId: string;
  readonly coinsAmount: number;
  readonly usdCents: number;
  readonly action: PatronHistory['action'];
}

export interface RecordSpendResult {
  readonly profile: PatronProfile;
  readonly relationship: CreatorRelationship;
  readonly tierChanged: boolean;
  readonly previousTier: PatronTier;
  readonly newTier: PatronTier;
  readonly newAchievements: PatronAchievement[];
  readonly newMilestones: PatronMilestone[];
}

// ── Persistence port ─────────────────────────────────────────────────────────

export interface PatronStorePort {
  findById(id: string): Promise<PatronProfile | null>;
  findByUserId(userId: string): Promise<PatronProfile | null>;
  create(input: Omit<PatronProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronProfile>;
  update(id: string, patch: Partial<PatronProfile>): Promise<PatronProfile>;

  findRelationship(patronId: string, starId: string): Promise<CreatorRelationship | null>;
  findRelationshipsByPatron(patronId: string): Promise<CreatorRelationship[]>;
  findRelationshipsByStar(starId: string, limit?: number): Promise<CreatorRelationship[]>;
  upsertRelationship(rel: Omit<CreatorRelationship, 'id' | 'updatedAt'> & { id?: string }): Promise<CreatorRelationship>;

  appendHistory(entry: Omit<PatronHistory, 'id'>): Promise<PatronHistory>;
  getHistory(patronId: string, limit?: number): Promise<PatronHistory[]>;

  appendAchievement(a: Omit<PatronAchievement, 'id'>): Promise<PatronAchievement>;
  getAchievements(patronId: string): Promise<PatronAchievement[]>;
  hasAchievement(patronId: string, type: PatronAchievementType): Promise<boolean>;

  appendMilestone(m: Omit<PatronMilestone, 'id'>): Promise<PatronMilestone>;
  getMilestones(patronId: string, starId?: string): Promise<PatronMilestone[]>;
}
