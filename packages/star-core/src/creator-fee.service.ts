// ---------------------------------------------------------------------------
// star-core — CreatorFeeService
// Single source of truth for platform fee resolution across all monetisation
// flows: gifting-core, ticketing-core, live-core.
// ---------------------------------------------------------------------------

import type { WhiteStarStorePort, GoldStarStorePort } from './prestige-ports';
import { resolveCreatorFeePct, type GoldStarTierLabel, type WhiteStarHalfStars } from './prestige-types';

export interface CreatorFeeResult {
  readonly feePct: number;
  readonly creatorPct: number;
  readonly whiteStarHalfStars: number;
  readonly goldStarTier: string | null;
  readonly revenueTier: string;
}

export class CreatorFeeService {
  constructor(
    private readonly whiteStarStore: WhiteStarStorePort,
    private readonly goldStarStore: GoldStarStorePort,
  ) {}

  async resolve(starId: string): Promise<CreatorFeeResult> {
    const [whiteStar, goldStar] = await Promise.all([
      this.whiteStarStore.findByStarId(starId),
      this.goldStarStore.findByStarId(starId),
    ]);

    const halfStars = (whiteStar?.halfStars ?? 0) as WhiteStarHalfStars | 0;
    const goldTier = goldStar?.tierLabel ?? null;

    const feePct = resolveCreatorFeePct(halfStars, goldTier as GoldStarTierLabel | undefined);

    const revenueTier =
      halfStars >= 8 ? 'LEGENDARY' :
      halfStars >= 6 ? 'ELITE' :
      halfStars >= 4 ? 'ESTABLISHED' :
      halfStars >= 2 ? 'RISING' : 'NEW';

    return {
      feePct,
      creatorPct: 100 - feePct,
      whiteStarHalfStars: halfStars,
      goldStarTier: goldTier,
      revenueTier,
    };
  }

  /**
   * Synchronous resolver — use when store data is already available.
   * Called by gifting/ticketing services when they already fetched profile.
   */
  static resolveSync(halfStars: WhiteStarHalfStars | 0, goldStarTier?: GoldStarTierLabel): number {
    return resolveCreatorFeePct(halfStars, goldStarTier);
  }
}
