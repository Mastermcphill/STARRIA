import type { DomainEvent } from '../event';
export declare const POSTER_GENERATED = "poster.generated";
export declare const POSTER_FAILED = "poster.failed";
export interface PosterGeneratedPayload {
    readonly generationId: string;
    readonly starId: string;
    readonly eventId?: string;
    readonly resultImageUrl: string;
    readonly thumbnailUrl?: string;
    readonly prompt: string;
    readonly style?: string;
    readonly coinsCharged: number;
    readonly generationMs: number;
    readonly generatedAt: string;
}
export interface PosterFailedPayload {
    readonly generationId: string;
    readonly starId: string;
    readonly eventId?: string;
    readonly reason: string;
    readonly coinsRefunded: number;
    readonly failedAt: string;
}
export type PosterGeneratedEvent = DomainEvent<PosterGeneratedPayload>;
export type PosterFailedEvent = DomainEvent<PosterFailedPayload>;
