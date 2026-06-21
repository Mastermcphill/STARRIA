import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LiveRoomService } from '@starria/live-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaLiveStoreRepository } from './prisma-live-store.repository';
import { LiveKitAdapterService } from './livekit-adapter.service';
import { PrismaTicketRepository } from '../ticketing/prisma-ticket-store.repository';
import type { JoinRoomDto } from './dto/join-room.dto';
import type { SendLiveGiftDto } from './dto/send-live-gift.dto';

@Injectable()
export class LiveService {
  private readonly core: LiveRoomService;

  constructor(
    private readonly db: PrismaService,
    private readonly store: PrismaLiveStoreRepository,
    private readonly livekit: LiveKitAdapterService,
    private readonly ledger: PrismaTicketRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.core = new LiveRoomService(store, livekit, ledger, eventBus);
  }

  async joinRoom(eventId: string, userId: string, dto: JoinRoomDto) {
    let room = await this.store.findRoomByEventId(eventId);

    if (!room) {
      const event = await this.db.event.findUnique({
        where: { id: eventId },
        include: { starProfile: { select: { id: true } } },
      });
      if (!event) throw new NotFoundException(`Event ${eventId} not found`);

      room = await this.core.createRoom({
        eventId,
        starId: event.starProfile.id,
        title: event.title,
        roomType: 'PUBLIC',
      });

      await this.core.startRoom(room.id);
      room = await this.store.findRoomById(room.id) ?? room;
    }

    return this.core.joinRoom({ roomId: room.id, userId, role: dto.role });
  }

  async leaveRoom(eventId: string, userId: string) {
    const room = await this.store.findRoomByEventId(eventId);
    if (!room) return { left: false };
    await this.core.leaveRoom({ roomId: room.id, userId });
    return { left: true };
  }

  async sendGift(eventId: string, userId: string, dto: SendLiveGiftDto) {
    const room = await this.store.findRoomByEventId(eventId);
    if (!room) throw new NotFoundException('No live room for this event');

    return this.core.sendGift({
      roomId: room.id,
      eventId,
      senderId: userId,
      recipientId: dto.recipientId,
      giftType: dto.giftType,
      coins: dto.coins,
      message: dto.message,
      idempotencyKey: dto.idempotencyKey ?? `live-gift:${randomUUID()}`,
    });
  }

  async publishReplay(eventId: string, playbackUrl: string, durationSeconds: number) {
    const room = await this.store.findRoomByEventId(eventId);
    const event = await this.db.event.findUnique({
      where: { id: eventId },
      include: { starProfile: { select: { id: true } } },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    const roomId = room?.id ?? randomUUID();
    const starId = event.starProfile.id;

    return this.core.publishReplay({ roomId, eventId, starId, playbackUrl, durationSeconds });
  }

  getReplay(replayId: string) {
    const replay = this.store.getReplayById(replayId);
    if (!replay) throw new NotFoundException(`Replay ${replayId} not found`);
    return replay;
  }

  async getReplaysForEvent(eventId: string) {
    return this.store.getReplaysForEvent(eventId);
  }
}
