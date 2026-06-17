// ---------------------------------------------------------------------------
// video-core — ports (implement in the app layer)
// ---------------------------------------------------------------------------

import type {
  VideoRecord,
  CreateVideoInput,
  VideoStatus,
  TranscodeResult,
  ThumbnailResult,
  ExtractedMetadata,
} from './types';

// ── Persistence ─────────────────────────────────────────────────────────────

export interface VideoStorePort {
  create(input: CreateVideoInput): Promise<VideoRecord>;
  findById(videoId: string): Promise<VideoRecord | undefined>;
  updateStatus(videoId: string, status: VideoStatus): Promise<VideoRecord>;
  applyProcessing(videoId: string, patch: {
    playbackUrl: string;
    thumbnailUrl: string;
    durationSeconds: number;
    width?: number;
    height?: number;
    language?: string;
    tags?: string[];
  }): Promise<VideoRecord>;
  markPublished(videoId: string, publishedAt: string): Promise<VideoRecord>;
}

// ── Media processing (transcode / thumbnail / metadata) ──────────────────────

export interface TranscoderPort {
  transcode(input: { videoId: string; storageKey: string }): Promise<TranscodeResult>;
}

export interface ThumbnailGeneratorPort {
  generate(input: { videoId: string; storageKey: string; atSeconds?: number }): Promise<ThumbnailResult>;
}

export interface MetadataExtractorPort {
  extract(input: { videoId: string; storageKey: string }): Promise<ExtractedMetadata>;
}

// ── Search indexing (wire to search-core) ────────────────────────────────────

export interface VideoSearchIndexPort {
  index(video: VideoRecord): Promise<void>;
  deindex(videoId: string): Promise<void>;
}
