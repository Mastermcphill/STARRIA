// ---------------------------------------------------------------------------
// video-core — VideoService
// Orchestrates the upload → transcode → thumbnail → metadata → index → publish
// flow via injected ports. Publishes domain events at each stage.
// ---------------------------------------------------------------------------

import type { EventBus } from '@starria/domain-events';
import type { VideoRecord, CreateVideoInput } from './types';
import type {
  VideoStorePort,
  TranscoderPort,
  ThumbnailGeneratorPort,
  MetadataExtractorPort,
  VideoSearchIndexPort,
} from './ports';
import {
  buildVideoUploadedEvent,
  buildVideoProcessedEvent,
  buildVideoPublishedEvent,
} from './events';

export class VideoService {
  constructor(
    private readonly store: VideoStorePort,
    private readonly transcoder: TranscoderPort,
    private readonly thumbnails: ThumbnailGeneratorPort,
    private readonly metadata: MetadataExtractorPort,
    private readonly searchIndex?: VideoSearchIndexPort,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Step 1 — register an uploaded video. The binary is assumed already in
   * object storage at `storageKey`. Emits VideoUploadedEvent.
   */
  async registerUpload(input: CreateVideoInput): Promise<VideoRecord> {
    const video = await this.store.create(input);
    void this.eventBus?.publish(buildVideoUploadedEvent({
      videoId: video.id,
      starProfileId: video.starProfileId,
      uploaderUserId: video.uploaderUserId,
      storageKey: video.storageKey,
      title: video.title,
      genre: video.genre,
      country: video.country,
      language: video.language,
    }));
    return video;
  }

  /**
   * Step 2 — run the processing pipeline. In production this would be invoked
   * by a worker reacting to VideoUploadedEvent; here it is callable directly.
   * Emits VideoProcessedEvent.
   */
  async processVideo(videoId: string): Promise<VideoRecord> {
    const existing = await this.store.findById(videoId);
    if (!existing) throw new Error(`Video ${videoId} not found`);

    await this.store.updateStatus(videoId, 'PROCESSING');

    try {
      const [transcode, thumb, meta] = await Promise.all([
        this.transcoder.transcode({ videoId, storageKey: existing.storageKey }),
        this.thumbnails.generate({ videoId, storageKey: existing.storageKey }),
        this.metadata.extract({ videoId, storageKey: existing.storageKey }),
      ]);

      const updated = await this.store.applyProcessing(videoId, {
        playbackUrl: transcode.playbackUrl,
        thumbnailUrl: thumb.thumbnailUrl,
        durationSeconds: meta.durationSeconds ?? transcode.durationSeconds,
        width: meta.width ?? transcode.width,
        height: meta.height ?? transcode.height,
        language: existing.language ?? meta.detectedLanguage,
        tags: existing.tags.length ? existing.tags : meta.suggestedTags,
      });

      void this.eventBus?.publish(buildVideoProcessedEvent({
        videoId,
        playbackUrl: transcode.playbackUrl,
        thumbnailUrl: thumb.thumbnailUrl,
        durationSeconds: updated.durationSeconds ?? transcode.durationSeconds,
        width: updated.width,
        height: updated.height,
      }));

      return updated;
    } catch (err) {
      await this.store.updateStatus(videoId, 'FAILED');
      throw err;
    }
  }

  /**
   * Step 3 — publish: mark live, index for search, emit VideoPublishedEvent
   * (which downstream initialises the discovery score).
   */
  async publishVideo(videoId: string): Promise<VideoRecord> {
    const published = await this.store.markPublished(videoId, new Date().toISOString());
    await this.searchIndex?.index(published);
    void this.eventBus?.publish(buildVideoPublishedEvent({
      videoId: published.id,
      starProfileId: published.starProfileId,
      title: published.title,
      genre: published.genre,
      country: published.country,
      language: published.language,
      thumbnailUrl: published.thumbnailUrl,
    }));
    return published;
  }

  /** Convenience: run process + publish back-to-back (used by the MVP flow). */
  async processAndPublish(videoId: string): Promise<VideoRecord> {
    await this.processVideo(videoId);
    return this.publishVideo(videoId);
  }

  async getById(videoId: string): Promise<VideoRecord | undefined> {
    return this.store.findById(videoId);
  }
}
