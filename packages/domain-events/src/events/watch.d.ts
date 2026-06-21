import type { DomainEvent } from '../event';
export declare const WATCH_STARTED = "analytics.watch.started";
export declare const WATCH_COMPLETED = "analytics.watch.completed";
export interface WatchStartedPayload {
    readonly watchId: string;
    readonly userId: string;
    readonly videoId: string;
    readonly starProfileId: string;
    readonly country?: string;
    readonly startedAt: string;
}
export interface WatchCompletedPayload {
    readonly watchId: string;
    readonly userId: string;
    readonly videoId: string;
    readonly starProfileId: string;
    readonly watchSeconds: number;
    readonly durationSeconds: number;
    /** 0..1 fraction of the video watched. */
    readonly retention: number;
    /** true when retention >= completion threshold (default 0.9). */
    readonly completed: boolean;
    readonly completedAt: string;
}
export type WatchStartedEvent = DomainEvent<WatchStartedPayload>;
export type WatchCompletedEvent = DomainEvent<WatchCompletedPayload>;
