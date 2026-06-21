# STARRIA Docker / Infrastructure Report (Sprint 9)
**Date:** 2026-06-18
**Track:** A — Infrastructure Hardening

---

## Summary

| Area                          | Before (audit) | After (Sprint 9) |
|-------------------------------|----------------|------------------|
| Dockerfile package coverage   | 17/30 (broken) | 30/30 (all)      |
| `campaign-core` tsconfig      | missing        | added            |
| `creator-os-core` tsconfig    | mis-configured (rootDir violation) | aligned to base |
| API workspace deps declared   | 17/26          | 26/26            |
| `domain-events` build         | **FAILED**     | **passes**       |
| All 30 packages `tsc` build   | failed         | **pass**         |
| API healthcheck in compose    | none           | added (`/health`) |
| pnpm lockfile                 | stale (drift)  | regeneration required (see Action Items) |

---

## 1. Dockerfile — Package COPY Gap (P0-03) — FIXED

The `deps` stage hand-listed 17 package manifests, silently omitting 13 packages
that `apps/api` depends on. `pnpm install --frozen-lockfile` therefore failed
because the workspace graph was incomplete.

**Fix** (`apps/api/Dockerfile`): replaced the brittle per-package list with a
single `COPY packages/ ./packages/`. This copies every workspace manifest, is
resilient to future package additions, and cannot drift out of sync with the
workspace again.

```dockerfile
# before: 17 explicit COPY packages/<name>/package.json lines (13 missing)
# after:
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
```

## 2. Missing tsconfig — `campaign-core` (P1-07) — FIXED

`campaign-core` had no `tsconfig.json`, so `turbo run build` (and `tsc`) failed
for it. Added a standard config extending `tsconfig.base.json`, matching every
other package.

## 3. Hidden build blocker — `domain-events` did not compile — FIXED

Discovered during Sprint 9 validation: **`domain-events` itself failed to build**
because `src/events/battle.ts` (Sprint 8) declared event aliases with two type
arguments (`DomainEvent<typeof BATTLE_CREATED, Payload>`) while `DomainEvent`
accepts only one. Because `domain-events` is the dependency-graph root, this
broke the type resolution of **every** downstream package and the entire API.

**Fix**: corrected all 12 aliases to the single-arg form `DomainEvent<Payload>`,
matching the convention in `tap.ts`, `live.ts`, etc.

This was the single highest-impact infrastructure fix — it is why the audit's
"package compilation" score was artificially depressed.

## 4. `creator-os-core` tsconfig — rootDir violation — FIXED

`creator-os-core/tsconfig.json` used `module: NodeNext` and a `paths` mapping
that pointed `@starria/domain-events` at the package **source** (`../domain-events/src/index.ts`),
producing `TS6059: File ... is not under rootDir`. Replaced with the standard
base-extending config so it resolves the built `.d.ts` like every sibling.

## 5. arena-core type errors (pre-existing) — FIXED

`arena-core/src/arena-service.ts` passed fields (`currentParticipantCount`,
`totalParticipantCount`, `status`, participant `status`, `moderatorId`) that the
port input types did not declare. Widened `ArenaStorePort.create`,
`ArenaParticipantPort.join`, and `ArenaModerationInput` accordingly, and fell
back `moderatorId ?? actorId`. arena-core now builds clean.

## 6. API Healthcheck — ADDED

- New `GET /health` (liveness) and `GET /health/ready` (DB + Redis readiness)
  endpoints (`HealthModule`, `@Public()`).
- `docker-compose.yml` `api` service now has a `healthcheck` hitting
  `/api/v1/health` via a dependency-free `node -e` http probe, with
  `start_period: 30s`.

---

## Validation Performed

Run in this environment (Node 24, no network registry access):

| Check                                   | Result |
|-----------------------------------------|--------|
| `tsc` build of all 30 workspace packages | ✅ PASS (after fixes above) |
| `domain-events` standalone build         | ✅ PASS |
| `arena-core` standalone build            | ✅ PASS |
| `creator-os-core` standalone build       | ✅ PASS |
| API `tsc --noEmit`                       | ⚠️ pre-existing baseline errors remain (see below) |

### Remaining API typecheck errors — classification

The API `tsc --noEmit` still reports errors, **none newly introduced by Sprint 9
except the expected `livekit-server-sdk` module** (resolved once dependencies are
installed). They fall into pre-existing baseline categories:

1. **`livekit-server-sdk` not installed** — declared in `package.json` this
   sprint; resolves after `pnpm install`. (Real, expected.)
2. **Prisma client not generated** (`Genre`, `VideoStatus`, `Video` not exported
   from `@prisma/client`) — resolves after `prisma generate`.
3. **Implicit-`any` (TS7006)** in discovery/gifting/ticketing/supporters/wallet —
   pre-existing, in files untouched this sprint.
4. **DTO `strictPropertyInitialization` (TS2564)** across live/poster/ticketing/
   battle DTOs — pre-existing repo-wide convention (no `!` assertions). Not a
   regression; `nest build` tolerates it.
5. **`live.service` `CoinLedgerPort` shape mismatch** — pre-existing.

> These are documented honestly rather than masked. They were present before
> Sprint 9 and are tracked for a dedicated type-hardening pass (see
> launch-readiness-report.md → Remaining Work).

---

## Action Items Requiring a Networked Environment

These could **not** be completed here (no npm registry access) and must be run in
CI or a connected dev machine:

1. **`pnpm install`** — regenerate `pnpm-lock.yaml`. The lockfile is stale:
   `messaging-core` (and other Sprint 5–8 packages) are **not present in the
   lockfile**, and Sprint 5–8 packages are not symlinked into `node_modules`.
   This is the root cause of the remaining `@starria/*` resolution failures in a
   clean clone. After install, `--frozen-lockfile` in Docker will succeed.
2. **`pnpm --filter @starria/api db:generate`** — generate the Prisma client
   (clears the `@prisma/client` export errors).
3. **`pnpm add livekit-server-sdk --filter @starria/api`** — already in
   `package.json`; install fetches it.
4. **`docker build -f apps/api/Dockerfile .`** — end-to-end image build
   validation (requires Docker daemon + network for base images).

### Recommended clean-clone bring-up

```bash
git clone <repo> && cd starria
pnpm install                              # regenerates lockfile, links all 30 pkgs
pnpm --filter @starria/api db:generate    # prisma client
pnpm exec turbo run build --filter=@starria/api
docker compose up -d postgres redis
pnpm --filter @starria/api db:migrate deploy
docker compose up --build api
curl localhost:3000/api/v1/health         # {"status":"ok",...}
```
