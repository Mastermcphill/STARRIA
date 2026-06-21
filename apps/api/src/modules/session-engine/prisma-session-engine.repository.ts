// ---------------------------------------------------------------------------
// session-engine — Prisma adapter for SessionEngineStorePort (Sprint 10).
// Replaces the in-memory Maps with the SessionRoom / SessionRoomParticipant /
// SessionRecording / SessionModeration tables. The room idempotency key is
// stored on SessionRoom.idempotencyKey (set via setRoomKey). The billing port
// (SessionBillingPort) and LiveKit provider stub remain unchanged.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  SessionEngineStorePort,
  SessionRoom,
  SessionParticipant,
  SessionRecording,
  SessionModeration,
  SessionRoomStatus,
  SessionRoomType,
  SessionBilling,
  SessionPermission,
  SessionRoomRole,
  ParticipantStatus,
  RecordingStatus,
  ModerationAction,
} from '@starria/session-engine-core';
import type {
  SessionRoom as DbRoom,
  SessionRoomParticipant as DbParticipant,
  SessionRecording as DbRecording,
  SessionModeration as DbModeration,
} from '@prisma/client';

function toRoom(r: DbRoom): SessionRoom {
  return {
    id: r.id,
    roomType: r.roomType as SessionRoomType,
    title: r.title,
    hostId: r.hostId,
    status: r.status as SessionRoomStatus,
    maxParticipants: r.maxParticipants,
    livekitRoomName: r.livekitRoomName,
    billing: r.billing as unknown as SessionBilling,
    permissions: r.permissions as unknown as SessionPermission,
    recordingEnabled: r.recordingEnabled,
    replayPublishing: r.replayPublishing,
    metadata: (r.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: r.createdAt.toISOString(),
    openedAt: r.openedAt?.toISOString(),
    startedAt: r.startedAt?.toISOString(),
    endedAt: r.endedAt?.toISOString(),
  };
}

function toParticipant(p: DbParticipant): SessionParticipant {
  return {
    id: p.id,
    roomId: p.roomId,
    userId: p.userId,
    role: p.role as SessionRoomRole,
    status: p.status as ParticipantStatus,
    invitedBy: p.invitedBy ?? undefined,
    joinedAt: p.joinedAt?.toISOString(),
    leftAt: p.leftAt?.toISOString(),
  };
}

function toRecording(r: DbRecording): SessionRecording {
  return {
    id: r.id,
    roomId: r.roomId,
    status: r.status as RecordingStatus,
    egressId: r.egressId ?? undefined,
    rawAssetUrl: r.rawAssetUrl ?? undefined,
    durationSeconds: r.durationSeconds ?? undefined,
    startedAt: r.startedAt?.toISOString(),
    stoppedAt: r.stoppedAt?.toISOString(),
  };
}

function toModeration(m: DbModeration): SessionModeration {
  return {
    id: m.id,
    roomId: m.roomId,
    targetUserId: m.targetUserId,
    actorId: m.actorId,
    action: m.action as ModerationAction,
    reason: m.reason ?? undefined,
    at: m.at.toISOString(),
  };
}

@Injectable()
export class PrismaSessionEngineRepository implements SessionEngineStorePort {
  constructor(private readonly db: PrismaService) {}

  // ── Rooms ─────────────────────────────────────────────────────────────────

  async createRoom(room: SessionRoom): Promise<SessionRoom> {
    const r = await this.db.sessionRoom.create({
      data: {
        id: room.id,
        roomType: room.roomType,
        title: room.title,
        hostId: room.hostId,
        status: room.status,
        maxParticipants: room.maxParticipants,
        livekitRoomName: room.livekitRoomName,
        billing: room.billing as unknown as object,
        permissions: room.permissions as unknown as object,
        recordingEnabled: room.recordingEnabled,
        replayPublishing: room.replayPublishing,
        metadata: (room.metadata as object | undefined) ?? undefined,
        createdAt: new Date(room.createdAt),
        openedAt: room.openedAt ? new Date(room.openedAt) : null,
        startedAt: room.startedAt ? new Date(room.startedAt) : null,
        endedAt: room.endedAt ? new Date(room.endedAt) : null,
      },
    });
    return toRoom(r);
  }

  async getRoom(roomId: string): Promise<SessionRoom | null> {
    const r = await this.db.sessionRoom.findUnique({ where: { id: roomId } });
    return r ? toRoom(r) : null;
  }

  async updateRoom(roomId: string, patch: Partial<SessionRoom>): Promise<SessionRoom> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.maxParticipants !== undefined) data.maxParticipants = patch.maxParticipants;
    if (patch.recordingEnabled !== undefined) data.recordingEnabled = patch.recordingEnabled;
    if (patch.replayPublishing !== undefined) data.replayPublishing = patch.replayPublishing;
    if (patch.billing !== undefined) data.billing = patch.billing as unknown as object;
    if (patch.permissions !== undefined) data.permissions = patch.permissions as unknown as object;
    if (patch.metadata !== undefined) data.metadata = (patch.metadata as object | undefined) ?? undefined;
    if (patch.openedAt !== undefined) data.openedAt = patch.openedAt ? new Date(patch.openedAt) : null;
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    if (patch.endedAt !== undefined) data.endedAt = patch.endedAt ? new Date(patch.endedAt) : null;
    const r = await this.db.sessionRoom.update({ where: { id: roomId }, data });
    return toRoom(r);
  }

  async listRooms(filter?: { status?: SessionRoomStatus; roomType?: SessionRoomType }): Promise<SessionRoom[]> {
    const rows = await this.db.sessionRoom.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.roomType ? { roomType: filter.roomType } : {}),
      },
    });
    return rows.map(toRoom);
  }

  async findRoomByKey(idempotencyKey: string): Promise<SessionRoom | null> {
    const r = await this.db.sessionRoom.findUnique({ where: { idempotencyKey } });
    return r ? toRoom(r) : null;
  }

  async setRoomKey(idempotencyKey: string, roomId: string): Promise<void> {
    await this.db.sessionRoom.update({ where: { id: roomId }, data: { idempotencyKey } });
  }

  // ── Participants ────────────────────────────────────────────────────────────

  async addParticipant(p: SessionParticipant): Promise<SessionParticipant> {
    const r = await this.db.sessionRoomParticipant.create({
      data: {
        id: p.id,
        roomId: p.roomId,
        userId: p.userId,
        role: p.role,
        status: p.status,
        invitedBy: p.invitedBy ?? null,
        joinedAt: p.joinedAt ? new Date(p.joinedAt) : null,
        leftAt: p.leftAt ? new Date(p.leftAt) : null,
      },
    });
    return toParticipant(r);
  }

  async getParticipant(roomId: string, userId: string): Promise<SessionParticipant | null> {
    const p = await this.db.sessionRoomParticipant.findFirst({ where: { roomId, userId } });
    return p ? toParticipant(p) : null;
  }

  async updateParticipant(roomId: string, userId: string, patch: Partial<SessionParticipant>): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.invitedBy !== undefined) data.invitedBy = patch.invitedBy ?? null;
    if (patch.joinedAt !== undefined) data.joinedAt = patch.joinedAt ? new Date(patch.joinedAt) : null;
    if (patch.leftAt !== undefined) data.leftAt = patch.leftAt ? new Date(patch.leftAt) : null;
    await this.db.sessionRoomParticipant.updateMany({ where: { roomId, userId }, data });
  }

  async listParticipants(roomId: string): Promise<SessionParticipant[]> {
    const rows = await this.db.sessionRoomParticipant.findMany({ where: { roomId } });
    return rows.map(toParticipant);
  }

  async countActiveParticipants(roomId: string): Promise<number> {
    return this.db.sessionRoomParticipant.count({ where: { roomId, status: 'JOINED' } });
  }

  // ── Recordings ────────────────────────────────────────────────────────────

  async createRecording(rec: SessionRecording): Promise<SessionRecording> {
    const r = await this.db.sessionRecording.create({
      data: {
        id: rec.id,
        roomId: rec.roomId,
        status: rec.status,
        egressId: rec.egressId ?? null,
        rawAssetUrl: rec.rawAssetUrl ?? null,
        durationSeconds: rec.durationSeconds ?? null,
        startedAt: rec.startedAt ? new Date(rec.startedAt) : null,
        stoppedAt: rec.stoppedAt ? new Date(rec.stoppedAt) : null,
      },
    });
    return toRecording(r);
  }

  async getRecording(recordingId: string): Promise<SessionRecording | null> {
    const r = await this.db.sessionRecording.findUnique({ where: { id: recordingId } });
    return r ? toRecording(r) : null;
  }

  async getRecordingByRoom(roomId: string): Promise<SessionRecording | null> {
    const r = await this.db.sessionRecording.findFirst({
      where: { roomId },
      orderBy: { startedAt: 'desc' },
    });
    return r ? toRecording(r) : null;
  }

  async updateRecording(recordingId: string, patch: Partial<SessionRecording>): Promise<SessionRecording> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.egressId !== undefined) data.egressId = patch.egressId ?? null;
    if (patch.rawAssetUrl !== undefined) data.rawAssetUrl = patch.rawAssetUrl ?? null;
    if (patch.durationSeconds !== undefined) data.durationSeconds = patch.durationSeconds ?? null;
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    if (patch.stoppedAt !== undefined) data.stoppedAt = patch.stoppedAt ? new Date(patch.stoppedAt) : null;
    const r = await this.db.sessionRecording.update({ where: { id: recordingId }, data });
    return toRecording(r);
  }

  // ── Moderation ──────────────────────────────────────────────────────────────

  async addModeration(m: SessionModeration): Promise<SessionModeration> {
    const r = await this.db.sessionModeration.create({
      data: {
        id: m.id,
        roomId: m.roomId,
        targetUserId: m.targetUserId,
        actorId: m.actorId,
        action: m.action,
        reason: m.reason ?? null,
        at: new Date(m.at),
      },
    });
    return toModeration(r);
  }

  async listModeration(roomId: string): Promise<SessionModeration[]> {
    const rows = await this.db.sessionModeration.findMany({
      where: { roomId },
      orderBy: { at: 'asc' },
    });
    return rows.map(toModeration);
  }
}
