// Gift catalog — canonical gift types with their coin costs.

export interface GiftItem {
  readonly id: string;
  readonly name: string;
  readonly coins: number;
  readonly emoji: string;
}

export const GIFT_CATALOG: readonly GiftItem[] = [
  { id: 'star',      name: 'Star',      coins: 10,   emoji: '⭐' },
  { id: 'rocket',    name: 'Rocket',    coins: 50,   emoji: '🚀' },
  { id: 'crown',     name: 'Crown',     coins: 100,  emoji: '👑' },
  { id: 'galaxy',    name: 'Galaxy',    coins: 500,  emoji: '🌌' },
  { id: 'supernova', name: 'Supernova', coins: 1000, emoji: '💥' },
] as const;

export const GIFT_CATALOG_MAP = new Map(GIFT_CATALOG.map(g => [g.id, g]));

export function getGiftItem(giftId: string): GiftItem | undefined {
  return GIFT_CATALOG_MAP.get(giftId);
}
