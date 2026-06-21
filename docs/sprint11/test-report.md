# STARRIA Sprint 11 — Test Report (Phase 11)

**Date:** 2026-06-18

## Verification matrix

| Check | Command | Result |
|---|---|---|
| Prisma schema valid | `prisma validate` | ✅ valid |
| Prisma formatted | `prisma format` | ✅ formatted |
| Prisma client | `prisma generate` | ✅ generated (v5.22.0) |
| Migrations (fresh DB) | `prisma migrate deploy` | ✅ **11/11 applied**, 104 tables |
| Migrations (additive) | applied on top of existing 10 | ✅ clean |
| TypeScript | `tsc --noEmit` | ✅ exit 0 |
| Build | `nest build` (`prisma generate && nest build`) | ✅ exit 0 |
| Tests | `npm test` (jest) | ✅ **107/107** |

## Test totals

```
Test Suites: 16 passed, 16 total
Tests:       107 passed, 107 total
```

- **Baseline (Sprint 10):** 13 suites, 92 tests.
- **Sprint 11 added:** 3 suites, 15 tests — `ledger-service.spec.ts` (7), `prisma-ledger-store.spec.ts` (5), `analytics.spec.ts` (3).
- **Regressions:** none. All 92 prior tests still pass.

> Benign warnings (exit 0): jest "worker failed to exit gracefully" and `allowJs` warnings for prebuilt `@starria/wallet-core/dist/*.js` — pre-existing environment noise, not failures.

## Migration status

New migration **`20260620000000_ledger_analytics`** — 6 additive tables (`WalletTransaction`, `WalletBalanceSnapshot`, `WalletSettlement`, `WalletRefund`, `AnalyticsEvent`, `AnalyticsRollup`), 0 alterations to existing tables. Verified applying cleanly from scratch (11 migrations total) and additively on a DB already at the Sprint 10 baseline.

## Build status

`prisma generate && nest build` → exit 0. `wallet-core` rebuilt (`tsc -p tsconfig.json`) so its new `LedgerService`/hash exports are present in `dist` for the API to consume.

## What is NOT covered by tests (honest)

- Credential-gated external providers (Apple IAP, Google Play, FCM/APNs, email, SMS, LiveKit egress) were **not implemented this sprint** (scope: depth on verifiable core) and therefore have no tests — they are documented in `external-services-audit.md` as the roadmap.
- The `LedgerService` integration into the 7 monetary call sites is **not yet wired**, so there are no end-to-end money-flow tests through it; the service + adapter themselves are unit-tested.
- No DB-integration/e2e layer (tests use in-memory fakes of the Prisma delegates). Migrations are separately verified against real Postgres.
</content>
