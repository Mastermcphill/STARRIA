// Patron tiers — per-creator-relationship, based on total coins gifted to that star.
// Different from the global SupporterTier (fan/superfan/ultra) in support-core.

export type PatronLevel = 'supporter' | 'patron' | 'champion' | 'benefactor' | 'legendary_patron';

export interface PatronTierConfig {
  level: PatronLevel;
  label: string;
  coinsThreshold: number;
}

export const PATRON_TIERS: readonly PatronTierConfig[] = [
  { level: 'supporter',        label: 'Supporter',        coinsThreshold: 0     },
  { level: 'patron',           label: 'Patron',           coinsThreshold: 500   },
  { level: 'champion',         label: 'Champion',         coinsThreshold: 2000  },
  { level: 'benefactor',       label: 'Benefactor',       coinsThreshold: 10000 },
  { level: 'legendary_patron', label: 'Legendary Patron', coinsThreshold: 50000 },
];

export function computePatronLevel(totalCoinsGifted: number): PatronLevel {
  const sorted = [...PATRON_TIERS].sort((a, b) => b.coinsThreshold - a.coinsThreshold);
  for (const t of sorted) {
    if (totalCoinsGifted >= t.coinsThreshold) return t.level;
  }
  return 'supporter';
}
