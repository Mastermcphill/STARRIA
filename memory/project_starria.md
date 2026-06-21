---
name: project-starria
description: STARRIA monorepo — creator economy platform, scaffold status and key decisions
metadata:
  type: project
---

STARRIA is a creator-economy platform (Stars host Arenas, Supporters send Taps) built as a pnpm + Turborepo monorepo.

**Why:** New platform extracting reusable packages from two prior apps (LifeNest, Vidzi).

**How to apply:** When working on STARRIA, start from the extraction docs in `docs/lifenest-extraction/` and `docs/vidzi-extraction/`. The infrastructure packages are fully populated — do not regenerate them.

## Current state (2026-06-18)

Sprints 1–8 complete. Full competitive platform layer added in Sprint 8.

### Apps
- `apps/api` — NestJS / Fastify / Prisma / PostgreSQL / Redis
- `apps/mobile` — Flutter (go_router, riverpod, livekit_client)

### Infrastructure packages (from LifeNest/Vidzi — FULLY POPULATED, do not regenerate)
- `@starria/wallet-core` — ledger hash chain
- `@starria/gifting-core` — coin + fiat gifts (CoinGiftingService, FiatGiftingService)
- `@starria/feed-core` — FYP engine (FeedEngine, FeedContentPort)
- `@starria/notification-core` — multi-channel notifications (NotificationService)
- `@starria/moderation-core` — reports + queues
- `@starria/analytics-core` — watch sessions (AnalyticsService)
- `video-core` — Python/FastAPI upload+streaming
- `search-core` — Python/FastAPI content index

### Domain packages (new — architecture only, no business logic)
- `@starria/support-core` — SupporterProfile, Subscription, SupporterTier (free/fan/superfan/ultra)
- `@starria/star-core` — StarProfile, StarTier (rising/verified/elite), verification, follows
- `@starria/tap-core` — Tap orchestration wrapping gifting-core; leaderboard, context, analytics
- `@starria/event-core` — Event lifecycle state machine (DRAFT→SCHEDULED→LIVE→ENDED), replays, watch sessions
- `@starria/arena-core` — LiveKit room management, access control (resolveArenaAccess), participants, moderation

### Key design decisions
- All packages: port interface pattern, no NestJS decorators, no Prisma
- tap-core is the ONLY package with hard deps on gifting-core + wallet-core
- arena-core checks subscriptions via ArenaSubscriptionCheckPort → injected from support-core at app layer
- No circular deps at package level; all cross-domain wiring at NestJS module level

### Documentation
- `docs/architecture/` — 6 files (system architecture, dep graph, package relationships, API contracts, migration roadmap, MVP plan)
- `docs/platform-design/` — 9 files (overview, one per package, dep graph, DB schema, API contracts, migration docs)

### Sprint 8 additions (2026-06-18)
- **Packages:** `@starria/ranking-core` (ELO engine, divisions, decay, reset), `@starria/voting-core` (weighted votes, fraud detection)
- **arena-core expanded:** BattleService, battle-types, battle-ports, battle-events
- **domain-events:** Sprint 8 battle events (`events/battle.ts`)
- **Prisma (migration 20260617000004):** 10 new tables, 9 new enums — Battle, BattleParticipant, BattleTeam, BattleVote, ArenaPrizePool, PrizePoolContribution, ArenaSeason, CreatorElo, HouseBattle, BattleHighlight
- **API:** BattlesController (15 endpoints), BattlesService — full lifecycle + ELO settlement + prize pool + leaderboard + houses
- **Flutter screens (7):** ArenaLobbyScreen, BattleRoomScreen, VotingScreen, LeaderboardScreenV2, HouseProfileScreen, PrizePoolScreen, ArenaHistoryScreen
- **E2E test:** `sprint8-arenas-battles.e2e.spec.ts` — 20 tests across voting, anti-fraud, ELO, prizes, teams, seasons
- **Docs:** arena-report, ranking-report, migration-report, gtex-migration-report, test-report, sprint9-roadmap

### Sprint 9 — Launch Hardening (2026-06-18)
Hardening only, no new features. Readiness 54→~83/100. Deliverables in `docs/audit/` (launch-readiness-report, security-report-final, docker-report, test-report-final, deployment-guide).
- **Root build fix:** `domain-events/src/events/battle.ts` used 2-arg `DomainEvent<>` (takes 1) — broke the whole graph; fixed. arena-core + creator-os-core type/tsconfig fixed. All 30 packages now `tsc`-build clean.
- **Security:** global `JwtAuthGuard` via APP_GUARD + `@Public()` (secure-by-default); auth register/login/refresh (bcrypt); CORS allowlist; JWT-secret boot validation; self-vote bypass fixed (voterId from JWT); Paystack webhook HMAC.
- **Infra:** Dockerfile now `COPY packages/` (was missing 13); campaign-core tsconfig added; health module + compose healthcheck; durable Redis Streams EventBus (`EVENT_BUS_DRIVER`).
- **Payments:** real Paystack (REST+retry+webhook); Apple/Google still stubs. **LiveKit:** real AccessToken/RoomServiceClient w/ dev fallback (port made async-capable).
- **Flutter:** added `http`; `SessionStore` for auth headers; removed `current-user-id`; `flutter analyze` 0 errors. **Tests:** jest configured; 64/65 unit tests pass.

**Known remaining (need network/DB):** `pnpm install` to regen stale lockfile (messaging-core etc. missing from it) + link Sprint 5–8 pkgs; `prisma generate`; Sprint 5–7 in-memory→Prisma migration (P1, multi-day); E2E suites need DB + auth-token updates.

**Env note:** no pnpm in sandbox — used `corepack pnpm`; manually symlinked `node_modules/@starria/*` to validate builds (real fix is `pnpm install`).

### Sprint 9 — Final hardening pass (2026-06-18) → ~89/100
Report: `docs/audit/sprint9-hardening-final.md`. Done & verified:
- **Lockfile regenerated** — all 12 Sprint 5–8 pkgs now in `pnpm-lock.yaml`; `--frozen-lockfile` passes (Docker `deps` stage was broken before).
- **`apps/api` build script** → `prisma generate && nest build` (Prisma now in local pipeline, not just Dockerfile).
- **API was NOT compiling** (prior "tsc-clean" covered packages only, not the Nest app): fixed 19× TS2564 (DTOs needed `!` — convention matches auth/withdraw DTOs) in arenas/live/poster/ticketing dto, + 1× TS2345 (`prisma-ticket-store.repository.ts` ledger methods must return `{userId,balance}` for `CoinLedgerPort`). Now `tsc --noEmit` clean, `dist/main.js` emits, full topo build exit 0.
- **Tests 71/71** (was 64 run + wallet suite uncompilable via TS7006 once Prisma generated + 1 streak fail). Streak: test data included the "gap" day as a real gift (a break is *absence* of gifts) — fixed data, kept assertions. Wallet: added missing `findUnique` mock + corrected event const to `WALLET_PAYOUT_REQUESTED`.

**Migration chain validated (user-authorized):** applied all migrations in order to a throwaway DB inside the `starria-postgres` container (host can't reach it — see below) → clean. **Messaging migrated to Prisma** (1 of 11 in-memory domains): +4 enums, +5 models (DmPermission, MessageRequest, Conversation, DirectMessage, ConversationUnread) in schema; migration `20260618000000_messaging_persistence`; new `prisma-messaging.repository.ts` (PrismaMessageRepository + PrismaDMPermissionRepository); in-memory file deleted; module/service rewired. Full chain now 9/9 → 54 tables; 71/71 tests; API builds. Messaging is the verified template for the rest.

**Still open:** 10 in-memory repos (campaigns, companion×3, creator-os, patrons, prestige, replay, session-engine, trust) — no Prisma models yet (P1, same pattern as messaging). No DB-connected integration test for the messaging repo yet (CI follow-up). Dev DB built via `db push` (no `_prisma_migrations`).

**Infra footgun:** a native `postgresql-x64-18` Windows service ALSO listens on localhost:5432, intercepting host→container DB connections (this, not a bad password, caused the P1000 on host). Reconcile before deploy; validate DB work inside the container or stop the native service.

### Sprint 12 — Final Launch Sprint (2026-06-21) → ~90/100
Report: `docs/sprint12/launch-readiness-report.md`. Verify-first; all 7 phases done, **208/208 tests (32 suites, +46), tsc clean, prisma valid, nest build emits**.
- **Phase 1 (payouts)** + **Phase 5 (ledger SHA-256 chain unification)** were already implemented by a prior agent; re-verified green. PayoutRequest/Attempt/Webhook + reserve→execute→reconcile + idempotency + Paystack provider; `appendWalletEntry` single appender with `verifyLedgerIntegrity()`.
- **Phase 2 (token revocation):** Redis-backed `auth/token-revocation.service.ts` — per-session `jti` revoke + per-user `iat` watermark (revoke-all). `/auth/logout` + `/auth/logout-all`; suspension now calls `revokeAllForUser`. Enforced in `JwtStrategy.validate` + `refresh`.
- **Phase 3 (content safety):** `ContentSafetyPort` WAS unwired (confirmed). Added provider port + `ManualSafetyProvider` (default, rule-based) + `CloudProviderAdapter` (real HTTP, config-gated) + `ContentSafetyService` (persist `ContentScan`, flag/auto-block→takedown, retry queue) + `ModerationSafetyAdapter` bridge. Migration `20260624000000_content_safety_scans`.
- **Phase 4 (replay):** only `StubMediaProcessor` was fake. Replaced with real `ReplayMediaProcessor` (HLS passthrough + `#EXTINF` duration probe) + `LiveKitEgressService` (EgressClient→R2) + `egress_ended` capture + `ReplayCapabilityService` (`GET /replays/capability`). Ships disabled-by-default (egress/transcode unverifiable without live LiveKit+R2). Removed a duplicate `GET /replays/:id` controller that would crash bootstrap.
- **Phase 6 (security):** `common/security-headers.ts` (helmet-equivalent Fastify hook, dependency-free — @fastify/helmet not installed), Fastify `bodyLimit` 1MB, stricter CORS, withdrawal throttle 5/60s, `common/webhook-ip.guard.ts` (CIDR allowlist for Paystack+LiveKit webhooks), `media/upload-validation.ts` (per-purpose MIME+ext+size).

**Still open:** replay egress + cloud content-safety + Apple/Google IAP are credential-gated (real code, not verifiable here); `forbidNonWhitelisted` still off; no DB-connected integration tests.
