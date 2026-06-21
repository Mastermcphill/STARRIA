import type { DomainEvent } from '../event';
export declare const PRESENCE_UPDATED = "presence.updated";
export declare const USER_TYPING = "presence.user.typing";
export type PresenceState = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | 'IN_SESSION';
export interface PresenceUpdatedPayload {
    readonly userId: string;
    readonly state: PresenceState;
    readonly previousState: PresenceState;
    readonly lastSeenAt: string;
    readonly roomId?: string;
    readonly updatedAt: string;
}
export interface UserTypingPayload {
    readonly userId: string;
    readonly conversationId: string;
    readonly isTyping: boolean;
    readonly at: string;
}
export type PresenceUpdatedEvent = DomainEvent<PresenceUpdatedPayload>;
export type UserTypingEvent = DomainEvent<UserTypingPayload>;
