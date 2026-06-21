/**
 * Sprint 6 — Companion Economy E2E Tests
 *
 * All stores are module-level in-memory Maps; each test isolates via unique IDs.
 * No database, no external services.
 */

import { randomUUID } from 'crypto';
import {
  CompanionService,
  LonelinessService,
  CompanionStorePort,
  LonelinessStorePort,
  CompanionProfile,
  CompanionRate,
  CompanionDiscoveryCard,
} from '@starria/companion-core';
import {
  SessionService,
  SessionStorePort,
  SessionCoinLedgerPort,
  Booking,
  Session,
  Escrow,
} from '@starria/session-core';
import {
  AgeGateService,
  AgeGateStorePort,
  AgeGateProfile,
  checkAgeGate,
} from '@starria/age-gate-core';

// ── In-memory stores (minimal; only what tests need) ─────────────────────────

function makeCompanionStore(): CompanionStorePort {
  const profiles   = new Map<string, CompanionProfile>();
  const rates      = new Map<string, CompanionRate[]>();
  const reviews    = new Map<string, { rating: number; comment?: string; reviewerId: string }[]>();
  const blocks     = new Map<string, Set<string>>();
  const reports    = new Map<string, { reason: string; reporterId: string }[]>();
  const idempotent = new Map<string, string>();

  return {
    createProfile:      async (p) => { profiles.set(p.id, p); return p; },
    getProfile:         async (id) => profiles.get(id) ?? null,
    updateProfile:      async (id, patch) => {
      const cur = profiles.get(id);
      if (!cur) throw new Error('not found');
      const next = { ...cur, ...patch };
      profiles.set(id, next);
      return next;
    },
    discover:           async (_filter) => [...profiles.values()],
    getRates:           async (id) => rates.get(id) ?? [],
    setRates:           async (id, r) => { rates.set(id, r); },
    hasReview:          async (companionId, reviewerId) =>
      !!(reviews.get(companionId) ?? []).find((r) => r.reviewerId === reviewerId),
    addReview:          async (companionId, review) => {
      const arr = reviews.get(companionId) ?? [];
      arr.push(review);
      reviews.set(companionId, arr);
    },
    getReviews:         async (id) => reviews.get(id) ?? [],
    setAvailability:    async (id, isAvailable) => {
      const cur = profiles.get(id);
      if (cur) profiles.set(id, { ...cur, isAvailableNow: isAvailable });
    },
    getAvailability:    async (id) => !!(profiles.get(id)?.isAvailableNow),
    isBlocked:          async (companionId, userId) =>
      !!(blocks.get(companionId)?.has(userId)),
    addBlock:           async (companionId, userId) => {
      if (!blocks.has(companionId)) blocks.set(companionId, new Set());
      blocks.get(companionId)!.add(userId);
    },
    addReport:          async (companionId, report) => {
      const arr = reports.get(companionId) ?? [];
      arr.push(report);
      reports.set(companionId, arr);
    },
    getIntroMedia:      async (id) => profiles.get(id) ?
      { videoUrl: profiles.get(id)!.introVideoUrl, imageUrls: profiles.get(id)!.introImageUrls } : null,
    setIntroMedia:      async (id, media) => {
      const cur = profiles.get(id);
      if (cur) profiles.set(id, { ...cur, introVideoUrl: media.videoUrl, introImageUrls: media.imageUrls ?? [] });
    },
    findByIdempotencyKey: async (key) => idempotent.get(key) ? (profiles.get(idempotent.get(key)!) ?? null) : null,
    setIdempotencyKey:  async (key, id) => { idempotent.set(key, id); },
  };
}

function makeSessionStore(): SessionStorePort {
  const bookings     = new Map<string, Booking>();
  const sessions     = new Map<string, Session>();
  const escrows      = new Map<string, Escrow>();
  const participants = new Map<string, { userId: string; role: string; joinedAt?: Date }[]>();
  const payouts      = new Map<string, { recipientId: string; coins: number; role: string }[]>();
  const idempotent   = new Map<string, string>();

  return {
    findBookingByKey:   async (key) => idempotent.has(key) ? (bookings.get(idempotent.get(key)!) ?? null) : null,
    createBooking:      async (b) => { bookings.set(b.id, b as Booking); return b as Booking; },
    getBooking:         async (id) => bookings.get(id) ?? null,
    updateBooking:      async (id, patch) => {
      const cur = bookings.get(id)!;
      const next = { ...cur, ...patch } as Booking;
      bookings.set(id, next);
      return next;
    },
    createSession:      async (s) => { sessions.set(s.id, s as Session); return s as Session; },
    getSession:         async (id) => sessions.get(id) ?? null,
    updateSession:      async (id, patch) => {
      const cur = sessions.get(id)!;
      const next = { ...cur, ...patch } as Session;
      sessions.set(id, next);
      return next;
    },
    createEscrow:       async (e) => { escrows.set(e.id, e as Escrow); return e as Escrow; },
    getEscrowByBooking: async (bookingId) =>
      [...escrows.values()].find((e) => e.bookingId === bookingId) ?? null,
    updateEscrow:       async (id, patch) => {
      const cur = escrows.get(id)!;
      escrows.set(id, { ...cur, ...patch } as Escrow);
    },
    getParticipants:    async (sessionId) => participants.get(sessionId) ?? [],
    createParticipant:  async (p) => {
      const arr = participants.get(p.sessionId) ?? [];
      arr.push({ userId: p.userId, role: p.role });
      participants.set(p.sessionId, arr);
      return p as any;
    },
    updateParticipant:  async (sessionId, userId, patch) => {
      const arr = (participants.get(sessionId) ?? []).map((p) =>
        p.userId === userId ? { ...p, ...patch } : p,
      );
      participants.set(sessionId, arr);
    },
    createPayout:       async (p) => {
      const arr = payouts.get(p.sessionId) ?? [];
      arr.push({ recipientId: p.recipientId, coins: p.coinsAmount, role: p.role });
      payouts.set(p.sessionId, arr);
      return p as any;
    },
    getPayouts:         async (sessionId) => payouts.get(sessionId) ?? [],
    setIdempotencyKey:  async (key, bookingId) => { idempotent.set(key, bookingId); },
  };
}

function makeSessionLedger(): SessionCoinLedgerPort & { balances: Map<string, number> } {
  const balances = new Map<string, number>();
  const seed = (userId: string, coins: number) => balances.set(userId, coins);

  return {
    balances,
    seed,
    getBalance:      async (userId) => balances.get(userId) ?? 0,
    debitEscrow:     async (userId, coins) => {
      const cur = balances.get(userId) ?? 0;
      if (cur < coins) throw new Error('Insufficient coins');
      balances.set(userId, cur - coins);
    },
    releaseEscrow:   async (_escrowId) => {},
    refundEscrow:    async (_escrowId, userId, coins) => {
      balances.set(userId, (balances.get(userId) ?? 0) + coins);
    },
    creditCompanion: async (companionId, coins) => {
      balances.set(companionId, (balances.get(companionId) ?? 0) + coins);
    },
    creditSplit:     async (splits) => {
      for (const s of splits) {
        balances.set(s.recipientId, (balances.get(s.recipientId) ?? 0) + s.coins);
      }
    },
  };
}

function makeAgeGateStore(): AgeGateStorePort {
  const profiles = new Map<string, AgeGateProfile>();
  return {
    getProfile:    async (userId) => profiles.get(userId) ?? null,
    upsertProfile: async (p) => { profiles.set(p.userId, p); return p; },
    hasConsent:    async (userId, type) =>
      !!(profiles.get(userId)?.consents.find((c) => c.type === type && c.granted)),
    addConsent:    async (userId, consent) => {
      const cur = profiles.get(userId) ?? { userId, status: 'PENDING', consents: [] } as AgeGateProfile;
      cur.consents.push(consent);
      profiles.set(userId, cur);
    },
    revokeConsent: async (userId, type) => {
      const cur = profiles.get(userId);
      if (cur) {
        cur.consents = cur.consents.map((c) => c.type === type ? { ...c, granted: false } : c);
        profiles.set(userId, cur);
      }
    },
  };
}

function makeLonelinessStore(): LonelinessStorePort {
  const profiles = new Map<string, any>();
  return {
    getProfile:    async (userId) => profiles.get(userId) ?? null,
    upsertProfile: async (p) => { profiles.set(p.userId, p); return p; },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildServices() {
  const companionStore  = makeCompanionStore();
  const sessionStore    = makeSessionStore();
  const ledger          = makeSessionLedger();
  const ageGateStore    = makeAgeGateStore();
  const lonelinessStore = makeLonelinessStore();

  const companionSvc  = new CompanionService({ store: companionStore });
  const sessionSvc    = new SessionService({ store: sessionStore, ledger });
  const ageGateSvc    = new AgeGateService({ store: ageGateStore });
  const lonelinessSvc = new LonelinessService({ store: lonelinessStore });

  return { companionSvc, sessionSvc, ageGateSvc, lonelinessSvc, ledger, companionStore };
}

async function createVerifiedCompanion(companionSvc: CompanionService, overrides: Partial<CompanionProfile> = {}) {
  const id = randomUUID();
  return companionSvc.createProfile({
    id,
    userId: id,
    displayName: 'Luna',
    nationality: 'JP',
    languages: ['Japanese', 'English'],
    heightCm: 162,
    hobbies: ['Piano', 'Origami'],
    interests: ['Anime', 'Travel'],
    timezone: 'Asia/Tokyo',
    sessionTypes: ['AUDIO', 'VIDEO'],
    activities: ['CHATTING', 'MUSIC'],
    bio: 'Test companion',
    introImageUrls: [],
    ageVerified: true,
    verificationStatus: 'VERIFIED',
    verificationBadge: true,
    isAvailableNow: true,
    status: 'ACTIVE',
    averageRating: 0,
    reviewCount: 0,
    totalSessionMinutes: 0,
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sprint 6 — Companion Economy', () => {

  // ── 1. Companion Profile CRUD ───────────────────────────────────────────────

  describe('Companion Profile', () => {
    it('creates a companion profile with required fields', async () => {
      const { companionSvc } = buildServices();
      const p = await createVerifiedCompanion(companionSvc);
      expect(p.displayName).toBe('Luna');
      expect(p.verificationBadge).toBe(true);
      expect(p.sessionTypes).toContain('AUDIO');
    });

    it('sets and reads availability', async () => {
      const { companionSvc } = buildServices();
      const p = await createVerifiedCompanion(companionSvc, { isAvailableNow: false });
      await companionSvc.setAvailability({ companionId: p.id, isAvailable: true });
      const updated = await companionSvc.getProfile(p.id);
      expect(updated?.isAvailableNow).toBe(true);
    });

    it('adds rates to a companion profile', async () => {
      const { companionSvc } = buildServices();
      const p = await createVerifiedCompanion(companionSvc);
      await companionSvc.setRates({
        companionId: p.id,
        rates: [
          { id: randomUUID(), companionId: p.id, sessionType: 'AUDIO', durationMinutes: 30, coinCost: 280, maxParticipants: 1 },
          { id: randomUUID(), companionId: p.id, sessionType: 'VIDEO', durationMinutes: 30, coinCost: 400, maxParticipants: 1 },
        ],
      });
      const rates = await companionSvc.getRates(p.id);
      expect(rates).toHaveLength(2);
      expect(rates[0].coinCost).toBe(280);
    });

    it('calculates average rating after multiple reviews', async () => {
      const { companionSvc } = buildServices();
      const p = await createVerifiedCompanion(companionSvc);
      await companionSvc.leaveReview({ companionId: p.id, reviewerId: 'u1', rating: 5 });
      await companionSvc.leaveReview({ companionId: p.id, reviewerId: 'u2', rating: 3 });
      const updated = await companionSvc.getProfile(p.id);
      expect(updated?.averageRating).toBeCloseTo(4.0);
      expect(updated?.reviewCount).toBe(2);
    });

    it('blocks a user from a companion profile', async () => {
      const { companionSvc } = buildServices();
      const p = await createVerifiedCompanion(companionSvc);
      await companionSvc.blockUser({ companionId: p.id, userId: 'bad-user' });
      const blocked = await companionSvc.isBlocked(p.id, 'bad-user');
      expect(blocked).toBe(true);
    });
  });

  // ── 2. Age Gate ─────────────────────────────────────────────────────────────

  describe('Age Gate', () => {
    it('rejects under-18 self-declaration', async () => {
      const { ageGateSvc } = buildServices();
      const userId = randomUUID();
      const under18dob = new Date();
      under18dob.setFullYear(under18dob.getFullYear() - 17);

      await expect(
        ageGateSvc.submitVerification({
          userId,
          method: 'SELF_DECLARE',
          level: '18+',
          dateOfBirth: under18dob,
        }),
      ).rejects.toThrow();
    });

    it('passes 18+ self-declaration for a 20-year-old', async () => {
      const { ageGateSvc } = buildServices();
      const userId = randomUUID();
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 20);

      const profile = await ageGateSvc.submitVerification({
        userId,
        method: 'SELF_DECLARE',
        level: '18+',
        dateOfBirth: dob,
      });
      expect(profile.status).toBe('PASSED');
      expect(profile.level).toBe('18+');
    });

    it('records companion discovery consent separately', async () => {
      const { ageGateSvc } = buildServices();
      const userId = randomUUID();

      await ageGateSvc.recordConsent({
        userId,
        type: 'COMPANION_DISCOVERY',
        granted: true,
        recordedAt: new Date(),
      });

      const hasConsent = await ageGateSvc.hasConsent(userId, 'COMPANION_DISCOVERY');
      expect(hasConsent).toBe(true);
    });

    it('checkAgeGate returns failed when profile is null', () => {
      const result = checkAgeGate(null, '18+');
      expect(result.passed).toBe(false);
    });

    it('checkAgeGate returns passed for valid 18+ profile', async () => {
      const { ageGateSvc } = buildServices();
      const userId = randomUUID();
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25);
      const profile = await ageGateSvc.submitVerification({
        userId, method: 'SELF_DECLARE', level: '18+', dateOfBirth: dob,
      });
      const result = checkAgeGate(profile, '18+');
      expect(result.passed).toBe(true);
    });
  });

  // ── 3. Session Booking ──────────────────────────────────────────────────────

  describe('Session Booking', () => {
    it('books a session and debits escrow', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId = randomUUID();
      ledger.balances.set(patronId, 100_000);

      const { booking, session } = await sessionSvc.bookSession({
        companionId: companion.id,
        patronId,
        sessionType: 'AUDIO',
        durationMinutes: 30,
        coinCost: 280,
        idempotencyKey: randomUUID(),
      });

      expect(booking.status).toBe('CONFIRMED');
      expect(session.status).toBe('SCHEDULED');
      expect(ledger.balances.get(patronId)).toBe(100_000 - 280);
    });

    it('is idempotent — duplicate booking key returns existing booking', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId = randomUUID();
      ledger.balances.set(patronId, 100_000);
      const key = randomUUID();

      const first  = await sessionSvc.bookSession({ companionId: companion.id, patronId, sessionType: 'AUDIO', durationMinutes: 30, coinCost: 280, idempotencyKey: key });
      const second = await sessionSvc.bookSession({ companionId: companion.id, patronId, sessionType: 'AUDIO', durationMinutes: 30, coinCost: 280, idempotencyKey: key });

      expect(first.booking.id).toBe(second.booking.id);
      // Debit only happens once
      expect(ledger.balances.get(patronId)).toBe(100_000 - 280);
    });

    it('rejects booking when patron has insufficient coins', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId = randomUUID();
      ledger.balances.set(patronId, 100); // only 100 coins

      await expect(
        sessionSvc.bookSession({
          companionId: companion.id,
          patronId,
          sessionType: 'AUDIO',
          durationMinutes: 30,
          coinCost: 280,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
    });

    it('cancels booking and refunds escrow', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId = randomUUID();
      ledger.balances.set(patronId, 100_000);

      const { booking } = await sessionSvc.bookSession({
        companionId: companion.id,
        patronId,
        sessionType: 'AUDIO',
        durationMinutes: 30,
        coinCost: 280,
        idempotencyKey: randomUUID(),
      });

      await sessionSvc.cancelBooking({ bookingId: booking.id, cancelledBy: patronId });
      expect(ledger.balances.get(patronId)).toBe(100_000); // refunded
    });
  });

  // ── 4. Session Lifecycle ────────────────────────────────────────────────────

  describe('Session Lifecycle', () => {
    async function bookedSession() {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId  = randomUUID();
      ledger.balances.set(patronId, 100_000);
      const { booking, session } = await sessionSvc.bookSession({
        companionId: companion.id,
        patronId,
        sessionType: 'AUDIO',
        durationMinutes: 30,
        coinCost: 280,
        idempotencyKey: randomUUID(),
      });
      return { companionSvc, sessionSvc, ledger, companion, patronId, booking, session };
    }

    it('starts a session — status becomes LIVE', async () => {
      const { sessionSvc, session } = await bookedSession();
      const started = await sessionSvc.startSession({ sessionId: session.id });
      expect(started.status).toBe('LIVE');
      expect(started.startedAt).toBeDefined();
    });

    it('ends a session — payout released to companion', async () => {
      const { sessionSvc, ledger, session, companion } = await bookedSession();
      await sessionSvc.startSession({ sessionId: session.id });
      await sessionSvc.endSession({ sessionId: session.id });
      // companion gets 80% of 280 = 224 coins
      expect(ledger.balances.get(companion.id)).toBeGreaterThan(0);
    });

    it('extends a session at the 5-min warning', async () => {
      const { sessionSvc, ledger, session, patronId } = await bookedSession();
      await sessionSvc.startSession({ sessionId: session.id });
      const balanceBefore = ledger.balances.get(patronId)!;
      await sessionSvc.extendSession({
        sessionId: session.id,
        patronId,
        addedMinutes: 15,
        coinCostPerMinute: 10,
      });
      expect(ledger.balances.get(patronId)).toBe(balanceBefore - 150);
    });

    it('invites a participant to a GROUP session', async () => {
      const { sessionSvc, session } = await bookedSession();
      await sessionSvc.startSession({ sessionId: session.id });
      const guestId = randomUUID();
      await sessionSvc.inviteParticipant({
        sessionId: session.id,
        invitedBy: 'host',
        userId: guestId,
        role: 'GUEST',
      });
      const participants = await sessionSvc.getParticipants(session.id);
      expect(participants.some((p: any) => p.userId === guestId)).toBe(true);
    });
  });

  // ── 5. Panic Leave ──────────────────────────────────────────────────────────

  describe('Panic Leave', () => {
    it('triggers panic leave and emits PANIC_LEAVE_TRIGGERED event', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId  = randomUUID();
      ledger.balances.set(patronId, 100_000);

      const { session } = await sessionSvc.bookSession({
        companionId: companion.id,
        patronId,
        sessionType: 'VIDEO',
        durationMinutes: 30,
        coinCost: 400,
        idempotencyKey: randomUUID(),
      });

      await sessionSvc.startSession({ sessionId: session.id });

      const events: any[] = [];
      (sessionSvc as any).eventBus = { publish: (e: any) => events.push(e) };
      await sessionSvc.panicLeave({ sessionId: session.id, userId: patronId });

      expect(events.some((e) => e.type === 'PANIC_LEAVE_TRIGGERED')).toBe(true);
    });
  });

  // ── 6. Loneliness Index ─────────────────────────────────────────────────────

  describe('Loneliness Index', () => {
    it('calculates loneliness score — high inactivity raises score', () => {
      const { lonelinessSvc } = buildServices();
      const score = lonelinessSvc.calculateLonelinessScore({
        inactiveChatDays: 30,    // max → 30 pts
        lowEngagementDays: 14,   // max → 20 pts
        recentSupportLoss: true, //       15 pts
        selfSelectedPreference: false,
        lowSocialActivityScore: 100, // inverted → 0 pts
      });
      expect(score).toBeCloseTo(65);
    });

    it('calculates loneliness score — active user scores low', () => {
      const { lonelinessSvc } = buildServices();
      const score = lonelinessSvc.calculateLonelinessScore({
        inactiveChatDays: 0,
        lowEngagementDays: 0,
        recentSupportLoss: false,
        selfSelectedPreference: false,
        lowSocialActivityScore: 0,
      });
      expect(score).toBeCloseTo(15); // only lowSocialActivity contribution when score=0 → (1-0)*15
    });

    it('getRecommendations never exposes the loneliness score', async () => {
      const { lonelinessSvc } = buildServices();
      const userId = randomUUID();

      await lonelinessSvc.updateProfile({
        userId,
        signals: {
          inactiveChatDays: 20,
          lowEngagementDays: 10,
          recentSupportLoss: false,
          selfSelectedPreference: true,
          lowSocialActivityScore: 50,
        },
      });

      const result = await lonelinessSvc.getRecommendations({ userId, companionPool: [] });
      expect(result).not.toHaveProperty('score');
      expect(result).not.toHaveProperty('lonelinessScore');
      expect(result).toHaveProperty('companions');
      expect(result).toHaveProperty('reason');
    });
  });

  // ── 7. Companion Discovery ──────────────────────────────────────────────────

  describe('Companion Discovery', () => {
    it('discovers available companions', async () => {
      const { companionSvc } = buildServices();
      await createVerifiedCompanion(companionSvc, { isAvailableNow: true });
      await createVerifiedCompanion(companionSvc, { displayName: 'Aria', isAvailableNow: false });

      const all = await companionSvc.discover({});
      expect(all.length).toBeGreaterThanOrEqual(2);

      const available = await companionSvc.discover({ availableNow: true });
      expect(available.every((c: any) => c.isAvailableNow)).toBe(true);
    });

    it('filters discovery by session type', async () => {
      const { companionSvc } = buildServices();
      await createVerifiedCompanion(companionSvc, { sessionTypes: ['AUDIO'] });
      await createVerifiedCompanion(companionSvc, { displayName: 'Mia', sessionTypes: ['VIDEO', 'GROUP'] });

      const videoOnly = await companionSvc.discover({ sessionType: 'VIDEO' });
      expect(videoOnly.some((c: any) => c.displayName === 'Mia')).toBe(true);
    });
  });

  // ── 8. Safety & Trust Restrictions ─────────────────────────────────────────

  describe('Safety', () => {
    it('reports a companion — adds to report queue', async () => {
      const { companionSvc } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);

      await companionSvc.reportProfile({
        companionId: companion.id,
        reporterId: 'patron-1',
        reason: 'Inappropriate behaviour',
      });

      // Report does not change profile status immediately (goes to moderation queue)
      const p = await companionSvc.getProfile(companion.id);
      expect(p?.status).toBe('ACTIVE');
    });

    it('blocks a companion — isBlocked returns true', async () => {
      const { companionSvc } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);

      await companionSvc.blockUser({ companionId: companion.id, userId: 'bad-actor' });
      expect(await companionSvc.isBlocked(companion.id, 'bad-actor')).toBe(true);
      expect(await companionSvc.isBlocked(companion.id, 'other-user')).toBe(false);
    });
  });

  // ── 9. Payout Split ─────────────────────────────────────────────────────────

  describe('Payout Split', () => {
    it('settles payout with 80/20 split — companion receives 80% of coins', async () => {
      const { companionSvc, sessionSvc, ledger } = buildServices();
      const companion = await createVerifiedCompanion(companionSvc);
      const patronId  = randomUUID();
      ledger.balances.set(patronId, 100_000);

      const { session } = await sessionSvc.bookSession({
        companionId: companion.id,
        patronId,
        sessionType: 'AUDIO',
        durationMinutes: 30,
        coinCost: 1000,
        idempotencyKey: randomUUID(),
      });

      await sessionSvc.startSession({ sessionId: session.id });
      await sessionSvc.endSession({ sessionId: session.id });

      // 80% of 1000 = 800
      expect(ledger.balances.get(companion.id)).toBe(800);
    });
  });

});
