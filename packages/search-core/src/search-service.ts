// ---------------------------------------------------------------------------
// search-core — SearchService
// Thin orchestration over a SearchIndexPort. The actual filtering/ranking is
// delegated to the adapter (Prisma full-text, OpenSearch, etc.); this service
// normalises the query and applies safe defaults.
// ---------------------------------------------------------------------------

import type { SearchDocument, SearchQuery, SearchResult } from './types';

export interface SearchIndexPort {
  upsert(doc: SearchDocument): Promise<void>;
  remove(id: string): Promise<void>;
  search(query: NormalisedSearchQuery): Promise<SearchResult>;
}

/** A SearchQuery with defaults applied and string fields normalised. */
export interface NormalisedSearchQuery extends SearchQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sort: 'relevance' | 'recent' | 'score';
}

const MAX_LIMIT = 50;

export class SearchService {
  constructor(private readonly index: SearchIndexPort) {}

  async upsert(doc: SearchDocument): Promise<void> {
    return this.index.upsert(doc);
  }

  async remove(id: string): Promise<void> {
    return this.index.remove(id);
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const normalised: NormalisedSearchQuery = {
      q: query.q?.trim() || undefined,
      creatorId: query.creatorId,
      creatorHandle: query.creatorHandle?.trim().toLowerCase(),
      country: query.country?.trim().toUpperCase(),
      language: query.language?.trim().toLowerCase(),
      genre: query.genre?.trim().toUpperCase(),
      type: query.type,
      limit: Math.min(Math.max(query.limit ?? 20, 1), MAX_LIMIT),
      offset: Math.max(query.offset ?? 0, 0),
      sort: query.sort ?? (query.q ? 'relevance' : 'score'),
    };
    return this.index.search(normalised);
  }
}
