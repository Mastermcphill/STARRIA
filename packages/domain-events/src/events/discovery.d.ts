import type { DomainEvent } from '../event';
export declare const DISCOVERY_CONTENT_INDEXED = "discovery.content.indexed";
export declare const DISCOVERY_CONTENT_DEINDEXED = "discovery.content.deindexed";
export declare const DISCOVERY_SCORE_UPDATED = "discovery.score.updated";
export declare const LOCAL_TREND_TRIGGERED = "discovery.trend.local";
export declare const GLOBAL_TREND_TRIGGERED = "discovery.trend.global";
export type DiscoveryEntityType = 'star' | 'event' | 'replay' | 'arena' | 'video';
export interface ContentIndexedPayload {
    readonly entityId: string;
    readonly entityType: DiscoveryEntityType;
    readonly title?: string;
    readonly tags?: string[];
    readonly category?: string;
    readonly starId?: string;
    readonly isLive?: boolean;
    readonly indexedAt: string;
}
export interface ContentDeindexedPayload {
    readonly entityId: string;
    readonly entityType: DiscoveryEntityType;
    readonly reason: string;
    readonly deindexedAt: string;
}
export interface DiscoveryScoreUpdatedPayload {
    readonly entityId: string;
    readonly entityType: DiscoveryEntityType;
    readonly previousScore: number;
    readonly newScore: number;
}
export interface LocalTrendTriggeredPayload {
    readonly entityId: string;
    readonly entityType: DiscoveryEntityType;
    readonly region: string;
    readonly score: number;
    readonly rank: number;
    readonly triggeredAt: string;
}
export interface GlobalTrendTriggeredPayload {
    readonly entityId: string;
    readonly entityType: DiscoveryEntityType;
    readonly score: number;
    readonly rank: number;
    readonly triggeredAt: string;
}
export type ContentIndexedEvent = DomainEvent<ContentIndexedPayload>;
export type ContentDeindexedEvent = DomainEvent<ContentDeindexedPayload>;
export type DiscoveryScoreUpdatedEvent = DomainEvent<DiscoveryScoreUpdatedPayload>;
export type LocalTrendTriggeredEvent = DomainEvent<LocalTrendTriggeredPayload>;
export type GlobalTrendTriggeredEvent = DomainEvent<GlobalTrendTriggeredPayload>;
