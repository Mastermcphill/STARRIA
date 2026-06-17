# Docker / Build / Runtime Fixes — Implementation Report

Status: **✅ Image builds and the backend boots and serves requests** (verified via `docker compose up`).

Scope was infrastructure/build/runtime only. No business logic was changed. Where
latent code defects blocked the build, the minimal type-level/config fix was applied
(documented below).

---

## 1. Changed files

### Docker / compose / workspace
| File | Change |
|---|---|
| `apps/api/Dockerfile` | Rewritten: copy **all** workspace manifests before install; `prisma generate` → `turbo build` (dependency-aware, generate-first); runtime-complete runner stage (carries built packages + pnpm store + generated client); added `openssl`/`libc6-compat` for Prisma on Alpine; removed external `# syntax` frontend directive |
| `docker-compose.yml` | Removed source bind-mounts on `api` (they shadowed the built `dist/`); added container-network `DATABASE_URL`/`REDIS_URL`/`NODE_ENV`; removed obsolete `version` key |
| `.dockerignore` | **New** — keeps host `node_modules`/`dist` out of the build context (reproducible installs) |
| `apps/api/package.json` | Added missing runtime deps: `@starria/support-core` (imported but undeclared) and `@fastify/static` (required by Swagger UI on Fastify) |
| `apps/api/tsconfig.json` | Removed `paths` override that forced recompiling package **source** (now consumes built `dist` + `.d.ts`); excluded unwired `src/adapters/prisma/**` stubs |
| `pnpm-lock.yaml` | Regenerated for the two new deps (`pnpm install --lockfile-only`) |

### Package build strategy — `main`/`types` → `dist` (task 3)
Flipped from `src/index.ts` to `dist/index.js` + `dist/index.d.ts` (build script already present, emits declarations via `tsconfig.base.json` `declaration: true`):
`domain-events`, `support-core`, `star-core`, `event-core`, `arena-core`, `creator-os-core`, `tap-core`, `geo-core`, `video-core`, `search-core`, `discovery-core`.

### Package tsconfig normalization (task 3/4)
6 packages had a stripped tsconfig (`{ extends, include: ["src"] }`) with **no `outDir`/`rootDir`**, so `tsc` emitted next to source instead of `dist/` — leaving `main: dist/index.js` dangling. Normalized to `outDir: dist` / `rootDir: src`:
`gifting-core`, `wallet-core`, `feed-core`, `notification-core`, `moderation-core`, `analytics-core`.

### Build-blocker fixes (latent defects surfaced by actually compiling)
| File | Fix |
|---|---|
| `packages/domain-events/src/bus.ts` | `NoopEventBus` methods made generic to satisfy `EventBus`; relaxed `publish`/`subscribe`/`EventHandler` to `DomainEvent<any>` so typed event payloads (interfaces) are accepted |
| `apps/api/src/adapters/redis-event-bus.adapter.ts` | `publish(event: DomainEvent<any>)` to match the contract |
| `apps/api/src/modules/discovery/discovery.controller.ts` | Renamed duplicate identifier — private field `local` → `localDiscovery` (collided with the `@Get('local')` method) |
| `apps/api/prisma/schema.prisma` | `ContentIndex.contentId @unique` — the `Event`↔`ContentIndex` 1:1 relation was invalid (`P1012`), blocking `prisma generate` entirely |
| `packages/wallet-core/src/ports.ts` | **Deleted** — orphaned/broken duplicate of `balance-store.ts` (not exported from the index; imported a non-existent `WalletBalance`) |

---

## 2. Build log summary

`docker build -f apps/api/Dockerfile` iterations (each surfaced the next latent blocker):

1. **deps install** — now passes once all 17 package manifests are copied + lockfile regenerated (`Scope: all 19 workspace projects`).
2. `domain-events` TS2416 — `NoopEventBus` signature → fixed.
3. `video-core` TS2345 + `wallet-core` TS2305 — typed-event payloads / orphaned `ports.ts` → fixed.
4. API TS6059 (`rootDir`) — `tsconfig` `paths` recompiling package source → removed mapping.
5. API TS2305 (`@prisma/client` has no model exports) — `prisma generate` ran after build → reordered generate-first.
6. `prisma generate` `P1012` — invalid 1:1 relation → `@unique`.
7. API TS2307/TS2344/TS2300 — non-emitting package tsconfigs, `EventBus` generic constraint, duplicate `local` → fixed; prisma stubs excluded.
8. **Final:** `Tasks: 13 successful, 13 total` → image exported `starria-api:verify`.

---

## 3. Runtime verification report

`docker compose up -d` (postgres + redis + api):

```
starria-postgres  Up (healthy)
starria-redis     Up (healthy)
starria-api       Up   0.0.0.0:3000->3000/tcp
```

API logs:
```
[InstanceLoader] <all 22 modules> dependencies initialized   ← no MODULE_NOT_FOUND
[RouterExplorer] Mapped {/api/v1/discovery/feed, GET} … (+ video, watch, content-taps, search, wallet, gifting, supporters)
[DiscoveryListeners] Discovery re-scoring listeners registered
[SupportGraphListeners] SupportGraph event listeners registered
[TapAggregationJob] TapAggregationJob scheduled every 60s
[NestApplication] Nest application successfully started
Server listening at http://0.0.0.0:3000
```

HTTP smoke test (data served from the `@starria/discovery-core` package's built `dist`):
```
GET /api/v1/discovery/genres  → HTTP 200
[{"genre":"COMEDY","label":"Comedy"}, … 8 genres]
```

`@prisma/client` loads (PrismaModule initialized, `$connect` to the healthy postgres succeeds). No dangling pnpm symlinks; every `@starria/*` import resolves at runtime.

---

## 4. Remaining TODOs

1. **DB migrations on deploy** — the app boots and connects, but tables aren't created. Add a startup step (entrypoint or compose `command`) running `prisma migrate deploy` before `node dist/main.js`, or a one-shot migration job. Until then, data endpoints will error against an empty schema.
2. **Migration for `ContentIndex.contentId @unique`** — the schema fix needs a matching migration (`ALTER TABLE "ContentIndex" ADD CONSTRAINT "ContentIndex_contentId_key" UNIQUE ("contentId");`). Not yet added to `prisma/migrations/`.
3. **Re-include `src/adapters/prisma/**` stubs** — currently excluded from the build (unwired, with latent Prisma `Json` typing gaps: `Record<string, unknown>` → `Prisma.InputJsonValue`). Fix typings and remove the tsconfig exclusion when these repositories are wired into modules.
4. **Production image size** — the runner copies the full `node_modules` (incl. dev deps) + package `src`. Switch to `pnpm deploy --prod` (or prune dev deps + copy only `dist`) for a lean image.
5. **Swagger in production** — `@fastify/static` was added so Swagger UI serves; consider gating `SwaggerModule.setup()` behind a non-production check.
6. **CI full build** — `star-core`, `event-core`, `arena-core`, `tap-core`, `creator-os-core` now build to `dist` but are outside the API's dependency closure, so they aren't exercised by this image. Run repo-wide `pnpm build` / `turbo run build` in CI to validate them.
7. **NestJS 11** — out of scope; the repo remains on Nest 10 (consistent across `@nestjs/*` + `@nestjs/cli`). Upgrade as a coordinated set (core/common/platform-fastify/cli@11 + fastify@5 + throttler@6 + swagger@8) if/when desired.
8. **Commit the regenerated `pnpm-lock.yaml`** — required for the Docker `--frozen-lockfile` install to succeed in CI.
