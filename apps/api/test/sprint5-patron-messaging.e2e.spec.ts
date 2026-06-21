// ---------------------------------------------------------------------------
// Sprint 5 E2E — Patron Economy, Messaging Prestige & Presence
// Pure in-memory, no HTTP, no DB, no external services.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';

// ── Core imports ─────────────────────────────────────────────────────────────
import {
  PatronService,
  PatronStorePort,
  PatronProfile,
  PatronHistory,
  CreatorRelationship,
  PatronAchievement,
  PatronAchievementType,
  PatronMilestone,
} from '../../packages/patron-core/src';

import {
  MessagingService,
  MessageStorePort,
  DMPermissionStorePort,
  MessageRequest,
  Conversation,
  Message,
  InboxThread,
  DMPermission,
  DMGateContext,
  MessageRequestStatus,
} from '../../packages/messaging-core/src';

import {
  TrustService,
  TrustStorePort,
  TrustProfile as TrustProf,
  TrustFlag,
  TrustRestrictionRecord,
} from '../../packages/trust-core/src';

// ── Domain event capture ──────────────────────────────────────────────────────

interface CapturedEvent { type: string; payload: unknown }

function makeEventBus() {
  const events: CapturedEvent[] = [];
  return {
    publish: async (event: any) => { events.push({ type: event.type, payload: event.payload }); },
    eventsOf: (type: string) => events.filter(e => e.type === type),
    clear: () => { events.length = 0; },
    all: () => events,
  };
}

// ── In-memory stores ──────────────────────────────────────────────────────────

function makePatronStore(): PatronStorePort {
  const profiles = new Map<string, PatronProfile>();
  const byUser   = new Map<string, string>();
  const history  = new Map<string, PatronHistory[]>();
  const rels     = new Map<string, CreatorRelationship>();
  const achs     = new Map<string, PatronAchievement[]>();
  const miles    = new Map<string, PatronMilestone[]>();

  return {
    async findById(id) { return profiles.get(id) ?? null; },
    async findByUserId(uid) { const id = byUser.get(uid); return id ? profiles.get(id) ?? null : null; },
    async create(input) {
      const now = new Date().toISOString();
      const p: PatronProfile = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      profiles.set(p.id, p); byUser.set(p.userId, p.id); return p;
    },
    async update(id, patch) {
      const existing = profiles.get(id)!;
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      profiles.set(id, updated); return updated;
    },
    async findRelationship(pid, sid) { return rels.get(`${pid}:${sid}`) ?? null; },
    async findRelationshipsByPatron(pid) { return [...rels.values()].filter(r => r.patronId === pid); },
    async findRelationshipsByStar(sid, limit = 50) {
      return [...rels.values()].filter(r => r.starId === sid)
        .sort((a, b) => b.creatorLifetimeUsdCents - a.creatorLifetimeUsdCents).slice(0, limit);
    },
    async upsertRelationship(rel) {
      const key = `${rel.patronId}:${rel.starId}`;
      const existing = rels.get(key);
      const record: CreatorRelationship = { ...rel, id: rel.id ?? existing?.id ?? randomUUID(), updatedAt: new Date().toISOString() };
      rels.set(key, record); return record;
    },
    async appendHistory(entry) { const r: PatronHistory = { ...entry, id: randomUUID() }; const l = history.get(entry.patronId) ?? []; l.push(r); history.set(entry.patronId, l); return r; },
    async getHistory(pid, limit = 50) { return (history.get(pid) ?? []).slice(-limit).reverse(); },
    async appendAchievement(a) { const r: PatronAchievement = { ...a, id: randomUUID() }; const l = achs.get(a.patronId) ?? []; l.push(r); achs.set(a.patronId, l); return r; },
    async getAchievements(pid) { return achs.get(pid) ?? []; },
    async hasAchievement(pid, type) { return (achs.get(pid) ?? []).some(a => a.achievementType === type); },
    async appendMilestone(m) { const r: PatronMilestone = { ...m, id: randomUUID() }; const l = miles.get(m.patronId) ?? []; l.push(r); miles.set(m.patronId, l); return r; },
    async getMilestones(pid, sid?) { const all = miles.get(pid) ?? []; return sid ? all.filter(m => m.starId === sid) : all; },
  };
}

function makeMessageStore(): MessageStorePort {
  const requests = new Map<string, MessageRequest>();
  const convs    = new Map<string, Conversation>();
  const msgs     = new Map<string, Message[]>();
  const unread   = new Map<string, number>();

  return {
    async findRequest(id) { return requests.get(id) ?? null; },
    async findRequestsByRecipient(rid, status?) {
      return [...requests.values()].filter(r => r.recipientId === rid && (!status || r.status === status));
    },
    async createRequest(req) { const r: MessageRequest = { ...req, id: randomUUID() }; requests.set(r.id, r); return r; },
    async updateRequest(id, patch) { const e = requests.get(id)!; const u = { ...e, ...patch }; requests.set(id, u); return u; },
    async findConversation(id) { return convs.get(id) ?? null; },
    async findConversationByParticipants(a, b) {
      return [...convs.values()].find(c => c.participantIds.includes(a) && c.participantIds.includes(b)) ?? null;
    },
    async createConversation(conv) { const r: Conversation = { ...conv, id: randomUUID() }; convs.set(r.id, r); return r; },
    async updateConversation(id, patch) { const e = convs.get(id)!; const u = { ...e, ...patch }; convs.set(id, u); return u; },
    async appendMessage(msg) { const r: Message = { ...msg, id: randomUUID() }; const l = msgs.get(msg.conversationId) ?? []; l.push(r); msgs.set(msg.conversationId, l); return r; },
    async getMessages(cid, limit = 50) { return (msgs.get(cid) ?? []).slice(-limit); },
    async getInbox(uid) {
      const threads: InboxThread[] = [];
      for (const conv of convs.values()) {
        if (!conv.participantIds.includes(uid)) continue;
        const other = conv.participantIds.find(id => id !== uid) ?? '';
        const list = msgs.get(conv.id) ?? [];
        const last = list[list.length - 1];
        threads.push({ conversationId: conv.id, otherUserId: other, lastMessage: last?.body, lastMessageAt: last?.sentAt, unreadCount: unread.get(`${conv.id}:${uid}`) ?? 0 });
      }
      return threads;
    },
    async incrementUnread(cid, rid) { const k = `${cid}:${rid}`; unread.set(k, (unread.get(k) ?? 0) + 1); },
    async markRead(cid, uid) { unread.set(`${cid}:${uid}`, 0); },
  };
}

function makeDMPermStore(): DMPermissionStorePort {
  const perms = new Map<string, DMPermission>();
  return {
    async find(uid) { return perms.get(uid) ?? null; },
    async upsert(p) { perms.set(p.userId, p); return p; },
  };
}

function makeTrustStore(): TrustStorePort {
  const profiles = new Map<string, TrustProf>();
  const flags    = new Map<string, TrustFlag[]>();
  const recs     = new Map<string, TrustRestrictionRecord[]>();
  return {
    async find(uid) { return profiles.get(uid) ?? null; },
    async upsert(p) { profiles.set(p.userId, p); return p; },
    async appendFlag(f) { const r: TrustFlag = { ...f, id: randomUUID() }; const l = flags.get(f.userId) ?? []; l.push(r); flags.set(f.userId, l); return r; },
    async getFlags(uid) { return flags.get(uid) ?? []; },
    async appendRestriction(rec) { const r: TrustRestrictionRecord = { ...rec, id: randomUUID() }; const l = recs.get(rec.userId) ?? []; l.push(r); recs.set(rec.userId, l); return r; },
    async getRestrictions(uid) { return recs.get(uid) ?? []; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sprint 5 — Patron Economy', () => {
  let store: PatronStorePort;
  let bus: ReturnType<typeof makeEventBus>;
  let svc: PatronService;

  beforeEach(() => {
    store = makePatronStore();
    bus   = makeEventBus();
    svc   = new PatronService(store, bus as any);
  });

  it('creates a patron profile and emits PATRON_PROFILE_CREATED', async () => {
    const profile = await svc.createProfile({
      userId: 'u1',
      displayName: 'Alice',
    });

    expect(profile.tier).toBe('VISITOR');
    expect(profile.lifetimeUsdCents).toBe(0);
    expect(bus.eventsOf('patron.profile.created')).toHaveLength(1);
  });

  it('recordSpend: upgrades VISITOR → SUPPORTER at $100', async () => {
    const profile = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });

    const result = await svc.recordSpend({
      patronId: profile.id,
      starId: 'star-1',
      coinsAmount: 1000,
      usdCents: 10_000,  // exactly $100
      action: 'GIFT',
    });

    expect(result.newTier).toBe('SUPPORTER');
    expect(result.tierChanged).toBe(true);
    expect(bus.eventsOf('patron.tier.upgraded')).toHaveLength(1);
  });

  it('recordSpend: VISITOR remains when spend < $100', async () => {
    const profile = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    const result = await svc.recordSpend({
      patronId: profile.id, starId: 'star-1',
      coinsAmount: 100, usdCents: 5_000, action: 'GIFT',
    });
    expect(result.newTier).toBe('VISITOR');
    expect(result.tierChanged).toBe(false);
  });

  it('SUPPORTER → PATRON at $1,000 lifetime', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    // First spend: get to SUPPORTER
    await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 1000, usdCents: 10_000, action: 'GIFT' });
    // Second spend: push to PATRON threshold
    const result = await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 9000, usdCents: 90_000, action: 'GIFT' });
    expect(result.newTier).toBe('PATRON');
  });

  it('unlocks FIRST_SUPPORT achievement on first spend', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    const result = await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 100, action: 'TIP' });
    const firstSupport = result.newAchievements.find(a => a.achievementType === 'FIRST_SUPPORT');
    expect(firstSupport).toBeDefined();
    expect(bus.eventsOf('patron.achievement.unlocked')).toHaveLength(1);
  });

  it('does NOT double-unlock achievements', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 100, action: 'TIP' });
    bus.clear();
    const result2 = await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 100, action: 'TIP' });
    expect(result2.newAchievements.find(a => a.achievementType === 'FIRST_SUPPORT')).toBeUndefined();
    expect(bus.eventsOf('patron.achievement.unlocked')).toHaveLength(0);
  });

  it('records FIRST_SUPPORT milestone for a new creator', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    const result = await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 100, action: 'TIP' });
    expect(result.newMilestones.find(m => m.milestoneType === 'FIRST_SUPPORT')).toBeDefined();
    expect(bus.eventsOf('patron.milestone.reached')).toHaveLength(1);
  });

  it('tracks creator-scoped relationship tier independently', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    // $500 to creator A
    const r1 = await svc.recordSpend({ patronId: p.id, starId: 'starA', coinsAmount: 5000, usdCents: 50_000, action: 'GIFT' });
    // $100 to creator B
    const r2 = await svc.recordSpend({ patronId: p.id, starId: 'starB', coinsAmount: 1000, usdCents: 10_000, action: 'GIFT' });

    // Global tier = SUPPORTER ($600 total)
    expect(r2.profile.tier).toBe('SUPPORTER');
    // Creator A tier = PATRON ($500 → 50_000 cents)
    expect(r1.relationship.creatorTier).toBe('SUPPORTER');
    // Creator B tier = SUPPORTER ($100)
    expect(r2.relationship.creatorTier).toBe('SUPPORTER');
  });

  it('emits PATRON_SPEND_RECORDED on every spend', async () => {
    const p = await svc.createProfile({ userId: 'u1', displayName: 'Alice' });
    await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 500, action: 'TIP' });
    await svc.recordSpend({ patronId: p.id, starId: 's1', coinsAmount: 10, usdCents: 500, action: 'TIP' });
    expect(bus.eventsOf('patron.spend.recorded')).toHaveLength(2);
  });
});

describe('Sprint 5 — Messaging Prestige', () => {
  let msgStore: MessageStorePort;
  let permStore: DMPermissionStorePort;
  let bus: ReturnType<typeof makeEventBus>;
  let svc: MessagingService;

  beforeEach(() => {
    msgStore  = makeMessageStore();
    permStore = makeDMPermStore();
    bus       = makeEventBus();
    svc       = new MessagingService(msgStore, permStore, bus as any);
  });

  const baseGateContext = (overrides: Partial<DMGateContext> = {}): DMGateContext => ({
    senderTier: 'PATRON',
    creatorScopedSpendUsdCents: 10_000,
    supporterDurationDays: 30,
    isTopSupporter: false,
    recipientPermission: {
      userId: 'creator-1',
      accessLevel: 'SUPPORTERS',
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  });

  it('sends a message request and emits MESSAGE_REQUEST_SENT', async () => {
    const req = await svc.sendRequest({
      senderId: 'fan-1',
      recipientId: 'creator-1',
      senderPatronTier: 'PATRON',
      openingMessage: 'Hello! Big fan.',
      dmGateContext: baseGateContext(),
    });

    expect(req.status).toBe('PENDING');
    expect(bus.eventsOf('messaging.request.sent')).toHaveLength(1);
  });

  it('blocks send when access level is NOBODY', async () => {
    const ctx = baseGateContext({
      recipientPermission: {
        userId: 'creator-1',
        accessLevel: 'NOBODY',
        updatedAt: new Date().toISOString(),
      },
    });
    await expect(svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'VISITOR', openingMessage: 'Hi', dmGateContext: ctx,
    })).rejects.toThrow('not accepting DM');
  });

  it('blocks VISITOR from sending to PATRONS-gated creator', async () => {
    const ctx = baseGateContext({
      senderTier: 'VISITOR',
      recipientPermission: {
        userId: 'creator-1',
        accessLevel: 'PATRONS',
        updatedAt: new Date().toISOString(),
      },
    });
    await expect(svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'VISITOR', openingMessage: 'Hi', dmGateContext: ctx,
    })).rejects.toThrow('Patron tier or higher');
  });

  it('accepts request and creates conversation', async () => {
    const req = await svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Hello!',
      dmGateContext: baseGateContext(),
    });
    const conv = await svc.acceptRequest({ requestId: req.id, recipientId: 'creator-1' });
    expect(conv.status).toBe('ACTIVE');
    expect(conv.participantIds).toContain('fan-1');
    expect(bus.eventsOf('messaging.request.accepted')).toHaveLength(1);
    expect(bus.eventsOf('messaging.conversation.opened')).toHaveLength(1);
  });

  it('declines request correctly', async () => {
    const req = await svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Hello!',
      dmGateContext: baseGateContext(),
    });
    const updated = await svc.declineRequest({ requestId: req.id, recipientId: 'creator-1' });
    expect(updated.status).toBe('DECLINED');
    expect(bus.eventsOf('messaging.request.declined')).toHaveLength(1);
  });

  it('sends messages within conversation', async () => {
    const req = await svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Hello!',
      dmGateContext: baseGateContext(),
    });
    const conv = await svc.acceptRequest({ requestId: req.id, recipientId: 'creator-1' });

    const msg = await svc.sendMessage({
      conversationId: conv.id, senderId: 'creator-1',
      recipientId: 'fan-1', type: 'TEXT', body: 'Thanks!',
    });
    expect(msg.body).toBe('Thanks!');
    expect(bus.eventsOf('messaging.message.sent').length).toBeGreaterThan(0);
  });

  it('inbox shows thread after conversation', async () => {
    const req = await svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Hello!',
      dmGateContext: baseGateContext(),
    });
    await svc.acceptRequest({ requestId: req.id, recipientId: 'creator-1' });
    const inbox = await svc.getInbox('creator-1');
    expect(inbox.length).toBeGreaterThan(0);
    expect(inbox[0].otherUserId).toBe('fan-1');
  });

  it('prevents duplicate pending requests', async () => {
    const ctx = baseGateContext();
    await svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Hi!',
      dmGateContext: ctx,
    });
    await expect(svc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Again!',
      dmGateContext: ctx,
    })).rejects.toThrow('pending request already exists');
  });
});

describe('Sprint 5 — Trust System', () => {
  let store: TrustStorePort;
  let bus: ReturnType<typeof makeEventBus>;
  let svc: TrustService;

  beforeEach(() => {
    store = makeTrustStore();
    bus   = makeEventBus();
    svc   = new TrustService(store, bus as any);
  });

  it('bootstraps pristine profile with score 100', async () => {
    const profile = await svc.getProfile('u1');
    expect(profile.score).toBe(100);
    expect(profile.restrictions).toHaveLength(0);
  });

  it('updating signals recalculates score', async () => {
    await svc.getProfile('u1');
    const updated = await svc.updateSignals({
      userId: 'u1',
      signals: { moderationScore: 50, fraudScore: 60 },
    });
    expect(updated.score).toBeLessThan(100);
    expect(bus.eventsOf('trust.score.updated')).toHaveLength(1);
  });

  it('raising SPAM flag applies score penalty', async () => {
    await svc.getProfile('u1');
    const after = await svc.raiseFlag({ userId: 'u1', flagType: 'SPAM', raisedBy: 'system' });
    expect(after.signals.spamScore).toBeLessThan(100);
    expect(bus.eventsOf('trust.flag.raised')).toHaveLength(1);
  });

  it('auto-applies MESSAGING_BLOCKED when score ≤ 20', async () => {
    await svc.getProfile('u1');
    const after = await svc.updateSignals({
      userId: 'u1',
      signals: {
        moderationScore: 0, fraudScore: 0, spamScore: 0,
        conversationQuality: 0, creatorFeedback: 0, paymentDisputes: 10,
      },
    });
    expect(after.restrictions).toContain('MESSAGING_BLOCKED');
    expect(bus.eventsOf('trust.restriction.set').length).toBeGreaterThan(0);
  });

  it('checkEligibility returns correct flags', async () => {
    await svc.getProfile('u1');
    const el = await svc.checkEligibility('u1');
    expect(el.canMessage).toBe(true);
    expect(el.canBePatron).toBe(true);
    expect(el.isShadowRestricted).toBe(false);
    expect(el.score).toBe(100);
  });

  it('manual restriction sets correctly', async () => {
    const profile = await svc.setRestriction({
      userId: 'u1',
      restriction: 'PATRON_INELIGIBLE',
      reason: 'Manual ban',
    });
    expect(profile.restrictions).toContain('PATRON_INELIGIBLE');
    expect(bus.eventsOf('trust.restriction.set')).toHaveLength(1);
  });
});

describe('Sprint 5 — Full patron→DM flow', () => {
  it('patron tier gates DM access end-to-end', async () => {
    const patronBus   = makeEventBus();
    const messageBus  = makeEventBus();
    const patronStore = makePatronStore();
    const msgStore    = makeMessageStore();
    const permStore   = makeDMPermStore();

    const patronSvc  = new PatronService(patronStore, patronBus as any);
    const messageSvc = new MessagingService(msgStore, permStore, messageBus as any);

    // 1. Create patron profile
    const patron = await patronSvc.createProfile({ userId: 'fan-1', displayName: 'Fan Alice' });

    // 2. Spend $1,000 → PATRON tier
    let spendResult = await patronSvc.recordSpend({
      patronId: patron.id, starId: 'creator-1',
      coinsAmount: 10_000, usdCents: 100_000, action: 'GIFT',
    });
    expect(spendResult.newTier).toBe('PATRON');

    // 3. PATRON tier can send DM request to PATRONS-gated creator
    const ctx: DMGateContext = {
      senderTier: 'PATRON',
      creatorScopedSpendUsdCents: 100_000,
      supporterDurationDays: 0,
      isTopSupporter: false,
      recipientPermission: {
        userId: 'creator-1',
        accessLevel: 'PATRONS',
        updatedAt: new Date().toISOString(),
      },
    };

    const req = await messageSvc.sendRequest({
      senderId: 'fan-1', recipientId: 'creator-1',
      senderPatronTier: 'PATRON', openingMessage: 'Love your content!',
      dmGateContext: ctx,
    });
    expect(req.status).toBe('PENDING');

    // 4. Creator accepts → conversation opens
    const conv = await messageSvc.acceptRequest({ requestId: req.id, recipientId: 'creator-1' });
    expect(conv.status).toBe('ACTIVE');

    // 5. Fan sends a follow-up message
    const msg = await messageSvc.sendMessage({
      conversationId: conv.id, senderId: 'fan-1',
      recipientId: 'creator-1', type: 'TEXT', body: 'Thank you for accepting!',
    });
    expect(msg.body).toBe('Thank you for accepting!');

    // Verify all expected events fired
    const allPatronTypes = patronBus.all().map(e => e.type);
    expect(allPatronTypes).toContain('patron.profile.created');
    expect(allPatronTypes).toContain('patron.spend.recorded');
    expect(allPatronTypes).toContain('patron.tier.upgraded');
    expect(allPatronTypes).toContain('patron.relationship.created');

    const allMsgTypes = messageBus.all().map(e => e.type);
    expect(allMsgTypes).toContain('messaging.request.sent');
    expect(allMsgTypes).toContain('messaging.request.accepted');
    expect(allMsgTypes).toContain('messaging.conversation.opened');
    expect(allMsgTypes).toContain('messaging.message.sent');
  });
});
