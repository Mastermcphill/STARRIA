// ---------------------------------------------------------------------------
// creator-os — Coin ledger adapter + poster/clip generator stubs + analytics
// source stub. The persistent STORES (content calendar, live commerce, clips)
// are now Prisma-backed (see prisma-creator-os.repository.ts). The remaining
// adapters are a wallet-adapter coin ledger (with a `seed()` test helper) and
// external-generator / computed-analytics stubs. See the Sprint 10 audit.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type {
  PosterGeneratorPort,
  CreatorCoinLedgerPort,
  AnalyticsSourcePort,
  ClipGeneratorPort,
  PosterRequest,
  AudienceAnalytics,
  RevenueAnalytics,
} from '@starria/creator-os-core';

const COIN_BALANCES = new Map<string, number>();
const DEFAULT_BALANCE = 100_000;

@Injectable()
export class InMemoryCreatorLedger implements CreatorCoinLedgerPort {
  seed(userId: string, coins: number): void {
    COIN_BALANCES.set(userId, coins);
  }
  getBalance(userId: string): number {
    return COIN_BALANCES.get(userId) ?? DEFAULT_BALANCE;
  }
  async charge(userId: string, coins: number, _reason: string): Promise<void> {
    const cur = COIN_BALANCES.get(userId) ?? DEFAULT_BALANCE;
    if (cur < coins) throw new Error('Insufficient coins');
    COIN_BALANCES.set(userId, cur - coins);
  }
  async credit(userId: string, coins: number, _reason: string): Promise<void> {
    COIN_BALANCES.set(userId, (COIN_BALANCES.get(userId) ?? DEFAULT_BALANCE) + coins);
  }
}

/** Stub poster generator — real impl calls the image-gen service. */
@Injectable()
export class StubPosterGenerator implements PosterGeneratorPort {
  async generate(req: PosterRequest): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    const slug = encodeURIComponent(req.title.toLowerCase().replace(/\s+/g, '-'));
    const base = `https://cdn.starria.local/posters/${req.posterType.toLowerCase()}/${slug}`;
    return { imageUrl: `${base}.png`, thumbnailUrl: `${base}_thumb.png` };
  }
}

/** Stub clip generator — real impl calls the video-cut service. */
@Injectable()
export class StubClipGenerator implements ClipGeneratorPort {
  async cut(replayId: string, startOffsetSeconds: number, lengthSeconds: number): Promise<{ clipUrl: string }> {
    return { clipUrl: `https://cdn.starria.local/clips/${replayId}/${startOffsetSeconds}-${lengthSeconds}.mp4` };
  }
}

/**
 * Stub analytics source — returns deterministic synthetic metrics derived from
 * the creatorId so responses are stable. Real impl aggregates from the
 * analytics-core / wallet ledger.
 */
@Injectable()
export class StubAnalyticsSource implements AnalyticsSourcePort {
  private seed(creatorId: string): number {
    let h = 0;
    for (const ch of creatorId) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    return h;
  }

  async audience(creatorId: string): Promise<AudienceAnalytics> {
    const s = this.seed(creatorId);
    const followers = 1000 + (s % 9000);
    const activeSupporters = Math.floor(followers * 0.12);
    return {
      creatorId,
      followers,
      activeSupporters,
      patrons: Math.floor(activeSupporters * 0.06),
      avgConcurrentViewers: 50 + (s % 450),
      topCountries: [
        { country: 'US', share: 0.35 },
        { country: 'NG', share: 0.22 },
        { country: 'GB', share: 0.15 },
      ],
      retentionPct: 30 + (s % 50),
    };
  }

  async revenue(creatorId: string, periodDays: number): Promise<RevenueAnalytics> {
    const s = this.seed(creatorId);
    const gross = 5000 + (s % 20000);
    const platformFeeCoins = Math.floor(gross * 0.2);
    const trend = Array.from({ length: Math.min(periodDays, 14) }, (_, i) => ({
      day: `D-${i}`,
      coins: Math.floor((gross / 14) * (0.6 + ((s + i) % 8) / 10)),
    }));
    return {
      creatorId,
      periodDays,
      grossCoins: gross,
      netCoins: gross - platformFeeCoins,
      platformFeeCoins,
      breakdown: [
        { source: 'TICKETS', coins: Math.floor(gross * 0.4) },
        { source: 'REPLAY', coins: Math.floor(gross * 0.25) },
        { source: 'GIFTS', coins: Math.floor(gross * 0.2) },
        { source: 'SUBSCRIPTIONS', coins: Math.floor(gross * 0.15) },
      ],
      trend,
    };
  }
}
