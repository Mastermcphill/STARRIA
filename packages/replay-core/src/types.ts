// ---------------------------------------------------------------------------
// replay-core — domain types
// Recording → process → thumbnails → publish → discovery pipeline.
// ---------------------------------------------------------------------------

import type { ReplayVisibility, ReplayStatus } from '@starria/domain-events';
export type { ReplayVisibility, ReplayStatus };

export interface Replay {
  readonly id: string;
  readonly roomId: string;
  readonly recordingId: string;
  readonly creatorId: string;
  readonly sourceRoomType: string;
  readonly status: ReplayStatus;
  readonly visibility: ReplayVisibility;
  readonly rawAssetUrl?: string;
  readonly playbackUrl?: string;
  readonly posterUrl?: string;
  readonly thumbnailUrls: string[];
  readonly durationSeconds: number;
  readonly priceCoins?: number;          // for PREMIUM
  readonly minSubscriberTier?: string;   // for SUBSCRIBER
  readonly title: string;
  readonly viewCount: number;
  readonly pushedToDiscovery: boolean;
  readonly createdAt: string;
  readonly publishedAt?: string;
}

export interface CaptureRecordingInput {
  readonly roomId: string;
  readonly recordingId: string;
  readonly creatorId: string;
  readonly sourceRoomType: string;
  readonly rawAssetUrl: string;
  readonly durationSeconds: number;
  readonly title: string;
}

export interface PublishReplayInput {
  readonly replayId: string;
  readonly visibility: ReplayVisibility;
  readonly priceCoins?: number;
  readonly minSubscriberTier?: string;
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface ReplayStorePort {
  create(replay: Replay): Promise<Replay>;
  get(replayId: string): Promise<Replay | null>;
  getByRecording(recordingId: string): Promise<Replay | null>;
  update(replayId: string, patch: Partial<Replay>): Promise<Replay>;
  listByCreator(creatorId: string): Promise<Replay[]>;
  listDiscoverable(visibility?: ReplayVisibility): Promise<Replay[]>;
  incrementViews(replayId: string): Promise<void>;
}

/** Media processing: transcode + thumbnail/poster extraction. Stubbed until infra wiring. */
export interface MediaProcessorPort {
  process(rawAssetUrl: string): Promise<{ playbackUrl: string; durationSeconds: number }>;
  generateThumbnails(playbackUrl: string, count: number): Promise<{ thumbnailUrls: string[]; posterUrl: string }>;
}

/** Pushes a published replay into the discovery feed. */
export interface DiscoveryPublisherPort {
  pushReplay(replay: Replay): Promise<void>;
}

/** Gate access to subscriber/premium replays. Returns null if allowed, error string if denied. */
export interface ReplayAccessPort {
  checkAccess(replay: Replay, userId: string): Promise<string | null>;
}
