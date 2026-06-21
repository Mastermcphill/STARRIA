/**
 * Sprint 7 — LiveKit Stabilization, Creator OS & Session Engine E2E Tests
 *
 * Self-contained: every store is an in-memory implementation of the core Port
 * interfaces. No database, no LiveKit server, no external services. Stub
 * adapters stand in for LiveKit egress / media processing / image generation.
 */

import { randomUUID } from 'crypto';
import {
  SessionEngineService,
  SessionEngineStorePort,
  SessionBillingPort,
  LiveKitProviderPort,
  SessionRoom,
  SessionParticipant,
  SessionRecording,
  SessionModeration,
} from '@starria/session-engine-core';
import {
  ReplayService,
  ReplayStorePort,
  MediaProcessorPort,
  DiscoveryPublisherPort,
  ReplayAccessPort,
  Replay,
} from '@starria/replay-core';
import {
  ShowPlannerService,
  PosterStudioService,
  LiveCommerceService,
  ClipService,
  PosterGeneratorPort,
  CreatorCoinLedgerPort,
  CommerceStorePort,
  ClipStorePort,
  ClipGeneratorPort,
  CommerceItem,
  Clip,
} from '@starria/creator-os-core';

// ── Session-engine in-memory adapters ────────────────────────────────────────

function makeEngineStore(): SessionEngineStorePort {
  const rooms = new Map<string, SessionRoom>();
  const keys = new Map<string, string>();
  const participants = new Map<string, SessionParticipant[]>();
  const recordings = new Map<string, SessionRecording>();
  const moderations = new Map<string, SessionModeration[]>();

  return {
    createRoom: async (r) => { rooms.set(r.id, r); participants.set(r.id, []); return r; },
    getRoom: async (id) => rooms.get(id) ?? null,
    updateRoom: async (id, patch) => { const n = { ...rooms.get(id)!, ...patch }; rooms.set(id, n); return n; },
    listRooms: async (f) => {
      let rs = [...rooms.values()];
      if (f?.status) rs = rs.filter((r) => r.status === f.status);
      if (f?.roomType) rs = rs.filter((r) => r.roomType === f.roomType);
      return rs;
    },
    findRoomByKey: async (k) => keys.has(k) ? (rooms.get(keys.get(k)!) ?? null) : null,
    setRoomKey: async (k, id) => { keys.set(k, id); },
    addParticipant: async (p) => { const a = participants.get(p.roomId) ?? []; a.push(p); participants.set(p.roomId, a); return p; },
    getParticipant: async (roomId, userId) => (participants.get(roomId) ?? []).find((p) => p.userId === userId) ?? null,
    updateParticipant: async (roomId, userId, patch) => {
      participants.set(roomId, (participants.get(roomId) ?? []).map((p) => p.userId === userId ? { ...p, ...patch } : p));
    },
    listParticipants: async (roomId) => participants.get(roomId) ?? [],
    countActiveParticipants: async (roomId) => (participants.get(roomId) ?? []).filter((p) => p.status === 'JOINED').length,
    createRecording: async (rec) => { recordings.set(rec.id, rec); return rec; },
    getRecording: async (id) => recordings.get(id) ?? null,
    getRecordingByRoom: async (roomId) => [...recordings.values()].filter((r) => r.roomId === roomId).slice(-1)[0] ?? null,
    updateRecording: async (id, patch) => { const n = { ...recordings.get(id)!, ...patch }; recordings.set(id, n); return n; },
    addModeration: async (m) => { const a = moderations.get(m.roomId) ?? []; a.push(m); moderations.set(m.roomId, a); return m; },
    listModeration: async (roomId) => moderations.get(roomId) ?? [],
  };
}

function makeBilling(): SessionBillingPort & { balances: Map<string, number>; seed: (u: string, c: number) => void } {
  const balances = new Map<string, number>();
  return {
    balances,
    seed: (u, c) => balances.set(u, c),
    charge: async (userId, coins) => {
      const cur = balances.get(userId) ?? 0;
      if (cur < coins) throw new Error('Insufficient coins');
      balances.set(userId, cur - coins);
    },
    settle: async (_roomId, creatorId, gross, feePct) => {
      const platformCoins = Math.floor((gross * feePct) / 100);
      const creatorCoins = gross - platformCoins;
      balances.set(creatorId, (balances.get(creatorId) ?? 0) + creatorCoins);
      return { creatorCoins, platformCoins };
    },
  };
}

function makeLiveKit(): LiveKitProviderPort & { egressStops: number } {
  const provider = {
    egressStops: 0,
    createRoom: async () => {},
    issueToken: async (room: string, id: string, pub: boolean) => `tok:${room}:${id}:${pub}`,
    startEgress: async (room: string) => ({ egressId: `eg_${room}` }),
    stopEgress: async (egressId: string) => { provider.egressStops++; return { assetUrl: `https://cdn/${egressId}.mp4`, durationSeconds: 1800 }; },
    deleteRoom: async () => {},
  };
  return provider;
}

function buildEngine() {
  const store = makeEngineStore();
  const billing = makeBilling();
  const livekit = makeLiveKit();
  const events: any[] = [];
  const eventBus = { publish: (e: any) => { events.push(e); }, subscribe: () => () => {}, subscribeMany: () => () => {} } as any;
  const engine = new SessionEngineService({ store, billing, livekit, eventBus });
  return { engine, store, billing, livekit, events };
}

// ── Replay in-memory adapters ────────────────────────────────────────────────

function makeReplayStore(): ReplayStorePort {
  const replays = new Map<string, Replay>();
  return {
    create: async (r) => { replays.set(r.id, r); return r; },
    get: async (id) => replays.get(id) ?? null,
    getByRecording: async (recId) => [...replays.values()].find((r) => r.recordingId === recId) ?? null,
    update: async (id, patch) => { const n = { ...replays.get(id)!, ...patch }; replays.set(id, n); return n; },
    listByCreator: async (cid) => [...replays.values()].filter((r) => r.creatorId === cid),
    listDiscoverable: async (vis) => [...replays.values()].filter((r) => r.pushedToDiscovery && (!vis || r.visibility === vis)),
    incrementViews: async (id) => { const r = replays.get(id); if (r) replays.set(id, { ...r, viewCount: r.viewCount + 1 }); },
  };
}

const stubProcessor: MediaProcessorPort = {
  process: async (raw) => ({ playbackUrl: raw.replace('.mp4', '') + '/play.m3u8', durationSeconds: 1800 }),
  generateThumbnails: async (url, n) => ({
    thumbnailUrls: Array.from({ length: n }, (_, i) => `${url}#t${i}`),
    posterUrl: `${url}#poster`,
  }),
};

function makeDiscovery(): DiscoveryPublisherPort & { pushed: string[] } {
  const pushed: string[] = [];
  return { pushed, pushReplay: async (r) => { pushed.push(r.id); } };
}

function makeAccess(): ReplayAccessPort & { grant: (u: string, r: string) => void } {
  const entitlements = new Map<string, Set<string>>();
  return {
    grant: (u, r) => { if (!entitlements.has(u)) entitlements.set(u, new Set()); entitlements.get(u)!.add(r); },
    checkAccess: async (replay, userId) => {
      if (replay.visibility === 'PUBLIC') return null;
      if (entitlements.get(userId)?.has(replay.id)) return null;
      return replay.visibility === 'PREMIUM' ? 'Purchase required.' : 'Subscribers only.';
    },
  };
}

function buildReplay() {
  const store = makeReplayStore();
  const discovery = makeDiscovery();
  const access = makeAccess();
  const events: any[] = [];
  const eventBus = { publish: (e: any) => { events.push(e); }, subscribe: () => () => {}, subscribeMany: () => () => {} } as any;
  const replays = new ReplayService({ store, processor: stubProcessor, discovery, access, eventBus });
  return { replays, store, discovery, access, events };
}

// ── Creator-OS in-memory adapters ────────────────────────────────────────────

function makeLedger(): CreatorCoinLedgerPort & { balances: Map<string, number> } {
  const balances = new Map<string, number>();
  return {
    balances,
    charge: async (u, c) => { const cur = balances.get(u) ?? 0; if (cur < c) throw new Error('Insufficient coins'); balances.set(u, cur - c); },
    credit: async (u, c) => { balances.set(u, (balances.get(u) ?? 0) + c); },
  };
}

function makeCommerceStore(): CommerceStorePort {
  const items = new Map<string, CommerceItem>();
  const purchases = new Map<string, { itemId: string; buyerId: string }>();
  return {
    create: async (i) => { items.set(i.id, i); return i; },
    get: async (id) => items.get(id) ?? null,
    update: async (id, patch) => { const n = { ...items.get(id)!, ...patch }; items.set(id, n); return n; },
    listByRoom: async (roomId) => [...items.values()].filter((i) => i.roomId === roomId),
    findPurchaseByKey: async (k) => purchases.get(k) ?? null,
    recordPurchase: async (k, itemId, buyerId) => { purchases.set(k, { itemId, buyerId }); },
  };
}

function makeClipStore(): ClipStorePort {
  const clips = new Map<string, Clip>();
  return {
    create: async (c) => { clips.set(c.id, c); return c; },
    listByReplay: async (rid) => [...clips.values()].filter((c) => c.sourceReplayId === rid),
  };
}

const stubClipGen: ClipGeneratorPort = {
  cut: async (rid, start, len) => ({ clipUrl: `https://cdn/clips/${rid}/${start}-${len}.mp4` }),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Sprint 7 — Session Engine', () => {
  it('creates a room with defaults and auto-adds the host as a participant', async () => {
    const { engine } = buildEngine();
    const room = await engine.createRoom({ roomType: 'LIVE_EVENT', hostId: 'host1', title: 'My Show' });
    expect(room.status).toBe('CREATED');
    expect(room.maxParticipants).toBe(5000);
    const participants = await engine.listParticipants(room.id);
    expect(participants.find((p) => p.userId === 'host1' && p.role === 'HOST')).toBeTruthy();
  });

  it('is idempotent on createRoom with an idempotencyKey', async () => {
    const { engine } = buildEngine();
    const key = randomUUID();
    const a = await engine.createRoom({ roomType: 'CREATOR_QA', hostId: 'h', title: 'QA', idempotencyKey: key });
    const b = await engine.createRoom({ roomType: 'CREATOR_QA', hostId: 'h', title: 'QA', idempotencyKey: key });
    expect(a.id).toBe(b.id);
  });

  it('enforces the participant cap', async () => {
    const { engine } = buildEngine();
    const room = await engine.createRoom({ roomType: 'COMPANION_VIDEO', hostId: 'host', title: '1:1', maxParticipants: 2 });
    await engine.joinRoom({ roomId: room.id, userId: 'guest1', role: 'GUEST' });
    // host(1) + guest1(1) = 2 => full
    await expect(engine.joinRoom({ roomId: room.id, userId: 'guest2', role: 'GUEST' })).rejects.toThrow(/full/i);
  });

  it('charges coin entry on join for COIN_ENTRY rooms and returns a token', async () => {
    const { engine, billing } = buildEngine();
    billing.seed('viewer', 1000);
    const room = await engine.createRoom({
      roomType: 'SUPPORTER_ROOM', hostId: 'host', title: 'Paid Room',
      billing: { mode: 'COIN_ENTRY', entryCoins: 200 },
    });
    const { token } = await engine.joinRoom({ roomId: room.id, userId: 'viewer', role: 'VIEWER' });
    expect(token).toContain('tok:');
    expect(billing.balances.get('viewer')).toBe(800);
  });

  it('starts → records → ends and settles accrued revenue', async () => {
    const { engine, billing, livekit } = buildEngine();
    billing.seed('viewer', 1000);
    const room = await engine.createRoom({
      roomType: 'LIVE_EVENT', hostId: 'host', title: 'Concert',
      billing: { mode: 'COIN_ENTRY', entryCoins: 300, platformFeePct: 20 },
      recordingEnabled: true,
    });
    await engine.joinRoom({ roomId: room.id, userId: 'viewer', role: 'VIEWER' }); // accrues 300 gross
    await engine.startRoom(room.id); // auto-records
    const rec = await engine.getRecordingByRoom(room.id);
    expect(rec?.status).toBe('RECORDING');

    const { settlement } = await engine.endRoom(room.id);
    expect(livekit.egressStops).toBe(1);
    // 80% of 300 = 240 to host
    expect(settlement?.creatorCoins).toBe(240);
    expect(billing.balances.get('host')).toBe(240);
    const stopped = await engine.getRecordingByRoom(room.id);
    expect(stopped?.status).toBe('STOPPED');
  });

  it('moderation KICK removes a participant', async () => {
    const { engine } = buildEngine();
    const room = await engine.createRoom({ roomType: 'CREATOR_QA', hostId: 'host', title: 'QA' });
    await engine.joinRoom({ roomId: room.id, userId: 'troll', role: 'GUEST' });
    await engine.moderate({ roomId: room.id, actorId: 'host', targetUserId: 'troll', action: 'KICK' });
    const p = (await engine.listParticipants(room.id)).find((x) => x.userId === 'troll');
    expect(p?.status).toBe('REMOVED');
  });

  it('start/stop recording explicitly', async () => {
    const { engine } = buildEngine();
    const room = await engine.createRoom({ roomType: 'RAP_BATTLE', hostId: 'host', title: 'Battle' });
    const rec = await engine.startRecording(room.id);
    expect(rec.status).toBe('RECORDING');
    const stopped = await engine.stopRecording(room.id);
    expect(stopped.status).toBe('STOPPED');
    expect(stopped.rawAssetUrl).toContain('.mp4');
  });
});

describe('Sprint 7 — Replay Pipeline', () => {
  async function captured() {
    const ctx = buildReplay();
    const replay = await ctx.replays.captureAndProcess({
      roomId: 'room1', recordingId: randomUUID(), creatorId: 'creator1',
      sourceRoomType: 'LIVE_EVENT', rawAssetUrl: 'https://cdn/raw.mp4',
      durationSeconds: 1800, title: 'Big Show',
    });
    return { ...ctx, replay };
  }

  it('captures and processes a recording into a READY replay with thumbnails', async () => {
    const { replay } = await captured();
    expect(replay.status).toBe('READY');
    expect(replay.playbackUrl).toContain('.m3u8');
    expect(replay.thumbnailUrls.length).toBe(4);
    expect(replay.posterUrl).toBeTruthy();
  });

  it('is idempotent on recordingId', async () => {
    const ctx = buildReplay();
    const recordingId = randomUUID();
    const input = { roomId: 'r', recordingId, creatorId: 'c', sourceRoomType: 'LIVE_EVENT', rawAssetUrl: 'https://cdn/x.mp4', durationSeconds: 100, title: 'T' };
    const a = await ctx.replays.captureAndProcess(input);
    const b = await ctx.replays.captureAndProcess(input);
    expect(a.id).toBe(b.id);
  });

  it('publishes a replay and pushes it to discovery', async () => {
    const { replays, discovery, replay } = await captured();
    const published = await replays.publish({ replayId: replay.id, visibility: 'PUBLIC' });
    expect(published.status).toBe('PUBLISHED');
    expect(published.pushedToDiscovery).toBe(true);
    expect(discovery.pushed).toContain(replay.id);
  });

  it('rejects PREMIUM publish without a price', async () => {
    const { replays, replay } = await captured();
    await expect(replays.publish({ replayId: replay.id, visibility: 'PREMIUM' })).rejects.toThrow(/priceCoins/);
  });

  it('gates premium playback until access is granted', async () => {
    const { replays, access, replay } = await captured();
    await replays.publish({ replayId: replay.id, visibility: 'PREMIUM', priceCoins: 500 });
    await expect(replays.getForPlayback(replay.id, 'viewer')).rejects.toThrow(/Purchase/);
    access.grant('viewer', replay.id);
    const ok = await replays.getForPlayback(replay.id, 'viewer');
    expect(ok.viewCount).toBe(1);
  });
});

describe('Sprint 7 — AI Show Planner', () => {
  const planner = new ShowPlannerService();

  it('segments sum exactly to the requested duration', () => {
    const plan = planner.generate({ creatorId: 'c', showType: 'STANDUP', durationMinutes: 60, audienceSize: 100 });
    const total = plan.segments.reduce((s, seg) => s + seg.minutes, 0);
    expect(total).toBe(60);
    expect(plan.segments.length).toBeGreaterThan(0);
  });

  it('drops audience-gated segments for tiny audiences', () => {
    const small = planner.generate({ creatorId: 'c', showType: 'STANDUP', durationMinutes: 30, audienceSize: 5 });
    // Roast battle needs >=50, interaction needs >=25 — both excluded.
    expect(small.segments.find((s) => s.title === 'Roast Battle')).toBeUndefined();
    expect(small.segments.find((s) => s.title === 'Audience Interaction')).toBeUndefined();
  });

  it('supports every show type', () => {
    for (const showType of ['STANDUP', 'RAP_BATTLE', 'SING_OFF', 'QA', 'AI_PREMIERE'] as const) {
      const plan = planner.generate({ creatorId: 'c', showType, durationMinutes: 45, audienceSize: 200 });
      expect(plan.segments.reduce((s, seg) => s + seg.minutes, 0)).toBe(45);
    }
  });
});

describe('Sprint 7 — Poster Studio', () => {
  const generator: PosterGeneratorPort = {
    generate: async (req) => ({ imageUrl: `https://cdn/${req.posterType}.png`, thumbnailUrl: `https://cdn/${req.posterType}_t.png` }),
  };

  it('charges coins and returns a poster', async () => {
    const ledger = makeLedger();
    ledger.balances.set('creator', 1000);
    const studio = new PosterStudioService({ generator, ledger });
    const result = await studio.generate({ creatorId: 'creator', posterType: 'AI_MOVIE', title: 'Epic', prompt: 'cinematic' });
    expect(result.coinsCharged).toBe(120);
    expect(ledger.balances.get('creator')).toBe(880);
    expect(result.resultImageUrl).toContain('.png');
  });

  it('refunds coins if generation fails', async () => {
    const ledger = makeLedger();
    ledger.balances.set('creator', 1000);
    const failing: PosterGeneratorPort = { generate: async () => { throw new Error('gen down'); } };
    const studio = new PosterStudioService({ generator: failing, ledger });
    await expect(studio.generate({ creatorId: 'creator', posterType: 'COMEDY', title: 'X', prompt: 'p' })).rejects.toThrow();
    expect(ledger.balances.get('creator')).toBe(1000); // refunded
  });
});

describe('Sprint 7 — Live Commerce', () => {
  it('lists and sells an item with an 80/20 split', async () => {
    const store = makeCommerceStore();
    const ledger = makeLedger();
    ledger.balances.set('buyer', 1000);
    const commerce = new LiveCommerceService({ store, ledger, platformFeePct: 20 });

    const item = await commerce.list({ creatorId: 'creator', itemType: 'DIGITAL_ITEM', title: 'Sticker Pack', priceCoins: 500 });
    const { creatorCoins, platformCoins } = await commerce.purchase({ itemId: item.id, buyerId: 'buyer', idempotencyKey: randomUUID() });

    expect(creatorCoins).toBe(400);
    expect(platformCoins).toBe(100);
    expect(ledger.balances.get('buyer')).toBe(500);
    expect(ledger.balances.get('creator')).toBe(400);
  });

  it('is idempotent on purchase key', async () => {
    const store = makeCommerceStore();
    const ledger = makeLedger();
    ledger.balances.set('buyer', 1000);
    const commerce = new LiveCommerceService({ store, ledger });
    const item = await commerce.list({ creatorId: 'creator', itemType: 'TICKET', title: 'Ticket', priceCoins: 300 });
    const key = randomUUID();
    await commerce.purchase({ itemId: item.id, buyerId: 'buyer', idempotencyKey: key });
    await commerce.purchase({ itemId: item.id, buyerId: 'buyer', idempotencyKey: key });
    expect(ledger.balances.get('buyer')).toBe(700); // charged once
  });

  it('enforces sold-out inventory', async () => {
    const store = makeCommerceStore();
    const ledger = makeLedger();
    ledger.balances.set('b1', 1000); ledger.balances.set('b2', 1000);
    const commerce = new LiveCommerceService({ store, ledger });
    const item = await commerce.list({ creatorId: 'c', itemType: 'MERCHANDISE', title: 'Tee', priceCoins: 100, inventory: 1 });
    await commerce.purchase({ itemId: item.id, buyerId: 'b1', idempotencyKey: randomUUID() });
    await expect(commerce.purchase({ itemId: item.id, buyerId: 'b2', idempotencyKey: randomUUID() })).rejects.toThrow(/sold out/i);
  });
});

describe('Sprint 7 — Discovery Flywheel (Clips)', () => {
  it('generates 15/30/60s clips within the source bounds', async () => {
    const store = makeClipStore();
    const clips = new ClipService({ store, generator: stubClipGen });
    const out = await clips.generateClips({ sourceReplayId: 'replay1', creatorId: 'c', durationSeconds: 1800 });
    expect(out.map((c) => c.lengthSeconds).sort((a, b) => a - b)).toEqual([15, 30, 60]);
    for (const clip of out) {
      expect(clip.startOffsetSeconds).toBeGreaterThanOrEqual(0);
      expect(clip.startOffsetSeconds + clip.lengthSeconds).toBeLessThanOrEqual(1800);
      expect(clip.clipUrl).toContain('.mp4');
    }
  });

  it('clamps offsets for very short replays', async () => {
    const store = makeClipStore();
    const clips = new ClipService({ store, generator: stubClipGen });
    const out = await clips.generateClips({ sourceReplayId: 'r', creatorId: 'c', durationSeconds: 20 });
    for (const clip of out) {
      expect(clip.startOffsetSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('generates a teaser', async () => {
    const store = makeClipStore();
    const clips = new ClipService({ store, generator: stubClipGen });
    const { teaserUrl } = await clips.generateTeaser({ sourceReplayId: 'r', creatorId: 'c', durationSeconds: 600 });
    expect(teaserUrl).toContain('.mp4');
  });
});
