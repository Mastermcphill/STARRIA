---
name: project-starria
description: STARRIA monorepo — creator economy platform, scaffold status and key decisions
metadata:
  type: project
---

STARRIA is a creator-economy platform (Stars host Arenas, Supporters send Taps) built as a pnpm + Turborepo monorepo.

**Why:** New platform extracting reusable packages from two prior apps (LifeNest, Vidzi).

**How to apply:** When working on STARRIA, start from the extraction docs in `docs/lifenest-extraction/` and `docs/vidzi-extraction/`. The infrastructure packages are fully populated — do not regenerate them.

## Current state (2026-06-16)

Architecture-only. Two sessions of scaffolding complete.

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

### Next step (Phase 2 / Sprint 2)
1. Add new enums + tables from `docs/platform-design/07-database-schema.md` to `apps/api/prisma/schema.prisma`
2. Run `prisma migrate dev --name platform_packages`
3. Implement Prisma adapters: `PrismaSupporterStore`, `PrismaStarStore`, `PrismaStarDiscovery`
4. Wire into `StarsModule` and `SupportersModule` in `apps/api/src/modules/`
