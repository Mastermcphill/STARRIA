// ---------------------------------------------------------------------------
// arena-core — ArenaService
// Orchestrates Arena lifecycle: create → open → join → leave → close.
// Delegates real-time operations to LiveKitPort.
// Business logic: TODO (wire ports in consuming app)
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  ArenaRecord,
  CreateArenaInput,
  UpdateArenaInput,
  JoinArenaInput,
  LeaveArenaInput,
  ArenaJoinToken,
  ArenaModerationInput,
  ArenaModerationRecord,
  ArenaDiscoveryFilter,
  ArenaParticipant,
} from './types';
import { resolveArenaAccess } from './types';
import type { EventBus } from '@starria/domain-events';
import type {
  ArenaStorePort,
  ArenaParticipantPort,
  ArenaModerationPort,
  LiveKitPort,
  ArenaAnalyticsPort,
  ArenaNotificationPort,
  ArenaSubscriptionCheckPort,
} from './ports';
import {
  buildArenaCreatedEvent,
  buildArenaClosedEvent,
  buildParticipantJoinedEvent,
  buildParticipantLeftEvent,
  buildParticipantModeratedEvent,
} from './events';

export class ArenaService {
  constructor(
    private readonly arenas: ArenaStorePort,
    private readonly participants: ArenaParticipantPort,
    private readonly moderation: ArenaModerationPort,
    private readonly liveKit: LiveKitPort,
    private readonly subscriptionCheck?: ArenaSubscriptionCheckPort,
    private readonly analytics?: ArenaAnalyticsPort,
    private readonly notifications?: ArenaNotificationPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async getById(arenaId: string): Promise<ArenaRecord | undefined> {
    return this.arenas.findById(arenaId);
  }

  async create(input: CreateArenaInput, displayName: string): Promise<ArenaRecord> {
    const id = randomUUID();
    const livekitRoom = `arena-${id}`;
    const now = new Date().toISOString();
    await this.liveKit.ensureRoom(livekitRoom, { maxParticipants: input.maxParticipants ?? 500 });
    const arena = await this.arenas.create({
      ...input,
      id,
      livekitRoom,
      accessMode: input.accessMode ?? 'public',
      maxParticipants: input.maxParticipants ?? 500,
      currentParticipantCount: 0,
      totalParticipantCount: 0,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    void this.notifications?.onArenaOpened(arena.id, arena.starId);
    void this.eventBus?.publish(buildArenaCreatedEvent({
      arenaId: arena.id,
      starId: arena.starId,
      name: arena.name,
      accessMode: arena.accessMode,
      livekitRoom: arena.livekitRoom,
      createdAt: now,
    }));
    return arena;
  }

  async update(arenaId: string, input: UpdateArenaInput): Promise<ArenaRecord> {
    return this.arenas.update(arenaId, input);
  }

  async close(arenaId: string, starId: string): Promise<ArenaRecord> {
    const arena = await this.arenas.findById(arenaId);
    if (!arena) throw new Error(`Arena not found: ${arenaId}`);
    await this.liveKit.closeRoom(arena.livekitRoom);
    const closed = await this.arenas.updateStatus(arenaId, 'CLOSED');
    void this.notifications?.onArenaClosed(arenaId, starId);
    void this.eventBus?.publish(buildArenaClosedEvent({
      arenaId,
      starId,
      closedAt: new Date().toISOString(),
      totalParticipantCount: arena.totalParticipantCount,
    }));
    return closed;
  }

  async list(filter: ArenaDiscoveryFilter) {
    return this.arenas.list(filter);
  }

  // ── Join / Leave ──────────────────────────────────────────────────────────

  async join(input: JoinArenaInput, displayName: string): Promise<{ participant: ArenaParticipant; token: ArenaJoinToken }> {
    const arena = await this.arenas.findById(input.arenaId);
    if (!arena) throw new Error(`Arena not found: ${input.arenaId}`);

    const bannedIds = new Set(await this.moderation.listBanned(input.arenaId));
    const hasSubscription = await this.subscriptionCheck?.hasActiveSubscription(input.userId, arena.starId) ?? false;
    const isOwner = input.userId === arena.starId;

    const access = resolveArenaAccess(arena, {
      userId: input.userId,
      arenaId: input.arenaId,
      hasSubscription,
      isInvited: false,
      isOwner,
    }, bannedIds);

    if (!access.allowed) {
      throw new Error(`Arena access denied: ${access.reason}`);
    }

    const now = new Date().toISOString();
    const participant = await this.participants.join({
      arenaId: input.arenaId,
      userId: input.userId,
      id: randomUUID(),
      role: access.role,
      status: 'active',
      joinedAt: now,
    });

    const { token, expiresAt, serverUrl } = await this.liveKit.generateToken({
      roomName: arena.livekitRoom,
      userId: input.userId,
      displayName,
      role: access.role,
    });

    await this.arenas.incrementParticipants(input.arenaId, 1);
    void this.analytics?.trackParticipantJoined(input.arenaId, input.userId);
    void this.notifications?.onUserJoined(input.arenaId, input.userId, arena.starId);
    void this.eventBus?.publish(buildParticipantJoinedEvent({
      participantId: participant.id,
      arenaId: input.arenaId,
      userId: input.userId,
      role: access.role,
      joinedAt: now,
    }));

    return {
      participant,
      token: {
        provider: 'livekit',
        roomName: arena.livekitRoom,
        token,
        uid: input.userId,
        expiresAt,
        serverUrl,
        role: access.role,
      },
    };
  }

  async leave(input: LeaveArenaInput): Promise<void> {
    const participant = await this.participants.findActive(input.arenaId, input.userId);
    if (!participant) return;
    const now = new Date().toISOString();
    await this.participants.leave(input.arenaId, input.userId, now);
    await this.arenas.incrementParticipants(input.arenaId, -1);
    const joinedMs = new Date(participant.joinedAt).getTime();
    const durationSeconds = Math.floor((Date.now() - joinedMs) / 1000);
    void this.analytics?.trackParticipantLeft(input.arenaId, input.userId, durationSeconds);
    void this.eventBus?.publish(buildParticipantLeftEvent({
      participantId: participant.id,
      arenaId: input.arenaId,
      userId: input.userId,
      leftAt: now,
      durationSeconds,
    }));
  }

  async getParticipants(arenaId: string): Promise<ArenaParticipant[]> {
    return this.participants.listActive(arenaId);
  }

  // ── Moderation ────────────────────────────────────────────────────────────

  async moderate(input: ArenaModerationInput): Promise<ArenaModerationRecord> {
    const arena = await this.arenas.findById(input.arenaId);
    if (!arena) throw new Error(`Arena not found: ${input.arenaId}`);

    const now = new Date().toISOString();
    const expiresAt = input.durationSeconds
      ? new Date(Date.now() + input.durationSeconds * 1000).toISOString()
      : undefined;

    const record = await this.moderation.record({ ...input, id: randomUUID(), createdAt: now, expiresAt });

    if (input.action === 'remove' || input.action === 'ban') {
      await this.liveKit.removeParticipant(arena.livekitRoom, input.targetUserId);
      const participant = await this.participants.findActive(input.arenaId, input.targetUserId);
      if (participant) {
        await this.participants.updateStatus(participant.id, input.action === 'ban' ? 'banned' : 'removed', input.reason);
      }
      void this.notifications?.onUserRemoved(input.arenaId, input.targetUserId, input.reason);
    }
    if (input.action === 'mute') {
      await this.liveKit.muteParticipant(arena.livekitRoom, input.targetUserId);
    }
    if (input.action === 'promote') {
      const participant = await this.participants.findActive(input.arenaId, input.targetUserId);
      if (participant) await this.participants.updateRole(participant.id, 'speaker');
    }
    if (input.action === 'demote') {
      const participant = await this.participants.findActive(input.arenaId, input.targetUserId);
      if (participant) await this.participants.updateRole(participant.id, 'viewer');
    }

    void this.analytics?.trackModerationAction(input.arenaId, input.action, input.targetUserId);
    void this.eventBus?.publish(buildParticipantModeratedEvent({
      recordId: record.id,
      arenaId: input.arenaId,
      moderatorId: input.moderatorId ?? input.actorId,
      targetUserId: input.targetUserId,
      action: input.action,
      reason: input.reason,
      expiresAt,
    }));
    return record;
  }
}
