// ---------------------------------------------------------------------------
// domain-events — Sprint 5 Messaging Prestige events
// ---------------------------------------------------------------------------

import type { DomainEvent } from '../event';

export const MESSAGE_REQUEST_SENT     = 'messaging.request.sent';
export const MESSAGE_REQUEST_ACCEPTED = 'messaging.request.accepted';
export const MESSAGE_REQUEST_DECLINED = 'messaging.request.declined';
export const MESSAGE_SENT             = 'messaging.message.sent';
export const CONVERSATION_OPENED      = 'messaging.conversation.opened';
export const CONVERSATION_ARCHIVED    = 'messaging.conversation.archived';
export const DM_PERMISSION_UPDATED    = 'messaging.dm_permission.updated';

export type MessageRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type ConversationStatus   = 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
export type DMAccessLevel        = 'NOBODY' | 'SUPPORTERS' | 'PATRONS' | 'LEGENDS' | 'EVERYONE' | 'CUSTOM';

export interface MessageRequestSentPayload {
  readonly requestId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly senderPatronTier: string;
  readonly message: string;
  readonly sentAt: string;
}

export interface MessageRequestAcceptedPayload {
  readonly requestId: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly acceptedAt: string;
}

export interface MessageRequestDeclinedPayload {
  readonly requestId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly declinedAt: string;
}

export interface MessageSentPayload {
  readonly messageId: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly sentAt: string;
}

export interface ConversationOpenedPayload {
  readonly conversationId: string;
  readonly participantIds: string[];
  readonly openedAt: string;
}

export interface ConversationArchivedPayload {
  readonly conversationId: string;
  readonly archivedBy: string;
  readonly archivedAt: string;
}

export interface DMPermissionUpdatedPayload {
  readonly userId: string;
  readonly accessLevel: DMAccessLevel;
  readonly customThresholdUsdCents?: number;
  readonly updatedAt: string;
}

export type MessageRequestSentEvent     = DomainEvent<MessageRequestSentPayload>;
export type MessageRequestAcceptedEvent = DomainEvent<MessageRequestAcceptedPayload>;
export type MessageRequestDeclinedEvent = DomainEvent<MessageRequestDeclinedPayload>;
export type MessageSentEvent            = DomainEvent<MessageSentPayload>;
export type ConversationOpenedEvent     = DomainEvent<ConversationOpenedPayload>;
export type ConversationArchivedEvent   = DomainEvent<ConversationArchivedPayload>;
export type DMPermissionUpdatedEvent    = DomainEvent<DMPermissionUpdatedPayload>;
