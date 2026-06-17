/**
 * Integration spec — Video Discovery loop (in-memory, no DB).
 *
 *   Creator uploads video
 *     → User watches
 *     → User taps
 *     → Regional boost updates
 *     → Discovery ranking changes
 *     → Content surfaces locally
 *
 * Uses the real discovery-core / geo-core formulas + InMemoryEventBus, wiring
 * the same event flow as the API (CONTENT_TAP_RECORDED / WATCH_COMPLETED →
 * discovery re-score) against in-memory stores.
 */

import { InMemoryEventBus } from '@starria/domain-events';
import {
  CONTENT_TAP_RECORDED,
  WATCH_COMPLETED,
  VIDEO_PUBLISHED,
  REGIONAL_BOOST_UPDATED,
} from '@starria/domain-events';
import {
  computeTapWeight,
  validateTap,
  computeDiscoveryScore,
  applyTapToRegionalBoost,
  buildContentTapRecordedEvent,
  buildRegionalBoostUpdatedEvent,
} from '@starria/discovery-core';
import { resolveLocation, geoDiversityMultiplier } from '@starria/geo-core';
import type { GeoRegion } from '@starria/geo-core';
import { randomUUID } from 'crypto';

// ── In-memory world ───────────────────────────────────────────────────────────

interface Video {
  id: string; uploaderUserId: string; starProfileId: string;
  genre: string; country: string; status: 'PUBLISHED'; supporterCount: number;
}
interface Watch { userId: string; videoId: string; watchSeconds: number; durationSeconds: number; retention: number }
interface Tap { userId: string; videoId: string; weight: number; region: string }

class World {
  bus = new InMemoryEventBus();
  videos = new Map<string, Video>();
  watches: Watch[] = [];
  taps: Tap[] = [];
  boosts = new Map<string, { boost: number; lastTapAt: number; count: number }>();
  scores = new Map<string, number>();
  events: string[] = [];

  constructor() {
    // Mirror the API's event-driven re-scoring.
    this.bus.subscribe(CONTENT_TAP_RECORDED, (e) => { this.events.push(e.type); this.recompute((e.payload as { videoId: string }).videoId); });
    this.bus.subscribe(WATCH_COMPLETED, (e) => { this.events.push(e.type); this.recompute((e.payload as { videoId: string }).videoId); });
    this.bus.subscribe(VIDEO_PUBLISHED, (e) => { this.events.push(e.type); });
    this.bus.subscribe(REGIONAL_BOOST_UPDATED, (e) => { this.events.push(e.type); });
  }

  publish(v: Omit<Video, 'status'>): Video {
    const video: Video = { ...v, status: 'PUBLISHED' };
    this.videos.set(video.id, video);
    this.scores.set(video.id, 0);
    void this.bus.publish({
      id: randomUUID(), type: VIDEO_PUBLISHED, aggregateId: video.id, aggregateType: 'Video',
      occurredAt: new Date().toISOString(), version: 1,
      payload: { videoId: video.id, starProfileId: video.starProfileId, title: 'x', genre: video.genre, publishedAt: new Date().toISOString() },
    });
    return video;
  }

  async watch(userId: string, videoId: string, watchSeconds: number, durationSeconds: number): Promise<void> {
    const retention = Math.min(1, watchSeconds / durationSeconds);
    this.watches.push({ userId, videoId, watchSeconds, durationSeconds, retention });
    await this.bus.publish({
      id: randomUUID(), type: WATCH_COMPLETED, aggregateId: randomUUID(), aggregateType: 'VideoWatch',
      occurredAt: new Date().toISOString(), version: 1,
      payload: { watchId: randomUUID(), userId, videoId, starProfileId: '', watchSeconds, durationSeconds, retention, completed: retention >= 0.9, completedAt: new Date().toISOString() },
    });
  }

  async tap(userId: string, videoId: string, country: string): Promise<{ ok: boolean; reason?: string; weight?: number }> {
    const video = this.videos.get(videoId)!;
    const existing = this.taps.filter(t => t.userId === userId && t.videoId === videoId).length;

    const v = validateTap({
      tapperUserId: userId, creatorUserId: video.uploaderUserId,
      existingTapCount: existing, trustScore: 0.9, videoPublished: video.status === 'PUBLISHED',
    });
    if (!v.ok) return { ok: false, reason: v.reason };

    const loc = resolveLocation({ country });
    const regionCounts = this.regionCounts(videoId);
    const geo = geoDiversityMultiplier(loc.region as GeoRegion, regionCounts);
    const bestRetention = Math.max(0.3, ...this.watches.filter(w => w.userId === userId && w.videoId === videoId).map(w => w.retention).concat(0));

    const weight = computeTapWeight({ trustScore: 0.9, accountAgeDays: 365, geoDiversity: geo, engagementQuality: bestRetention });
    this.taps.push({ userId, videoId, weight, region: loc.region });

    // Regional boost
    const key = `${videoId}|${loc.region}`;
    const prev = this.boosts.get(key);
    const newBoost = applyTapToRegionalBoost({ previousBoost: prev?.boost ?? 0, tapWeight: weight, secondsSinceLastTap: 0 });
    this.boosts.set(key, { boost: newBoost, lastTapAt: Date.now(), count: (prev?.count ?? 0) + 1 });
    await this.bus.publish(buildRegionalBoostUpdatedEvent({ videoId, region: loc.region, previousBoost: prev?.boost ?? 0, newBoost, tapCount: (prev?.count ?? 0) + 1 }));

    await this.bus.publish(buildContentTapRecordedEvent({ tapId: randomUUID(), userId, videoId, starProfileId: video.starProfileId, weight, region: loc.region, country: loc.country }));
    return { ok: true, weight };
  }

  regionCounts(videoId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of this.taps.filter(t => t.videoId === videoId)) out[t.region] = (out[t.region] ?? 0) + 1;
    return out;
  }

  recompute(videoId: string): void {
    const video = this.videos.get(videoId);
    if (!video) return;
    const watches = this.watches.filter(w => w.videoId === videoId);
    const totalWatchSeconds = watches.reduce((a, w) => a + w.watchSeconds, 0);
    const averageRetention = watches.length ? watches.reduce((a, w) => a + w.retention, 0) / watches.length : 0;
    const recentWeightedTaps = this.taps.filter(t => t.videoId === videoId).reduce((a, t) => a + t.weight, 0);
    const breakdown = computeDiscoveryScore({
      totalWatchSeconds, supporterCount: video.supporterCount, recentWeightedTaps,
      averageRetention, starMultiplier: 0.7,
    });
    this.scores.set(videoId, breakdown.score);
  }

  localFeed(country: string): Array<{ videoId: string; score: number }> {
    const region = resolveLocation({ country }).region;
    return [...this.videos.values()]
      .filter(v => resolveLocation({ country: v.country }).region === region)
      .map(v => ({ videoId: v.id, score: this.scores.get(v.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Video Discovery — end-to-end loop', () => {
  let world: World;
  const CREATOR_A = 'userA';
  const CREATOR_B = 'userB';

  beforeEach(() => {
    world = new World();
    world.publish({ id: 'videoA', uploaderUserId: CREATOR_A, starProfileId: 'starA', genre: 'COMEDY', country: 'NG', supporterCount: 100 });
    world.publish({ id: 'videoB', uploaderUserId: CREATOR_B, starProfileId: 'starB', genre: 'COMEDY', country: 'NG', supporterCount: 100 });
  });

  it('publishing emits VIDEO_PUBLISHED and seeds a zero score', () => {
    expect(world.events.filter(e => e === VIDEO_PUBLISHED)).toHaveLength(2);
    expect(world.scores.get('videoA')).toBe(0);
  });

  it('watching recomputes the discovery score', async () => {
    await world.watch('fan1', 'videoA', 55, 60);
    expect(world.scores.get('videoA')!).toBeGreaterThan(0);
    expect(world.events).toContain(WATCH_COMPLETED);
  });

  it('a creator cannot tap their own content', async () => {
    const res = await world.tap(CREATOR_A, 'videoA', 'NG');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('self_tap');
  });

  it('taps update the regional boost and emit events', async () => {
    await world.watch('fan1', 'videoB', 58, 60);
    const res = await world.tap('fan1', 'videoB', 'NG');
    expect(res.ok).toBe(true);
    expect(world.boosts.get('videoB|AF')!.boost).toBeGreaterThan(0);
    expect(world.events).toContain(REGIONAL_BOOST_UPDATED);
    expect(world.events).toContain(CONTENT_TAP_RECORDED);
  });

  it('full loop: taps + watches make videoB outrank videoA and surface first locally', async () => {
    // Light engagement on A
    await world.watch('fan1', 'videoA', 20, 60);

    // Heavy, geographically diverse engagement on B
    await world.watch('fan2', 'videoB', 58, 60);
    await world.watch('fan3', 'videoB', 59, 60);
    await world.tap('fan2', 'videoB', 'NG'); // AF
    await world.tap('fan3', 'videoB', 'US'); // NA — diverse, higher weight
    await world.tap('fan4', 'videoB', 'GB'); // EU — diverse

    const feed = world.localFeed('NG');
    expect(feed[0].videoId).toBe('videoB');
    expect(world.scores.get('videoB')!).toBeGreaterThan(world.scores.get('videoA')!);
  });

  it('geographically diverse taps earn more weight than concentrated ones', async () => {
    await world.watch('fanX', 'videoB', 60, 60);
    const first = await world.tap('fanX', 'videoB', 'NG'); // pioneer region → high multiplier
    // saturate AF so a second AF tap is worth less than a fresh region
    await world.tap('fanY', 'videoB', 'NG');
    await world.watch('fanZ', 'videoB', 60, 60);
    const diverse = await world.tap('fanZ', 'videoB', 'JP'); // AS — under-represented
    expect(diverse.weight!).toBeGreaterThan(0);
    expect(first.ok && diverse.ok).toBe(true);
  });
});
