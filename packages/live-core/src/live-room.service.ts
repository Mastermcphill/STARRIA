// ---------------------------------------------------------------------------
// live-core — LiveRoomService
// Orchestrates room lifecycle, participant management, moderation, gifting,
// and replay publishing. Framework-agnostic; inject ports from the API layer.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type { CoinLedgerPort } from '@starria/gifting-core';
import { CoinGiftingService, createCommissionConfig } from '@starria/gifting-core';
import type {
  LiveRoom, LiveParticipant, LiveGift, LiveReplay, LiveModerationAction,
  CreateLiveRoomInput, JoinRoomInput, JoinRoomResult,
  LeaveRoomInput, ModerationInput, SendLiveGiftInput, PublishReplayInput,
  LiveRoomStorePort, LiveKitPort,
} from './types';
import {
  buildLiveCreatedEvent, buildLiveStartedEvent, buildLiveEndedEvent,
  buildParticipantJoinedEvent, buildParticipantLeftEvent, buildParticipantBannedEvent,
  buildLiveGiftSentEvent, buildReplayPublishedEvent,
} from './events';

export class LiveRoomService {
  constructor(
    private readonly store: LiveRoomStorePort,
    private readonly livekit: LiveKitPort,
    private readonly ledger: CoinLedgerPort,
    private readonly eventBus: EventBus,
    private readonly platformFeePct: number = 40,
  ) {}

  // ── Room lifecycle ─────────────────────────────────────────────────────────

  async createRoom(input: CreateLiveRoomInput): Promise<LiveRoom> {
    const roomId = randomUUID();
    const livekitRoomName = `starria-live-${roomId}`;
    const now = new Date().toISOString();
    const max = input.maxParticipants ?? 500;

    await this.livekit.createRoom(livekitRoomName, max);

    const room = await this.store.createRoom({
      id: roomId,
      eventId: input.eventId,
      starId: input.starId,
      title: input.title,
      roomType: input.roomType,
      status: 'WAITING',
      livekitRoomName,
      maxParticipants: max,
      participantCount: 0,
      peakViewerCount: 0,
      totalGiftsSentCoins: 0,
      createdAt: now,
    });

    void this.eventBus.publish(buildLiveCreatedEvent({
      roomId, eventId: input.eventId, starId: input.starId,
      roomType: input.roomType, title: input.title,
    }));

    return room;
  }

  async startRoom(roomId: string): Promise<LiveRoom> {
    const room = await this.requireRoom(roomId);
    const updated = await this.store.updateRoom(roomId, {
      status: 'LIVE',
      startedAt: new Date().toISOString(),
    });

    void this.eventBus.publish(buildLiveStartedEvent({
      roomId, eventId: room.eventId, starId: room.starId,
    }));

    return updated;
  }

  async endRoom(roomId: string): Promise<LiveRoom> {
    const room = await this.requireRoom(roomId);
    const endedAt = new Date().toISOString();
    const durationSeconds = room.startedAt
      ? Math.round((Date.parse(endedAt) - Date.parse(room.startedAt)) / 1000)
      : 0;

    const updated = await this.store.updateRoom(roomId, {
      status: 'ENDED',
      endedAt,
    });

    await this.livekit.deleteRoom(room.livekitRoomName);

    void this.eventBus.publish(buildLiveEndedEvent({
      roomId, eventId: room.eventId, starId: room.starId,
      durationSeconds, peakViewerCount: room.peakViewerCount,
      totalGiftsSentCoins: room.totalGiftsSentCoins,
    }));

    return updated;
  }

  // ── Participants ───────────────────────────────────────────────────────────

  async joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
    const room = await this.requireRoom(input.roomId);
    if (room.status === 'ENDED') throw new Error('Room has ended');

    const existing = await this.store.findParticipant(input.roomId, input.userId);
    if (existing?.isBanned) throw new Error('User is banned from this room');

    const role = input.role ?? 'VIEWER';
    const participantId = randomUUID();
    const identity = `user-${input.userId}`;
    const now = new Date().toISOString();

    let participant: LiveParticipant;
    if (existing && !existing.leftAt) {
      participant = existing;
    } else {
      participant = await this.store.createParticipant({
        id: participantId,
        roomId: input.roomId,
        userId: input.userId,
        role,
        livekitIdentity: identity,
        isMuted: false,
        isBanned: false,
        joinedAt: now,
        watchSeconds: 0,
      });

      const count = await this.store.countActiveParticipants(input.roomId);
      await this.store.updateRoom(input.roomId, {
        participantCount: count,
        peakViewerCount: Math.max(room.peakViewerCount, count),
      });

      void this.eventBus.publish(buildParticipantJoinedEvent({
        participantId: participant.id,
        roomId: input.roomId,
        userId: input.userId,
        role,
      }));
    }

    const livekitToken = await this.livekit.generateToken({
      roomName: room.livekitRoomName,
      identity,
      canPublish: role === 'HOST' || role === 'COHOST' || role === 'GUEST',
      canSubscribe: true,
    });

    return {
      participant,
      livekitToken,
      room: {
        id: room.id,
        title: room.title,
        roomType: room.roomType,
        status: room.status,
        participantCount: room.participantCount,
      },
    };
  }

  async leaveRoom(input: LeaveRoomInput): Promise<void> {
    const participant = await this.store.findParticipant(input.roomId, input.userId);
    if (!participant || participant.leftAt) return;

    const watchSeconds = Math.round(
      (Date.now() - Date.parse(participant.joinedAt)) / 1000,
    );

    await this.store.updateParticipant(participant.id, {
      leftAt: new Date().toISOString(),
      watchSeconds,
    });

    const count = await this.store.countActiveParticipants(input.roomId);
    await this.store.updateRoom(input.roomId, { participantCount: count });

    void this.eventBus.publish(buildParticipantLeftEvent({
      participantId: participant.id,
      roomId: input.roomId,
      userId: input.userId,
      watchSeconds,
    }));
  }

  // ── Moderation ─────────────────────────────────────────────────────────────

  async moderate(input: ModerationInput): Promise<LiveModerationAction> {
    const room = await this.requireRoom(input.roomId);
    const participant = await this.store.findParticipant(input.roomId, input.targetUserId);
    const identity = participant?.livekitIdentity ?? `user-${input.targetUserId}`;

    switch (input.action) {
      case 'MUTE':
        await this.livekit.muteParticipant(room.livekitRoomName, identity, true);
        if (participant) await this.store.updateParticipant(participant.id, { isMuted: true });
        break;
      case 'UNMUTE':
        await this.livekit.muteParticipant(room.livekitRoomName, identity, false);
        if (participant) await this.store.updateParticipant(participant.id, { isMuted: false });
        break;
      case 'KICK':
        await this.livekit.removeParticipant(room.livekitRoomName, identity);
        if (participant) await this.store.updateParticipant(participant.id, { leftAt: new Date().toISOString() });
        break;
      case 'BAN':
        await this.livekit.removeParticipant(room.livekitRoomName, identity);
        if (participant) await this.store.updateParticipant(participant.id, { isBanned: true, leftAt: new Date().toISOString() });
        void this.eventBus.publish(buildParticipantBannedEvent({
          roomId: input.roomId, bannedUserId: input.targetUserId,
          moderatorId: input.moderatorId, reason: input.reason,
        }));
        break;
      case 'PROMOTE_COHOST':
        if (participant) await this.store.updateParticipant(participant.id, { role: 'COHOST' });
        break;
      case 'DEMOTE_VIEWER':
        if (participant) await this.store.updateParticipant(participant.id, { role: 'VIEWER' });
        break;
    }

    return this.store.createModerationAction({
      id: randomUUID(),
      roomId: input.roomId,
      moderatorId: input.moderatorId,
      targetUserId: input.targetUserId,
      action: input.action,
      reason: input.reason,
      createdAt: new Date().toISOString(),
    });
  }

  // ── Live gifting ───────────────────────────────────────────────────────────

  async sendGift(input: SendLiveGiftInput): Promise<LiveGift> {
    const room = await this.requireRoom(input.roomId);
    if (room.status !== 'LIVE') throw new Error('Room is not live');

    const commission = createCommissionConfig(this.platformFeePct);
    const gifting = new CoinGiftingService(this.ledger, commission, undefined, this.eventBus);

    const result = await gifting.sendCoinGift({
      senderId: input.senderId,
      recipientId: input.recipientId,
      coins: input.coins,
      targetType: 'LIVE_STREAM',
      contentId: input.roomId,
      idempotencyKey: input.idempotencyKey,
      note: input.message,
    });

    const gift = await this.store.createGift({
      id: randomUUID(),
      roomId: input.roomId,
      eventId: input.eventId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      giftType: input.giftType,
      coins: input.coins,
      creatorAmount: result.creatorAmount,
      platformCut: result.platformCut,
      message: input.message,
      sentAt: new Date().toISOString(),
    });

    await this.store.updateRoom(input.roomId, {
      totalGiftsSentCoins: room.totalGiftsSentCoins + input.coins,
    });

    void this.eventBus.publish(buildLiveGiftSentEvent({
      giftId: gift.id,
      roomId: input.roomId,
      eventId: input.eventId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      coins: input.coins,
      creatorAmount: result.creatorAmount,
      platformCut: result.platformCut,
      giftType: input.giftType,
    }));

    return gift;
  }

  // ── Replay publishing ──────────────────────────────────────────────────────

  async publishReplay(input: PublishReplayInput): Promise<LiveReplay> {
    const room = await this.requireRoom(input.roomId);
    const now = new Date().toISOString();

    const replay = await this.store.createReplay({
      id: randomUUID(),
      roomId: input.roomId,
      eventId: input.eventId,
      starId: input.starId,
      playbackUrl: input.playbackUrl,
      thumbnailUrl: input.thumbnailUrl,
      durationSeconds: input.durationSeconds,
      viewCount: 0,
      publishedAt: now,
      createdAt: now,
    });

    void this.eventBus.publish(buildReplayPublishedEvent({
      replayId: replay.id,
      roomId: input.roomId,
      eventId: input.eventId,
      starId: input.starId,
      playbackUrl: input.playbackUrl,
      durationSeconds: input.durationSeconds,
    }));

    return replay;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async requireRoom(roomId: string): Promise<LiveRoom> {
    const room = await this.store.findRoomById(roomId);
    if (!room) throw new Error(`LiveRoom ${roomId} not found`);
    return room;
  }
}
