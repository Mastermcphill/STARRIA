// ---------------------------------------------------------------------------
// star-core — WhiteStarService
// Nightly recalculation, history snapshots, decay, seasonal resets.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type { WhiteStarStorePort } from './prestige-ports';
import {
  calculateWhiteStarScore,
  resolveWhiteStarTier,
  type CalculateWhiteStarInput,
  type WhiteStarProfile,
  type WhiteStarHalfStars,
} from './prestige-types';
import {
  buildWhiteStarUpdatedEvent,
  buildWhiteStarTierChangedEvent,
  buildWhiteStarDecayAppliedEvent,
  buildWhiteStarSeasonResetEvent,
} from './prestige-events';

const DECAY_AMOUNT_PER_INACTIVE_WEEK = 20;
const INACTIVITY_DECAY_THRESHOLD_DAYS = 14;

export class WhiteStarService {
  constructor(
    private readonly store: WhiteStarStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Recalculation (called nightly) ───────────────────────────────────────

  async recalculate(
    starId: string,
    input: CalculateWhiteStarInput,
  ): Promise<WhiteStarProfile> {
    const now = new Date().toISOString();
    const { score, factors } = calculateWhiteStarScore(input);
    const tier = resolveWhiteStarTier(score);

    const existing = await this.store.findByStarId(starId);
    const weekResetAt = existing?.weekResetAt ?? this._nextWeekReset();

    const profile = await this.store.upsert({
      id: existing?.id,
      starId,
      score,
      halfStars: tier.halfStars as WhiteStarHalfStars,
      tierLabel: tier.label,
      factors,
      uploadUsedThisWeek: existing?.uploadUsedThisWeek ?? 0,
      weekResetAt,
      lastCalculatedAt: now,
    });

    // Snapshot history
    await this.store.appendHistory({
      starId,
      score,
      halfStars: tier.halfStars as WhiteStarHalfStars,
      tierLabel: tier.label,
      factors,
      recordedAt: now,
    });

    void this.eventBus?.publish(buildWhiteStarUpdatedEvent({
      starId,
      score,
      tier: tier.label,
      halfStars: tier.halfStars,
      factors,
      calculatedAt: now,
    }));

    // Emit tier change event if tier shifted
    if (existing && existing.tierLabel !== tier.label) {
      void this.eventBus?.publish(buildWhiteStarTierChangedEvent({
        starId,
        previousTier: existing.tierLabel,
        newTier: tier.label,
        previousHalfStars: existing.halfStars,
        newHalfStars: tier.halfStars,
        changedAt: now,
      }));
    }

    return profile;
  }

  // ── Decay ─────────────────────────────────────────────────────────────────

  async applyDecay(starId: string, reason: 'INACTIVITY' | 'MODERATION' | 'MANUAL' = 'INACTIVITY'): Promise<WhiteStarProfile> {
    const now = new Date().toISOString();
    const existing = await this.store.findByStarId(starId);
    if (!existing) throw new Error(`WhiteStarProfile not found for star: ${starId}`);

    const decayAmount = DECAY_AMOUNT_PER_INACTIVE_WEEK;
    const scoreAfter = Math.max(0, existing.score - decayAmount);
    const tier = resolveWhiteStarTier(scoreAfter);

    const profile = await this.store.upsert({
      ...existing,
      score: scoreAfter,
      halfStars: tier.halfStars as WhiteStarHalfStars,
      tierLabel: tier.label,
      lastCalculatedAt: now,
    });

    await this.store.appendDecay({
      starId,
      decayAmount,
      scoreBefore: existing.score,
      scoreAfter,
      reason,
      appliedAt: now,
    });

    void this.eventBus?.publish(buildWhiteStarDecayAppliedEvent({
      starId,
      decayAmount,
      scoreBefore: existing.score,
      scoreAfter,
      reason,
      appliedAt: now,
    }));

    return profile;
  }

  // ── Upload tracking ───────────────────────────────────────────────────────

  async getProfile(starId: string): Promise<WhiteStarProfile | null> {
    return this.store.findByStarId(starId);
  }

  async getHistory(starId: string, limit = 30) {
    return this.store.getHistory(starId, limit);
  }

  // ── Seasonal reset ────────────────────────────────────────────────────────

  async resetSeason(starId: string, seasonId: string, seasonName: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.store.findByStarId(starId);
    if (!existing) return;

    await this.store.appendSeasonScore({
      starId,
      seasonId,
      seasonName,
      finalScore: existing.score,
      finalHalfStars: existing.halfStars,
      finalTierLabel: existing.tierLabel,
      resetAt: now,
    });

    // Reset to Spark
    await this.store.upsert({
      ...existing,
      score: 0,
      halfStars: 1,
      tierLabel: 'Spark',
      factors: { supporters: 0, giftVolume: 0, watchTime: 0, retention: 0, tapVelocity: 0 },
      lastCalculatedAt: now,
    });

    void this.eventBus?.publish(buildWhiteStarSeasonResetEvent({
      starId,
      seasonId,
      finalScore: existing.score,
      finalTier: existing.tierLabel,
      resetAt: now,
    }));
  }

  private _nextWeekReset(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
    return next.toISOString();
  }
}
