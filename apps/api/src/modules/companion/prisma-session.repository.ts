// ---------------------------------------------------------------------------
// companion — Prisma adapter for SessionStorePort (session-core, Sprint 10).
// Replaces the in-memory Maps with the SessionBooking / SessionEscrow /
// SessionReservation / SessionExtension / CompanionSessionParticipant /
// SessionPayout tables. The coin escrow ledger (SessionCoinLedgerPort) remains
// a separate wallet-adapter concern and is unchanged.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  SessionBooking,
  SessionEscrow,
  SessionReservation,
  SessionExtension,
  SessionParticipant,
  SessionPayout,
  PayoutSplit,
  SessionStorePort,
  BookingStatus,
  EscrowStatus,
  SessionStatus,
  ParticipantRole,
  SessionDuration,
  SessionType,
} from '@starria/session-core';
import type {
  SessionBooking as DbBooking,
  SessionEscrow as DbEscrow,
  SessionReservation as DbReservation,
  SessionExtension as DbExtension,
  CompanionSessionParticipant as DbParticipant,
  SessionPayout as DbPayout,
} from '@prisma/client';

function toBooking(b: DbBooking): SessionBooking {
  return {
    id: b.id,
    companionId: b.companionId,
    patronId: b.patronId,
    sessionType: b.sessionType as SessionType,
    durationMinutes: b.durationMinutes as SessionDuration,
    coinCost: b.coinCost,
    status: b.status as BookingStatus,
    idempotencyKey: b.idempotencyKey,
    scheduledAt: b.scheduledAt.toISOString(),
    confirmedAt: b.confirmedAt?.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString(),
    sessionId: b.sessionId ?? undefined,
    createdAt: b.createdAt.toISOString(),
  };
}

function toEscrow(e: DbEscrow): SessionEscrow {
  return {
    id: e.id,
    bookingId: e.bookingId,
    patronId: e.patronId,
    companionId: e.companionId,
    heldCoins: e.heldCoins,
    status: e.status as EscrowStatus,
    heldAt: e.heldAt.toISOString(),
    releasedAt: e.releasedAt?.toISOString(),
  };
}

function toReservation(s: DbReservation): SessionReservation {
  return {
    id: s.id,
    bookingId: s.bookingId,
    companionId: s.companionId,
    sessionType: s.sessionType as SessionType,
    status: s.status as SessionStatus,
    livekitRoomName: s.livekitRoomName,
    durationMinutes: s.durationMinutes,
    scheduledAt: s.scheduledAt.toISOString(),
    startedAt: s.startedAt?.toISOString(),
    endsAt: s.endsAt?.toISOString(),
    endedAt: s.endedAt?.toISOString(),
    extensionMinutes: s.extensionMinutes,
    participantCount: s.participantCount,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toExtension(x: DbExtension): SessionExtension {
  return {
    id: x.id,
    sessionId: x.sessionId,
    patronId: x.patronId,
    addedMinutes: x.addedMinutes as SessionDuration,
    additionalCoins: x.additionalCoins,
    escrowId: x.escrowId,
    extendedAt: x.extendedAt.toISOString(),
  };
}

function toParticipant(p: DbParticipant): SessionParticipant {
  return {
    id: p.id,
    sessionId: p.sessionId,
    userId: p.userId,
    role: p.role as ParticipantRole,
    livekitIdentity: p.livekitIdentity,
    joinedAt: p.joinedAt.toISOString(),
    leftAt: p.leftAt?.toISOString(),
    watchSeconds: p.watchSeconds,
  };
}

function toPayout(p: DbPayout): SessionPayout {
  return {
    id: p.id,
    sessionId: p.sessionId,
    companionId: p.companionId,
    grossCoins: p.grossCoins,
    platformFeeCoins: p.platformFeeCoins,
    netCoins: p.netCoins,
    splits: p.splits as unknown as PayoutSplit[],
    settledAt: p.settledAt.toISOString(),
  };
}

@Injectable()
export class PrismaSessionRepository implements SessionStorePort {
  constructor(private readonly db: PrismaService) {}

  // ── Bookings ──────────────────────────────────────────────────────────────

  async createBooking(booking: Omit<SessionBooking, 'id' | 'createdAt'>): Promise<SessionBooking> {
    const b = await this.db.sessionBooking.create({
      data: {
        companionId: booking.companionId,
        patronId: booking.patronId,
        sessionType: booking.sessionType,
        durationMinutes: booking.durationMinutes,
        coinCost: booking.coinCost,
        status: booking.status,
        idempotencyKey: booking.idempotencyKey,
        scheduledAt: new Date(booking.scheduledAt),
        confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt) : null,
        cancelledAt: booking.cancelledAt ? new Date(booking.cancelledAt) : null,
        sessionId: booking.sessionId ?? null,
      },
    });
    return toBooking(b);
  }

  async findBooking(id: string): Promise<SessionBooking | null> {
    const b = await this.db.sessionBooking.findUnique({ where: { id } });
    return b ? toBooking(b) : null;
  }

  async findBookingByKey(idempotencyKey: string): Promise<SessionBooking | null> {
    const b = await this.db.sessionBooking.findUnique({ where: { idempotencyKey } });
    return b ? toBooking(b) : null;
  }

  async updateBooking(id: string, patch: Partial<SessionBooking>): Promise<SessionBooking> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.sessionId !== undefined) data.sessionId = patch.sessionId ?? null;
    if (patch.confirmedAt !== undefined) data.confirmedAt = patch.confirmedAt ? new Date(patch.confirmedAt) : null;
    if (patch.cancelledAt !== undefined) data.cancelledAt = patch.cancelledAt ? new Date(patch.cancelledAt) : null;
    const b = await this.db.sessionBooking.update({ where: { id }, data });
    return toBooking(b);
  }

  // ── Escrows ───────────────────────────────────────────────────────────────

  async createEscrow(escrow: Omit<SessionEscrow, 'id'>): Promise<SessionEscrow> {
    const e = await this.db.sessionEscrow.create({
      data: {
        bookingId: escrow.bookingId,
        patronId: escrow.patronId,
        companionId: escrow.companionId,
        heldCoins: escrow.heldCoins,
        status: escrow.status,
        heldAt: new Date(escrow.heldAt),
        releasedAt: escrow.releasedAt ? new Date(escrow.releasedAt) : null,
      },
    });
    return toEscrow(e);
  }

  async findEscrowByBooking(bookingId: string): Promise<SessionEscrow | null> {
    const e = await this.db.sessionEscrow.findUnique({ where: { bookingId } });
    return e ? toEscrow(e) : null;
  }

  async updateEscrow(id: string, patch: Partial<SessionEscrow>): Promise<SessionEscrow> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.heldCoins !== undefined) data.heldCoins = patch.heldCoins;
    if (patch.releasedAt !== undefined) data.releasedAt = patch.releasedAt ? new Date(patch.releasedAt) : null;
    const e = await this.db.sessionEscrow.update({ where: { id }, data });
    return toEscrow(e);
  }

  // ── Reservations (live sessions) ────────────────────────────────────────────

  async createSession(
    session: Omit<SessionReservation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionReservation> {
    const s = await this.db.sessionReservation.create({
      data: {
        bookingId: session.bookingId,
        companionId: session.companionId,
        sessionType: session.sessionType,
        status: session.status,
        livekitRoomName: session.livekitRoomName,
        durationMinutes: session.durationMinutes,
        scheduledAt: new Date(session.scheduledAt),
        startedAt: session.startedAt ? new Date(session.startedAt) : null,
        endsAt: session.endsAt ? new Date(session.endsAt) : null,
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        extensionMinutes: session.extensionMinutes,
        participantCount: session.participantCount,
      },
    });
    return toReservation(s);
  }

  async findSession(id: string): Promise<SessionReservation | null> {
    const s = await this.db.sessionReservation.findUnique({ where: { id } });
    return s ? toReservation(s) : null;
  }

  async findSessionByBooking(bookingId: string): Promise<SessionReservation | null> {
    const s = await this.db.sessionReservation.findFirst({ where: { bookingId } });
    return s ? toReservation(s) : null;
  }

  async updateSession(id: string, patch: Partial<SessionReservation>): Promise<SessionReservation> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.durationMinutes !== undefined) data.durationMinutes = patch.durationMinutes;
    if (patch.extensionMinutes !== undefined) data.extensionMinutes = patch.extensionMinutes;
    if (patch.participantCount !== undefined) data.participantCount = patch.participantCount;
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    if (patch.endsAt !== undefined) data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
    if (patch.endedAt !== undefined) data.endedAt = patch.endedAt ? new Date(patch.endedAt) : null;
    const s = await this.db.sessionReservation.update({ where: { id }, data });
    return toReservation(s);
  }

  // ── Extensions ──────────────────────────────────────────────────────────────

  async appendExtension(ext: Omit<SessionExtension, 'id'>): Promise<SessionExtension> {
    const x = await this.db.sessionExtension.create({
      data: {
        sessionId: ext.sessionId,
        patronId: ext.patronId,
        addedMinutes: ext.addedMinutes,
        additionalCoins: ext.additionalCoins,
        escrowId: ext.escrowId,
        extendedAt: new Date(ext.extendedAt),
      },
    });
    return toExtension(x);
  }

  async getExtensions(sessionId: string): Promise<SessionExtension[]> {
    const rows = await this.db.sessionExtension.findMany({
      where: { sessionId },
      orderBy: { extendedAt: 'asc' },
    });
    return rows.map(toExtension);
  }

  // ── Participants ────────────────────────────────────────────────────────────

  async createParticipant(p: Omit<SessionParticipant, 'id'>): Promise<SessionParticipant> {
    const r = await this.db.companionSessionParticipant.create({
      data: {
        sessionId: p.sessionId,
        userId: p.userId,
        role: p.role,
        livekitIdentity: p.livekitIdentity,
        joinedAt: new Date(p.joinedAt),
        leftAt: p.leftAt ? new Date(p.leftAt) : null,
        watchSeconds: p.watchSeconds,
      },
    });
    return toParticipant(r);
  }

  async findParticipant(sessionId: string, userId: string): Promise<SessionParticipant | null> {
    const p = await this.db.companionSessionParticipant.findFirst({ where: { sessionId, userId } });
    return p ? toParticipant(p) : null;
  }

  async updateParticipant(id: string, patch: Partial<SessionParticipant>): Promise<SessionParticipant> {
    const data: Record<string, unknown> = {};
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.watchSeconds !== undefined) data.watchSeconds = patch.watchSeconds;
    if (patch.leftAt !== undefined) data.leftAt = patch.leftAt ? new Date(patch.leftAt) : null;
    const p = await this.db.companionSessionParticipant.update({ where: { id }, data });
    return toParticipant(p);
  }

  async getParticipants(sessionId: string): Promise<SessionParticipant[]> {
    const rows = await this.db.companionSessionParticipant.findMany({ where: { sessionId } });
    return rows.map(toParticipant);
  }

  // ── Payouts ───────────────────────────────────────────────────────────────

  async createPayout(payout: Omit<SessionPayout, 'id'>): Promise<SessionPayout> {
    const p = await this.db.sessionPayout.create({
      data: {
        sessionId: payout.sessionId,
        companionId: payout.companionId,
        grossCoins: payout.grossCoins,
        platformFeeCoins: payout.platformFeeCoins,
        netCoins: payout.netCoins,
        splits: payout.splits as unknown as object,
        settledAt: new Date(payout.settledAt),
      },
    });
    return toPayout(p);
  }

  async findPayout(sessionId: string): Promise<SessionPayout | null> {
    const p = await this.db.sessionPayout.findUnique({ where: { sessionId } });
    return p ? toPayout(p) : null;
  }
}
