# Sprint 7 Deliverables — LiveKit Stabilization, Creator OS & Session Engine

**Status:** Complete
**Branch:** main
**Theme:** Transform STARRIA into a production-grade entertainment operating system.

---

## 1. Migration / Build Report

### Packages shipped

| Package | Purpose |
|---|---|
| `packages/session-engine-core` | Unified engine for all 10 room types — lifecycle, participants, billing, moderation, recording, replay handoff, invites |
| `packages/replay-core` | Recording → process → thumbnails → publish → discovery pipeline with public/subscriber/premium gating |
| `packages/creator-os-core` *(expanded)* | Poster Studio, Show Planner, Analytics, Content Calendar, Live Commerce, Clips/Teasers |

### Domain events added

`packages/domain-events/src/events/`:
- `session-engine.ts` — room lifecycle, participants, billing, moderation, recording (18 constants)
- `replay.ts` — capture, processing, thumbnails, published, discovery, failed (6 constants)
- `creator-os-studio.ts` — show plan, poster, commerce list/sold, gifting overlay, clip, teaser (7 constants)

All registered in `domain-events/src/index.ts`. **No existing event renamed or removed.**

### Typecheck status

- `domain-events` — compiles clean (`tsc --noEmit`).
- `session-engine-core`, `replay-core`, `creator-os-core` — compile clean via path-mapped typecheck against source.
- New API modules (`session-engine`, `replay`, `creator-os`) — compile clean against package sources + NestJS.
- Flutter: `flutter analyze` on all new files → **0 errors** (4 `withOpacity` deprecation infos, consistent with existing codebase).

> Note: the monorepo is not `pnpm install`-ed in this environment (no `@starria/*` symlinks), so full workspace builds/tests were validated via path-mapped `tsc` and `flutter analyze` rather than `turbo run build`. This matches how Sprints 5–6 were authored.

---

## 2. Session Engine (Phase 1)

Unifies **10 room types** under one engine:
`LIVE_EVENT, COMPANION_AUDIO, COMPANION_VIDEO, SUPPORTER_ROOM, CREATOR_QA, RAP_BATTLE, SING_OFF, YAP_BATTLE, AI_PREMIERE, PRIVATE_ROOM`.

Core models: `SessionRoom, SessionParticipant, SessionPermission, SessionBilling, SessionRecording, SessionModeration, SessionReplay`.

Per-type defaults: `DEFAULT_PERMISSIONS` (role → capability matrix) and `DEFAULT_MAX_PARTICIPANTS` (e.g. `COMPANION_VIDEO=2`, `LIVE_EVENT=5000`).

Lifecycle: `createRoom → openRoom → startRoom (auto-records if enabled) → pauseRoom → endRoom (settles revenue) / cancelRoom`. Billing hooks charge on join (`COIN_ENTRY`/`TICKETED`), accrue gross, and settle 80/20 at end. Moderation `KICK`/`BAN` removes participants. Recording delegates to a `LiveKitProviderPort` (egress).

---

## 3. Replay Architecture (Phase 3)

Pipeline: **capture → process → thumbnails → publish → discovery push.**

- `captureAndProcess()` — idempotent on `recordingId`; runs `MediaProcessorPort.process` + `generateThumbnails`, lands in `READY`.
- `publish()` — sets visibility (`PUBLIC`/`SUBSCRIBER`/`PREMIUM`), requires `priceCoins` for premium, pushes to discovery via `DiscoveryPublisherPort`.
- `getForPlayback()` — enforces `ReplayAccessPort` gating for non-public replays, increments views.

Failures emit `replay.failed` and set status `FAILED` (with coin-safety left to caller).

---

## 4. Creator OS (Phases 4–7)

| Service | Capability |
|---|---|
| `PosterStudioService` | Comedy/AI-movie/live-show/arena posters; charges coins (`POSTER_COIN_COST`), refunds on failure |
| `ShowPlannerService` | Deterministic segment breakdowns; weights normalized to exact duration; audience-gated segments |
| `CreatorAnalyticsService` | Audience + revenue analytics + derived insights & best posting hour |
| `ContentCalendarService` | Schedule / publish / cancel calendar entries (release scheduler) |
| `LiveCommerceService` | List & sell tickets/replays/subs/digital/merch; idempotent purchase; 80/20 split; gifting overlays |
| `ClipService` | Auto-cut 15/30/60s clips + teasers from replays (discovery flywheel) |

### Show Planner example (STANDUP, 60 min, audience 100)

Segments sum **exactly** to 60 min, distributing remainder minutes to the largest fractional shares. Audience-gated segments (roast battle ≥50, interaction ≥25) are dropped for small crowds.

---

## 5. API Endpoints (Phase 9)

All under Swagger (`/docs`), tagged `session-engine`, `replay`, `creator-os`.

### Contract endpoints (as specified)
| Method | Path |
|---|---|
| POST | `/sessions/:id/record` |
| POST | `/sessions/:id/stop-recording` |
| POST | `/replays/publish` |
| GET | `/replays/:id` |
| POST | `/creator-os/poster` |
| POST | `/creator-os/show-plan` |
| GET | `/creator-os/analytics` |
| POST | `/clips/generate` |

### Supporting endpoints
- Rooms: `POST /rooms`, `GET /rooms`, `GET /rooms/:id`, `POST /rooms/:id/{open,start,pause,end,cancel,join,leave,invite,moderate}`
- Replays: `POST /replays/capture`, `GET /replays/discover`
- Creator OS: `POST/GET /creator-os/calendar`, `POST /creator-os/commerce/{list,purchase,gift-overlay}`, `GET /creator-os/commerce/room/:roomId`, `POST /clips/teaser`, `GET /clips/replay/:replayId`

`/rooms/:id/join` returns a LiveKit `token` consumed by the Flutter client.

---

## 6. Flutter (Phases 2 & 8)

### Production LiveKit widgets (`lib/features/livekit/`)
- `VideoGridView` — **the SmartStageView replacement** (stage + adaptive grid)
- `ParticipantTile` — real `VideoTrackRenderer` + avatar fallback
- `SpeakerIndicator`, `NetworkQualityBadge`, `RoomControlsBar`
- `LiveKitRoomController` — connect, token fetch, reconnection, background lifecycle, audio routing

### Screens
`LiveRoomScreenV2`, `ReplayScreen`, `CreatorOSDashboard`, `CreatorPosterStudioScreen`, `ShowPlannerScreen`, `RevenueAnalyticsScreen`, `RecordingManagerScreen` — all routed in `app_router.dart`.

Added `lib/core/config/app_config.dart` (was referenced by Sprint 6 but missing — now created with `apiBase` + `livekitUrl`).

---

## 7. Test Report (Phase 10)

`apps/api/test/sprint7-livekit-creator-os.e2e.spec.ts` — self-contained in-memory adapters.

| Suite | Scenarios |
|---|---|
| Session Engine | create+host participant, idempotency, participant cap, coin-entry billing, start→record→end+settle, KICK removal, explicit start/stop recording (7) |
| Replay Pipeline | capture→process→thumbnails, idempotency, publish+discovery, premium-needs-price, premium gating (5) |
| Show Planner | segments sum to duration, audience-gating, all show types (3) |
| Poster Studio | charge+poster, refund on failure (2) |
| Live Commerce | 80/20 split, idempotent purchase, sold-out (3) |
| Discovery Flywheel | 15/30/60 clips in bounds, short-replay clamp, teaser (3) |

**Total: 23 scenarios.** Verifies video-path contracts, recording, replay publishing, poster generation, show planning, live commerce, clip generation.

---

## 8. Constraint Compliance

- ✅ No breaking changes — all Sprint 1–6 routes, APIs, packages untouched.
- ✅ Additive only — new modules appended to `AppModule`; new events appended to index.
- ✅ Existing APIs preserved — `/sessions/start|end|...` (companion) coexist with new `/sessions/:id/record`.
- ✅ Name collisions resolved — `ReplayAssetPublishedEvent` (vs live-event's `ReplayPublishedEvent`); `CreatorPosterStudioScreen` (vs Sprint 3 `PosterStudioScreen`).

---

## 9. Sprint 8 Roadmap

1. **Real LiveKit server** — replace `StubLiveKitProvider`: room provisioning, signed `AccessToken` JWTs, Egress recording.
2. **Real media pipeline** — replace `StubMediaProcessor` with transcode + thumbnail extraction (ffmpeg/cloud).
3. **Replay player** — wire HLS playback into `ReplayScreen`.
4. **Persistence** — swap module-level in-memory Maps for Prisma repositories.
5. **Wallet bridge** — connect `SessionBillingPort` / `CreatorCoinLedgerPort` to `wallet-core`.
6. **Image-gen integration** — real `PosterGeneratorPort` + `ClipGeneratorPort`.
7. **Discovery integration** — `DiscoveryPublisherPort` → `discovery-core` feed.
8. **AI Co-host** — scoped in Creator OS types, implementation deferred.
