// ---------------------------------------------------------------------------
// search-core — types
// ---------------------------------------------------------------------------

export type SearchDocType = 'video' | 'star';

/** A flattened, indexable representation of a piece of content. */
export interface SearchDocument {
  readonly id: string;
  readonly type: SearchDocType;
  readonly title: string;
  readonly creatorId: string;       // starProfileId
  readonly creatorHandle?: string;
  readonly country?: string;        // ISO 3166-1 alpha-2
  readonly language?: string;       // ISO 639-1
  readonly genre?: string;
  readonly tags: string[];
  readonly thumbnailUrl?: string;
  readonly score: number;           // discovery score, used for ordering
  readonly publishedAt?: string;
}

export interface SearchQuery {
  /** Free-text query matched against title + tags. */
  readonly q?: string;
  readonly creatorId?: string;
  readonly creatorHandle?: string;
  readonly country?: string;
  readonly language?: string;
  readonly genre?: string;
  readonly type?: SearchDocType;
  readonly limit?: number;
  readonly offset?: number;
  /** Ordering: 'relevance' (default) or 'recent' or 'score'. */
  readonly sort?: 'relevance' | 'recent' | 'score';
}

export interface SearchResult {
  readonly items: SearchDocument[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
