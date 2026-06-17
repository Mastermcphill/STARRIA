# Sprint 2 — Video Discovery Engine MVP

## Implementation Summary

Implements the full content discovery loop end-to-end:

```
Creator uploads video → Video processed → User watches → User taps
  → Regional boost updates → Discovery ranking updates → Users discover content
```

The slice is event-driven: video upload, watch completion, and content taps all
publish domain events; the discovery score is recomputed reactively, and a
periodic aggregation job rebuilds the trending rails (global + per-region).

Four new packages were created (`geo-core`, `video-core`, `search-core`,
`discovery-core`) plus five new API modules and five Flutter screens.

---

## Architecture

```
            ┌───────────────┐   VIDEO_PUBLISHED    ┌────────────────────┐
 upload ───▶│  video module │ ───────────────────▶ │ discovery listeners│
            │ (video-core)  │                      │  → init/recompute  │
            └───────┬───────┘                      └─────────┬──────────┘
                    │ transcode/thumbnail/metadata           │
                    ▼                                         ▼
            ┌───────────────┐  WATCH_COMPLETED      ┌────────────────────┐
 watch ───▶ │ watch module  │ ───────────────────▶ │ DiscoveryScoring   │
            └───────────────┘                      │ Service (recompute)│
            ┌───────────────┐  CONTENT_TAP_RECORDED └─────────┬──────────┘
 tap  ────▶ │ content-tap   │ ───────────────────▶           │ DiscoveryScore
            │ (Tap Engine)  │  REGIONAL_BOOST_UPDATED         ▼
            │ + RegionalBoost                        ┌────────────────────┐
            │ + Aggregation │ ─── periodic ────────▶ │ TrendingCompute    │
            └───────────────┘                        │ → TrendingScore    │
                                                     │ → Local/Global trend
            ┌───────────────┐                        └─────────┬──────────┘
 browse ──▶ │ discovery mod │ ◀──────── reads DiscoveryScore / TrendingScore
            │ search module │ ◀──────── reads Video (search-core)
            └───────────────┘
```

No circular dependencies: `discovery-core` depends on `geo-core` +
`domain-events`; everything else depends only on `domain-events`. Cross-package
communication is via the EventBus, not imports.

---

## New Packages

| Package | Purpose | Key exports |
|---|---|---|
| `@starria/geo-core` | Country→region mapping, geo-diversity scoring | `resolveLocation`, `computeGeoDiversity`, `geoDiversityMultiplier`, `countryToRegion` |
| `@starria/video-core` | Upload→transcode→thumbnail→metadata→index→publish | `VideoService`, ports, `buildVideo*Event` |
| `@starria/search-core` | Content search abstraction | `SearchService`, `SearchIndexPort` |
| `@starria/discovery-core` | Discovery matrix, tap-weight + ranking formulas, regional boost, trending | `DiscoveryService`, `LocalDiscoveryService`, `TrendingService`, `computeTapWeight`, `computeDiscoveryScore`, `validateTap` |

---

## Formulas

**Tap weight** (`discovery-core/tap-weight.ts`):
```
tap_weight = trust_score × account_age × geo_diversity × engagement_quality
```
- `account_age` ramps linearly to 1 over 30 days
- `geo_diversity` rewards taps from under-represented regions (geo-core)
- `engagement_quality` derives from the tapper's watch retention (floor 0.3)
- Anti-spam: max **10,000** taps/user/video, min trust 0.1, no self-taps

**Discovery score** (`discovery-core/ranking.ts`):
```
score = watch_time*0.25 + supporters*0.25 + tap_velocity*0.20
      + retention*0.15 + star_multiplier*0.15
```
Each component normalised to [0,1] (counts via log-scaling) → score in [0,1].

**Regional boost**: exponential time-decay accumulator (24h half-life).
**Trending**: `discoveryScore*0.5 + velocity*0.35 + recency*0.15`; thresholds
local 0.6 / global 0.75.

---

## Changed / Created Files

### Packages
- `packages/geo-core/**` (package.json, tsconfig, types, region-map, geo-service, index)
- `packages/video-core/**` (types, ports, events, video-service, index)
- `packages/search-core/**` (types, search-service, index)
- `packages/discovery-core/**` (types, tap-weight, ranking, ports, events, discovery-service, local-discovery-service, trending-service, index)
- `packages/domain-events/src/events/video.ts` *(new)*
- `packages/domain-events/src/events/watch.ts` *(new)*
- `packages/domain-events/src/events/content-tap.ts` *(new)*
- `packages/domain-events/src/events/discovery.ts` *(extended: local/global trend, `video` entity)*
- `packages/domain-events/src/index.ts` *(barrel updated)*

### Prisma
- `apps/api/prisma/schema.prisma` — `Genre`, `VideoStatus` enums; `Video`, `VideoWatch`, `ContentTap`, `DiscoveryScore`, `RegionalTapBoost`, `TrendingScore` models; relations on `User`, `StarProfile`
- `apps/api/prisma/migrations/20260617000001_video_discovery/migration.sql`

### API modules
- `apps/api/src/modules/video/**` — controller, service, prisma store, processing stubs (transcoder/thumbnail/metadata), search-index adapter, DTOs
- `apps/api/src/modules/watch/**` — controller, service (WatchStarted/Completed), DTOs
- `apps/api/src/modules/content-tap/**` — TapController, ContentTapService (Tap Engine), RegionalBoostService, FraudSignalsAdapter (AI Brain stub), TapAggregationJob, DTOs
- `apps/api/src/modules/discovery/**` — controller, feed/trending Prisma adapters, DiscoveryScoringService, TrendingComputeService, DiscoveryListeners
- `apps/api/src/modules/search/**` — controller, Prisma search adapter, DTOs
- `apps/api/src/app.module.ts` — registers the 5 new modules
- `apps/api/package.json` — adds `discovery-core`, `geo-core`, `domain-events` deps

### Flutter (`apps/mobile`)
- `lib/features/discovery/` — models, repository, providers, **discovery_feed_screen** (vertical + horizontal swipe), **video_player_screen**
- `lib/features/search/` — repository, **search_screen**
- `lib/features/upload/` — repository, **upload_screen**
- `lib/features/creator/` — **creator_profile_screen**
- `lib/core/router/app_router.dart` — routes wired

### Tests
- `apps/api/src/modules/discovery/discovery-formulas.spec.ts`
- `apps/api/test/video-discovery.e2e.spec.ts`

---

## API Endpoints

### Video
```
POST /api/v1/videos/upload     Upload + process + publish (creators only)   [auth]
GET  /api/v1/videos/:id        Get a video
```

### Watch
```
POST /api/v1/watch/start       Start a watch session → WatchStartedEvent     [auth]
POST /api/v1/watch/complete    Complete (watch time/retention) → WatchCompletedEvent [auth]
```

### Content Taps (Tap Engine)
```
POST /api/v1/content-taps              Tap a video (weighted, anti-spam, geo-aware) [auth]
GET  /api/v1/content-taps/:videoId/count   Caller's tap count for a video           [auth]
POST /api/v1/content-taps/aggregate/run    Trigger a trending aggregation pass        [auth]
```

### Discovery
```
GET  /api/v1/discovery/genres            Genre rail (horizontal swipe)
GET  /api/v1/discovery/feed              Vertical feed by genre (filters: country, language)
GET  /api/v1/discovery/matrix            Top items per genre
GET  /api/v1/discovery/local             Local feed (viewer country)
GET  /api/v1/discovery/trending          Global trending rail
GET  /api/v1/discovery/trending/:region  Local/regional trending rail
```

### Search
```
GET  /api/v1/search   q, creatorId, creatorHandle, country, language, genre, sort
```

---

## Events

| Event | Type string | Emitted by |
|---|---|---|
| VideoUploadedEvent | `video.uploaded` | video-core |
| VideoProcessedEvent | `video.processed` | video-core |
| VideoPublishedEvent | `video.published` | video-core |
| WatchStartedEvent | `analytics.watch.started` | watch module |
| WatchCompletedEvent | `analytics.watch.completed` | watch module |
| ContentTapRecordedEvent | `discovery.tap.recorded` | content-tap |
| ContentTapRejectedEvent | `discovery.tap.rejected` | content-tap |
| RegionalBoostUpdatedEvent | `discovery.boost.updated` | RegionalBoostService |
| DiscoveryScoreUpdatedEvent | `discovery.score.updated` | DiscoveryScoringService |
| LocalTrendTriggeredEvent | `discovery.trend.local` | TrendingService |
| GlobalTrendTriggeredEvent | `discovery.trend.global` | TrendingService |

---

## Test Report

| Suite | Tests | Coverage |
|---|---|---|
| `discovery-formulas.spec.ts` | 22 | geo mapping/diversity, tap weight, anti-spam validation (self/limit/trust/unpublished), ranking weights + monotonicity, regional boost accumulation/decay, trending thresholds |
| `video-discovery.e2e.spec.ts` | 6 | publish→watch→tap→boost→rescore→**local surfacing**; self-tap rejection; geo-diverse weighting; event emission |

> **Execution note:** tests are written against Jest (API) using `InMemoryEventBus`
> and the real `discovery-core`/`geo-core` formulas. They were authored in this
> environment but not executed here (no installed toolchain); run with
> `pnpm --filter @starria/api test`. The formula unit tests are pure and have no
> DB dependency; the e2e spec is fully in-memory.

---

## Remaining TODOs

1. **Real media pipeline** — replace `TranscoderStub` / `ThumbnailGeneratorStub` / `MetadataExtractorStub` with FFmpeg/Mux/Cloudflare Stream workers; move `processAndPublish` off the request path into a worker reacting to `VideoUploadedEvent`.
2. **Object storage upload** — add signed-URL issuance + a real client-side picker in the Flutter upload screen (currently generates a fake `storageKey`).
3. **Real video playback** — add `video_player`/HLS to `video_player_screen` (currently renders the poster + tracks watch time).
4. **AI Brain fraud signals** — `FraudSignalsAdapter` is a heuristic stub (account maturity + rapid-fire detection); wire the real AI Brain client behind the same `FraudSignalPort`.
5. **Dedicated search index** — search currently queries the `Video` table live; move to OpenSearch/Meilisearch via the existing `SearchIndexPort`/`VideoSearchIndexPort` seams for scale + full-text relevance.
6. **Aggregation at scale** — `TapAggregationJob` recomputes all published videos every 60s in-process; move to the Redis job scheduler (`apps/api/src/adapters/job-scheduler.adapter.ts`) and incremental windows.
7. **Redis EventBus** — swap `InMemoryEventBus` for `RedisEventBusAdapter` so re-scoring works across replicas.
8. **Trust/account-age inputs** — engagement quality currently uses best watch retention; consider session-level signals and per-video unique-viewer counts for `supporters`.
9. **Horizontal-swipe gesture** — the Flutter feed uses genre chips; add a `PageView`-based horizontal swipe between genres for the full matrix feel.

Do **not** included in this sprint (per scope): livestreams, events, arenas, creator OS.
