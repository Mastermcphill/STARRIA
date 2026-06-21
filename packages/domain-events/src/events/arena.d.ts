import type { DomainEvent } from '../event';
export declare const ARENA_CREATED = "arena.created";
export declare const ARENA_CLOSED = "arena.closed";
export declare const ARENA_PARTICIPANT_JOINED = "arena.participant.joined";
export declare const ARENA_PARTICIPANT_LEFT = "arena.participant.left";
export declare const ARENA_PARTICIPANT_MUTED = "arena.participant.muted";
export declare const ARENA_PARTICIPANT_REMOVED = "arena.participant.removed";
export declare const ARENA_PARTICIPANT_BANNED = "arena.participant.banned";
export declare const ARENA_PARTICIPANT_PROMOTED = "arena.participant.promoted";
export declare const ARENA_PARTICIPANT_DEMOTED = "arena.participant.demoted";
export interface ArenaCreatedPayload {
    readonly arenaId: string;
    readonly starId: string;
    readonly name: string;
    readonly accessMode: string;
    readonly livekitRoom: string;
    readonly createdAt: string;
}
export interface ArenaClosedPayload {
    readonly arenaId: string;
    readonly starId: string;
    readonly closedAt: string;
    readonly totalParticipantCount: number;
}
export interface ArenaParticipantJoinedPayload {
    readonly participantId: string;
    readonly arenaId: string;
    readonly userId: string;
    readonly role: string;
    readonly joinedAt: string;
}
export interface ArenaParticipantLeftPayload {
    readonly participantId: string;
    readonly arenaId: string;
    readonly userId: string;
    readonly leftAt: string;
    readonly durationSeconds: number;
}
export interface ArenaParticipantModeratedPayload {
    readonly recordId: string;
    readonly arenaId: string;
    readonly moderatorId: string;
    readonly targetUserId: string;
    readonly action: string;
    readonly reason?: string;
    readonly expiresAt?: string;
}
export type ArenaCreatedEvent = DomainEvent<ArenaCreatedPayload>;
export type ArenaClosedEvent = DomainEvent<ArenaClosedPayload>;
export type ArenaParticipantJoinedEvent = DomainEvent<ArenaParticipantJoinedPayload>;
export type ArenaParticipantLeftEvent = DomainEvent<ArenaParticipantLeftPayload>;
export type ArenaParticipantModeratedEvent = DomainEvent<ArenaParticipantModeratedPayload>;
