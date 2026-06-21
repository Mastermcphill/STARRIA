// ---------------------------------------------------------------------------
// session-core — domain types
// Booking, escrow, timer, extension, payout, participant management
// ---------------------------------------------------------------------------

import type { SessionType } from '@starria/domain-events';
export type { SessionType };

// ── Enumerations ──────────────────────────────────────────────────────────────

export type BookingStatus   = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type SessionStatus   = 'SCHEDULED' | 'WAITING' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type EscrowStatus    = 'HELD' | 'RELEASED' | 'REFUNDED' | 'PARTIAL_REFUND';
export type ParticipantRole = 'HOST' | 'GUEST' | 'CO_HOST' | 'VIEWER';

export const SESSION_DURATIONS = [15, 30, 45, 60] as const;
export type SessionDuration = typeof SESSION_DURATIONS[number];

// ── SessionBooking ────────────────────────────────────────────────────────────

export interface SessionBooking {
  readonly id: string;
  readonly companionId: string;
  readonly patronId: string;
  readonly sessionType: SessionType;
  readonly durationMinutes: SessionDuration;
  readonly coinCost: number;
  readonly status: BookingStatus;
  readonly idempotencyKey: string;
  readonly scheduledAt: string;
  readonly confirmedAt?: string;
  readonly cancelledAt?: string;
  readonly sessionId?: string;   // set once session is created
  readonly createdAt: string;
}

// ── SessionEscrow ─────────────────────────────────────────────────────────────

export interface SessionEscrow {
  readonly id: string;
  readonly bookingId: string;
  readonly patronId: string;
  readonly companionId: string;
  readonly heldCoins: number;
  readonly status: EscrowStatus;
  readonly heldAt: string;
  readonly releasedAt?: string;
}

// ── SessionReservation (live session record) ──────────────────────────────────

export interface SessionReservation {
  readonly id: string;
  readonly bookingId: string;
  readonly companionId: string;
  readonly sessionType: SessionType;
  readonly status: SessionStatus;
  readonly livekitRoomName: string;
  readonly durationMinutes: number;
  readonly scheduledAt: string;
  readonly startedAt?: string;
  readonly endsAt?: string;     // computed: startedAt + durationMinutes + extensions
  readonly endedAt?: string;
  readonly extensionMinutes: number;   // cumulative
  readonly participantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── SessionExtension ──────────────────────────────────────────────────────────

export interface SessionExtension {
  readonly id: string;
  readonly sessionId: string;
  readonly patronId: string;
  readonly addedMinutes: SessionDuration;
  readonly additionalCoins: number;
  readonly escrowId: string;
  readonly extendedAt: string;
}

// ── SessionParticipant ────────────────────────────────────────────────────────

export interface SessionParticipant {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: ParticipantRole;
  readonly livekitIdentity: string;
  readonly joinedAt: string;
  readonly leftAt?: string;
  readonly watchSeconds: number;
}

// ── SessionPayout ─────────────────────────────────────────────────────────────

export interface SessionPayout {
  readonly id: string;
  readonly sessionId: string;
  readonly companionId: string;
  readonly grossCoins: number;
  readonly platformFeeCoins: number;
  readonly netCoins: number;
  readonly splits: PayoutSplit[];
  readonly settledAt: string;
}

export interface PayoutSplit {
  readonly userId: string;
  readonly coins: number;
  readonly pct: number;         // percentage share 0–100
}

// ── Coin ledger port ──────────────────────────────────────────────────────────

export interface SessionCoinLedgerPort {
  debitEscrow(patronId: string, coins: number, bookingId: string): Promise<void>;
  releaseEscrow(bookingId: string): Promise<{ coins: number }>;
  refundEscrow(bookingId: string, refundCoins: number): Promise<void>;
  creditCompanion(companionId: string, coins: number, sessionId: string): Promise<void>;
  creditSplit(userId: string, coins: number, sessionId: string): Promise<void>;
}

// ── Persistence port ──────────────────────────────────────────────────────────

export interface SessionStorePort {
  createBooking(booking: Omit<SessionBooking, 'id' | 'createdAt'>): Promise<SessionBooking>;
  findBooking(id: string): Promise<SessionBooking | null>;
  findBookingByKey(idempotencyKey: string): Promise<SessionBooking | null>;
  updateBooking(id: string, patch: Partial<SessionBooking>): Promise<SessionBooking>;

  createEscrow(escrow: Omit<SessionEscrow, 'id'>): Promise<SessionEscrow>;
  findEscrowByBooking(bookingId: string): Promise<SessionEscrow | null>;
  updateEscrow(id: string, patch: Partial<SessionEscrow>): Promise<SessionEscrow>;

  createSession(session: Omit<SessionReservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<SessionReservation>;
  findSession(id: string): Promise<SessionReservation | null>;
  findSessionByBooking(bookingId: string): Promise<SessionReservation | null>;
  updateSession(id: string, patch: Partial<SessionReservation>): Promise<SessionReservation>;

  appendExtension(ext: Omit<SessionExtension, 'id'>): Promise<SessionExtension>;
  getExtensions(sessionId: string): Promise<SessionExtension[]>;

  createParticipant(p: Omit<SessionParticipant, 'id'>): Promise<SessionParticipant>;
  findParticipant(sessionId: string, userId: string): Promise<SessionParticipant | null>;
  updateParticipant(id: string, patch: Partial<SessionParticipant>): Promise<SessionParticipant>;
  getParticipants(sessionId: string): Promise<SessionParticipant[]>;

  createPayout(payout: Omit<SessionPayout, 'id'>): Promise<SessionPayout>;
  findPayout(sessionId: string): Promise<SessionPayout | null>;
}

// ── Service I/O ───────────────────────────────────────────────────────────────

export interface BookSessionInput {
  readonly companionId: string;
  readonly patronId: string;
  readonly sessionType: SessionType;
  readonly durationMinutes: SessionDuration;
  readonly coinCost: number;
  readonly scheduledAt: string;
  readonly idempotencyKey: string;
}

export interface ExtendSessionInput {
  readonly sessionId: string;
  readonly patronId: string;
  readonly addedMinutes: SessionDuration;
  readonly coinCostPerMinute: number;
}

export interface InviteParticipantInput {
  readonly sessionId: string;
  readonly invitedBy: string;
  readonly userId: string;
  readonly role: 'GUEST' | 'CO_HOST';
}

// Payout configuration
export const COMPANION_PLATFORM_FEE_PCT = 20; // platform takes 20%
export const COMPANION_CREATOR_PCT      = 80; // companion earns 80%
