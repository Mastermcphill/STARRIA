# STARRIA Infrastructure Report
**Audit Date:** 2026-06-18

---

## Docker Compose Overview

| Service    | Image                 | Port  | Health Check         | Status |
|------------|-----------------------|-------|----------------------|--------|
| postgres   | postgres:16-alpine    | 5432  | pg_isready -U starria| ✓ wired |
| redis      | redis:7-alpine        | 6379  | redis-cli ping       | ✓ wired |
| api        | apps/api/Dockerfile   | 3000  | **None**             | ⚠ missing |

`api` depends on both `postgres` and `redis` via `condition: service_healthy`.
PostgreSQL and Redis health checks are correctly configured.

**Missing:** The `api` service has no `healthcheck` block. The `depends_on` guards
ensure Postgres/Redis are up before the API starts, but the API itself is never
health-checked. Kubernetes or downstream orchestrators cannot determine API readiness.

---

## Dockerfile Analysis

The Dockerfile uses a 3-stage multi-stage build (`base → deps → build → runner`).

### COPY Coverage Gap (P0)

The `deps` stage copies package manifests for 17 packages to satisfy the 
workspace graph. However, 12 packages used by `apps/api` are **not copied**:

| Missing from Dockerfile COPY    | Used by API module      |
|---------------------------------|-------------------------|
| `packages/companion-core/`      | companion               |
| `packages/messaging-core/`      | messaging               |
| `packages/patron-core/`         | patrons                 |
| `packages/trust-core/`          | trust                   |
| `packages/ticketing-core/`      | ticketing               |
| `packages/live-core/`           | live                    |
| `packages/age-gate-core/`       | companion               |
| `packages/campaign-core/`       | campaigns               |
| `packages/star-core/`           | prestige                |
| `packages/session-engine-core/` | session-engine          |
| `packages/replay-core/`         | replay                  |
| `packages/voting-core/`         | arenas (Sprint 8)       |
| `packages/ranking-core/`        | arenas (Sprint 8)       |

Without their `package.json` files present, `pnpm install --frozen-lockfile` will
fail because the workspace graph is incomplete. The Docker build fails at the 
`deps` stage — no image is produced.

**Severity: P0** — Docker build is currently broken.

### Lockfile Currency

The Dockerfile uses `--frozen-lockfile`. `voting-core` and `ranking-core` were 
added to `apps/api/package.json` during Sprint 8. If `pnpm-lock.yaml` was not 
regenerated after that change, the frozen install will fail with:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because 
pnpm-lock.yaml is not up to date.
```

**Resolution:** Run `pnpm install` from the workspace root after every new 
`workspace:*` dep addition, then commit the updated lockfile.

---

## Environment Variables

### `.env.example` Coverage

| Variable             | Value in .env.example           | Notes                           |
|----------------------|---------------------------------|---------------------------------|
| `DATABASE_URL`       | `postgresql://...@localhost/...`| ✓                               |
| `REDIS_URL`          | `redis://localhost:6379`        | ✓                               |
| `JWT_SECRET`         | `"change-me-in-production"`     | **P1 — insecure default**       |
| `JWT_EXPIRES_IN`     | `"7d"`                          | ✓                               |
| `LIVEKIT_API_KEY`    | `""`                            | blank — LiveKit non-functional  |
| `LIVEKIT_API_SECRET` | `""`                            | blank                           |
| `LIVEKIT_URL`        | `wss://localhost:7880`          | ✓ placeholder                   |
| `FCM_SERVER_KEY`     | `""`                            | blank — push notifications off  |
| `OPENAI_API_KEY`     | `""`                            | blank — AI generation off       |
| `ANTHROPIC_API_KEY`  | `""`                            | blank                           |
| `MEDIA_SCAN_SECRET`  | `""`                            | blank                           |
| `PORT`               | `3000`                          | ✓                               |
| `API_PREFIX`         | `"api/v1"`                      | ✓                               |

### No Startup Validation

`main.ts` does not validate required secrets at startup. If `JWT_SECRET` is 
`"change-me-in-production"` in production, tokens can be forged by anyone who 
reads the default. If `FCM_SERVER_KEY` / `OPENAI_API_KEY` are blank, features
silently fail with no log.

**Recommendation:** Add a startup guard (NestJS `OnApplicationBootstrap` or a 
`ConfigService` schema with `Joi`) that throws if `JWT_SECRET` equals the default 
string, or if critical keys are blank in `NODE_ENV=production`.

---

## EventBus Durability

`EventBusModule` provides `InMemoryEventBus`. All domain event handlers (gifting, 
wallet deductions, notification fans) are driven by this bus. On process restart 
or crash, any in-flight events are lost.

**Impact in production:** A wallet deduction event that fires after a tap but before
the corresponding wallet entry handler processes it will be silently dropped — coins
deducted, credits never issued.

**Severity: P1.**

**Resolution (Sprint 9):** Replace `InMemoryEventBus` with a Redis Streams adapter.
The `REDIS_CLIENT` token is already globally provided — the adapter is a 30-line 
implementation against the existing `EventBus` interface.

---

## Payment Providers

All three payment integrations are stubs:

| Provider    | File                                  | Status                          |
|-------------|---------------------------------------|---------------------------------|
| Paystack    | `coin-purchase/paystack.adapter.ts`   | Returns `{status:'success', ref:'stub-...'}`  |
| Apple Pay   | `coin-purchase/apple-pay.adapter.ts`  | Returns identical stub payload  |
| Google Pay  | `coin-purchase/google-pay.adapter.ts` | Returns identical stub payload  |

No real HTTP calls are made to any payment provider. Every coin purchase "succeeds"
unconditionally — coins are credited without any real money movement.

**Severity: P0** — zero real revenue is possible until at least one provider is wired.

---

## LiveKit Server SDK

`livekit-server-sdk` is not declared in `apps/api/package.json`. The 
`LiveKitAdapterService` generates tokens using a manual JWT construction instead
of the SDK:

```typescript
// livekit-adapter.service.ts
return `stub-livekit-token-${Date.now()}`;
```

Tokens returned by `POST /live/token` cannot authenticate with a real LiveKit
server — rooms will reject them.

**Severity: P0.**

**Resolution:** 
1. `pnpm add livekit-server-sdk` in `apps/api`
2. Replace the stub with `new AccessToken(apiKey, apiSecret, { identity }).addGrant({roomJoin: true, room}).toJwt()`

---

## Infra / Postgres Init

`infra/postgres/init.sql` creates extensions (`uuid-ossp`, `pg_trgm`) required
by the Prisma schema. This file is correctly volume-mounted in `docker-compose.yml`
at `docker-entrypoint-initdb.d/init.sql`.

The `migration_lock.toml` specifies `provider = "postgresql"`. All 8 migration 
files are additive SQL. `prisma migrate deploy` will succeed when pointed at a 
clean PostgreSQL 16 instance.

---

## Missing Health Check Endpoint

`docker-compose.yml` has no `healthcheck` for the `api` service. Additionally,
there is no `GET /health` route in any NestJS controller.

A health check that verifies Prisma connectivity and Redis reachability would 
allow both the Compose healthcheck and Kubernetes readiness probes to confirm 
the service is accepting traffic before routing is enabled.

**Severity: P3.**

---

## Infrastructure Readiness Summary

| Component                    | Status     | Severity |
|------------------------------|------------|----------|
| PostgreSQL container         | ✓ ready    | —        |
| Redis container              | ✓ ready    | —        |
| docker-compose healthchecks  | ✓ Pg+Redis | —        |
| Prisma migrations            | ✓ deployable | —      |
| Docker build (missing COPY)  | ✗ broken   | **P0**   |
| Payment providers            | ✗ stubs    | **P0**   |
| LiveKit SDK                  | ✗ stub     | **P0**   |
| EventBus durability          | ✗ in-memory | **P1** |
| JWT_SECRET startup validation| ✗ missing  | **P1**   |
| API health check endpoint    | ✗ missing  | P3       |
| CORS origin whitelist        | ✗ open     | P2       |
