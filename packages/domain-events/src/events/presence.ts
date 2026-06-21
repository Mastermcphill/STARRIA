// ---------------------------------------------------------------------------
// domain-events — Sprint 5 Presence System events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const PRESENCE_UPDATED = 'presence.updated';
export const USER_TYPING      = 'presence.user.typing';

export type PresenceState = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | 'IN_SESSION';

export interface PresenceUpdatedPayload {
  readonly userId: string;
  readonly state: PresenceState;
  readonly previousState: PresenceState;
  readonly lastSeenAt: string;
  readonly roomId?: string;       // set when IN_SESSION
  readonly updatedAt: string;
}

export interface UserTypingPayload {
  readonly userId: string;
  readonly conversationId: string;
  readonly isTyping: boolean;
  readonly at: string;
}

export type PresenceUpdatedEvent = DomainEvent<PresenceUpdatedPayload>;
export type UserTypingEvent      = DomainEvent<UserTypingPayload>;
