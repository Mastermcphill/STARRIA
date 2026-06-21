# STARRIA Sprint 11 — Infrastructure Report (Phase 10)

**Date:** 2026-06-18
**Status:** ✅ Delivered, build verified.

## Health endpoints

`apps/api/src/modules/health/health.controller.ts` (all `@Public()`):

| Endpoint | Purpose | Behaviour |
|---|---|---|
| `GET /health` | liveness | `{ status: 'ok', uptime }` |
| `GET /health/live` | liveness alias (k8s) | `{ status: 'ok', uptime }` |
| `GET /health/ready` | readiness | pings **PostgreSQL** (`SELECT 1`) and **Redis** (`PING`); reports `status: ok\|degraded`. Also reports external-integration **config presence** (LiveKit, Paystack, FCM, Apple IAP, Google Play) for observability — these do *not* gate readiness (a live ping would couple pod readiness to third-party uptime). |

Hard dependencies (DB, Redis) determine readiness; external integrations are reported as `configured` / `unconfigured`.

## Startup validation

`apps/api/src/main.ts`:
- **Pre-existing:** `validateProductionConfig()` aborts boot in production if `JWT_SECRET` is missing/weak (<32 chars / default), or `DATABASE_URL` / `REDIS_URL` are unset; warns if `CORS_ORIGINS` unset.
- **Added this sprint:** `verifyCriticalDependencies(app)` runs right after app creation and **pings PostgreSQL and Redis**. In production an unreachable hard dependency throws and aborts boot (so the orchestrator never routes traffic to a broken pod); in development it logs a warning so local work without infra is still possible.

Fail-fast matrix (production):
- JWT secret missing/weak → **boot aborts** ✅
- `DATABASE_URL` / `REDIS_URL` unset → **boot aborts** ✅
- Database unreachable → **boot aborts** (`verifyCriticalDependencies`) ✅
- Redis unreachable → **boot aborts** ✅

## Docker health checks

- **Image-level** (`apps/api/Dockerfile`): added `HEALTHCHECK` hitting `/<API_PREFIX>/health/live` via an inline Node HTTP request (alpine has no curl), `interval=15s timeout=5s start-period=30s retries=5`.
- **Compose-level** (`docker-compose.yml`, pre-existing): api service health check hitting `/api/v1/health`; `postgres` and `redis` services have their own health checks and the api `depends_on` them with `condition: service_healthy`.

## Already-real infrastructure (confirmed, unchanged)

- **EventBus:** `RedisStreamsEventBus` — durable Redis Stream consumer group, at-least-once, per-pod consumer name, `MAXLEN` trim, graceful in-process fallback.
- **Auth:** global `JwtAuthGuard` (`APP_GUARD`), `@Public()` opt-out; global `ThrottlerGuard` (100 req/60s).
- **CORS:** locked-down allowlist via `CORS_ORIGINS` (prod default: no cross-origin).

## Verification

- `tsc --noEmit` ✅, `nest build` ✅, `npm test` ✅ (107/107).
- Health controller compiles with `ConfigService` injection; no DB needed for `/health/live`.
</content>
