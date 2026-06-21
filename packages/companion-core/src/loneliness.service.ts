// ---------------------------------------------------------------------------
// companion-core — LonelinessService
// Computes a private loneliness index (0–100) from behavioural signals.
// Score is NEVER exposed publicly — used only for private recommendations.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  LONELINESS_PROFILE_UPDATED,
  COMPANION_RECOMMENDATION_SENT,
} from '@starria/domain-events';
import type { EventBus } from '@starria/domain-events';
import type { CompanionProfile, CompanionStorePort } from './types';

// ── LonelinessProfile ─────────────────────────────────────────────────────────

export interface LonelinessSignals {
  readonly inactiveChatDays: number;        // days since last meaningful chat
  readonly lowEngagementDays: number;       // days below average engagement
  readonly recentSupportLoss: boolean;      // lost a creator they followed
  readonly selfSelectedPreference: boolean; // user explicitly said "show me companions"
  readonly lowSocialActivityScore: number;  // 0–100; 0 = very inactive
}

export interface LonelinessProfile {
  readonly userId: string;
  /** 0–100; higher = stronger loneliness signal. PRIVATE — never expose in API. */
  readonly score: number;
  readonly signals: LonelinessSignals;
  readonly updatedAt: string;
}

// ── Score formula ─────────────────────────────────────────────────────────────

export function calculateLonelinessScore(signals: LonelinessSignals): number {
  let score = 0;

  // Inactive chat (0–30 pts; caps at 30 days)
  score += Math.min(signals.inactiveChatDays / 30, 1) * 30;

  // Low engagement days (0–20 pts; caps at 14 days)
  score += Math.min(signals.lowEngagementDays / 14, 1) * 20;

  // Recent support loss (binary, 15 pts)
  if (signals.recentSupportLoss) score += 15;

  // Self-selected preference (binary, 20 pts — strong signal)
  if (signals.selfSelectedPreference) score += 20;

  // Low social activity (0–15 pts; inverted so 0 activity → 15)
  score += (1 - Math.min(signals.lowSocialActivityScore / 100, 1)) * 15;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ── Persistence port ──────────────────────────────────────────────────────────

export interface LonelinessStorePort {
  find(userId: string): Promise<LonelinessProfile | null>;
  upsert(profile: LonelinessProfile): Promise<LonelinessProfile>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class LonelinessService {
  constructor(
    private readonly store: LonelinessStorePort,
    private readonly companionStore: CompanionStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async updateSignals(userId: string, signals: LonelinessSignals): Promise<LonelinessProfile> {
    const now = new Date().toISOString();
    const score = calculateLonelinessScore(signals);

    const profile = await this.store.upsert({ userId, score, signals, updatedAt: now });

    void this.eventBus?.publish(createEvent({
      id: randomUUID(),
      type: LONELINESS_PROFILE_UPDATED,
      aggregateId: userId,
      aggregateType: 'LonelinessProfile',
      payload: { userId, score, signals, updatedAt: now },
    }));

    return profile;
  }

  async getProfile(userId: string): Promise<LonelinessProfile | null> {
    return this.store.find(userId);
  }

  /**
   * Returns companion recommendations for a user.
   * Only emits a recommendation event if score exceeds threshold.
   * NEVER exposes the score itself in responses.
   */
  async getRecommendations(
    userId: string,
    limit = 5,
  ): Promise<{ companions: CompanionProfile[]; reason: 'LONELINESS_SIGNAL' | 'ACTIVITY_MATCH' | 'AVAILABILITY' }> {
    const profile = await this.store.find(userId);
    const score   = profile?.score ?? 0;

    // Prioritise "available now" companions for high-signal users
    const availableNow = score >= 50;

    const companions = await this.companionStore.discover({
      availableNow: availableNow || undefined,
      limit,
    });

    const reason = score >= 50
      ? 'LONELINESS_SIGNAL'
      : availableNow
      ? 'AVAILABILITY'
      : 'ACTIVITY_MATCH';

    if (companions.length > 0) {
      void this.eventBus?.publish(createEvent({
        id: randomUUID(),
        type: COMPANION_RECOMMENDATION_SENT,
        aggregateId: userId,
        aggregateType: 'LonelinessProfile',
        payload: {
          userId,
          recommendedCompanionIds: companions.map(c => c.id),
          reason,
          sentAt: new Date().toISOString(),
        },
      }));
    }

    return { companions, reason };
  }
}
