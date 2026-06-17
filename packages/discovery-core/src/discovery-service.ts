// ---------------------------------------------------------------------------
// discovery-core — DiscoveryService
// Powers the discovery matrix:
//   • vertical swipe  → more content in the same genre (getVerticalFeed)
//   • horizontal swipe → genre switching (genres + getVerticalFeed for new genre)
// ---------------------------------------------------------------------------

import type { DiscoveryFeedPort } from './ports';
import type { Genre, GenreInfo, DiscoveryFilters, DiscoveryPage, DiscoveryItem } from './types';
import { GENRES } from './types';

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}
function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    return Math.max(0, parseInt(Buffer.from(cursor, 'base64url').toString(), 10) || 0);
  } catch {
    return 0;
  }
}

export class DiscoveryService {
  constructor(private readonly feed: DiscoveryFeedPort) {}

  /** Horizontal swipe — the list of genres the user can switch between. */
  genres(): readonly GenreInfo[] {
    return GENRES;
  }

  /**
   * Vertical swipe — return the next page of content in a genre, ordered by
   * discovery score, optionally filtered by country/language.
   */
  async getVerticalFeed(params: {
    genre: Genre;
    filters?: DiscoveryFilters;
    cursor?: string;
    limit?: number;
    excludeVideoIds?: string[];
  }): Promise<DiscoveryPage> {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
    const offset = decodeCursor(params.cursor);

    const rows = await this.feed.listByGenre({
      genre: params.genre,
      country: params.filters?.country,
      language: params.filters?.language,
      excludeVideoIds: params.excludeVideoIds,
      limit: limit + 1,
      offset,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      genre: params.genre,
      hasMore,
      nextCursor: hasMore ? encodeCursor(offset + limit) : undefined,
    };
  }

  /**
   * The discovery matrix entry point — the top item per genre, used to seed the
   * initial grid the user sees before swiping.
   */
  async getMatrix(params: { filters?: DiscoveryFilters; perGenre?: number } = {}): Promise<
    Array<{ genre: Genre; items: DiscoveryItem[] }>
  > {
    const perGenre = Math.min(Math.max(params.perGenre ?? 5, 1), 20);
    const result: Array<{ genre: Genre; items: DiscoveryItem[] }> = [];
    for (const { genre } of GENRES) {
      const items = await this.feed.listByGenre({
        genre,
        country: params.filters?.country,
        language: params.filters?.language,
        limit: perGenre,
        offset: 0,
      });
      result.push({ genre, items });
    }
    return result;
  }
}
