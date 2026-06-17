// ---------------------------------------------------------------------------
// discovery-core — ports (implemented by the app's Prisma adapters)
// ---------------------------------------------------------------------------

import type { Genre, DiscoveryItem, TrendingItem } from './types';

export interface DiscoveryFeedPort {
  /** Published videos in a genre, ordered by discovery score (desc). */
  listByGenre(params: {
    genre: Genre;
    country?: string;
    language?: string;
    excludeVideoIds?: string[];
    limit: number;
    offset: number;
  }): Promise<DiscoveryItem[]>;
}

export interface TrendingStorePort {
  /** Trending rail for a scope ('GLOBAL' or a country/region), ordered by rank. */
  listTrending(scope: string, limit: number): Promise<TrendingItem[]>;
}
