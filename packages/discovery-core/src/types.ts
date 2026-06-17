// ---------------------------------------------------------------------------
// discovery-core — types
// ---------------------------------------------------------------------------

/** The eight STARRIA genres that drive the horizontal swipe (genre switching). */
export type Genre =
  | 'COMEDY'
  | 'AI_MOVIES'
  | 'AI_SERIES'
  | 'MUSIC'
  | 'ANIMALS'
  | 'ANIMATION'
  | 'EDUCATION'
  | 'LIFESTYLE';

export interface GenreInfo {
  readonly genre: Genre;
  readonly label: string;
}

export const GENRES: readonly GenreInfo[] = [
  { genre: 'COMEDY',    label: 'Comedy' },
  { genre: 'AI_MOVIES', label: 'AI Movies' },
  { genre: 'AI_SERIES', label: 'AI Series' },
  { genre: 'MUSIC',     label: 'Music' },
  { genre: 'ANIMALS',   label: 'Animals' },
  { genre: 'ANIMATION', label: 'Animation' },
  { genre: 'EDUCATION', label: 'Education' },
  { genre: 'LIFESTYLE', label: 'Lifestyle' },
];

export const GENRE_VALUES: readonly Genre[] = GENRES.map(g => g.genre);

export function isGenre(value: string): value is Genre {
  return GENRE_VALUES.includes(value as Genre);
}

// ── Discovery feed item ───────────────────────────────────────────────────────

export interface DiscoveryItem {
  readonly videoId: string;
  readonly starProfileId: string;
  readonly title: string;
  readonly genre: Genre;
  readonly country?: string;
  readonly language?: string;
  readonly thumbnailUrl?: string;
  readonly playbackUrl?: string;
  readonly score: number;
  readonly tapCount: number;
  readonly viewCount: number;
}

export interface DiscoveryFilters {
  readonly country?: string;
  readonly language?: string;
}

export interface DiscoveryPage {
  readonly items: DiscoveryItem[];
  readonly genre: Genre;
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

// ── Trending ───────────────────────────────────────────────────────────────

export const GLOBAL_SCOPE = 'GLOBAL';

export interface TrendingItem extends DiscoveryItem {
  readonly rank: number;
  readonly scope: string; // 'GLOBAL' or a region/country code
}
