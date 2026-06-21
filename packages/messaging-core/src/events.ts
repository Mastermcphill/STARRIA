// ---------------------------------------------------------------------------
// messaging-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  MessageRequestSentEvent,
  MessageRequestAcceptedEvent,
  MessageRequestDeclinedEvent,
  MessageSentEvent,
  ConversationOpenedEvent,
  ConversationArchivedEvent,
  DMPermissionUpdatedEvent,
} from '@starria/domain-events';
import {
  MESSAGE_REQUEST_SENT,
  MESSAGE_REQUEST_ACCEPTED,
  MESSAGE_REQUEST_DECLINED,
  MESSAGE_SENT,
  CONVERSATION_OPENED,
  CONVERSATION_ARCHIVED,
  DM_PERMISSION_UPDATED,
} from '@starria/domain-events';
import type { DMAccessLevel } from './types';

export function buildMessageRequestSent(params: {
  requestId: string;
  senderId: string;
  recipientId: string;
  senderPatronTier: string;
  message: string;
  sentAt: string;
}): MessageRequestSentEvent {
  return createEvent({
    id: randomUUID(),
    type: MESSAGE_REQUEST_SENT,
    aggregateId: params.requestId,
    aggregateType: 'MessageRequest',
    payload: params,
  });
}

export function buildMessageRequestAccepted(params: {
  requestId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  acceptedAt: string;
}): MessageRequestAcceptedEvent {
  return createEvent({
    id: randomUUID(),
    type: MESSAGE_REQUEST_ACCEPTED,
    aggregateId: params.requestId,
    aggregateType: 'MessageRequest',
    payload: params,
  });
}

export function buildMessageRequestDeclined(params: {
  requestId: string;
  senderId: string;
  recipientId: string;
  declinedAt: string;
}): MessageRequestDeclinedEvent {
  return createEvent({
    id: randomUUID(),
    type: MESSAGE_REQUEST_DECLINED,
    aggregateId: params.requestId,
    aggregateType: 'MessageRequest',
    payload: params,
  });
}

export function buildMessageSent(params: {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  sentAt: string;
}): MessageSentEvent {
  return createEvent({
    id: randomUUID(),
    type: MESSAGE_SENT,
    aggregateId: params.conversationId,
    aggregateType: 'Conversation',
    payload: params,
  });
}

export function buildConversationOpened(params: {
  conversationId: string;
  participantIds: string[];
  openedAt: string;
}): ConversationOpenedEvent {
  return createEvent({
    id: randomUUID(),
    type: CONVERSATION_OPENED,
    aggregateId: params.conversationId,
    aggregateType: 'Conversation',
    payload: params,
  });
}

export function buildConversationArchived(params: {
  conversationId: string;
  archivedBy: string;
  archivedAt: string;
}): ConversationArchivedEvent {
  return createEvent({
    id: randomUUID(),
    type: CONVERSATION_ARCHIVED,
    aggregateId: params.conversationId,
    aggregateType: 'Conversation',
    payload: params,
  });
}

export function buildDMPermissionUpdated(params: {
  userId: string;
  accessLevel: DMAccessLevel;
  customThresholdUsdCents?: number;
  updatedAt: string;
}): DMPermissionUpdatedEvent {
  return createEvent({
    id: randomUUID(),
    type: DM_PERMISSION_UPDATED,
    aggregateId: params.userId,
    aggregateType: 'DMPermission',
    payload: params,
  });
}
