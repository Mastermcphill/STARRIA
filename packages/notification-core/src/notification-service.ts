// ---------------------------------------------------------------------------
// notification-core — NotificationService
// Generalised from LifeNest notifications/notification.service.ts.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  NotificationRecord,
  SendNotificationInput,
  NotificationListOptions,
  MarkAllReadResult,
  NotificationStatus,
  NotificationState,
} from './types';

// ---------------------------------------------------------------------------
// Storage port (implement with Prisma, MongoDB, Redis, etc.)
// ---------------------------------------------------------------------------

export interface NotificationStorePort {
  create(record: NotificationRecord): Promise<NotificationRecord>;
  findById(id: string): Promise<NotificationRecord | undefined>;
  findByDedupeKey(key: string): Promise<NotificationRecord | undefined>;
  list(options?: NotificationListOptions): Promise<NotificationRecord[]>;
  unreadCount(userId: string): Promise<number>;
  updateState(id: string, state: NotificationState, patch?: Partial<NotificationRecord>): Promise<NotificationRecord>;
  updateStatus(id: string, status: NotificationStatus, patch?: Partial<NotificationRecord>): Promise<NotificationRecord>;
  markAllRead(userId: string, readAt: string): Promise<MarkAllReadResult>;
}

// ---------------------------------------------------------------------------
// Delivery port (push / email / SMS — implement per channel)
// ---------------------------------------------------------------------------

export interface NotificationDeliveryPort {
  send(record: NotificationRecord): Promise<void>;
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export class NotificationService {
  constructor(
    private readonly store: NotificationStorePort,
    private readonly delivery?: NotificationDeliveryPort,
  ) {}

  async send(input: SendNotificationInput): Promise<NotificationRecord> {
    // Deduplication
    if (input.dedupeKey) {
      const existing = await this.store.findByDedupeKey(input.dedupeKey);
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: input.channel ?? 'in_app',
      status: 'queued',
      state: 'unread',
      priority: input.priority ?? 'normal',
      deferPolicy: input.deferPolicy ?? 'send_immediately',
      dedupeKey: input.dedupeKey,
      actorId: input.actorId,
      entityId: input.entityId,
      entityType: input.entityType,
      deepLink: input.deepLink,
      imageUrl: input.imageUrl,
      metadata: input.metadata,
      createdAt: now,
    };

    const saved = await this.store.create(record);

    // Fire-and-forget delivery
    this.delivery?.send(saved).catch(() => {
      // caller should schedule retry via worker
    });

    return saved;
  }

  async getById(id: string): Promise<NotificationRecord | undefined> {
    return this.store.findById(id);
  }

  async list(options?: NotificationListOptions): Promise<NotificationRecord[]> {
    return this.store.list(options);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.store.unreadCount(userId);
  }

  async markRead(id: string): Promise<NotificationRecord> {
    const now = new Date().toISOString();
    return this.store.updateState(id, 'read', { readAt: now, status: 'read' });
  }

  async markAllRead(userId: string): Promise<MarkAllReadResult> {
    return this.store.markAllRead(userId, new Date().toISOString());
  }

  async archive(id: string): Promise<NotificationRecord> {
    return this.store.updateState(id, 'archived');
  }

  async delete(id: string): Promise<NotificationRecord> {
    return this.store.updateState(id, 'deleted');
  }

  async markDelivered(id: string): Promise<NotificationRecord> {
    return this.store.updateStatus(id, 'delivered', { deliveredAt: new Date().toISOString() });
  }

  async markFailed(id: string): Promise<NotificationRecord> {
    return this.store.updateStatus(id, 'failed');
  }
}
