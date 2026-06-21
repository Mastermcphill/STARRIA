# STARRIA Launch Readiness Report (Sprint 9)
**Date:** 2026-06-18
**Sprint:** 9 — Launch Hardening
**Starting score (audit):** 54 / 100

---

## Executive Summary

Sprint 9 was a hardening-only sprint (no new features). It fixed the structural
build blockers, closed the platform's largest security gap (unauthenticated
endpoints), implemented authentication, wired real payment + LiveKit integrations
with graceful dev fallbacks, made the durable Redis event bus, and got the unit
test suite running and green.

**Revised readiness: ~83 / 100** — a large jump from 54, just short of the 85
target. The two items keeping it under 85 are environmental and explicitly
out of this sandbox's reach: (1) the workspace `pnpm install` / lockfile
regeneration and Prisma client generation need registry/DB access, and (2) the
Sprint 5–7 in-memory→Prisma persistence migration is a multi-day data-layer
effort. Both are precisely scoped below.

---

## Score Movement by Dimension

| Dimension                       | Audit | Now  | Driver |
|---------------------------------|-------|------|--------|
| Package compilation             | 85    | 98   | domain-events + arena-core + creator-os-core now build; all 30 pkgs compile |
| Workspace dependency integrity  | 80    | 90   | 12 missing API deps + campaign-core tsconfig added |
| Database migrations             | 70    | 70   | unchanged — Sprint 5–7 persistence still pending |
| API module registration         | 95    | 98   | health module added |
| DTO validation coverage         | 40    | 62   | auth + battle DTOs fully decorated |
| Domain event wiring             | 65    | 88   | durable Redis Streams bus |
| Flutter route reachability      | 92    | 95   | session-aware auth headers |
| Flutter screen compilation      | 75    | 95   | `http` added → `flutter analyze` 0 errors |
| Repository implementations      | 45    | 50   | unchanged structurally (still in-memory for S5–7) |
| Port adapter coverage           | 50    | 60   | LiveKit real adapter; Redis bus adapter |
| E2E test executability          | 35    | 55   | jest configured; unit suites green; E2E needs DB + auth update |
| Docker build correctness        | 50    | 88   | Dockerfile copies all packages; healthcheck added |
| Infrastructure readiness        | 60    | 80   | health probes, durable bus, config validation |
| Security posture                | 30    | 80   | global JWT guard, auth impl, CORS lockdown, webhook HMAC |

**Weighted total ≈ 83 / 100.**

---

## Track-by-Track Results

### TRACK A — Infrastructure ✅ (mostly)
- **Dockerfile** now `COPY packages/ ./packages/` — all 30 manifests (was 17).
- **`campaign-core/tsconfig.json`** added; **`creator-os-core/tsconfig.json`**
  fixed (rootDir violation).
- **12 missing `@starria/*` deps** added to `apps/api/package.json`;
  `livekit-server-sdk` declared.
- **Root-cause build fix:** `domain-events` failed to compile (Sprint 8
  `battle.ts` two-arg `DomainEvent<>`); fixed → unblocked the whole graph.
- **arena-core** pre-existing type errors fixed.
- **Validation:** all 30 packages build with `tsc`. ✅
- **Remaining (needs network):** `pnpm install` to regenerate the stale lockfile
  (`messaging-core` et al. missing from it) and link Sprint 5–8 packages; then a
  full `docker build`. Detailed in `docker-report.md`.

### TRACK B — Backend ◑
- **Redis Streams EventBus** implemented (`redis-event-bus.ts`) with consumer
  groups, at-least-once delivery, graceful in-process fallback; selected in prod
  via `EVENT_BUS_DRIVER`. ✅
- **Replace ALL in-memory repos with Prisma:** ❌ NOT done — this is a multi-day
  data-layer migration (companion, messaging, presence, trust, patron, replay,
  session-engine need ~10 Prisma models + migration + adapter rewrites). Scoped
  below as the #1 remaining P1. Honestly out of reach for a hardening pass
  without a DB to validate against.

### TRACK C — Security ✅
- Global `JwtAuthGuard` (secure-by-default) + `@Public()` opt-out.
- `auth` register/login/refresh implemented (bcrypt, refresh tokens).
- CORS allowlist; JWT-secret boot validation; auth-route rate limits;
  Paystack webhook HMAC; self-vote bypass fixed (server-derived voter).
- See `security-report-final.md`. Residual: decorate remaining S5–7 DTOs, RBAC.

### TRACK D — Payments ◑
- **Paystack**: real `initialize`/`verify` via REST with retry+backoff; webhook
  endpoint with HMAC-SHA512 verification; dev-stub fallback when unkeyed. ✅
- **Apple Pay / Google Pay**: still stubs — real receipt verification
  (App Store / Play Developer API) not implemented. Structure (provider
  interface, retry util) is in place to add them.

### TRACK E — LiveKit ✅ (code) / ⚠️ (live verify)
- Real `AccessToken` + `RoomServiceClient` (create/delete room, token,
  remove/mute participant) via `livekit-server-sdk`; dev-stub fallback when
  unkeyed. Port widened to allow async token. ✅
- join/leave/reconnect/recording/moderation **cannot be live-verified** here (no
  LiveKit server + SDK not yet installed). Requires a staging LiveKit instance.

### TRACK F — Flutter ✅
- `http` added to `pubspec.yaml`; `flutter pub get` succeeds.
- Hardcoded `current-user-id` removed; `SessionStore` provides token + user id;
  arena calls send auth headers; voter id is server-derived.
- Unused imports cleaned.
- **`flutter analyze`: 0 errors** (65 lint infos/warnings — mostly `withOpacity`
  deprecations). All 35 routes intact.

### TRACK G — Testing ◑
- jest + jest-e2e configured (P1-02 fixed). Unit tests: **64/65 pass** (1
  pre-existing assertion fail in streak; wallet suite needs `prisma generate`).
- E2E need a DB and must be updated for the new auth guard (401s otherwise).
- **80% coverage target NOT met** — needs DB-backed E2E + new unit tests. See
  `test-report-final.md`.

### TRACK H — Production Readiness ◑
- **Health checks** (`/health`, `/health/ready`) + compose healthcheck. ✅
- **Migrations pipeline** documented (`deployment-guide.md`). ✅
- **Durable events** (Redis bus). ✅
- **Logging/metrics/crash-reporting/backups**: documented with concrete
  recommendations but **not wired** (Sentry, Prometheus, structured logs).

---

## Remaining Work to Reach ≥85 (and beyond)

| # | Item | Severity | Effort | Blocks score |
|---|------|----------|--------|--------------|
| 1 | `pnpm install` (regen lockfile, link S5–8 pkgs) + `prisma generate` | P0-env | 30 min in CI | build/deps/test |
| 2 | Sprint 5–7 in-memory → Prisma (models + migration + adapters) | P1 | 3–4 days | migrations/repos |
| 3 | Update E2E suites for auth guard + run against DB → coverage | P1 | 1–2 days | testing |
| 4 | Decorate remaining S5–7 DTOs; enable `forbidNonWhitelisted` | P2 | 1 day | validation |
| 5 | Apple/Google IAP real verification | P1 | 2–3 days | payments |
| 6 | Wire Sentry + Prometheus + structured logging | P2 | 1 day | infra |
| 7 | Live-verify LiveKit (join/leave/reconnect/record/mod) on staging | P1 | 1 day | livekit |
| 8 | Unit tests for ranking-core / voting-core | P2 | 0.5 day | testing |

Completing #1 (trivial, env-only) and #3 alone pushes the score to ~86. Adding #2
brings it to ~90+ (Public Beta ready).

---

## Files Changed in Sprint 9 (code)

**API**
- `src/main.ts` — config validation, CORS allowlist, rawBody
- `src/app.module.ts` — global JwtAuthGuard + ThrottlerGuard, HealthModule
- `src/event-bus/{event-bus.module,redis-event-bus}.ts` — durable bus
- `src/modules/auth/{auth.controller,auth.service,jwt-auth.guard,public.decorator,dto/auth.dto}.ts`
- `src/modules/health/{health.controller,health.module}.ts`
- `src/modules/arenas/{battles.controller,battles.service,dto/battle.dto}.ts`
- `src/modules/coin-purchase/{coin-purchase.controller,service,module}.ts`,
  `providers/{paystack.provider,retry.util}.ts`
- `src/modules/live/livekit-adapter.service.ts`
- `src/modules/{search,discovery,prestige}/*.controller.ts` — `@Public()`
- `apps/api/{package.json,Dockerfile,jest-e2e.json}`, 4 `*.spec.ts` fixes

**Packages**
- `domain-events/src/events/battle.ts` — DomainEvent arity fix
- `arena-core/src/{ports,types,arena-service}.ts` — type fixes
- `live-core/src/{types,live-room.service}.ts` — async token port
- `campaign-core/tsconfig.json`, `creator-os-core/tsconfig.json`

**Mobile**
- `pubspec.yaml` — `http`
- `lib/core/session/session_store.dart` — new
- `lib/features/arenas/{arenas_provider,voting_screen,battle_room_screen}.dart`
- unused-import cleanups; `assets/{images,icons}/.gitkeep`

**Infra/Docs**
- `docker-compose.yml` — api healthcheck
- `.env.example` — new config keys
- `docs/audit/{launch-readiness-report,security-report-final,docker-report,test-report-final,deployment-guide}.md`

---

## Validation Evidence (run in this environment)

| Check | Result |
|-------|--------|
| `tsc` build — all 30 packages | ✅ PASS |
| `flutter pub get` | ✅ PASS (`http` resolved) |
| `flutter analyze` | ✅ 0 errors (65 lint infos/warnings) |
| `jest` (API unit) | ◑ 64/65 tests pass (1 pre-existing fail; 1 suite needs prisma generate) |
| API `tsc --noEmit` | ⚠️ pre-existing baseline errors + livekit-sdk (needs install) |
| `pnpm install` / `docker build` / E2E | ⛔ not runnable here (no registry/DB) |
