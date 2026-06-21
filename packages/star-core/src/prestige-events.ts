// ---------------------------------------------------------------------------
// star-core — Sprint 4 Prestige event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  WhiteStarUpdatedEvent,
  WhiteStarTierChangedEvent,
  WhiteStarDecayAppliedEvent,
  WhiteStarSeasonResetEvent,
  GoldStarUpdatedEvent,
  LegacyAchievementUnlockedEvent,
  UploadLimitReachedEvent,
} from '@starria/domain-events';
import {
  WHITE_STAR_UPDATED,
  WHITE_STAR_TIER_CHANGED,
  WHITE_STAR_DECAY_APPLIED,
  WHITE_STAR_SEASON_RESET,
  GOLD_STAR_UPDATED,
  LEGACY_ACHIEVEMENT_UNLOCKED,
  UPLOAD_LIMIT_REACHED,
} from '@starria/domain-events';

export function buildWhiteStarUpdatedEvent(params: {
  starId: string;
  score: number;
  tier: string;
  halfStars: number;
  factors: { supporters: number; giftVolume: number; watchTime: number; retention: number; tapVelocity: number };
  calculatedAt: string;
}): WhiteStarUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: WHITE_STAR_UPDATED,
    aggregateId: params.starId,
    aggregateType: 'WhiteStarProfile',
    payload: params,
  });
}

export function buildWhiteStarTierChangedEvent(params: {
  starId: string;
  previousTier: string;
  newTier: string;
  previousHalfStars: number;
  newHalfStars: number;
  changedAt: string;
}): WhiteStarTierChangedEvent {
  return createEvent({
    id: randomUUID(),
    type: WHITE_STAR_TIER_CHANGED,
    aggregateId: params.starId,
    aggregateType: 'WhiteStarProfile',
    payload: params,
  });
}

export function buildWhiteStarDecayAppliedEvent(params: {
  starId: string;
  decayAmount: number;
  scoreBefore: number;
  scoreAfter: number;
  reason: string;
  appliedAt: string;
}): WhiteStarDecayAppliedEvent {
  return createEvent({
    id: randomUUID(),
    type: WHITE_STAR_DECAY_APPLIED,
    aggregateId: params.starId,
    aggregateType: 'WhiteStarProfile',
    payload: params,
  });
}

export function buildWhiteStarSeasonResetEvent(params: {
  starId: string;
  seasonId: string;
  finalScore: number;
  finalTier: string;
  resetAt: string;
}): WhiteStarSeasonResetEvent {
  return createEvent({
    id: randomUUID(),
    type: WHITE_STAR_SEASON_RESET,
    aggregateId: params.starId,
    aggregateType: 'WhiteStarProfile',
    payload: params,
  });
}

export function buildGoldStarUpdatedEvent(params: {
  starId: string;
  score: number;
  tier: string;
  updatedAt: string;
}): GoldStarUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: GOLD_STAR_UPDATED,
    aggregateId: params.starId,
    aggregateType: 'GoldStarProfile',
    payload: params,
  });
}

export function buildLegacyAchievementUnlockedEvent(params: {
  starId: string;
  achievementId: string;
  achievementType: string;
  title: string;
  unlockedAt: string;
}): LegacyAchievementUnlockedEvent {
  return createEvent({
    id: randomUUID(),
    type: LEGACY_ACHIEVEMENT_UNLOCKED,
    aggregateId: params.starId,
    aggregateType: 'GoldStarProfile',
    payload: params,
  });
}

export function buildUploadLimitReachedEvent(params: {
  starId: string;
  weeklyLimit: number;
  usedCount: number;
  resetAt: string;
}): UploadLimitReachedEvent {
  return createEvent({
    id: randomUUID(),
    type: UPLOAD_LIMIT_REACHED,
    aggregateId: params.starId,
    aggregateType: 'WhiteStarProfile',
    payload: params,
  });
}
