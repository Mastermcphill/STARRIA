# STARRIA Launch Blockers
**Audit Date:** 2026-06-18

This document is a ranked consolidated list of all issues found across the 
Platform Readiness Audit (Sprints 1–8). Issues are ordered by severity 
(P0 → P3) then by business impact within each tier.

Full details for each finding are in the linked reports.

---

## P0 — Launch Blockers (Must Fix Before Any Production Deployment)

These issues prevent the platform from functioning at all.

| ID    | Finding                                                       | Report                  | Fix Effort |
|-------|---------------------------------------------------------------|-------------------------|------------|
| **P0-01** | **Auth controller has zero endpoints** — no user can register or log in; no JWT can be obtained; all guarded endpoints are unreachable | api-report, security-report | High |
| **P0-02** | **`http` package missing from Flutter `pubspec.yaml`** — 22 screens across companion, messaging, patron, arenas, creator-os, trust, presence, replay fail to compile with `Target of URI doesn't exist: 'package:http/http.dart'` | flutter-report, dependency-report | Low (add 1 line to pubspec.yaml) |
| **P0-03** | **Dockerfile missing 13 package manifests** — `pnpm install --frozen-lockfile` fails at the `deps` stage; no Docker image can be built | infrastructure-report, dependency-report | Medium (add COPY lines) |
| **P0-04** | **All payment providers are stubs** — Paystack, Apple Pay, Google Pay all return `{status:'success', ref:'stub-...'}` unconditionally; zero real coin purchases are possible | infrastructure-report | High |
| **P0-05** | **`livekit-server-sdk` not installed** — `LiveKitAdapterService` returns `stub-livekit-token-${Date.now()}`; all live rooms will reject the token at the LiveKit server | infrastructure-report, dependency-report | Low (install package + 20-line adapter) |

---

## P1 — Critical Issues (Must Fix Before Public Beta)

These issues cause data loss, security holes, or complete feature unavailability.

| ID    | Finding                                                       | Report                  | Fix Effort |
|-------|---------------------------------------------------------------|-------------------------|------------|
| **P1-01** | **Sprints 5–7 use in-memory repositories** — companion, messaging, presence, trust, patron, replay, session-engine store all data in `Map<string, T>`; all data is lost on every process restart | migration-report, api-report | High (Prisma models + migrations + adapter swap) |
| **P1-02** | **No jest config in `apps/api/package.json`** — `pnpm test` fails; the 7 E2E spec files (sprint3–sprint8) cannot be run; CI has no test coverage signal | api-report | Low |
| **P1-03** | **9 controllers with no `@UseGuards`** — patrons, messaging, trust, presence, companion, battles, session-engine, replay, campaigns endpoints are fully unauthenticated | security-report, api-report | Medium |
| **P1-04** | **`JWT_SECRET` defaults to `"change-me-in-production"`** — no startup validation; if the default survives to production, tokens can be forged by any attacker who reads the .env.example | security-report | Low |
| **P1-05** | **Self-vote check is bypassable** — `castVote` compares `participant.starProfileId === dto.voterId` but the endpoint has no auth guard; attacker sets `voterId` to any other UUID to bypass | security-report, api-report | Low |
| **P1-06** | **`EventBusModule` uses `InMemoryEventBus` in production** — in-flight domain events (wallet deductions, notifications) are lost on crash or restart; coins can be deducted without credits being issued | infrastructure-report | Medium (Redis Streams adapter) |
| **P1-07** | **`campaign-core` has no `tsconfig.json`** — `turbo run build` fails for this package; any downstream that imports it will fail to type-check | dependency-report | Low (copy tsconfig from sibling) |
| **P1-08** | **`auth`, `users`, `stars`, `taps`, `events`, `ai-creator` controllers are complete stubs** — zero CRUD endpoints for core entities; creator profiles, event browsing, and tap sending are all unavailable | api-report | High |

---

## P2 — Important Issues (Must Fix Before Public Launch)

These issues degrade quality, security posture, or developer experience.

| ID    | Finding                                                       | Report                  | Fix Effort |
|-------|---------------------------------------------------------------|-------------------------|------------|
| **P2-01** | **No `class-validator` decorators on most DTOs** — `ValidationPipe` strips unknown fields but cannot reject null/missing/malformed values; bad inputs reach Prisma and return 500 instead of 400 | api-report, security-report | Medium |
| **P2-02** | **No `ParseUUIDPipe` on `@Param('id')` parameters** — malformed UUID path params hit Prisma directly, producing unhandled `PrismaClientValidationError` (500) | security-report | Low |
| **P2-03** | **5 controllers missing `@ApiTags`** — companion, messaging, patrons, presence, trust are invisible in Swagger `/docs`; integration partners have no contract | api-report, flutter-report | Low |
| **P2-04** | **No Prisma schema entries for Sprint 5–7 models** — `CompanionProfile`, `MessageThread`, `PresenceStatus`, `TrustProfile`, `PatronProfile`, `ReplaySession`, `SessionEngineSession` do not exist in `schema.prisma`; migration gap required before P1-01 can be resolved | migration-report | High (coupled to P1-01) |
| **P2-05** | **Hardcoded `'current-user-id'` in Flutter battle screens** — `voting_screen.dart` and `battle_room_screen.dart` send this literal string as the voter ID; vote attribution is incorrect for all users | flutter-report | Low |
| **P2-06** | **Route ordering conflict in `battles.controller.ts`** — `/arenas/leaderboard/global`, `/arenas/seasons`, `/arenas/houses` are declared after the `/:id` catch-all; NestJS routes them as battle ID lookups, returning wrong responses | api-report | Low (reorder declarations) |
| **P2-07** | **No rate limiting on auth endpoints** — when `/auth/login` is implemented, the global 100 req/60s throttle is insufficient to prevent brute-force or credential-stuffing | security-report | Low |
| **P2-08** | **CORS `enableCors()` with no origin whitelist** — all origins can make credentialed requests to the API | security-report | Low |
| **P2-09** | **Critical env vars have no startup validation** — `FCM_SERVER_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MEDIA_SCAN_SECRET` being blank produces silent failures with no log | infrastructure-report, security-report | Low |
| **P2-10** | **`pnpm-lock.yaml` may be stale** — Sprint 8 added `voting-core` and `ranking-core` to `apps/api/package.json`; if `pnpm install` was not run after, the Dockerfile `--frozen-lockfile` install fails | dependency-report | Low (run pnpm install) |
| **P2-11** | **No rate limiting on public discovery/search endpoints** — scraping and abuse exposure | api-report | Low |

---

## P3 — Future Improvements (Address in Sprint 9+)

| ID    | Finding                                                       | Report       |
|-------|---------------------------------------------------------------|--------------|
| **P3-01** | Replace `InMemoryEventBus` with Redis Streams adapter for production durability | infrastructure-report |
| **P3-02** | Self-vote enforcement should use a Prisma join on authenticated userId, not a caller-supplied ID | security-report |
| **P3-03** | Remove legacy Sprint 1 `arenas_repository.dart`, `ai_creator_repository.dart`, `feed_repository.dart` — superseded and unreferenced | flutter-report |
| **P3-04** | Create `assets/images/` and `assets/icons/` directories (or remove declarations from `pubspec.yaml`) to eliminate build warning | flutter-report |
| **P3-05** | Add `GET /health` endpoint checking Prisma + Redis connectivity; wire into `docker-compose.yml` api service healthcheck | infrastructure-report |
| **P3-06** | Add `turbo.json` pipeline entries for `typecheck` on `ranking-core` and `voting-core` | dependency-report |
| **P3-07** | `BattleHighlight.clipUrl` is never populated — highlight discovery push is cosmetic until clip generation is wired | api-report |

---

## Sprint 9 Recommended Fix Order

Based on severity and inter-dependencies:

```
Week 1 — P0 Blockers
  1. P0-02  Add http: ^1.2.0 to pubspec.yaml               (30 min)
  2. P0-05  Install livekit-server-sdk, wire real tokens    (2 hr)
  3. P0-03  Add 13 missing COPY lines to Dockerfile         (1 hr)
  4. P2-10  Regenerate pnpm-lock.yaml                       (15 min)
  5. P1-07  Add campaign-core tsconfig.json                 (15 min)
  6. P1-04  Add JWT_SECRET startup validation               (1 hr)
  7. P2-06  Fix battle route ordering                       (30 min)
  8. P0-01  Implement auth register/login/refresh           (1 day)

Week 2 — P1 Persistence
  9. P2-04  Add Prisma models for Sprint 5–7 entities       (1 day)
  10. P1-01  Create migration 20260618000001_sprint5_7_persistence (4 hr)
  11. P1-01  Replace in-memory repos with Prisma adapters   (2 days)

Week 3 — P1 Security + Quality
  12. P1-03  Add @UseGuards to 9 unguarded controllers       (2 hr)
  13. P1-05  Fix self-vote via authenticated userId join     (1 hr)
  14. P1-06  Redis Streams EventBus adapter                  (1 day)
  15. P2-01  Add class-validator to all DTOs                 (1 day)
  16. P2-02  Add ParseUUIDPipe to all @Param('id')           (2 hr)
  17. P2-05  Replace hardcoded user IDs in Flutter screens   (1 hr)
  18. P1-02  Wire jest config for E2E tests                  (2 hr)

Week 4 — P0 Payments + P1 Stubs
  19. P0-04  Wire real payment provider (Paystack minimum)   (3 days)
  20. P1-08  Implement auth/users/stars stubs                (3 days)
```

**Estimated total to reach production-ready: ~3–4 developer-weeks.**

---

## Readiness Score Recap

| Overall Score | Status             |
|---------------|--------------------|
| **54 / 100**  | NOT LAUNCH-READY   |

Score after P0 blockers are resolved (estimated): **~72 / 100 — Private Beta Ready**  
Score after all P1 issues are resolved (estimated): **~88 / 100 — Public Beta Ready**  
Score after all P2 issues are resolved (estimated): **~95 / 100 — Production Ready**
