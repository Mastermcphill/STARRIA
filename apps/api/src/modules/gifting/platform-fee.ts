// Platform fee ladder based on creator's StarTier.
// New creators pay a higher platform cut; legendary creators keep more.

export type StarTierKey = 'RISING' | 'VERIFIED' | 'ELITE' | 'GOLD_STAR';

export const PLATFORM_FEE_PCT: Record<StarTierKey | 'NONE', number> = {
  NONE:      50, // no star profile / brand new
  RISING:    40,
  VERIFIED:  30,
  ELITE:     20,
  GOLD_STAR: 10, // creators with active GoldStarProfile
};

export function getPlatformFeePct(starTier?: string | null, hasGoldStar = false): number {
  if (hasGoldStar) return PLATFORM_FEE_PCT.GOLD_STAR;
  if (!starTier) return PLATFORM_FEE_PCT.NONE;
  return PLATFORM_FEE_PCT[starTier as StarTierKey] ?? PLATFORM_FEE_PCT.RISING;
}
