import {
  computeTapWeight,
  accountAgeFactor,
  validateTap,
  MAX_TAPS_PER_USER_VIDEO,
  computeDiscoveryScore,
  normaliseCount,
  applyTapToRegionalBoost,
  computeTrendingScore,
  RANKING_WEIGHTS,
  TREND_THRESHOLDS,
} from '@starria/discovery-core';
import {
  computeGeoDiversity,
  geoDiversityMultiplier,
  countryToRegion,
  normalizeCountry,
  resolveLocation,
} from '@starria/geo-core';

// ── geo-core ──────────────────────────────────────────────────────────────────

describe('geo-core', () => {
  it('maps countries to macro-regions', () => {
    expect(countryToRegion('NG')).toBe('AF');
    expect(countryToRegion('us')).toBe('NA');
    expect(countryToRegion('GB')).toBe('EU');
    expect(countryToRegion('ZZ')).toBe('XX');
    expect(countryToRegion(undefined)).toBe('XX');
  });

  it('normalises country codes', () => {
    expect(normalizeCountry('ng')).toBe('NG');
    expect(normalizeCountry('USA')).toBe('XX'); // not 2-letter
    expect(normalizeCountry(undefined)).toBe('XX');
  });

  it('resolveLocation returns country + region', () => {
    expect(resolveLocation({ country: 'ng' })).toEqual({ country: 'NG', region: 'AF' });
  });

  it('geo-diversity is 0 for single region, higher for spread', () => {
    expect(computeGeoDiversity({ AF: 10 })).toBe(0);
    const even = computeGeoDiversity({ AF: 5, EU: 5, NA: 5, AS: 5 });
    const skewed = computeGeoDiversity({ AF: 17, EU: 1, NA: 1, AS: 1 });
    expect(even).toBeGreaterThan(skewed);
    expect(even).toBeCloseTo(1, 5);
  });

  it('geo-diversity multiplier rewards under-represented regions', () => {
    const counts = { AF: 90, EU: 10 };
    const fromRareRegion = geoDiversityMultiplier('NA', counts); // 0 share → max
    const fromDominant = geoDiversityMultiplier('AF', counts);   // high share → low
    expect(fromRareRegion).toBeGreaterThan(fromDominant);
  });
});

// ── tap weight ────────────────────────────────────────────────────────────────

describe('tap weight', () => {
  it('account age ramps to 1 over 30 days', () => {
    expect(accountAgeFactor(0)).toBe(0);
    expect(accountAgeFactor(15)).toBeCloseTo(0.5, 5);
    expect(accountAgeFactor(30)).toBe(1);
    expect(accountAgeFactor(100)).toBe(1);
  });

  it('weight is the product of all four factors', () => {
    const w = computeTapWeight({ trustScore: 1, accountAgeDays: 30, geoDiversity: 1, engagementQuality: 1 });
    expect(w).toBeCloseTo(1, 5);
  });

  it('a new, low-trust, unengaged tap is worth almost nothing', () => {
    const w = computeTapWeight({ trustScore: 0.2, accountAgeDays: 1, geoDiversity: 0.8, engagementQuality: 0.3 });
    expect(w).toBeLessThan(0.05);
  });

  it('clamps invalid inputs', () => {
    expect(computeTapWeight({ trustScore: 5, accountAgeDays: -1, geoDiversity: 1, engagementQuality: 1 })).toBe(0);
  });
});

// ── anti-spam validation ──────────────────────────────────────────────────────

describe('validateTap', () => {
  const base = { tapperUserId: 'u1', creatorUserId: 'c1', existingTapCount: 0, trustScore: 0.9, videoPublished: true };

  it('accepts a normal tap', () => {
    expect(validateTap(base).ok).toBe(true);
  });

  it('rejects self-taps', () => {
    expect(validateTap({ ...base, creatorUserId: 'u1' })).toEqual({ ok: false, reason: 'self_tap' });
  });

  it('rejects when tap limit reached', () => {
    expect(validateTap({ ...base, existingTapCount: MAX_TAPS_PER_USER_VIDEO })).toEqual({ ok: false, reason: 'limit_exceeded' });
  });

  it('rejects low-trust users', () => {
    expect(validateTap({ ...base, trustScore: 0.01 })).toEqual({ ok: false, reason: 'low_trust' });
  });

  it('rejects taps on unpublished videos', () => {
    expect(validateTap({ ...base, videoPublished: false })).toEqual({ ok: false, reason: 'video_not_published' });
  });
});

// ── discovery ranking ─────────────────────────────────────────────────────────

describe('discovery ranking', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('normaliseCount is monotonic and bounded', () => {
    expect(normaliseCount(0, 1000)).toBe(0);
    expect(normaliseCount(1000, 1000)).toBeCloseTo(1, 5);
    expect(normaliseCount(10, 1000)).toBeLessThan(normaliseCount(100, 1000));
  });

  it('a strong video scores higher than a weak one', () => {
    const strong = computeDiscoveryScore({
      totalWatchSeconds: 500_000, supporterCount: 5_000, recentWeightedTaps: 3_000,
      averageRetention: 0.85, starMultiplier: 1,
    });
    const weak = computeDiscoveryScore({
      totalWatchSeconds: 100, supporterCount: 2, recentWeightedTaps: 1,
      averageRetention: 0.1, starMultiplier: 0.4,
    });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(1);
    expect(weak.score).toBeGreaterThanOrEqual(0);
  });

  it('score increases when taps increase (everything else equal)', () => {
    const before = computeDiscoveryScore({ totalWatchSeconds: 1000, supporterCount: 10, recentWeightedTaps: 0, averageRetention: 0.5, starMultiplier: 0.7 });
    const after = computeDiscoveryScore({ totalWatchSeconds: 1000, supporterCount: 10, recentWeightedTaps: 2000, averageRetention: 0.5, starMultiplier: 0.7 });
    expect(after.score).toBeGreaterThan(before.score);
  });
});

// ── regional boost + trending ───────────────────────────────────────────────

describe('regional boost', () => {
  it('accumulates weighted taps', () => {
    const b1 = applyTapToRegionalBoost({ previousBoost: 0, tapWeight: 1, secondsSinceLastTap: 0 });
    const b2 = applyTapToRegionalBoost({ previousBoost: b1, tapWeight: 1, secondsSinceLastTap: 0 });
    expect(b2).toBeGreaterThan(b1);
  });

  it('decays over time (half-life 24h)', () => {
    const decayed = applyTapToRegionalBoost({ previousBoost: 10, tapWeight: 0, secondsSinceLastTap: 86_400 });
    expect(decayed).toBeCloseTo(5, 1);
  });
});

describe('trending', () => {
  it('fresh, high-discovery, high-velocity content trends', () => {
    const s = computeTrendingScore({ discoveryScore: 0.9, recentWeightedTaps: 4000, hoursSincePublish: 1 });
    expect(s).toBeGreaterThan(TREND_THRESHOLDS.local);
  });

  it('old content with no recent taps does not trend', () => {
    const s = computeTrendingScore({ discoveryScore: 0.3, recentWeightedTaps: 0, hoursSincePublish: 500 });
    expect(s).toBeLessThan(TREND_THRESHOLDS.local);
  });
});
