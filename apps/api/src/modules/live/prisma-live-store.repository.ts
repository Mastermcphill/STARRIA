// ---------------------------------------------------------------------------
// Prisma adapter — implements LiveRoomStorePort using Arena + WatchSession
// tables until a dedicated LiveRoom migration ships in Sprint 4.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  LiveRoom, LiveParticipant, LiveGift, LiveReplay,
  LiveModerationAction, LiveRoomStorePort,
} from '@starria/live-core';

// In-memory store (scoped to process lifetime) for participant & gift state.
// Persisted LiveRoom data uses the Arena table; participants use WatchSession.
const ROOMS = new Map<string, LiveRoom>();
const PARTICIPANTS = new Map<string, LiveParticipant>();
const GIFTS = new Map<string, LiveGift>();
const REPLAYS = new Map<string, LiveReplay>();
const MOD_ACTIONS: LiveModerationAction[] = [];

@Injectable()
export class PrismaLiveStoreRepository implements LiveRoomStorePort {
  constructor(private readonly db: PrismaService) {}

  // ── LiveRoom ────────────────────────────────────────────────────────────────

  async createRoom(input: Omit<LiveRoom, 'updatedAt'>): Promise<LiveRoom> {
    const room: LiveRoom = { ...input, updatedAt: input.createdAt };
    ROOMS.set(room.id, room);

    // Mirror into Arena table for cross-feature visibility
    await this.db.arena.upsert({
      where: { id: room.id },
      create: {
        id: room.id,
        starProfileId: room.starId,
        name: room.title,
        livekitRoom: room.livekitRoomName,
        maxParticipants: room.maxParticipants,
        status: 'ACTIVE',
      },
      update: { livekitRoom: room.livekitRoomName },
    });

    return room;
  }

  async findRoomById(roomId: string): Promise<LiveRoom | null> {
    return ROOMS.get(roomId) ?? null;
  }

  async findRoomByEventId(eventId: string): Promise<LiveRoom | null> {
    return [...ROOMS.values()].find(r => r.eventId === eventId) ?? null;
  }

  // Used by the LiveKit webhook receiver, which identifies rooms by their
  // LiveKit room name rather than our internal room id.
  async findRoomByLivekitName(livekitRoomName: string): Promise<LiveRoom | null> {
    return [...ROOMS.values()].find(r => r.livekitRoomName === livekitRoomName) ?? null;
  }

  async updateRoom(roomId: string, patch: Partial<LiveRoom>): Promise<LiveRoom> {
    const existing = ROOMS.get(roomId);
    if (!existing) throw new Error(`Room ${roomId} not found`);
    const updated: LiveRoom = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    ROOMS.set(roomId, updated);
    return updated;
  }

  // ── Participants ─────────────────────────────────────────────────────────────

  async createParticipant(participant: LiveParticipant): Promise<LiveParticipant> {
    PARTICIPANTS.set(`${participant.roomId}:${participant.userId}`, participant);
    // Persist as a WatchSession row for analytics
    await this.db.watchSession.create({
      data: {
        id: participant.id,
        userId: participant.userId,
        contentId: participant.roomId,
        contentType: 'live_room',
        joinedAt: new Date(participant.joinedAt),
      },
    });
    return participant;
  }

  async findParticipant(roomId: string, userId: string): Promise<LiveParticipant | null> {
    return PARTICIPANTS.get(`${roomId}:${userId}`) ?? null;
  }

  async updateParticipant(id: string, patch: Partial<LiveParticipant>): Promise<LiveParticipant> {
    const key = [...PARTICIPANTS.keys()].find(k => PARTICIPANTS.get(k)?.id === id);
    if (!key) throw new Error(`Participant ${id} not found`);
    const updated = { ...PARTICIPANTS.get(key)!, ...patch };
    PARTICIPANTS.set(key, updated);

    if (patch.leftAt) {
      await this.db.watchSession.update({
        where: { id },
        data: { leftAt: new Date(patch.leftAt), lastPositionSeconds: patch.watchSeconds },
      });
    }

    return updated;
  }

  async countActiveParticipants(roomId: string): Promise<number> {
    return [...PARTICIPANTS.values()].filter(
      p => p.roomId === roomId && !p.leftAt && !p.isBanned,
    ).length;
  }

  // ── Moderation ──────────────────────────────────────────────────────────────

  async createModerationAction(action: LiveModerationAction): Promise<LiveModerationAction> {
    MOD_ACTIONS.push(action);
    return action;
  }

  // ── Gifts ────────────────────────────────────────────────────────────────────

  async createGift(gift: LiveGift): Promise<LiveGift> {
    GIFTS.set(gift.id, gift);
    return gift;
  }

  // ── Replays ──────────────────────────────────────────────────────────────────

  async createReplay(replay: LiveReplay): Promise<LiveReplay> {
    REPLAYS.set(replay.id, replay);

    // Update Event with replay URL
    await this.db.event.update({
      where: { id: replay.eventId },
      data: { replayUrl: replay.playbackUrl, status: 'ENDED' },
    }).catch(() => undefined);

    return replay;
  }

  // ── Query helpers (used by controller) ──────────────────────────────────────

  getReplayById(replayId: string): LiveReplay | null {
    return REPLAYS.get(replayId) ?? null;
  }

  getReplaysForEvent(eventId: string): LiveReplay[] {
    return [...REPLAYS.values()].filter(r => r.eventId === eventId);
  }
}
