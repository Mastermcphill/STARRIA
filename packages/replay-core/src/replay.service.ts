// ---------------------------------------------------------------------------
// replay-core — ReplayService
// Orchestrates the pipeline: capture → process → thumbnails → publish → discovery.
// Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  Replay,
  CaptureRecordingInput,
  PublishReplayInput,
  ReplayStorePort,
  MediaProcessorPort,
  DiscoveryPublisherPort,
  ReplayAccessPort,
} from './types';
import {
  buildRecordingCaptured,
  buildProcessingStarted,
  buildThumbnailsReady,
  buildReplayPublished,
  buildPushedToDiscovery,
  buildReplayFailed,
} from './events';

export interface ReplayDeps {
  store: ReplayStorePort;
  processor: MediaProcessorPort;
  discovery: DiscoveryPublisherPort;
  access?: ReplayAccessPort;
  eventBus?: EventBus;
}

const DEFAULT_THUMBNAIL_COUNT = 4;

export class ReplayService {
  private readonly store: ReplayStorePort;
  private readonly processor: MediaProcessorPort;
  private readonly discovery: DiscoveryPublisherPort;
  private readonly access?: ReplayAccessPort;
  private readonly eventBus?: EventBus;

  constructor(deps: ReplayDeps) {
    this.store = deps.store;
    this.processor = deps.processor;
    this.discovery = deps.discovery;
    this.access = deps.access;
    this.eventBus = deps.eventBus;
  }

  /**
   * Step 1–3: capture a finished recording and run it through processing +
   * thumbnail generation. Leaves the replay in READY state (not yet public).
   */
  async captureAndProcess(input: CaptureRecordingInput): Promise<Replay> {
    const now = new Date().toISOString();

    // Idempotency on recordingId.
    const existing = await this.store.getByRecording(input.recordingId);
    if (existing) return existing;

    const replayId = randomUUID();
    let replay = await this.store.create({
      id: replayId,
      roomId: input.roomId,
      recordingId: input.recordingId,
      creatorId: input.creatorId,
      sourceRoomType: input.sourceRoomType,
      status: 'RECORDING',
      visibility: 'PUBLIC',
      rawAssetUrl: input.rawAssetUrl,
      thumbnailUrls: [],
      durationSeconds: input.durationSeconds,
      title: input.title,
      viewCount: 0,
      pushedToDiscovery: false,
      createdAt: now,
    });

    this.eventBus?.publish(buildRecordingCaptured({
      replayId, roomId: input.roomId, sourceRoomType: input.sourceRoomType,
      durationSeconds: input.durationSeconds, rawAssetUrl: input.rawAssetUrl, capturedAt: now,
    }));

    try {
      // Step 2: process.
      replay = await this.store.update(replayId, { status: 'PROCESSING' });
      this.eventBus?.publish(buildProcessingStarted({ replayId, roomId: input.roomId, at: now }));

      const { playbackUrl, durationSeconds } = await this.processor.process(input.rawAssetUrl);

      // Step 3: thumbnails.
      const { thumbnailUrls, posterUrl } = await this.processor.generateThumbnails(playbackUrl, DEFAULT_THUMBNAIL_COUNT);
      this.eventBus?.publish(buildThumbnailsReady({ replayId, thumbnailUrls, posterUrl, at: new Date().toISOString() }));

      replay = await this.store.update(replayId, {
        status: 'READY', playbackUrl, durationSeconds, thumbnailUrls, posterUrl,
      });
      return replay;
    } catch (err) {
      await this.store.update(replayId, { status: 'FAILED' });
      this.eventBus?.publish(buildReplayFailed({
        replayId, roomId: input.roomId, reason: (err as Error).message, at: new Date().toISOString(),
      }));
      throw err;
    }
  }

  /**
   * Step 4–5: publish a READY replay at a given visibility and push to discovery.
   */
  async publish(input: PublishReplayInput): Promise<Replay> {
    const replay = await this.store.get(input.replayId);
    if (!replay) throw new Error(`Replay not found: ${input.replayId}`);
    if (replay.status !== 'READY' && replay.status !== 'PUBLISHED') {
      throw new Error(`Replay must be READY to publish (current: ${replay.status}).`);
    }
    if (input.visibility === 'PREMIUM' && (input.priceCoins ?? 0) <= 0) {
      throw new Error('PREMIUM replays require a positive priceCoins.');
    }

    const now = new Date().toISOString();
    const published = await this.store.update(input.replayId, {
      status: 'PUBLISHED',
      visibility: input.visibility,
      priceCoins: input.priceCoins,
      minSubscriberTier: input.minSubscriberTier,
      publishedAt: now,
    });

    this.eventBus?.publish(buildReplayPublished({
      replayId: published.id, roomId: published.roomId, creatorId: published.creatorId,
      visibility: published.visibility, playbackUrl: published.playbackUrl ?? '',
      posterUrl: published.posterUrl ?? '', durationSeconds: published.durationSeconds,
      priceCoins: published.priceCoins, publishedAt: now,
    }));

    // Step 5: push to discovery feed.
    await this.discovery.pushReplay(published);
    const flagged = await this.store.update(input.replayId, { pushedToDiscovery: true });
    this.eventBus?.publish(buildPushedToDiscovery({
      replayId: flagged.id, creatorId: flagged.creatorId, visibility: flagged.visibility, at: new Date().toISOString(),
    }));

    return flagged;
  }

  /** Gated playback resolution. Throws if the user may not access this replay. */
  async getForPlayback(replayId: string, userId: string): Promise<Replay> {
    const replay = await this.store.get(replayId);
    if (!replay) throw new Error(`Replay not found: ${replayId}`);
    if (replay.status !== 'PUBLISHED') throw new Error('Replay is not published.');

    if (replay.visibility !== 'PUBLIC' && this.access) {
      const denial = await this.access.checkAccess(replay, userId);
      if (denial) throw new Error(denial);
    }

    await this.store.incrementViews(replayId);
    return replay;
  }

  get(replayId: string) { return this.store.get(replayId); }
  listByCreator(creatorId: string) { return this.store.listByCreator(creatorId); }
  listDiscoverable(visibility?: Replay['visibility']) { return this.store.listDiscoverable(visibility); }
}
