// ---------------------------------------------------------------------------
// video-core — types
// ---------------------------------------------------------------------------

/** STARRIA content genres (matches the discovery-core Genre vocabulary). */
export type VideoGenre =
  | 'COMEDY'
  | 'AI_MOVIES'
  | 'AI_SERIES'
  | 'MUSIC'
  | 'ANIMALS'
  | 'ANIMATION'
  | 'EDUCATION'
  | 'LIFESTYLE';

export const VIDEO_GENRES: readonly VideoGenre[] = [
  'COMEDY', 'AI_MOVIES', 'AI_SERIES', 'MUSIC',
  'ANIMALS', 'ANIMATION', 'EDUCATION', 'LIFESTYLE',
];

export type VideoStatus =
  | 'UPLOADING'   // storage upload in progress / awaiting processing
  | 'PROCESSING'  // transcode + thumbnail + metadata running
  | 'PUBLISHED'   // live and discoverable
  | 'FAILED';     // processing failed

export interface VideoRecord {
  readonly id: string;
  readonly starProfileId: string;
  readonly uploaderUserId: string;
  readonly title: string;
  readonly description?: string;
  readonly genre: VideoGenre;
  readonly country?: string;   // ISO 3166-1 alpha-2 of the creator/content origin
  readonly language?: string;  // ISO 639-1
  readonly tags: string[];
  readonly status: VideoStatus;
  readonly storageKey: string;
  readonly playbackUrl?: string;
  readonly thumbnailUrl?: string;
  readonly durationSeconds?: number;
  readonly width?: number;
  readonly height?: number;
  readonly viewCount: number;
  readonly tapCount: number;
  readonly createdAt: string;
  readonly publishedAt?: string;
}

export interface CreateVideoInput {
  readonly starProfileId: string;
  readonly uploaderUserId: string;
  readonly title: string;
  readonly description?: string;
  readonly genre: VideoGenre;
  readonly country?: string;
  readonly language?: string;
  readonly tags?: string[];
  readonly storageKey: string;
}

// ── Processing pipeline I/O ────────────────────────────────────────────────

export interface TranscodeResult {
  readonly playbackUrl: string;
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
}

export interface ThumbnailResult {
  readonly thumbnailUrl: string;
}

export interface ExtractedMetadata {
  readonly durationSeconds?: number;
  readonly width?: number;
  readonly height?: number;
  readonly codec?: string;
  readonly detectedLanguage?: string;
  readonly suggestedTags?: string[];
}
