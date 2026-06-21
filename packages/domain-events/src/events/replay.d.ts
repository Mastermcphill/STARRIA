import type { DomainEvent } from '../event';
export type ReplayVisibility = 'PUBLIC' | 'SUBSCRIBER' | 'PREMIUM';
export type ReplayStatus = 'RECORDING' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'FAILED';
export declare const REPLAY_RECORDING_CAPTURED = "replay.recording.captured";
export declare const REPLAY_PROCESSING_STARTED = "replay.processing.started";
export declare const REPLAY_THUMBNAILS_READY = "replay.thumbnails.ready";
export declare const REPLAY_PUBLISHED = "replay.published";
export declare const REPLAY_PUSHED_TO_DISCOVERY = "replay.pushed-to-discovery";
export declare const REPLAY_FAILED = "replay.failed";
export interface ReplayRecordingCapturedPayload {
    readonly replayId: string;
    readonly roomId: string;
    readonly sourceRoomType: string;
    readonly durationSeconds: number;
    readonly rawAssetUrl: string;
    readonly capturedAt: string;
}
export interface ReplayProcessingPayload {
    readonly replayId: string;
    readonly roomId: string;
    readonly at: string;
}
export interface ReplayThumbnailsReadyPayload {
    readonly replayId: string;
    readonly thumbnailUrls: string[];
    readonly posterUrl: string;
    readonly at: string;
}
export interface ReplayAssetPublishedPayload {
    readonly replayId: string;
    readonly roomId: string;
    readonly creatorId: string;
    readonly visibility: ReplayVisibility;
    readonly playbackUrl: string;
    readonly posterUrl: string;
    readonly durationSeconds: number;
    readonly priceCoins?: number;
    readonly publishedAt: string;
}
export interface ReplayDiscoveryPayload {
    readonly replayId: string;
    readonly creatorId: string;
    readonly visibility: ReplayVisibility;
    readonly at: string;
}
export interface ReplayFailedPayload {
    readonly replayId: string;
    readonly roomId: string;
    readonly reason: string;
    readonly at: string;
}
export type ReplayRecordingCapturedEvent = DomainEvent<ReplayRecordingCapturedPayload>;
export type ReplayProcessingEvent = DomainEvent<ReplayProcessingPayload>;
export type ReplayThumbnailsReadyEvent = DomainEvent<ReplayThumbnailsReadyPayload>;
export type ReplayAssetPublishedEvent = DomainEvent<ReplayAssetPublishedPayload>;
export type ReplayDiscoveryEvent = DomainEvent<ReplayDiscoveryPayload>;
export type ReplayFailedEvent = DomainEvent<ReplayFailedPayload>;
