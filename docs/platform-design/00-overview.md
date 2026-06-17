# STARRIA Platform Package Design — Overview

## Purpose

This directory documents the design of five new **STARRIA-native** packages that sit
on top of the six extracted packages from LifeNest and three from Vidzi.

The extracted packages provide **generic infrastructure** (wallet ledger, gifting engine,
feed, notifications, moderation, analytics, video, search). The new packages provide
**domain semantics**: what a Star is, what a Tap means in STARRIA, how Arenas work.

---

## Package Map

```
INFRASTRUCTURE LAYER (extracted)               DOMAIN LAYER (new)
────────────────────────────────               ──────────────────
@starria/wallet-core  ──────────────────────▶  @starria/tap-core
@starria/gifting-core ──────────────────────▶  @starria/tap-core
@starria/feed-core ─────────────────────────▶  (wired in apps/api)
@starria/notification-core ─────────────────▶  all five (via port)
@starria/moderation-core ───────────────────▶  @starria/arena-core
@starria/analytics-core ────────────────────▶  @starria/tap-core
                                               @starria/event-core
                                               @starria/arena-core
video-core (Python) ────────────────────────▶  @starria/event-core (via port)
search-core (Python) ───────────────────────▶  @starria/event-core (via port)
                                               @starria/star-core (via port)
```

## New packages

| Package | Description |
|---|---|
| [`@starria/support-core`](./01-support-core.md) | Supporter profiles, tier progression, subscriptions |
| [`@starria/star-core`](./02-star-core.md) | Star profiles, tiers, discovery, verification, follows |
| [`@starria/tap-core`](./03-tap-core.md) | Tap (micropayment) orchestration — wraps gifting-core |
| [`@starria/event-core`](./04-event-core.md) | Event lifecycle, replays, watch sessions |
| [`@starria/arena-core`](./05-arena-core.md) | Arena rooms, participants, LiveKit integration |

## Design principles (same as extracted packages)

1. **No NestJS decorators.** All packages export plain TypeScript classes + interfaces.
2. **No Prisma.** All persistence is behind port interfaces.
3. **Port interface pattern.** Every external dependency (DB, push, LiveKit, analytics) is injected through a named interface.
4. **Idempotency.** Every write operation that can be retried carries an `idempotencyKey`.
5. **Fire-and-forget side-effects.** Notifications, analytics, and search index updates are `void` calls; they do not block the primary operation.
6. **Zero runtime `dependencies`.** New packages only list extracted packages as deps where they import concrete types (e.g. `tap-core → gifting-core`); all other relationships are through port interfaces with no hard package dep.

## Documents in this directory

| File | Contents |
|---|---|
| `01-support-core.md` | Package design, schema, APIs, ports, migration |
| `02-star-core.md` | Package design, schema, APIs, ports, migration |
| `03-tap-core.md` | Package design, schema, APIs, ports, migration |
| `04-event-core.md` | Package design, schema, APIs, ports, migration |
| `05-arena-core.md` | Package design, schema, APIs, ports, migration |
| `06-dependency-graph.md` | Complete inter-package dependency graph |
| `07-database-schema.md` | All new Prisma model additions |
| `08-api-contracts.md` | All new HTTP endpoints with request/response shapes |
| `09-migration-docs.md` | Prisma migrations and data backfill strategy |
