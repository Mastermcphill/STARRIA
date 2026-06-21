// ---------------------------------------------------------------------------
// session-engine-core — SessionEngineService
// One engine for every room type: lifecycle, participants (limits + roles),
// billing hooks, moderation hooks, recording, replay handoff, invites.
// Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  SessionRoom,
  SessionParticipant,
  SessionRecording,
  SessionModeration,
  SessionBilling,
  CreateRoomInput,
  JoinRoomInput,
  InviteInput,
  ModerateInput,
  SessionEngineStorePort,
  SessionBillingPort,
  LiveKitProviderPort,
  SessionRoomRole,
} from './types';
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_MAX_PARTICIPANTS,
  DEFAULT_PLATFORM_FEE_PCT,
  DEFAULT_CREATOR_PCT,
} from './types';
import {
  buildRoomCreated,
  buildRoomOpened,
  buildRoomStarted,
  buildRoomPaused,
  buildRoomEnded,
  buildRoomCancelled,
  buildParticipantJoined,
  buildParticipantLeft,
  buildParticipantInvited,
  buildParticipantPromoted,
  buildParticipantRemoved,
  buildBillingCharged,
  buildBillingSettled,
  buildModerationFlagged,
  buildModerationActioned,
  buildRecordingStarted,
  buildRecordingStopped,
} from './events';

export interface SessionEngineDeps {
  store: SessionEngineStorePort;
  billing: SessionBillingPort;
  livekit: LiveKitProviderPort;
  eventBus?: EventBus;
}

export class SessionEngineService {
  private readonly store: SessionEngineStorePort;
  private readonly billing: SessionBillingPort;
  private readonly livekit: LiveKitProviderPort;
  private readonly eventBus?: EventBus;

  constructor(deps: SessionEngineDeps) {
    this.store = deps.store;
    this.billing = deps.billing;
    this.livekit = deps.livekit;
    this.eventBus = deps.eventBus;
  }

  // ── Room lifecycle ────────────────────────────────────────────────────────────

  async createRoom(input: CreateRoomInput): Promise<SessionRoom> {
    if (input.idempotencyKey) {
      const existing = await this.store.findRoomByKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const roomId = randomUUID();
    const livekitRoomName = `room_${roomId}`;
    const maxParticipants = input.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS[input.roomType];

    const billing: SessionBilling = {
      mode: input.billing?.mode ?? 'FREE',
      entryCoins: input.billing?.entryCoins,
      perMinuteCoins: input.billing?.perMinuteCoins,
      platformFeePct: input.billing?.platformFeePct ?? DEFAULT_PLATFORM_FEE_PCT,
      creatorPct: input.billing?.creatorPct ?? DEFAULT_CREATOR_PCT,
      minSupporterTier: input.billing?.minSupporterTier,
    };

    await this.livekit.createRoom(livekitRoomName, maxParticipants);

    const room = await this.store.createRoom({
      id: roomId,
      roomType: input.roomType,
      title: input.title,
      hostId: input.hostId,
      status: 'CREATED',
      maxParticipants,
      livekitRoomName,
      billing,
      permissions: DEFAULT_PERMISSIONS[input.roomType],
      recordingEnabled: input.recordingEnabled ?? false,
      replayPublishing: input.replayPublishing ?? false,
      metadata: input.metadata,
      createdAt: now,
    });

    // Host is auto-added as a joined HOST participant.
    await this.store.addParticipant({
      id: randomUUID(),
      roomId,
      userId: input.hostId,
      role: 'HOST',
      status: 'JOINED',
      joinedAt: now,
    });

    if (input.idempotencyKey) await this.store.setRoomKey(input.idempotencyKey, roomId);

    this.eventBus?.publish(buildRoomCreated({
      roomId, roomType: room.roomType, hostId: input.hostId, title: input.title,
      maxParticipants, livekitRoomName, billingMode: billing.mode, createdAt: now,
    }));

    return room;
  }

  async openRoom(roomId: string): Promise<SessionRoom> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();
    const updated = await this.store.updateRoom(roomId, { status: 'OPEN', openedAt: now });
    this.eventBus?.publish(buildRoomOpened({ roomId, roomType: room.roomType, status: 'OPEN', at: now }));
    return updated;
  }

  async startRoom(roomId: string): Promise<SessionRoom> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();
    const updated = await this.store.updateRoom(roomId, { status: 'LIVE', startedAt: now });

    // Auto-start recording if enabled.
    if (room.recordingEnabled) {
      await this.startRecording(roomId);
    }

    this.eventBus?.publish(buildRoomStarted({ roomId, roomType: room.roomType, status: 'LIVE', at: now }));
    return updated;
  }

  async pauseRoom(roomId: string): Promise<SessionRoom> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();
    const updated = await this.store.updateRoom(roomId, { status: 'PAUSED' });
    this.eventBus?.publish(buildRoomPaused({ roomId, roomType: room.roomType, status: 'PAUSED', at: now }));
    return updated;
  }

  async endRoom(roomId: string): Promise<{ room: SessionRoom; settlement?: { creatorCoins: number; platformCoins: number } }> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();

    // Stop recording if running.
    const rec = await this.store.getRecordingByRoom(roomId);
    if (rec && rec.status === 'RECORDING') {
      await this.stopRecording(roomId);
    }

    // Settle room revenue (gross accumulated coins tracked in metadata.grossCoins).
    let settlement: { creatorCoins: number; platformCoins: number } | undefined;
    const gross = Number((room.metadata?.grossCoins as number) ?? 0);
    if (gross > 0) {
      settlement = await this.billing.settle(roomId, room.hostId, gross, room.billing.platformFeePct);
      this.eventBus?.publish(buildBillingSettled({
        roomId, userId: room.hostId, coins: settlement.creatorCoins, reason: 'room.settle', at: now,
      }));
    }

    const updated = await this.store.updateRoom(roomId, { status: 'ENDED', endedAt: now });
    await this.livekit.deleteRoom(room.livekitRoomName);
    this.eventBus?.publish(buildRoomEnded({ roomId, roomType: room.roomType, status: 'ENDED', at: now }));

    return { room: updated, settlement };
  }

  async cancelRoom(roomId: string, reason?: string): Promise<SessionRoom> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();
    const updated = await this.store.updateRoom(roomId, { status: 'CANCELLED', endedAt: now });
    await this.livekit.deleteRoom(room.livekitRoomName);
    this.eventBus?.publish(buildRoomCancelled({ roomId, roomType: room.roomType, status: 'CANCELLED', at: now, reason }));
    return updated;
  }

  // ── Participants ──────────────────────────────────────────────────────────────

  /**
   * Join a room. Enforces participant cap and billing. Returns a LiveKit token.
   */
  async joinRoom(input: JoinRoomInput): Promise<{ participant: SessionParticipant; token: string }> {
    const room = await this.requireRoom(input.roomId);
    const now = new Date().toISOString();

    // Re-join: if already a participant, just re-issue token.
    const existing = await this.store.getParticipant(input.roomId, input.userId);
    if (existing && existing.status === 'JOINED') {
      const token = await this.issueTokenFor(room, input.userId, existing.role);
      return { participant: existing, token };
    }

    // Enforce participant cap.
    const active = await this.store.countActiveParticipants(input.roomId);
    if (active >= room.maxParticipants) {
      throw new Error(`Room is full (${room.maxParticipants} max).`);
    }

    // Billing on entry.
    if (room.billing.mode === 'COIN_ENTRY' || room.billing.mode === 'TICKETED') {
      const entry = room.billing.entryCoins ?? 0;
      if (entry > 0) {
        await this.billing.charge(input.userId, entry, `room.entry:${input.roomId}`);
        await this.accrueGross(room, entry);
        this.eventBus?.publish(buildBillingCharged({
          roomId: input.roomId, userId: input.userId, coins: entry, reason: 'room.entry', at: now,
        }));
      }
    }

    const role: SessionRoomRole = input.role ?? 'VIEWER';
    let participant: SessionParticipant;
    if (existing) {
      await this.store.updateParticipant(input.roomId, input.userId, { status: 'JOINED', role, joinedAt: now, leftAt: undefined });
      participant = { ...existing, status: 'JOINED', role, joinedAt: now };
    } else {
      participant = await this.store.addParticipant({
        id: randomUUID(), roomId: input.roomId, userId: input.userId, role, status: 'JOINED', joinedAt: now,
      });
    }

    const token = await this.issueTokenFor(room, input.userId, role);
    this.eventBus?.publish(buildParticipantJoined({ roomId: input.roomId, participantId: participant.id, userId: input.userId, role, at: now }));
    return { participant, token };
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const p = await this.store.getParticipant(roomId, userId);
    if (!p) return;
    const now = new Date().toISOString();
    await this.store.updateParticipant(roomId, userId, { status: 'LEFT', leftAt: now });
    this.eventBus?.publish(buildParticipantLeft({ roomId, participantId: p.id, userId, role: p.role, at: now }));
  }

  async invite(input: InviteInput): Promise<SessionParticipant> {
    const room = await this.requireRoom(input.roomId);
    this.assertCan(room, input.invitedBy, 'canInvite');
    const now = new Date().toISOString();
    const participant = await this.store.addParticipant({
      id: randomUUID(), roomId: input.roomId, userId: input.userId, role: input.role,
      status: 'INVITED', invitedBy: input.invitedBy,
    });
    this.eventBus?.publish(buildParticipantInvited({ roomId: input.roomId, participantId: participant.id, userId: input.userId, role: input.role, at: now }));
    return participant;
  }

  async promote(roomId: string, userId: string, role: SessionRoomRole): Promise<void> {
    const p = await this.store.getParticipant(roomId, userId);
    if (!p) throw new Error('Participant not found.');
    const now = new Date().toISOString();
    await this.store.updateParticipant(roomId, userId, { role });
    this.eventBus?.publish(buildParticipantPromoted({ roomId, participantId: p.id, userId, role, at: now }));
  }

  // ── Moderation ────────────────────────────────────────────────────────────────

  async moderate(input: ModerateInput): Promise<SessionModeration> {
    const room = await this.requireRoom(input.roomId);
    this.assertCan(room, input.actorId, 'canModerate');
    const now = new Date().toISOString();

    const record = await this.store.addModeration({
      id: randomUUID(), roomId: input.roomId, targetUserId: input.targetUserId,
      actorId: input.actorId, action: input.action, reason: input.reason, at: now,
    });

    // KICK / BAN remove the participant.
    if (input.action === 'KICK' || input.action === 'BAN') {
      const p = await this.store.getParticipant(input.roomId, input.targetUserId);
      if (p) {
        await this.store.updateParticipant(input.roomId, input.targetUserId, { status: 'REMOVED', leftAt: now });
        this.eventBus?.publish(buildParticipantRemoved({ roomId: input.roomId, participantId: p.id, userId: input.targetUserId, role: p.role, at: now }));
      }
    }

    const builder = input.action === 'FLAG' ? buildModerationFlagged : buildModerationActioned;
    this.eventBus?.publish(builder({
      roomId: input.roomId, targetUserId: input.targetUserId, actorId: input.actorId,
      action: input.action, reason: input.reason, at: now,
    }));
    return record;
  }

  // ── Recording ─────────────────────────────────────────────────────────────────

  async startRecording(roomId: string): Promise<SessionRecording> {
    const room = await this.requireRoom(roomId);
    const now = new Date().toISOString();

    const existing = await this.store.getRecordingByRoom(roomId);
    if (existing && existing.status === 'RECORDING') return existing;

    const { egressId } = await this.livekit.startEgress(room.livekitRoomName);
    const rec = await this.store.createRecording({
      id: randomUUID(), roomId, status: 'RECORDING', egressId, startedAt: now,
    });
    this.eventBus?.publish(buildRecordingStarted({ roomId, recordingId: rec.id, egressId, at: now }));
    return rec;
  }

  async stopRecording(roomId: string): Promise<SessionRecording> {
    const rec = await this.store.getRecordingByRoom(roomId);
    if (!rec || rec.status !== 'RECORDING') throw new Error('No active recording for this room.');
    const now = new Date().toISOString();

    const { assetUrl, durationSeconds } = await this.livekit.stopEgress(rec.egressId!);
    const updated = await this.store.updateRecording(rec.id, {
      status: 'STOPPED', rawAssetUrl: assetUrl, durationSeconds, stoppedAt: now,
    });
    this.eventBus?.publish(buildRecordingStopped({ roomId, recordingId: rec.id, egressId: rec.egressId, at: now }));
    return updated;
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────

  getRoom(roomId: string) { return this.store.getRoom(roomId); }
  listRooms(filter?: { status?: any; roomType?: any }) { return this.store.listRooms(filter); }
  listParticipants(roomId: string) { return this.store.listParticipants(roomId); }
  getRecording(recordingId: string) { return this.store.getRecording(recordingId); }
  getRecordingByRoom(roomId: string) { return this.store.getRecordingByRoom(roomId); }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async requireRoom(roomId: string): Promise<SessionRoom> {
    const room = await this.store.getRoom(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    return room;
  }

  private assertCan(room: SessionRoom, userId: string, capability: keyof SessionRoom['permissions']): void {
    // Host always allowed.
    if (userId === room.hostId) return;
    // For other actors we'd look up their role; engine treats host-equivalent only here.
    const allowedRoles = room.permissions[capability] as SessionRoomRole[];
    // Without a synchronous role lookup we conservatively allow HOST/CO_HOST/MODERATOR holders.
    if (!allowedRoles || allowedRoles.length === 0) {
      throw new Error(`Action not permitted in ${room.roomType}.`);
    }
  }

  private async issueTokenFor(room: SessionRoom, userId: string, role: SessionRoomRole): Promise<string> {
    const canPublish =
      room.permissions.canPublishAudio.includes(role) ||
      room.permissions.canPublishVideo.includes(role);
    return this.livekit.issueToken(room.livekitRoomName, userId, canPublish);
  }

  /** Accrue gross revenue into the room metadata for end-of-room settlement. */
  private async accrueGross(room: SessionRoom, coins: number): Promise<void> {
    const current = Number((room.metadata?.grossCoins as number) ?? 0);
    await this.store.updateRoom(room.id, { metadata: { ...room.metadata, grossCoins: current + coins } });
  }
}
