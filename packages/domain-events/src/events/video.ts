// ---------------------------------------------------------------------------
// domain-events — video-core events
// Emitted by video-core / the API video module across the upload→publish flow.
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const VIDEO_UPLOADED  = 'video.uploaded';
export const VIDEO_PROCESSED = 'video.processed';
export const VIDEO_PUBLISHED = 'video.published';

export interface VideoUploadedPayload {
  readonly videoId: string;
  readonly starProfileId: string;
  readonly uploaderUserId: string;
  readonly storageKey: string;
  readonly title: string;
  readonly genre: string;
  readonly country?: string;
  readonly language?: string;
  readonly uploadedAt: string;
}

export interface VideoProcessedPayload {
  readonly videoId: string;
  readonly playbackUrl: string;
  readonly thumbnailUrl: string;
  readonly durationSeconds: number;
  readonly width?: number;
  readonly height?: number;
  readonly processedAt: string;
}

export interface VideoPublishedPayload {
  readonly videoId: string;
  readonly starProfileId: string;
  readonly title: string;
  readonly genre: string;
  readonly country?: string;
  readonly language?: string;
  readonly thumbnailUrl?: string;
  readonly publishedAt: string;
}

export type VideoUploadedEvent  = DomainEvent<VideoUploadedPayload>;
export type VideoProcessedEvent = DomainEvent<VideoProcessedPayload>;
export type VideoPublishedEvent = DomainEvent<VideoPublishedPayload>;
