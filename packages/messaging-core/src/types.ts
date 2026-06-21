// ---------------------------------------------------------------------------
// messaging-core — domain types
// Messaging Prestige: gated DMs, message requests, conversations, inbox
// ---------------------------------------------------------------------------

import type { DMAccessLevel, MessageRequestStatus, ConversationStatus } from '@starria/domain-events';
export type { DMAccessLevel, MessageRequestStatus, ConversationStatus };

import type { PatronTier } from '@starria/patron-core';
export type { PatronTier };

// ── DMPermission ─────────────────────────────────────────────────────────────

export interface DMPermission {
  readonly userId: string;
  /** Who can send this user a message request */
  readonly accessLevel: DMAccessLevel;
  /** Custom minimum creator-scoped spend to qualify (cents). Only when accessLevel=CUSTOM */
  readonly customThresholdUsdCents?: number;
  /** Optional list of explicitly allowed userIds (CUSTOM mode) */
  readonly allowedUserIds?: readonly string[];
  readonly updatedAt: string;
}

// ── MessageRequest ────────────────────────────────────────────────────────────

export interface MessageRequest {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  /** Patron tier of sender at time of request */
  readonly senderPatronTier: PatronTier;
  /** Opening message included with the request */
  readonly openingMessage: string;
  readonly status: MessageRequestStatus;
  readonly sentAt: string;
  readonly resolvedAt?: string;
  /** If accepted, points to the created conversation */
  readonly conversationId?: string;
}

// ── Conversation ──────────────────────────────────────────────────────────────

export interface Conversation {
  readonly id: string;
  readonly participantIds: readonly string[];
  readonly status: ConversationStatus;
  readonly lastMessageAt?: string;
  readonly openedAt: string;
  readonly updatedAt: string;
}

// ── Message ───────────────────────────────────────────────────────────────────

export type MessageType = 'TEXT' | 'IMAGE' | 'GIFT_NOTIFICATION' | 'SYSTEM';

export interface Message {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly type: MessageType;
  readonly body: string;
  readonly sentAt: string;
}

// ── InboxThread ───────────────────────────────────────────────────────────────

export interface InboxThread {
  readonly conversationId: string;
  readonly otherUserId: string;
  readonly lastMessage?: string;
  readonly lastMessageAt?: string;
  readonly unreadCount: number;
}

// ── DM access gate ────────────────────────────────────────────────────────────

export interface DMGateContext {
  /** Patron tier of the sender */
  senderTier: PatronTier;
  /** Sender's spend toward this specific creator in USD cents */
  creatorScopedSpendUsdCents: number;
  /** How long the sender has been a supporter of this creator (days) */
  supporterDurationDays: number;
  /** Whether sender is in the creator's top-N supporters */
  isTopSupporter: boolean;
  /** The creator's DM permission setting */
  recipientPermission: DMPermission;
}

/** Returns null if access is granted, or a denial reason string */
export function checkDMAccess(ctx: DMGateContext): string | null {
  const { accessLevel, customThresholdUsdCents } = ctx.recipientPermission;

  switch (accessLevel) {
    case 'NOBODY':
      return 'This creator is not accepting DM requests.';

    case 'EVERYONE':
      return null;

    case 'SUPPORTERS':
      // Must have spent at least $1 toward this creator
      if (ctx.creatorScopedSpendUsdCents < 100) {
        return 'You must be a supporter of this creator to send a DM request.';
      }
      return null;

    case 'PATRONS':
      if (ctx.senderTier === 'VISITOR' || ctx.senderTier === 'SUPPORTER') {
        return 'You need Patron tier or higher to DM this creator.';
      }
      return null;

    case 'LEGENDS':
      if (ctx.senderTier !== 'LEGEND' && ctx.senderTier !== 'OG') {
        return 'You need Legend or OG tier to DM this creator.';
      }
      return null;

    case 'CUSTOM': {
      const threshold = customThresholdUsdCents ?? 10_000;
      // Custom: explicit allowlist OR spend threshold OR top supporter
      if (ctx.recipientPermission.allowedUserIds) {
        return null; // caller must check allowedUserIds separately
      }
      if (ctx.creatorScopedSpendUsdCents >= threshold) {
        return null;
      }
      if (ctx.isTopSupporter) {
        return null;
      }
      return `You need to spend $${(threshold / 100).toFixed(0)} with this creator to send a DM.`;
    }

    default:
      return 'DM access check failed.';
  }
}

// ── Broadcast access gate ─────────────────────────────────────────────────────

export function canBroadcast(tier: PatronTier): boolean {
  return tier === 'LEGEND' || tier === 'OG';
}

// ── Persistence ports ─────────────────────────────────────────────────────────

export interface MessageStorePort {
  findRequest(id: string): Promise<MessageRequest | null>;
  findRequestsByRecipient(recipientId: string, status?: MessageRequestStatus): Promise<MessageRequest[]>;
  createRequest(req: Omit<MessageRequest, 'id'>): Promise<MessageRequest>;
  updateRequest(id: string, patch: Partial<MessageRequest>): Promise<MessageRequest>;

  findConversation(id: string): Promise<Conversation | null>;
  findConversationByParticipants(userIdA: string, userIdB: string): Promise<Conversation | null>;
  createConversation(conv: Omit<Conversation, 'id'>): Promise<Conversation>;
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation>;

  appendMessage(msg: Omit<Message, 'id'>): Promise<Message>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;

  getInbox(userId: string): Promise<InboxThread[]>;
  incrementUnread(conversationId: string, recipientId: string): Promise<void>;
  markRead(conversationId: string, userId: string): Promise<void>;
}

export interface DMPermissionStorePort {
  find(userId: string): Promise<DMPermission | null>;
  upsert(perm: DMPermission): Promise<DMPermission>;
}

// ── Service I/O ───────────────────────────────────────────────────────────────

export interface SendMessageRequestInput {
  readonly senderId: string;
  readonly recipientId: string;
  readonly senderPatronTier: PatronTier;
  readonly openingMessage: string;
  readonly dmGateContext: DMGateContext;
}

export interface AcceptRequestInput {
  readonly requestId: string;
  readonly recipientId: string;
}

export interface DeclineRequestInput {
  readonly requestId: string;
  readonly recipientId: string;
}

export interface SendMessageInput {
  readonly conversationId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly type: MessageType;
  readonly body: string;
}

export interface UpdateDMPermissionInput {
  readonly userId: string;
  readonly accessLevel: DMAccessLevel;
  readonly customThresholdUsdCents?: number;
  readonly allowedUserIds?: string[];
}
