// ---------------------------------------------------------------------------
// video-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  VideoUploadedEvent,
  VideoProcessedEvent,
  VideoPublishedEvent,
} from '@starria/domain-events';
import {
  VIDEO_UPLOADED,
  VIDEO_PROCESSED,
  VIDEO_PUBLISHED,
} from '@starria/domain-events';

export function buildVideoUploadedEvent(params: {
  videoId: string;
  starProfileId: string;
  uploaderUserId: string;
  storageKey: string;
  title: string;
  genre: string;
  country?: string;
  language?: string;
}): VideoUploadedEvent {
  return createEvent({
    id: randomUUID(),
    type: VIDEO_UPLOADED,
    aggregateId: params.videoId,
    aggregateType: 'Video',
    payload: { ...params, uploadedAt: new Date().toISOString() },
  });
}

export function buildVideoProcessedEvent(params: {
  videoId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  width?: number;
  height?: number;
}): VideoProcessedEvent {
  return createEvent({
    id: randomUUID(),
    type: VIDEO_PROCESSED,
    aggregateId: params.videoId,
    aggregateType: 'Video',
    payload: { ...params, processedAt: new Date().toISOString() },
  });
}

export function buildVideoPublishedEvent(params: {
  videoId: string;
  starProfileId: string;
  title: string;
  genre: string;
  country?: string;
  language?: string;
  thumbnailUrl?: string;
}): VideoPublishedEvent {
  return createEvent({
    id: randomUUID(),
    type: VIDEO_PUBLISHED,
    aggregateId: params.videoId,
    aggregateType: 'Video',
    payload: { ...params, publishedAt: new Date().toISOString() },
  });
}
