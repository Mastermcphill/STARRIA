// ---------------------------------------------------------------------------
// geo-core — resolution + geo-diversity scoring (pure)
// ---------------------------------------------------------------------------

import type { GeoLocation, GeoHint, GeoRegion } from './types';
import { countryToRegion } from './region-map';

/** Normalise an ISO country code; returns 'XX' when absent/invalid. */
export function normalizeCountry(country?: string): string {
  const c = (country ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : 'XX';
}

/** Resolve a GeoLocation from a hint (explicit country wins over IP lookup). */
export function resolveLocation(hint: GeoHint): GeoLocation {
  const country = normalizeCountry(hint.country);
  return { country, region: countryToRegion(country) };
}

/**
 * Geo-diversity score in [0, 1].
 *
 * Measures how spread out a video's audience is across macro-regions.
 * A higher score means more organic, broad reach (harder to fake with a
 * single botnet in one location). Computed as the normalised entropy of the
 * region distribution.
 */
export function computeGeoDiversity(regionCounts: Readonly<Record<string, number>>): number {
  const counts = Object.values(regionCounts).filter(n => n > 0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0 || counts.length <= 1) return counts.length <= 1 ? 0 : 0;

  // Shannon entropy normalised by log2(number of distinct regions present).
  let entropy = 0;
  for (const n of counts) {
    const p = n / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(counts.length);
  return maxEntropy === 0 ? 0 : Math.min(1, entropy / maxEntropy);
}

/**
 * Per-tap geo-diversity multiplier in [minMultiplier, maxMultiplier].
 *
 * A tap from an *under-represented* region for this video counts for more
 * (rewards organic geographic spread); a tap from the dominant region counts
 * for slightly less.
 */
export function geoDiversityMultiplier(
  tapRegion: GeoRegion,
  regionCounts: Readonly<Record<string, number>>,
  opts: { min?: number; max?: number } = {},
): number {
  const min = opts.min ?? 0.8;
  const max = opts.max ?? 1.3;
  const total = Object.values(regionCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return max; // first tap — reward the pioneer
  const share = (regionCounts[tapRegion] ?? 0) / total;
  // share 0 → max, share 1 → min (linear)
  return Math.max(min, Math.min(max, max - (max - min) * share));
}
