// ---------------------------------------------------------------------------
// discovery-core — LocalDiscoveryService
// Surfaces content relevant to a viewer's region/country first. Backed by the
// same DiscoveryFeedPort with a country filter, and the trending store for the
// local trending rail.
// ---------------------------------------------------------------------------

import type { DiscoveryFeedPort, TrendingStorePort } from './ports';
import type { Genre, DiscoveryItem, TrendingItem } from './types';
import { GENRE_VALUES } from './types';

export class LocalDiscoveryService {
  constructor(
    private readonly feed: DiscoveryFeedPort,
    private readonly trending: TrendingStorePort,
  ) {}

  /** Local feed — top-scoring published videos in the viewer's country. */
  async getLocalFeed(params: {
    country: string;
    genre?: Genre;
    language?: string;
    limit?: number;
  }): Promise<DiscoveryItem[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const genres: Genre[] = params.genre ? [params.genre] : [...GENRE_VALUES];

    const batches = await Promise.all(
      genres.map(genre =>
        this.feed.listByGenre({
          genre,
          country: params.country,
          language: params.language,
          limit,
          offset: 0,
        }),
      ),
    );

    // Merge across genres and re-sort by score, then cap.
    return batches
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Local trending rail for a region/country. */
  async getLocalTrending(region: string, limit = 20): Promise<TrendingItem[]> {
    return this.trending.listTrending(region.trim().toUpperCase(), Math.min(limit, 50));
  }
}
