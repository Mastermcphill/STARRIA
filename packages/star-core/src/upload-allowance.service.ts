// ---------------------------------------------------------------------------
// star-core — UploadAllowanceService
// Weekly upload cap governed by White Star half-star rating.
// Livestreams are excluded from the cap.
// ---------------------------------------------------------------------------

import type { EventBus } from '@starria/domain-events';
import type { WhiteStarStorePort } from './prestige-ports';
import { resolveWhiteStarTier, type WhiteStarHalfStars } from './prestige-types';
import { buildUploadLimitReachedEvent } from './prestige-events';

/**
 * Returns weekly upload cap from the canonical tier table.
 * Exported for use in API guards and tests without needing a full service.
 */
export function getWeeklyUploadCap(halfStars: WhiteStarHalfStars | 0): number {
  if (halfStars <= 0) return 2;
  const tier = resolveWhiteStarTier(halfStars * 50); // rough score proxy
  // Use tier table directly for the exact half-star passed
  const MAP: Record<number, number> = {
    1: 2,  // 0.5★ Spark
    2: 3,  // 1★   Rising
    3: 3,
    4: 4,  // 2★   Radiant
    5: 4,
    6: 6,  // 3★   Nova
    7: 6,
    8: 8,  // 4★   Celestial
    9: 8,
    10: 10, // 5★   Legendary
  };
  return MAP[halfStars] ?? 2;
}

export interface CheckUploadResult {
  readonly allowed: boolean;
  readonly used: number;
  readonly cap: number;
  readonly remaining: number;
  readonly resetAt: string;
}

export class UploadAllowanceService {
  constructor(
    private readonly store: WhiteStarStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async checkAndConsume(starId: string): Promise<CheckUploadResult> {
    const profile = await this.store.findByStarId(starId);
    const halfStars = (profile?.halfStars ?? 1) as WhiteStarHalfStars;
    const cap = getWeeklyUploadCap(halfStars);

    // Reset if past week boundary
    const now = new Date();
    let used = profile?.uploadUsedThisWeek ?? 0;
    let resetAt = profile?.weekResetAt ?? this._nextWeekReset();

    if (profile && new Date(resetAt) <= now) {
      await this.store.resetWeeklyUploads(starId, this._nextWeekReset());
      used = 0;
      resetAt = this._nextWeekReset();
    }

    if (used >= cap) {
      void this.eventBus?.publish(buildUploadLimitReachedEvent({
        starId,
        weeklyLimit: cap,
        usedCount: used,
        resetAt,
      }));
      return { allowed: false, used, cap, remaining: 0, resetAt };
    }

    await this.store.incrementUploadCount(starId);
    return { allowed: true, used: used + 1, cap, remaining: cap - used - 1, resetAt };
  }

  async getStatus(starId: string): Promise<CheckUploadResult> {
    const profile = await this.store.findByStarId(starId);
    const halfStars = (profile?.halfStars ?? 1) as WhiteStarHalfStars;
    const cap = getWeeklyUploadCap(halfStars);
    const used = profile?.uploadUsedThisWeek ?? 0;
    const resetAt = profile?.weekResetAt ?? this._nextWeekReset();
    return { allowed: used < cap, used, cap, remaining: Math.max(0, cap - used), resetAt };
  }

  private _nextWeekReset(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
    return next.toISOString();
  }
}
