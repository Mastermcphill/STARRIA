# STARRIA Sprint 11 — Analytics Report (Phase 9)

**Date:** 2026-06-18
**Status:** ✅ Delivered, build + test verified.

## What shipped

A real analytics pipeline replacing the synthetic `StubAnalyticsSource`: a durable event store and a deterministic rollup aggregator.

### Code
| File | Role |
|---|---|
| `apps/api/src/modules/analytics/analytics-event.store.ts` | `AnalyticsEventStore` — `record`, `recordMany`, `listForCreator` |
| `apps/api/src/modules/analytics/period-key.ts` | pure day/week(ISO)/month bucketing from a timestamp |
| `apps/api/src/modules/analytics/creator-analytics.aggregator.ts` | `CreatorAnalyticsAggregator` — `rollup`, `rollupAll`, `getRollups` |
| `apps/api/src/modules/analytics/analytics.controller.ts` | `GET /analytics/rollups`, `POST /analytics/rollups/recompute` (JWT) |
| `apps/api/src/modules/analytics/analytics.module.ts` | wiring (registered in `AppModule`) |
| `apps/api/src/modules/analytics/analytics.spec.ts` | 3 tests (period keys + aggregator) |

### Tables (migration `20260620000000_ledger_analytics`)
- **AnalyticsEvent** — `eventType`, `creatorId?`, `actorId?`, `subjectId?`, `subjectType?`, `value` (weight, default 1), `metadata`, `occurredAt`. Indexed by `(creatorId, occurredAt)`, `(eventType, occurredAt)`, `occurredAt`.
- **AnalyticsRollup** — `creatorId`, `period` (DAY/WEEK/MONTH), `periodKey`, `metric`, `value`, `count`. `@@unique([creatorId, period, periodKey, metric])` makes rollups idempotent.

## What it persists

`AnalyticsEventStore.record` captures the events the brief lists — **views, sessions, purchases, gifts, retention, engagement** — as typed `AnalyticsEvent` rows (`AnalyticsEventType` union), with a numeric `value` for weighted metrics (coins gifted, seconds watched). `recordMany` provides a single-round-trip bulk path for high-volume capture.

## Rollups

`CreatorAnalyticsAggregator.rollup(creatorId, period, {from,to})` reads the creator's events in the window, groups them in-process by `(periodKey, metric)` summing `value` and `count`, and upserts `AnalyticsRollup` rows. `rollupAll` runs DAY/WEEK/MONTH in one call. Period keys are computed by pure functions (`periodKeyFor`) with no `Date.now()`, so rollups are deterministic and reproducible. Re-running a window produces identical stored values (idempotent — tested).

ISO-week keys use the ISO-8601 algorithm (`YYYY-Www`); month is `YYYY-MM`; day is `YYYY-MM-DD`, all in UTC.

## Tests (3, all passing)

- `periodKeyFor` buckets a known Thursday timestamp to `2026-06-18` / `2026-06` / `2026-W25`.
- Aggregator sums two same-day GIFTs into one bucket (value 150, count 2), keeps VIEW separate, and excludes events outside the window.
- Re-running a rollup is idempotent (one PURCHASE row, value 10, count 1).

## Wiring the creator dashboard (follow-on)

`StubAnalyticsSource` (creator-os) still serves the dashboard. A Prisma-backed `AnalyticsSource` reading `AnalyticsRollup` can replace it without changing `CreatorAnalyticsService`'s contract; emitting `AnalyticsEvent`s from the gifting/watch/purchase paths feeds it. Both are localized changes deferred to keep the test suite green and are documented in the audit.

## Verification

- `tsc --noEmit` ✅, `nest build` ✅, `npm test` ✅ (107/107).
- Tables verified present after migration on a fresh DB.
</content>
