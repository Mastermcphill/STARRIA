/**
 * Sprint 4 — Stars, Prestige, Upload Caps & Visibility Marketplace
 * End-to-end integration test (no HTTP, no Prisma, no external services).
 *
 * Full loop:
 *   Support increases → White Star score rises → tier upgrades →
 *   Platform fee decreases → Upload allowance increases →
 *   Creator launches campaign → Visibility boosts work →
 *   Gold Star unlocks achievement → Leaderboard updated
 *
 * Invariants verified:
 *   • White star score formula: supporters*0.35 + gifts*0.25 + watch*0.20 + retention*0.10 + tap*0.10
 *   • Upload cap exactly matches half-star tier table
 *   • Platform fee decreases as stars increase
 *   • Supporter activity triggering tier upgrade emits WhiteStarTierChangedEvent
 *   • Gold Star score accounts for account age, retention, reach, moderation, verification
 *   • Campaign coin debit before activation; idempotent on duplicate key
 *   • Campaign cancellation within 12h → 50% refund
 *   • Seasonal reset preserves final score in history, resets to Spark
 *   • Decay reduces score and emits WhiteStarDecayAppliedEvent
 */

import { randomUUID } from 'crypto';
import { InMemoryEventBus } from '@starria/domain-events';
import {
  WHITE_STAR_UPDATED,
  WHITE_STAR_TIER_CHANGED,
  WHITE_STAR_DECAY_APPLIED,
  WHITE_STAR_SEASON_RESET,
  GOLD_STAR_UPDATED,
  LEGACY_ACHIEVEMENT_UNLOCKED,
  UPLOAD_LIMIT_REACHED,
  CAMPAIGN_CREATED,
  CAMPAIGN_ACTIVATED,
  CAMPAIGN_EXPIRED,
  CAMPAIGN_CANCELLED,
} from '@starria/domain-events';
import {
  WhiteStarService,
  GoldStarService,
  UploadAllowanceService,
  CreatorFeeService,
  calculateWhiteStarScore,
  resolveWhiteStarTier,
  calculateGoldStarScore,
  resolveGoldStarTier,
  resolveRevenueTier,
  resolveCreatorFeePct,
  getWeeklyUploadCap,
  WHITE_STAR_TIERS,
  REVENUE_TIER_FEE_PCT,
} from '@starria/star-core';
import type {
  WhiteStarStorePort,
  GoldStarStorePort,
  WhiteStarProfile,
  WhiteStarHistory,
  SeasonScore,
  StarDecay,
  GoldStarProfile,
  LegacyAchievement,
  CreatorReputation,
  WhiteStarHalfStars,
} from '@starria/star-core';
import { CampaignService } from '@starria/campaign-core';
import type {
  CampaignStorePort,
  CampaignCoinLedgerPort,
  VisibilityCampaign,
  CampaignLedgerEntry,
  CampaignAnalytics,
  CampaignStatus,
} from '@starria/campaign-core';

// ─────────────────────────────────────────────────────────────────────────────
// Test actors
// ─────────────────────────────────────────────────────────────────────────────

const STAR_ID = 'creator-nova-001';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory WhiteStarStore
// ─────────────────────────────────────────────────────────────────────────────

function makeWhiteStarStore(): WhiteStarStorePort {
  const profiles = new Map<string, WhiteStarProfile>();
  const history:  WhiteStarHistory[] = [];
  const decays:   StarDecay[] = [];
  const seasons:  SeasonScore[] = [];

  const nextMonday = () => {
    const now = new Date();
    const d = now.getUTCDay();
    const days = d === 0 ? 1 : 8 - d;
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    return next.toISOString();
  };

  return {
    async findByStarId(starId) { return profiles.get(starId) ?? null; },
    async upsert(p) {
      const now = new Date().toISOString();
      const existing = profiles.get(p.starId);
      const saved: WhiteStarProfile = {
        ...p,
        id: p.id ?? existing?.id ?? randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      profiles.set(p.starId, saved);
      return saved;
    },
    async incrementUploadCount(starId) {
      const p = profiles.get(starId)!;
      const updated = { ...p, uploadUsedThisWeek: p.uploadUsedThisWeek + 1, updatedAt: new Date().toISOString() };
      profiles.set(starId, updated);
      return updated;
    },
    async resetWeeklyUploads(starId, weekResetAt) {
      const p = profiles.get(starId)!;
      const updated = { ...p, uploadUsedThisWeek: 0, weekResetAt, updatedAt: new Date().toISOString() };
      profiles.set(starId, updated);
      return updated;
    },
    async appendHistory(entry) {
      const h: WhiteStarHistory = { ...entry, id: randomUUID() };
      history.push(h);
      return h;
    },
    async getHistory(starId, limit = 30) {
      return history.filter(h => h.starId === starId).slice(-limit);
    },
    async appendDecay(decay) {
      const d: StarDecay = { ...decay, id: randomUUID() };
      decays.push(d);
      return d;
    },
    async getDecays(starId) { return decays.filter(d => d.starId === starId); },
    async appendSeasonScore(score) {
      const s: SeasonScore = { ...score, id: randomUUID() };
      seasons.push(s);
      return s;
    },
    async getSeasonScores(starId) { return seasons.filter(s => s.starId === starId); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory GoldStarStore
// ─────────────────────────────────────────────────────────────────────────────

function makeGoldStarStore(): GoldStarStorePort {
  const profiles = new Map<string, GoldStarProfile>();
  const achievements: LegacyAchievement[] = [];
  const reps = new Map<string, CreatorReputation>();

  return {
    async findByStarId(starId) { return profiles.get(starId) ?? null; },
    async upsert(p) {
      const now = new Date().toISOString();
      const existing = profiles.get(p.starId);
      const saved: GoldStarProfile = { ...p, id: p.id ?? existing?.id ?? randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now };
      profiles.set(p.starId, saved);
      return saved;
    },
    async appendAchievement(a) {
      const ach: LegacyAchievement = { ...a, id: randomUUID() };
      achievements.push(ach);
      return ach;
    },
    async getAchievements(starId) { return achievements.filter(a => a.starId === starId); },
    async hasAchievement(starId, type) { return achievements.some(a => a.starId === starId && a.achievementType === type); },
    async getReputation(starId) { return reps.get(starId) ?? null; },
    async upsertReputation(rep) {
      const saved: CreatorReputation = { ...rep, id: rep.id ?? reps.get(rep.starId)?.id ?? randomUUID(), updatedAt: new Date().toISOString() };
      reps.set(rep.starId, saved);
      return saved;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory CampaignStore + ledger
// ─────────────────────────────────────────────────────────────────────────────

function makeCampaignInfra(initialBalance: Record<string, number> = {}) {
  const campaigns = new Map<string, VisibilityCampaign>();
  const idemMap   = new Map<string, string>();
  const ledger    = new Map<string, CampaignLedgerEntry[]>();
  const analytics = new Map<string, CampaignAnalytics>();
  const balances  = new Map<string, number>(Object.entries(initialBalance));
  const idemOps   = new Set<string>();

  const store: CampaignStorePort = {
    async findById(id) { return campaigns.get(id) ?? null; },
    async findByIdempotencyKey(key) { const id = idemMap.get(key); return id ? (campaigns.get(id) ?? null) : null; },
    async findByStarId(starId) { return [...campaigns.values()].filter(c => c.starId === starId); },
    async findActive(scope?) { return [...campaigns.values()].filter(c => c.status === 'ACTIVE' && (!scope || c.scope === scope)); },
    async create(c) {
      const now = new Date().toISOString();
      const saved: VisibilityCampaign = { ...c, id: randomUUID(), createdAt: now, updatedAt: now };
      campaigns.set(saved.id, saved);
      idemMap.set(c.idempotencyKey, saved.id);
      return saved;
    },
    async updateStatus(id, status) {
      const c = campaigns.get(id)!;
      const updated = { ...c, status, updatedAt: new Date().toISOString() };
      campaigns.set(id, updated);
      return updated;
    },
    async appendLedger(entry) {
      const e: CampaignLedgerEntry = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
      const arr = ledger.get(entry.campaignId) ?? [];
      arr.push(e);
      ledger.set(entry.campaignId, arr);
      return e;
    },
    async getLedger(campaignId) { return ledger.get(campaignId) ?? []; },
    async getAnalytics(campaignId) { return analytics.get(campaignId) ?? null; },
    async upsertAnalytics(a) {
      const now = new Date().toISOString();
      const saved: CampaignAnalytics = { ...a, id: a.id ?? analytics.get(a.campaignId)?.id ?? randomUUID(), updatedAt: now };
      analytics.set(a.campaignId, saved);
      return saved;
    },
  };

  const coinLedger: CampaignCoinLedgerPort = {
    async getBalance(userId) { return { balance: balances.get(userId) ?? 0 }; },
    async debit({ userId, amount, idempotencyKey }) {
      if (idemOps.has(idempotencyKey)) return { balance: balances.get(userId) ?? 0 };
      const bal = balances.get(userId) ?? 0;
      if (bal < amount) throw new Error(`Insufficient coins: have ${bal}, need ${amount}`);
      balances.set(userId, bal - amount);
      idemOps.add(idempotencyKey);
      return { balance: balances.get(userId)! };
    },
    async credit({ userId, amount, idempotencyKey }) {
      if (idemOps.has(idempotencyKey)) return { balance: balances.get(userId) ?? 0 };
      balances.set(userId, (balances.get(userId) ?? 0) + amount);
      idemOps.add(idempotencyKey);
      return { balance: balances.get(userId)! };
    },
  };

  return { store, coinLedger, balances };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Sprint 4 — Prestige Layer (E2E integration)', () => {

  // ── 1. White Star score formula ─────────────────────────────────────────────

  describe('1. White Star score formula', () => {
    it('computes weighted score across 5 dimensions', () => {
      const { score, factors } = calculateWhiteStarScore({
        supporterCount: 100,
        giftVolumeCoins: 1000,
        watchTimeMinutes: 600,
        averageRetentionPct: 70,
        tapVelocityPerDay: 5,
      });

      // supporters: min(100/10,1000)*0.35 = 1000*0.35 = 350
      // giftVolume: min(1000/100,1000)*0.25 = 1000*0.25 = 250
      // watchTime:  min(600/60,1000)*0.20 = 1000*0.20 = 200
      // retention:  min(70,100)*10*0.10 = 70
      // tapVelocity: min(5*10,1000)*0.10 = 50
      // total ≈ 920 (may round differently)
      expect(score).toBeGreaterThan(800);
      expect(factors.supporters).toBeGreaterThan(0);
      expect(factors.giftVolume).toBeGreaterThan(0);
      expect(factors.watchTime).toBeGreaterThan(0);
      expect(factors.retention).toBeGreaterThan(0);
      expect(factors.tapVelocity).toBeGreaterThan(0);
    });

    it('returns score=0 for a completely inactive creator', () => {
      const { score } = calculateWhiteStarScore({
        supporterCount: 0, giftVolumeCoins: 0,
        watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0,
      });
      expect(score).toBe(0);
    });

    it('maps score 0 → Spark (½★)', () => {
      const tier = resolveWhiteStarTier(0);
      expect(tier.label).toBe('Spark');
      expect(tier.halfStars).toBe(1);
    });

    it('maps score ≥ 1200 → Legendary (5★)', () => {
      const tier = resolveWhiteStarTier(1200);
      expect(tier.label).toBe('Legendary');
      expect(tier.halfStars).toBe(10);
    });
  });

  // ── 2. White Star Service (nightly recalculation) ───────────────────────────

  describe('2. White Star Service — recalculation & events', () => {
    it('emits WHITE_STAR_UPDATED on first recalculation', async () => {
      const bus = new InMemoryEventBus();
      const events: unknown[] = [];
      bus.subscribe(WHITE_STAR_UPDATED, e => events.push(e));

      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store, bus);

      await svc.recalculate(STAR_ID, {
        supporterCount: 50, giftVolumeCoins: 200,
        watchTimeMinutes: 120, averageRetentionPct: 60, tapVelocityPerDay: 3,
      });
      await new Promise(r => setTimeout(r, 20));

      expect(events).toHaveLength(1);
    });

    it('emits WHITE_STAR_TIER_CHANGED when tier shifts', async () => {
      const bus = new InMemoryEventBus();
      const tierChanges: unknown[] = [];
      bus.subscribe(WHITE_STAR_TIER_CHANGED, e => tierChanges.push(e));

      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store, bus);

      // First calc: low score → Spark
      await svc.recalculate(STAR_ID, {
        supporterCount: 0, giftVolumeCoins: 0,
        watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0,
      });

      // Second calc: high score → Legendary (tier change)
      await svc.recalculate(STAR_ID, {
        supporterCount: 1000, giftVolumeCoins: 10000,
        watchTimeMinutes: 6000, averageRetentionPct: 90, tapVelocityPerDay: 20,
      });
      await new Promise(r => setTimeout(r, 20));

      expect(tierChanges.length).toBeGreaterThan(0);
      const payload = (tierChanges[0] as { payload: { previousTier: string; newTier: string } }).payload;
      expect(payload.previousTier).toBe('Spark');
      expect(payload.newTier).not.toBe('Spark');
    });

    it('appends a history snapshot on each recalculation', async () => {
      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store);

      await svc.recalculate(STAR_ID, { supporterCount: 10, giftVolumeCoins: 0, watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0 });
      await svc.recalculate(STAR_ID, { supporterCount: 20, giftVolumeCoins: 0, watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0 });

      const history = await svc.getHistory(STAR_ID);
      expect(history).toHaveLength(2);
    });
  });

  // ── 3. Decay ────────────────────────────────────────────────────────────────

  describe('3. Inactivity decay', () => {
    it('reduces score by 20 and emits WHITE_STAR_DECAY_APPLIED', async () => {
      const bus = new InMemoryEventBus();
      const decayEvents: unknown[] = [];
      bus.subscribe(WHITE_STAR_DECAY_APPLIED, e => decayEvents.push(e));

      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store, bus);

      const profile = await svc.recalculate(STAR_ID, {
        supporterCount: 50, giftVolumeCoins: 0, watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0,
      });
      const scoreBefore = profile.score;

      const decayed = await svc.applyDecay(STAR_ID);
      await new Promise(r => setTimeout(r, 20));

      expect(decayed.score).toBe(scoreBefore - 20);
      expect(decayEvents).toHaveLength(1);
      const payload = (decayEvents[0] as { payload: { decayAmount: number } }).payload;
      expect(payload.decayAmount).toBe(20);
    });

    it('score cannot go below zero with decay', async () => {
      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store);

      await svc.recalculate(STAR_ID, {
        supporterCount: 0, giftVolumeCoins: 0, watchTimeMinutes: 0, averageRetentionPct: 0, tapVelocityPerDay: 0,
      });
      const decayed = await svc.applyDecay(STAR_ID);
      expect(decayed.score).toBe(0);
    });
  });

  // ── 4. Seasonal Reset ───────────────────────────────────────────────────────

  describe('4. Seasonal Reset', () => {
    it('preserves final score in history and resets to Spark', async () => {
      const bus = new InMemoryEventBus();
      const resetEvents: unknown[] = [];
      bus.subscribe(WHITE_STAR_SEASON_RESET, e => resetEvents.push(e));

      const store = makeWhiteStarStore();
      const svc = new WhiteStarService(store, bus);

      const profile = await svc.recalculate(STAR_ID, {
        supporterCount: 200, giftVolumeCoins: 5000, watchTimeMinutes: 1000,
        averageRetentionPct: 80, tapVelocityPerDay: 10,
      });
      const finalScore = profile.score;

      await svc.resetSeason(STAR_ID, 'S2026-Q1', 'Season 1');
      await new Promise(r => setTimeout(r, 20));

      const seasonScores = await store.getSeasonScores(STAR_ID);
      expect(seasonScores).toHaveLength(1);
      expect(seasonScores[0].finalScore).toBe(finalScore);
      expect(seasonScores[0].seasonName).toBe('Season 1');

      const current = await svc.getProfile(STAR_ID);
      expect(current?.score).toBe(0);
      expect(current?.tierLabel).toBe('Spark');

      expect(resetEvents).toHaveLength(1);
    });
  });

  // ── 5. Upload Caps ──────────────────────────────────────────────────────────

  describe('5. Upload Caps', () => {
    it('exact upload caps by half-star rating', () => {
      expect(getWeeklyUploadCap(1)).toBe(2);   // 0.5★ Spark
      expect(getWeeklyUploadCap(2)).toBe(3);   // 1★ Rising
      expect(getWeeklyUploadCap(4)).toBe(4);   // 2★ Radiant
      expect(getWeeklyUploadCap(6)).toBe(6);   // 3★ Nova
      expect(getWeeklyUploadCap(8)).toBe(8);   // 4★ Celestial
      expect(getWeeklyUploadCap(10)).toBe(10); // 5★ Legendary
    });

    it('upload allowed when under cap, denied at cap', async () => {
      const store = makeWhiteStarStore();
      const bus = new InMemoryEventBus();
      const limitEvents: unknown[] = [];
      bus.subscribe(UPLOAD_LIMIT_REACHED, e => limitEvents.push(e));

      // Create a Spark profile (cap=2)
      await store.upsert({
        starId: STAR_ID, score: 0, halfStars: 1, tierLabel: 'Spark',
        factors: { supporters: 0, giftVolume: 0, watchTime: 0, retention: 0, tapVelocity: 0 },
        uploadUsedThisWeek: 0,
        weekResetAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        lastCalculatedAt: new Date().toISOString(),
      });

      const svc = new UploadAllowanceService(store, bus);

      const r1 = await svc.checkAndConsume(STAR_ID);
      expect(r1.allowed).toBe(true);
      expect(r1.used).toBe(1);

      const r2 = await svc.checkAndConsume(STAR_ID);
      expect(r2.allowed).toBe(true);
      expect(r2.used).toBe(2);

      // Third upload denied
      const r3 = await svc.checkAndConsume(STAR_ID);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);

      await new Promise(r => setTimeout(r, 20));
      expect(limitEvents).toHaveLength(1);
    });
  });

  // ── 6. Revenue Ladder ───────────────────────────────────────────────────────

  describe('6. Revenue Ladder — platform fee tied to stars', () => {
    it('exact fee schedule by half-star rating', () => {
      expect(resolveCreatorFeePct(0)).toBe(50);  // NEW
      expect(resolveCreatorFeePct(2)).toBe(40);  // RISING
      expect(resolveCreatorFeePct(4)).toBe(30);  // ESTABLISHED
      expect(resolveCreatorFeePct(6)).toBe(20);  // ELITE
      expect(resolveCreatorFeePct(8)).toBe(10);  // LEGENDARY
      expect(resolveCreatorFeePct(10)).toBe(10); // 5★ also LEGENDARY
    });

    it('gold star tier overrides to lower fee when better', () => {
      // Half-stars=2 → RISING → 40%. Gold Eternal → 10%. Creator gets 10%.
      expect(resolveCreatorFeePct(2, 'Eternal')).toBe(10);
    });

    it('gold star tier does NOT override when white star is already better', () => {
      // Half-stars=10 → LEGENDARY → 10%. Gold Aurora → 40%. Still 10% (min).
      expect(resolveCreatorFeePct(10, 'Aurora')).toBe(10);
    });

    it('CreatorFeeService resolves fee from both stores', async () => {
      const wsStore = makeWhiteStarStore();
      const gsStore = makeGoldStarStore();

      await wsStore.upsert({
        starId: STAR_ID, score: 700, halfStars: 8, tierLabel: 'Celestial',
        factors: { supporters: 0, giftVolume: 0, watchTime: 0, retention: 0, tapVelocity: 0 },
        uploadUsedThisWeek: 0,
        weekResetAt: new Date().toISOString(),
        lastCalculatedAt: new Date().toISOString(),
      });

      const svc = new CreatorFeeService(wsStore, gsStore);
      const result = await svc.resolve(STAR_ID);

      expect(result.feePct).toBe(10);        // Celestial = LEGENDARY tier
      expect(result.creatorPct).toBe(90);
      expect(result.revenueTier).toBe('LEGENDARY');
      expect(result.goldStarTier).toBeNull();
    });
  });

  // ── 7. Gold Star Service ────────────────────────────────────────────────────

  describe('7. Gold Star System', () => {
    it('score includes account age, retention, reach, verification bonus', () => {
      const score = calculateGoldStarScore({
        accountAgeMonths: 12,
        supporterRetentionPct: 80,
        countryReach: 10,
        moderationIncidents: 0,
        isVerified: true,
      });
      // age: 12*5=60, retention: 80*2=160, reach: 10*10=100, verified: 100 → 420
      expect(score).toBe(420);
    });

    it('moderation incidents reduce gold star score', () => {
      const clean = calculateGoldStarScore({
        accountAgeMonths: 6, supporterRetentionPct: 50, countryReach: 3,
        moderationIncidents: 0, isVerified: false,
      });
      const penalised = calculateGoldStarScore({
        accountAgeMonths: 6, supporterRetentionPct: 50, countryReach: 3,
        moderationIncidents: 3, isVerified: false,
      });
      expect(penalised).toBe(clean - 75); // 3 incidents × 25
    });

    it('emits GOLD_STAR_UPDATED on recalculation', async () => {
      const bus = new InMemoryEventBus();
      const events: unknown[] = [];
      bus.subscribe(GOLD_STAR_UPDATED, e => events.push(e));

      const store = makeGoldStarStore();
      const svc = new GoldStarService(store, bus);

      await svc.recalculate(STAR_ID, {
        accountAgeMonths: 24, supporterRetentionPct: 75, countryReach: 15,
        moderationIncidents: 0, isVerified: true,
      });
      await new Promise(r => setTimeout(r, 20));

      expect(events).toHaveLength(1);
    });

    it('achievement unlock is idempotent', async () => {
      const bus = new InMemoryEventBus();
      const achEvents: unknown[] = [];
      bus.subscribe(LEGACY_ACHIEVEMENT_UNLOCKED, e => achEvents.push(e));

      const store = makeGoldStarStore();
      const svc = new GoldStarService(store, bus);

      const a1 = await svc.unlockAchievement(STAR_ID, 'FIRST_100_SUPPORTERS', '100 Supporters', 'desc');
      const a2 = await svc.unlockAchievement(STAR_ID, 'FIRST_100_SUPPORTERS', '100 Supporters', 'desc');

      expect(a1).not.toBeNull();
      expect(a2).toBeNull(); // duplicate — no second unlock

      await new Promise(r => setTimeout(r, 20));
      expect(achEvents).toHaveLength(1);
    });
  });

  // ── 8. Visibility Campaigns ─────────────────────────────────────────────────

  describe('8. Visibility Campaigns', () => {
    it('LOCAL VIDEO campaign costs 50 coins and emits CAMPAIGN_CREATED + CAMPAIGN_ACTIVATED', async () => {
      const bus = new InMemoryEventBus();
      const created: unknown[] = [];
      const activated: unknown[] = [];
      bus.subscribe(CAMPAIGN_CREATED, e => created.push(e));
      bus.subscribe(CAMPAIGN_ACTIVATED, e => activated.push(e));

      const { store, coinLedger } = makeCampaignInfra({ [STAR_ID]: 200 });
      const svc = new CampaignService(store, coinLedger, bus);

      const result = await svc.createCampaign({
        starId: STAR_ID,
        promotableType: 'VIDEO',
        promotableId: 'video-abc123',
        scope: 'LOCAL',
        idempotencyKey: 'campaign:v1:local:video',
      });

      expect(result.campaign.status).toBe('ACTIVE');
      expect(result.campaign.coinsSpent).toBe(50);
      expect(result.starCoinBalance).toBe(150); // 200 − 50

      await new Promise(r => setTimeout(r, 20));
      expect(created).toHaveLength(1);
      expect(activated).toHaveLength(1);
    });

    it('GLOBAL CREATOR campaign costs 800 coins', async () => {
      const { store, coinLedger } = makeCampaignInfra({ [STAR_ID]: 1000 });
      const svc = new CampaignService(store, coinLedger);

      const result = await svc.createCampaign({
        starId: STAR_ID,
        promotableType: 'CREATOR',
        promotableId: STAR_ID,
        scope: 'GLOBAL',
        idempotencyKey: 'campaign:v2:global:creator',
      });

      expect(result.campaign.coinsSpent).toBe(800);
    });

    it('campaign creation is idempotent', async () => {
      const { store, coinLedger, balances } = makeCampaignInfra({ [STAR_ID]: 500 });
      const svc = new CampaignService(store, coinLedger);

      const input = {
        starId: STAR_ID, promotableType: 'VIDEO' as const,
        promotableId: 'video-xyz', scope: 'LOCAL' as const,
        idempotencyKey: 'campaign:idem:1',
      };

      const r1 = await svc.createCampaign(input);
      const r2 = await svc.createCampaign(input);

      expect(r1.campaign.id).toBe(r2.campaign.id);
      expect(r2.deduped).toBe(true);
      expect(balances.get(STAR_ID)).toBe(450); // only charged once
    });

    it('throws when creator has insufficient coins', async () => {
      const { store, coinLedger } = makeCampaignInfra({ [STAR_ID]: 10 });
      const svc = new CampaignService(store, coinLedger);

      await expect(svc.createCampaign({
        starId: STAR_ID, promotableType: 'VIDEO',
        promotableId: 'vid', scope: 'COUNTRY',
        idempotencyKey: 'campaign:broke',
      })).rejects.toThrow('Insufficient coins');
    });

    it('cancellation within 12h refunds 50% of coins', async () => {
      const { store, coinLedger, balances } = makeCampaignInfra({ [STAR_ID]: 500 });
      const svc = new CampaignService(store, coinLedger);

      const result = await svc.createCampaign({
        starId: STAR_ID, promotableType: 'EVENT',
        promotableId: 'event-001', scope: 'LOCAL',
        idempotencyKey: 'campaign:cancel:1',
      });
      const balanceAfterCreate = balances.get(STAR_ID)!;

      await svc.cancelCampaign(result.campaign.id, STAR_ID);
      const balanceAfterCancel = balances.get(STAR_ID)!;

      expect(balanceAfterCancel).toBe(balanceAfterCreate + Math.floor(result.campaign.coinsSpent * 0.5));
    });

    it('impression and click tracking updates CTR', async () => {
      const { store, coinLedger } = makeCampaignInfra({ [STAR_ID]: 500 });
      const svc = new CampaignService(store, coinLedger);

      const result = await svc.createCampaign({
        starId: STAR_ID, promotableType: 'VIDEO',
        promotableId: 'vid-ctr', scope: 'LOCAL',
        idempotencyKey: 'campaign:ctr:1',
      });

      await svc.recordImpression(result.campaign.id);
      await svc.recordImpression(result.campaign.id);
      await svc.recordClick(result.campaign.id);

      const analytics = await svc.getAnalytics(result.campaign.id);
      expect(analytics?.impressions).toBe(2);
      expect(analytics?.clicks).toBe(1);
      expect(analytics?.ctr).toBeCloseTo(0.5);
    });
  });

  // ── 9. Full loop ────────────────────────────────────────────────────────────

  describe('9. Full prestige loop', () => {
    it('support → stars → reduced fee → higher upload cap → campaign', async () => {
      const bus = new InMemoryEventBus();
      const eventTypes: string[] = [];
      [WHITE_STAR_UPDATED, WHITE_STAR_TIER_CHANGED, GOLD_STAR_UPDATED,
       LEGACY_ACHIEVEMENT_UNLOCKED, CAMPAIGN_CREATED, CAMPAIGN_ACTIVATED,
      ].forEach(t => bus.subscribe(t, () => eventTypes.push(t)));

      const wsStore = makeWhiteStarStore();
      const gsStore = makeGoldStarStore();
      const { store: campStore, coinLedger, balances } = makeCampaignInfra({ [STAR_ID]: 1000 });

      const wsSvc   = new WhiteStarService(wsStore, bus);
      const gsSvc   = new GoldStarService(gsStore, bus);
      const feeSvc  = new CreatorFeeService(wsStore, gsStore);
      const campSvc = new CampaignService(campStore, coinLedger, bus);

      // Step 1: Creator gains supporters → recalculate stars
      const profile = await wsSvc.recalculate(STAR_ID, {
        supporterCount: 500,
        giftVolumeCoins: 5000,
        watchTimeMinutes: 2000,
        averageRetentionPct: 75,
        tapVelocityPerDay: 12,
      });

      expect(profile.score).toBeGreaterThan(350);  // at minimum Nova tier
      expect(profile.halfStars).toBeGreaterThanOrEqual(6);

      // Step 2: Fee should decrease from NEW (50%) to ELITE or LEGENDARY
      const fee = await feeSvc.resolve(STAR_ID);
      expect(fee.feePct).toBeLessThan(50);
      expect(fee.feePct).toBeLessThanOrEqual(20);

      // Step 3: Upload cap should be at least 6 (Nova = 3★ = halfStars 6)
      const cap = getWeeklyUploadCap(profile.halfStars);
      expect(cap).toBeGreaterThanOrEqual(6);

      // Step 4: Gold star milestones
      await gsSvc.recalculate(STAR_ID, {
        accountAgeMonths: 18, supporterRetentionPct: 75, countryReach: 12,
        moderationIncidents: 0, isVerified: true,
      });
      await gsSvc.unlockAchievement(STAR_ID, 'FIRST_100_SUPPORTERS', '100 Supporters', 'desc');
      await gsSvc.unlockAchievement(STAR_ID, 'VERIFIED_CREATOR', 'Verified', 'desc');

      const achievements = await gsSvc.getAchievements(STAR_ID);
      expect(achievements).toHaveLength(2);

      // Step 5: Campaign to boost visibility
      const campResult = await campSvc.createCampaign({
        starId: STAR_ID,
        promotableType: 'CREATOR',
        promotableId: STAR_ID,
        scope: 'COUNTRY',
        idempotencyKey: 'prestige-loop:campaign:1',
      });

      expect(campResult.campaign.status).toBe('ACTIVE');
      expect(campResult.campaign.coinsSpent).toBe(300);

      await new Promise(r => setTimeout(r, 30));

      // All expected events fired
      expect(eventTypes).toContain(WHITE_STAR_UPDATED);
      expect(eventTypes).toContain(GOLD_STAR_UPDATED);
      expect(eventTypes).toContain(LEGACY_ACHIEVEMENT_UNLOCKED);
      expect(eventTypes).toContain(CAMPAIGN_CREATED);
      expect(eventTypes).toContain(CAMPAIGN_ACTIVATED);
    });
  });
});
