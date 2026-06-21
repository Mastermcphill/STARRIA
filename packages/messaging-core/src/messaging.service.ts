// ---------------------------------------------------------------------------
// messaging-core — MessagingService
// Handles DM request flow, conversation management, inbox, DM permission CRUD.
// Framework-agnostic. Emits domain events.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  MessageRequest,
  Conversation,
  Message,
  InboxThread,
  DMPermission,
  MessageStorePort,
  DMPermissionStorePort,
  SendMessageRequestInput,
  AcceptRequestInput,
  DeclineRequestInput,
  SendMessageInput,
  UpdateDMPermissionInput,
} from './types';
import { checkDMAccess } from './types';
import {
  buildMessageRequestSent,
  buildMessageRequestAccepted,
  buildMessageRequestDeclined,
  buildMessageSent,
  buildConversationOpened,
  buildConversationArchived,
  buildDMPermissionUpdated,
} from './events';

export class MessagingService {
  constructor(
    private readonly messageStore: MessageStorePort,
    private readonly permissionStore: DMPermissionStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── DM Permission ────────────────────────────────────────────────────────────

  async getDMPermission(userId: string): Promise<DMPermission> {
    const perm = await this.permissionStore.find(userId);
    if (perm) return perm;
    // Default: anyone with supporter spend can request
    return {
      userId,
      accessLevel: 'SUPPORTERS',
      updatedAt: new Date().toISOString(),
    };
  }

  async updateDMPermission(input: UpdateDMPermissionInput): Promise<DMPermission> {
    const now = new Date().toISOString();
    const perm = await this.permissionStore.upsert({
      userId: input.userId,
      accessLevel: input.accessLevel,
      customThresholdUsdCents: input.customThresholdUsdCents,
      allowedUserIds: input.allowedUserIds,
      updatedAt: now,
    });

    void this.eventBus?.publish(buildDMPermissionUpdated({
      userId: input.userId,
      accessLevel: input.accessLevel,
      customThresholdUsdCents: input.customThresholdUsdCents,
      updatedAt: now,
    }));

    return perm;
  }

  // ── Message Requests ──────────────────────────────────────────────────────────

  async sendRequest(input: SendMessageRequestInput): Promise<MessageRequest> {
    const now = new Date().toISOString();

    // Gate check
    const denial = checkDMAccess(input.dmGateContext);
    if (denial) throw new Error(denial);

    // Check no existing open request between these two users
    const existing = await this.messageStore.findRequestsByRecipient(input.recipientId, 'PENDING');
    const duplicate = existing.find(r => r.senderId === input.senderId);
    if (duplicate) throw new Error('A pending request already exists between these users.');

    const request = await this.messageStore.createRequest({
      senderId: input.senderId,
      recipientId: input.recipientId,
      senderPatronTier: input.senderPatronTier,
      openingMessage: input.openingMessage,
      status: 'PENDING',
      sentAt: now,
    });

    void this.eventBus?.publish(buildMessageRequestSent({
      requestId: request.id,
      senderId: input.senderId,
      recipientId: input.recipientId,
      senderPatronTier: input.senderPatronTier,
      message: input.openingMessage,
      sentAt: now,
    }));

    return request;
  }

  async getPendingRequests(recipientId: string): Promise<MessageRequest[]> {
    return this.messageStore.findRequestsByRecipient(recipientId, 'PENDING');
  }

  async acceptRequest(input: AcceptRequestInput): Promise<Conversation> {
    const now = new Date().toISOString();

    const req = await this.messageStore.findRequest(input.requestId);
    if (!req) throw new Error(`Request not found: ${input.requestId}`);
    if (req.recipientId !== input.recipientId) throw new Error('Not authorized to accept this request.');
    if (req.status !== 'PENDING') throw new Error(`Request is ${req.status}, cannot accept.`);

    // Check if conversation already exists
    let conv = await this.messageStore.findConversationByParticipants(req.senderId, req.recipientId);
    if (!conv) {
      conv = await this.messageStore.createConversation({
        participantIds: [req.senderId, req.recipientId],
        status: 'ACTIVE',
        openedAt: now,
        updatedAt: now,
      });

      void this.eventBus?.publish(buildConversationOpened({
        conversationId: conv.id,
        participantIds: [req.senderId, req.recipientId],
        openedAt: now,
      }));
    }

    await this.messageStore.updateRequest(input.requestId, {
      status: 'ACCEPTED',
      resolvedAt: now,
      conversationId: conv.id,
    });

    void this.eventBus?.publish(buildMessageRequestAccepted({
      requestId: input.requestId,
      conversationId: conv.id,
      senderId: req.senderId,
      recipientId: req.recipientId,
      acceptedAt: now,
    }));

    // Seed the conversation with the opening message
    await this.sendMessage({
      conversationId: conv.id,
      senderId: req.senderId,
      recipientId: req.recipientId,
      type: 'TEXT',
      body: req.openingMessage,
    });

    return conv;
  }

  async declineRequest(input: DeclineRequestInput): Promise<MessageRequest> {
    const now = new Date().toISOString();

    const req = await this.messageStore.findRequest(input.requestId);
    if (!req) throw new Error(`Request not found: ${input.requestId}`);
    if (req.recipientId !== input.recipientId) throw new Error('Not authorized to decline this request.');
    if (req.status !== 'PENDING') throw new Error(`Request is ${req.status}, cannot decline.`);

    const updated = await this.messageStore.updateRequest(input.requestId, {
      status: 'DECLINED',
      resolvedAt: now,
    });

    void this.eventBus?.publish(buildMessageRequestDeclined({
      requestId: input.requestId,
      senderId: req.senderId,
      recipientId: req.recipientId,
      declinedAt: now,
    }));

    return updated;
  }

  // ── Conversations & Messages ──────────────────────────────────────────────────

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.messageStore.findConversation(conversationId);
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    return this.messageStore.getMessages(conversationId, limit);
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const now = new Date().toISOString();

    const conv = await this.messageStore.findConversation(input.conversationId);
    if (!conv) throw new Error(`Conversation not found: ${input.conversationId}`);
    if (conv.status !== 'ACTIVE') throw new Error('Cannot send to an archived or blocked conversation.');
    if (!conv.participantIds.includes(input.senderId)) {
      throw new Error('Sender is not a participant in this conversation.');
    }

    const message = await this.messageStore.appendMessage({
      conversationId: input.conversationId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      type: input.type,
      body: input.body,
      sentAt: now,
    });

    await this.messageStore.updateConversation(input.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
    });

    await this.messageStore.incrementUnread(input.conversationId, input.recipientId);

    void this.eventBus?.publish(buildMessageSent({
      messageId: message.id,
      conversationId: input.conversationId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      sentAt: now,
    }));

    return message;
  }

  async archiveConversation(conversationId: string, userId: string): Promise<Conversation> {
    const now = new Date().toISOString();

    const conv = await this.messageStore.findConversation(conversationId);
    if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
    if (!conv.participantIds.includes(userId)) throw new Error('Not a participant.');

    const updated = await this.messageStore.updateConversation(conversationId, {
      status: 'ARCHIVED',
      updatedAt: now,
    });

    void this.eventBus?.publish(buildConversationArchived({
      conversationId,
      archivedBy: userId,
      archivedAt: now,
    }));

    return updated;
  }

  // ── Inbox ─────────────────────────────────────────────────────────────────────

  async getInbox(userId: string): Promise<InboxThread[]> {
    return this.messageStore.getInbox(userId);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    return this.messageStore.markRead(conversationId, userId);
  }
}
