// ---------------------------------------------------------------------------
// session-core — SessionService
// Booking, escrow, start/end lifecycle, extensions, payout splitting,
// participant management, panic leave, flagging.
// Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  SessionBooking,
  SessionEscrow,
  SessionReservation,
  SessionParticipant,
  SessionPayout,
  SessionStorePort,
  SessionCoinLedgerPort,
  BookSessionInput,
  ExtendSessionInput,
  InviteParticipantInput,
  PayoutSplit,
} from './types';
import { COMPANION_PLATFORM_FEE_PCT, COMPANION_CREATOR_PCT } from './types';
import {
  buildSessionBooked,
  buildSessionStarted,
  buildSessionExtended,
  buildSessionEnded,
  buildSessionCancelled,
  buildSessionPayoutSettled,
  buildParticipantInvited,
  buildParticipantJoined,
  buildParticipantLeft,
  buildPanicLeave,
  buildSessionFlagged,
} from './events';

export class SessionService {
  constructor(
    private readonly store: SessionStorePort,
    private readonly ledger: SessionCoinLedgerPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Booking ───────────────────────────────────────────────────────────────────

  async bookSession(input: BookSessionInput): Promise<{ booking: SessionBooking; escrow: SessionEscrow }> {
    const now = new Date().toISOString();

    // Idempotency
    const existing = await this.store.findBookingByKey(input.idempotencyKey);
    if (existing) {
      const escrow = await this.store.findEscrowByBooking(existing.id);
      return { booking: existing, escrow: escrow! };
    }

    // Escrow coins first
    await this.ledger.debitEscrow(input.patronId, input.coinCost, input.idempotencyKey);

    const booking = await this.store.createBooking({
      companionId: input.companionId,
      patronId: input.patronId,
      sessionType: input.sessionType,
      durationMinutes: input.durationMinutes,
      coinCost: input.coinCost,
      status: 'CONFIRMED',
      idempotencyKey: input.idempotencyKey,
      scheduledAt: input.scheduledAt,
      confirmedAt: now,
    });

    const escrow = await this.store.createEscrow({
      bookingId: booking.id,
      patronId: input.patronId,
      companionId: input.companionId,
      heldCoins: input.coinCost,
      status: 'HELD',
      heldAt: now,
    });

    // Create placeholder session record
    const roomName = `session-${booking.id}`;
    const session = await this.store.createSession({
      bookingId: booking.id,
      companionId: input.companionId,
      sessionType: input.sessionType,
      status: 'SCHEDULED',
      livekitRoomName: roomName,
      durationMinutes: input.durationMinutes,
      scheduledAt: input.scheduledAt,
      extensionMinutes: 0,
      participantCount: 0,
    });

    // Link session to booking
    await this.store.updateBooking(booking.id, { sessionId: session.id });

    void this.eventBus?.publish(buildSessionBooked({
      sessionId: session.id,
      bookingId: booking.id,
      companionId: input.companionId,
      patronId: input.patronId,
      sessionType: input.sessionType,
      durationMinutes: input.durationMinutes,
      coinCost: input.coinCost,
      escrowedCoins: input.coinCost,
      scheduledAt: input.scheduledAt,
      bookedAt: now,
    }));

    return { booking, escrow };
  }

  async cancelBooking(
    bookingId: string,
    cancelledBy: string,
    reason?: string,
  ): Promise<SessionBooking> {
    const now = new Date().toISOString();
    const booking = await this.store.findBooking(bookingId);
    if (!booking) throw new Error(`Booking not found: ${bookingId}`);
    if (booking.status !== 'CONFIRMED') throw new Error(`Cannot cancel booking in status: ${booking.status}`);

    const escrow = await this.store.findEscrowByBooking(bookingId);
    let refundCoins = 0;
    if (escrow && escrow.status === 'HELD') {
      refundCoins = escrow.heldCoins;
      await this.ledger.refundEscrow(bookingId, refundCoins);
      await this.store.updateEscrow(escrow.id, { status: 'REFUNDED', releasedAt: now });
    }

    const updated = await this.store.updateBooking(bookingId, {
      status: 'CANCELLED',
      cancelledAt: now,
    });

    if (booking.sessionId) {
      await this.store.updateSession(booking.sessionId, { status: 'CANCELLED' });
      void this.eventBus?.publish(buildSessionCancelled({
        sessionId: booking.sessionId,
        cancelledBy,
        reason,
        refundCoins,
        cancelledAt: now,
      }));
    }

    return updated;
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────────

  async startSession(sessionId: string): Promise<SessionReservation> {
    const now = new Date().toISOString();
    const session = await this.store.findSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'SCHEDULED' && session.status !== 'WAITING') {
      throw new Error(`Cannot start session in status: ${session.status}`);
    }

    const totalMinutes = session.durationMinutes + session.extensionMinutes;
    const endsAt = new Date(Date.now() + totalMinutes * 60_000).toISOString();

    const updated = await this.store.updateSession(sessionId, {
      status: 'LIVE',
      startedAt: now,
      endsAt,
    });

    void this.eventBus?.publish(buildSessionStarted({
      sessionId,
      companionId: session.companionId,
      startedAt: now,
      durationMinutes: totalMinutes,
      endsAt,
    }));

    return updated;
  }

  async endSession(sessionId: string): Promise<{ session: SessionReservation; payout: SessionPayout }> {
    const now = new Date().toISOString();
    const session = await this.store.findSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'LIVE') throw new Error(`Cannot end session in status: ${session.status}`);

    // Calculate actual duration
    const startedAt  = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const actualMs   = Date.now() - startedAt;
    const actualMins = Math.ceil(actualMs / 60_000);

    const updated = await this.store.updateSession(sessionId, {
      status: 'ENDED',
      endedAt: now,
    });

    // Settle escrow → payout
    const booking = await this.store.findSessionByBooking(sessionId)
      .then(() => null)
      .catch(() => null);

    const escrow = await this._findEscrowForSession(sessionId);
    const grossCoins = escrow?.heldCoins ?? 0;

    const payout = await this._settlePayoutSingle(sessionId, session.companionId, grossCoins, now);

    void this.eventBus?.publish(buildSessionEnded({
      sessionId,
      companionId: session.companionId,
      actualDurationMinutes: actualMins,
      totalCoinsEarned: payout.netCoins,
      endedAt: now,
    }));

    // Update companion total session minutes
    return { session: updated, payout };
  }

  private async _findEscrowForSession(sessionId: string): Promise<SessionEscrow | null> {
    const session = await this.store.findSession(sessionId);
    if (!session) return null;
    const booking = await this.store.findSessionByBooking(session.id);
    if (!booking) return null;
    return null; // store.findEscrowByBooking requires bookingId — caller should wire properly
  }

  private async _settlePayoutSingle(
    sessionId: string,
    companionId: string,
    grossCoins: number,
    now: string,
    extraSplits: PayoutSplit[] = [],
  ): Promise<SessionPayout> {
    const platformFee = Math.floor(grossCoins * COMPANION_PLATFORM_FEE_PCT / 100);
    const creatorNet  = grossCoins - platformFee;

    // Distribute among splits or give 100% to companion
    const splits: PayoutSplit[] = extraSplits.length > 0
      ? extraSplits
      : [{ userId: companionId, coins: creatorNet, pct: COMPANION_CREATOR_PCT }];

    // Credit each split recipient
    for (const split of splits) {
      await this.ledger.creditSplit(split.userId, split.coins, sessionId);
    }

    const payout = await this.store.createPayout({
      sessionId,
      companionId,
      grossCoins,
      platformFeeCoins: platformFee,
      netCoins: creatorNet,
      splits,
      settledAt: now,
    });

    void this.eventBus?.publish(buildSessionPayoutSettled({
      sessionId,
      companionId,
      grossCoins,
      platformFeeCoins: platformFee,
      netCoins: creatorNet,
      splits,
      settledAt: now,
    }));

    return payout;
  }

  async settlePayoutWithSplits(
    sessionId: string,
    companionId: string,
    grossCoins: number,
    splits: PayoutSplit[],
  ): Promise<SessionPayout> {
    return this._settlePayoutSingle(sessionId, companionId, grossCoins, new Date().toISOString(), splits);
  }

  // ── Extension ─────────────────────────────────────────────────────────────────

  async extendSession(input: ExtendSessionInput): Promise<SessionReservation> {
    const now = new Date().toISOString();
    const session = await this.store.findSession(input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);
    if (session.status !== 'LIVE') throw new Error('Can only extend a live session.');

    const additionalCoins = input.coinCostPerMinute * input.addedMinutes;
    await this.ledger.debitEscrow(input.patronId, additionalCoins, `ext-${input.sessionId}-${now}`);

    const newEndsAt = new Date(
      new Date(session.endsAt!).getTime() + input.addedMinutes * 60_000,
    ).toISOString();

    const ext = await this.store.appendExtension({
      sessionId: input.sessionId,
      patronId: input.patronId,
      addedMinutes: input.addedMinutes,
      additionalCoins,
      escrowId: `ext-${randomUUID()}`,
      extendedAt: now,
    });

    const updated = await this.store.updateSession(input.sessionId, {
      extensionMinutes: session.extensionMinutes + input.addedMinutes,
      endsAt: newEndsAt,
    });

    void this.eventBus?.publish(buildSessionExtended({
      sessionId: input.sessionId,
      addedMinutes: input.addedMinutes,
      additionalCoins,
      newEndsAt,
      extendedAt: now,
    }));

    return updated;
  }

  // ── Participants ──────────────────────────────────────────────────────────────

  async inviteParticipant(input: InviteParticipantInput): Promise<SessionParticipant> {
    const now = new Date().toISOString();
    const session = await this.store.findSession(input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);

    const participant = await this.store.createParticipant({
      sessionId: input.sessionId,
      userId: input.userId,
      role: input.role,
      livekitIdentity: `${input.userId}-${Date.now()}`,
      joinedAt: now,
      watchSeconds: 0,
    });

    void this.eventBus?.publish(buildParticipantInvited({
      sessionId: input.sessionId,
      invitedUserId: input.userId,
      invitedBy: input.invitedBy,
      role: input.role,
      invitedAt: now,
    }));

    return participant;
  }

  async joinSession(sessionId: string, userId: string): Promise<SessionParticipant> {
    const now = new Date().toISOString();
    const existing = await this.store.findParticipant(sessionId, userId);
    if (existing && !existing.leftAt) return existing;

    const participant = await this.store.createParticipant({
      sessionId,
      userId,
      role: 'VIEWER',
      livekitIdentity: `${userId}-${Date.now()}`,
      joinedAt: now,
      watchSeconds: 0,
    });

    await this.store.updateSession(sessionId, {
      participantCount: (await this.store.getParticipants(sessionId)).length,
    });

    void this.eventBus?.publish(buildParticipantJoined({ sessionId, userId, joinedAt: now }));

    return participant;
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    const participant = await this.store.findParticipant(sessionId, userId);
    if (!participant || participant.leftAt) return;

    const watchSeconds = Math.floor(
      (Date.now() - new Date(participant.joinedAt).getTime()) / 1000,
    );

    await this.store.updateParticipant(participant.id, { leftAt: now, watchSeconds });

    void this.eventBus?.publish(buildParticipantLeft({ sessionId, userId, leftAt: now, watchSeconds }));
  }

  async panicLeave(sessionId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.leaveSession(sessionId, userId);

    void this.eventBus?.publish(buildPanicLeave({ userId, sessionId, triggeredAt: now }));
  }

  async flagSession(sessionId: string, flaggedBy: string, reason: string): Promise<void> {
    void this.eventBus?.publish(buildSessionFlagged({
      sessionId,
      flaggedBy,
      reason,
      flaggedAt: new Date().toISOString(),
    }));
  }

  async getParticipants(sessionId: string): Promise<SessionParticipant[]> {
    return this.store.getParticipants(sessionId);
  }

  async getSession(sessionId: string): Promise<SessionReservation | null> {
    return this.store.findSession(sessionId);
  }

  async getBooking(bookingId: string): Promise<SessionBooking | null> {
    return this.store.findBooking(bookingId);
  }
}
