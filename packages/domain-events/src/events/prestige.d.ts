import type { DomainEvent } from '../event';
export declare const WHITE_STAR_UPDATED = "prestige.white_star.updated";
export declare const WHITE_STAR_TIER_CHANGED = "prestige.white_star.tier_changed";
export declare const WHITE_STAR_DECAY_APPLIED = "prestige.white_star.decay_applied";
export declare const WHITE_STAR_SEASON_RESET = "prestige.white_star.season_reset";
export interface WhiteStarUpdatedPayload {
    readonly starId: string;
    readonly score: number;
    readonly tier: string;
    readonly halfStars: number;
    readonly factors: {
        supporters: number;
        giftVolume: number;
        watchTime: number;
        retention: number;
        tapVelocity: number;
    };
    readonly calculatedAt: string;
}
export interface WhiteStarTierChangedPayload {
    readonly starId: string;
    readonly previousTier: string;
    readonly newTier: string;
    readonly previousHalfStars: number;
    readonly newHalfStars: number;
    readonly changedAt: string;
}
export interface WhiteStarDecayAppliedPayload {
    readonly starId: string;
    readonly decayAmount: number;
    readonly scoreBefore: number;
    readonly scoreAfter: number;
    readonly reason: string;
    readonly appliedAt: string;
}
export interface WhiteStarSeasonResetPayload {
    readonly starId: string;
    readonly seasonId: string;
    readonly finalScore: number;
    readonly finalTier: string;
    readonly resetAt: string;
}
export type WhiteStarUpdatedEvent = DomainEvent<WhiteStarUpdatedPayload>;
export type WhiteStarTierChangedEvent = DomainEvent<WhiteStarTierChangedPayload>;
export type WhiteStarDecayAppliedEvent = DomainEvent<WhiteStarDecayAppliedPayload>;
export type WhiteStarSeasonResetEvent = DomainEvent<WhiteStarSeasonResetPayload>;
export declare const GOLD_STAR_UPDATED = "prestige.gold_star.updated";
export declare const LEGACY_ACHIEVEMENT_UNLOCKED = "prestige.gold_star.achievement_unlocked";
export interface GoldStarUpdatedPayload {
    readonly starId: string;
    readonly score: number;
    readonly tier: string;
    readonly updatedAt: string;
}
export interface LegacyAchievementUnlockedPayload {
    readonly starId: string;
    readonly achievementId: string;
    readonly achievementType: string;
    readonly title: string;
    readonly unlockedAt: string;
}
export type GoldStarUpdatedEvent = DomainEvent<GoldStarUpdatedPayload>;
export type LegacyAchievementUnlockedEvent = DomainEvent<LegacyAchievementUnlockedPayload>;
export declare const UPLOAD_LIMIT_REACHED = "prestige.upload.limit_reached";
export interface UploadLimitReachedPayload {
    readonly starId: string;
    readonly weeklyLimit: number;
    readonly usedCount: number;
    readonly resetAt: string;
}
export type UploadLimitReachedEvent = DomainEvent<UploadLimitReachedPayload>;
