# STARRIA Deployment Guide
**Date:** 2026-06-18
**Track:** H — Production Readiness

End-to-end guide for deploying STARRIA (NestJS API + PostgreSQL + Redis, with the
Flutter mobile client shipped separately to the app stores).

---

## 1. Prerequisites

| Component   | Version | Notes                              |
|-------------|---------|------------------------------------|
| Node.js     | 20 LTS  | Docker image uses `node:20-alpine` |
| pnpm        | 9.x     | `corepack enable` or `npm i -g pnpm@9` |
| PostgreSQL  | 16      | `pgcrypto` / `uuid-ossp` via init.sql |
| Redis       | 7       | append-only mode on                |
| Docker      | 24+     | compose v2                         |

---

## 2. Environment Variables

Copy `.env.example` → `.env` and set every value. **Production-critical:**

| Var                      | Requirement |
|--------------------------|-------------|
| `JWT_SECRET`             | ≥32 random chars (`openssl rand -hex 32`). Boot fails if default/weak. |
| `JWT_REFRESH_SECRET`     | distinct ≥32 chars (defaults to `${JWT_SECRET}:refresh` if blank) |
| `DATABASE_URL`           | required |
| `REDIS_URL`              | required |
| `CORS_ORIGINS`           | comma-separated allowlist; empty in prod = no cross-origin |
| `EVENT_BUS_DRIVER`       | `redis` in prod (durable); defaults to redis when `NODE_ENV=production` |
| `PAYSTACK_SECRET_KEY`    | required for real payments |
| `PAYSTACK_WEBHOOK_SECRET`| required to verify webhooks |
| `LIVEKIT_API_KEY/SECRET/HOST` | required for live rooms |

`main.ts` runs `validateProductionConfig()` at boot and **refuses to start** in
production with a missing/weak `JWT_SECRET`, `DATABASE_URL`, or `REDIS_URL`.

---

## 3. First-Time Build (clean clone)

```bash
pnpm install                                   # links all 30 workspace packages
pnpm --filter @starria/api db:generate         # Prisma client
pnpm exec turbo run build --filter=@starria/api
```

> If `pnpm install` reports lockfile drift, run `pnpm install` once without
> `--frozen-lockfile` to regenerate `pnpm-lock.yaml`, then commit it.

---

## 4. Database Migrations Pipeline

Migrations live in `apps/api/prisma/migrations/` and are applied with:

```bash
# Production / CI — applies committed migrations, never generates:
pnpm --filter @starria/api exec prisma migrate deploy

# Local development — create + apply a new migration:
pnpm --filter @starria/api exec prisma migrate dev --name <change>
```

**Recommended CI ordering** (e.g. in the release job, before traffic cutover):

1. `prisma migrate deploy` against the production DB (additive migrations only).
2. Roll out the new API image.
3. Health-gate on `/api/v1/health/ready` before shifting traffic.

> ⚠️ Persistence gap: Sprint 5–7 modules (companion, messaging, presence, trust,
> patron, replay, session-engine) still use in-memory repositories — see
> launch-readiness-report.md → Remaining Work. Their data is **not** yet covered
> by migrations and is lost on restart. Do not launch those features to
> production until the Prisma persistence migration lands.

---

## 5. Docker Compose Deployment

```bash
docker compose up -d postgres redis      # start data stores
# wait for healthchecks to pass
docker compose up --build -d api         # build + run API
docker compose ps                         # all services healthy
curl localhost:3000/api/v1/health         # {"status":"ok"}
curl localhost:3000/api/v1/health/ready   # {"status":"ok","checks":{...}}
```

The `api` service has a `healthcheck` (node http probe on `/api/v1/health`,
`start_period: 30s`). `postgres` and `redis` have `pg_isready` / `redis-cli ping`
healthchecks, and `api` `depends_on` both being healthy.

---

## 6. Health Checks & Probes

| Endpoint              | Use                          | Auth   |
|-----------------------|------------------------------|--------|
| `GET /api/v1/health`       | Liveness (process up)    | public |
| `GET /api/v1/health/ready` | Readiness (DB + Redis)   | public |

Kubernetes example:

```yaml
livenessProbe:
  httpGet: { path: /api/v1/health, port: 3000 }
  initialDelaySeconds: 20
readinessProbe:
  httpGet: { path: /api/v1/health/ready, port: 3000 }
  periodSeconds: 10
```

---

## 7. Observability (current state + recommendations)

| Concern         | Current                                  | Recommended next |
|-----------------|------------------------------------------|------------------|
| Logging         | Fastify built-in logger (`logger: true`) | ship JSON logs to Loki/CloudWatch; add request-id |
| Metrics         | none                                     | add `@willsoto/nestjs-prometheus` + `/metrics` |
| Crash reporting | none                                     | Sentry (`@sentry/node`) in `main.ts` bootstrap |
| Tracing         | none                                     | OpenTelemetry SDK + OTLP exporter |
| Event durability| ✅ Redis Streams bus (prod)              | add a dead-letter stream + PEL claim job |

> Logging/metrics/Sentry are **not yet wired** — they are documented here as the
> required Track H follow-up. The durable event bus (Redis Streams) and health
> probes are done.

---

## 8. Backups

| Store     | Strategy |
|-----------|----------|
| PostgreSQL | Nightly `pg_dump` (or managed PITR snapshots). Test restores monthly. The `postgres_data` named volume is **not** a backup. |
| Redis      | AOF is on (`--appendonly yes`). For the event stream, snapshot RDB hourly; the stream is capped at `MAXLEN ~100000`. |

Suggested cron (managed DB preferred over self-rolled):

```bash
0 2 * * *  pg_dump "$DATABASE_URL" | gzip > /backups/starria-$(date +\%F).sql.gz
```

---

## 9. Rollback

- **API:** redeploy the previous image tag; migrations are additive (no down
  migrations) so the prior image remains schema-compatible.
- **Migrations:** never `migrate reset` in production. To revert a bad additive
  migration, ship a new forward migration.

---

## 10. Pre-Launch Checklist

- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` set to strong unique values
- [ ] `CORS_ORIGINS` set to real client origins
- [ ] `PAYSTACK_*` live keys + webhook secret configured
- [ ] `LIVEKIT_*` configured and a real LiveKit server reachable
- [ ] `prisma migrate deploy` run; DB reachable
- [ ] `/health/ready` returns `ok`
- [ ] Sprint 5–7 persistence migration landed (or those features feature-flagged off)
- [ ] Sentry / metrics / structured logging wired
- [ ] `pnpm-lock.yaml` committed and `--frozen-lockfile` install verified in CI
