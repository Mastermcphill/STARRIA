// ---------------------------------------------------------------------------
// Prisma adapters — implement MessageStorePort + DMPermissionStorePort using
// the Conversation / DirectMessage / MessageRequest / DmPermission /
// ConversationUnread tables (migration 20260618000000_messaging_persistence).
// Replaces the Sprint 5 in-memory stores so messaging survives restarts.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  MessageRequest,
  Conversation,
  Message,
  InboxThread,
  DMPermission,
  MessageStorePort,
  DMPermissionStorePort,
  MessageRequestStatus,
  MessageType,
} from '@starria/messaging-core';
import type {
  MessageRequest as DbMessageRequest,
  Conversation as DbConversation,
  DirectMessage as DbDirectMessage,
  DmPermission as DbDmPermission,
} from '@prisma/client';

// ── Row → domain mappers ──────────────────────────────────────────────────────

function toRequest(r: DbMessageRequest): MessageRequest {
  return {
    id: r.id,
    senderId: r.senderId,
    recipientId: r.recipientId,
    senderPatronTier: r.senderPatronTier as MessageRequest['senderPatronTier'],
    openingMessage: r.openingMessage,
    status: r.status as MessageRequestStatus,
    sentAt: r.sentAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString(),
    conversationId: r.conversationId ?? undefined,
  };
}

function toConversation(c: DbConversation): Conversation {
  return {
    id: c.id,
    participantIds: c.participantIds,
    status: c.status as Conversation['status'],
    lastMessageAt: c.lastMessageAt?.toISOString(),
    openedAt: c.openedAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toMessage(m: DbDirectMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    recipientId: m.recipientId,
    type: m.type as MessageType,
    body: m.body,
    sentAt: m.sentAt.toISOString(),
  };
}

function toPermission(p: DbDmPermission): DMPermission {
  return {
    userId: p.userId,
    accessLevel: p.accessLevel as DMPermission['accessLevel'],
    customThresholdUsdCents: p.customThresholdUsdCents ?? undefined,
    allowedUserIds: p.allowedUserIds,
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaMessageRepository implements MessageStorePort {
  constructor(private readonly db: PrismaService) {}

  // ── Message requests ────────────────────────────────────────────────────────

  async findRequest(id: string): Promise<MessageRequest | null> {
    const r = await this.db.messageRequest.findUnique({ where: { id } });
    return r ? toRequest(r) : null;
  }

  async findRequestsByRecipient(recipientId: string, status?: MessageRequestStatus): Promise<MessageRequest[]> {
    const rows = await this.db.messageRequest.findMany({
      where: { recipientId, ...(status ? { status } : {}) },
      orderBy: { sentAt: 'desc' },
    });
    return rows.map(toRequest);
  }

  async createRequest(req: Omit<MessageRequest, 'id'>): Promise<MessageRequest> {
    const r = await this.db.messageRequest.create({
      data: {
        senderId: req.senderId,
        recipientId: req.recipientId,
        senderPatronTier: req.senderPatronTier,
        openingMessage: req.openingMessage,
        status: req.status,
        sentAt: new Date(req.sentAt),
        resolvedAt: req.resolvedAt ? new Date(req.resolvedAt) : null,
        conversationId: req.conversationId ?? null,
      },
    });
    return toRequest(r);
  }

  async updateRequest(id: string, patch: Partial<MessageRequest>): Promise<MessageRequest> {
    const r = await this.db.messageRequest.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.resolvedAt !== undefined ? { resolvedAt: patch.resolvedAt ? new Date(patch.resolvedAt) : null } : {}),
        ...(patch.conversationId !== undefined ? { conversationId: patch.conversationId ?? null } : {}),
      },
    });
    return toRequest(r);
  }

  // ── Conversations ─────────────────────────────────────────────────────────────

  async findConversation(id: string): Promise<Conversation | null> {
    const c = await this.db.conversation.findUnique({ where: { id } });
    return c ? toConversation(c) : null;
  }

  async findConversationByParticipants(userIdA: string, userIdB: string): Promise<Conversation | null> {
    const c = await this.db.conversation.findFirst({
      where: { AND: [{ participantIds: { has: userIdA } }, { participantIds: { has: userIdB } }] },
    });
    return c ? toConversation(c) : null;
  }

  async createConversation(conv: Omit<Conversation, 'id'>): Promise<Conversation> {
    const c = await this.db.conversation.create({
      data: {
        participantIds: [...conv.participantIds],
        status: conv.status,
        lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
        openedAt: new Date(conv.openedAt),
      },
    });
    return toConversation(c);
  }

  async updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const c = await this.db.conversation.update({
      where: { id },
      data: {
        ...(patch.participantIds !== undefined ? { participantIds: [...patch.participantIds] } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.lastMessageAt !== undefined ? { lastMessageAt: patch.lastMessageAt ? new Date(patch.lastMessageAt) : null } : {}),
      },
    });
    return toConversation(c);
  }

  // ── Messages ──────────────────────────────────────────────────────────────────

  async appendMessage(msg: Omit<Message, 'id'>): Promise<Message> {
    const m = await this.db.directMessage.create({
      data: {
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        type: msg.type,
        body: msg.body,
        sentAt: new Date(msg.sentAt),
      },
    });
    return toMessage(m);
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    // Return the most recent `limit` messages in chronological (ascending) order,
    // matching the in-memory `.slice(-limit)` behaviour.
    const rows = await this.db.directMessage.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
    return rows.reverse().map(toMessage);
  }

  // ── Inbox + unread ──────────────────────────────────────────────────────────────

  async getInbox(userId: string): Promise<InboxThread[]> {
    const convs = await this.db.conversation.findMany({
      where: { participantIds: { has: userId } },
      orderBy: { lastMessageAt: 'desc' },
    });

    const threads = await Promise.all(
      convs.map(async (conv) => {
        const otherUserId = conv.participantIds.find((id) => id !== userId) ?? '';
        const [last, unread] = await Promise.all([
          this.db.directMessage.findFirst({
            where: { conversationId: conv.id },
            orderBy: { sentAt: 'desc' },
          }),
          this.db.conversationUnread.findUnique({
            where: { conversationId_userId: { conversationId: conv.id, userId } },
          }),
        ]);
        return {
          conversationId: conv.id,
          otherUserId,
          lastMessage: last?.body,
          lastMessageAt: last?.sentAt.toISOString(),
          unreadCount: unread?.count ?? 0,
        } satisfies InboxThread;
      }),
    );

    return threads.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  }

  async incrementUnread(conversationId: string, recipientId: string): Promise<void> {
    await this.db.conversationUnread.upsert({
      where: { conversationId_userId: { conversationId, userId: recipientId } },
      create: { conversationId, userId: recipientId, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.db.conversationUnread.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, count: 0 },
      update: { count: 0 },
    });
  }
}

@Injectable()
export class PrismaDMPermissionRepository implements DMPermissionStorePort {
  constructor(private readonly db: PrismaService) {}

  async find(userId: string): Promise<DMPermission | null> {
    const p = await this.db.dmPermission.findUnique({ where: { userId } });
    return p ? toPermission(p) : null;
  }

  async upsert(perm: DMPermission): Promise<DMPermission> {
    const p = await this.db.dmPermission.upsert({
      where: { userId: perm.userId },
      create: {
        userId: perm.userId,
        accessLevel: perm.accessLevel,
        customThresholdUsdCents: perm.customThresholdUsdCents ?? null,
        allowedUserIds: perm.allowedUserIds ? [...perm.allowedUserIds] : [],
      },
      update: {
        accessLevel: perm.accessLevel,
        customThresholdUsdCents: perm.customThresholdUsdCents ?? null,
        allowedUserIds: perm.allowedUserIds ? [...perm.allowedUserIds] : [],
      },
    });
    return toPermission(p);
  }
}
