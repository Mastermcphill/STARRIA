import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsEventStore } from './analytics-event.store';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly store: AnalyticsEventStore) {}

  async trackRoomJoin(opts: { userId: string; roomId: string }) {
    this.logger.log({ event: 'ROOM_JOIN', ...opts });
    await this.store.record({
      eventType: 'ROOM_JOIN',
      actorId: opts.userId,
      subjectId: opts.roomId,
      subjectType: 'room',
    });
  }

  async trackUpload(opts: { userId: string; mediaId: string; sizeBytes?: number }) {
    this.logger.log({ event: 'UPLOAD', ...opts });
    await this.store.record({
      eventType: 'UPLOAD',
      actorId: opts.userId,
      subjectId: opts.mediaId,
      subjectType: 'media',
      value: opts.sizeBytes ?? 1,
    });
  }

  async trackAuthFailure(opts: { identifier?: string; reason: string }) {
    this.logger.warn({ event: 'AUTH_FAILURE', ...opts });
    await this.store.record({
      eventType: 'AUTH_FAILURE',
      metadata: { identifier: opts.identifier, reason: opts.reason },
    });
  }

  async trackApiError(opts: { requestId?: string; method: string; url: string; statusCode: number; error: string }) {
    this.logger.error({ event: 'API_ERROR', ...opts });
    await this.store.record({
      eventType: 'API_ERROR',
      metadata: opts,
    });
  }

  async trackGiftPurchase(opts: { buyerId: string; recipientId: string; coins: number; giftId: string }) {
    this.logger.log({ event: 'GIFT_PURCHASE', ...opts });
    await this.store.record({
      eventType: 'GIFT',
      actorId: opts.buyerId,
      creatorId: opts.recipientId,
      subjectId: opts.giftId,
      subjectType: 'gift',
      value: opts.coins,
    });
  }
}
