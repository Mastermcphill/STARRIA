# STARRIA Sprint 11 — Ledger Report (Phase 2)

**Date:** 2026-06-18
**Status:** ✅ Delivered, build + test verified.

## What shipped

A framework-agnostic, double-entry `LedgerService` in `packages/wallet-core`, backed by an atomic Prisma adapter and four new immutable tables. Money cannot move without a balanced, hash-chained posting.

### Code
| File | Role |
|---|---|
| `packages/wallet-core/src/ledger-service.ts` | `LedgerService` (pure) + `LedgerStorePort` + posting/result types. Capabilities: `credit`, `debit`, `reserve`, `release`, `settle`, `refund`, `balance`. |
| `packages/wallet-core/src/index.ts` | exports the new service/types |
| `apps/api/src/modules/wallet/prisma-ledger-store.ts` | `PrismaLedgerStore` — atomic, serializable adapter implementing `LedgerStorePort` |
| `apps/api/src/modules/wallet/ledger.module.ts` | `LedgerModule` — provides `LedgerService` (DI), exported app-wide |
| `apps/api/src/modules/wallet/ledger-service.spec.ts` | 7 tests — pure double-entry logic |
| `apps/api/src/modules/wallet/prisma-ledger-store.spec.ts` | 5 tests — adapter (snapshots, hashing, settlement/refund, dedupe, insufficiency) |

### Tables (migration `20260620000000_ledger_analytics`)
- **WalletTransaction** — immutable, hash-chained postings, one row per leg. `@@unique([idempotencyKey, accountId, sub, direction])` blocks duplicate legs; indexed by key/posting/account/reference.
- **WalletBalanceSnapshot** — materialized `available` + `reserved` + `version` per `(accountId, currency)` (composite PK).
- **WalletSettlement** — one row per `settle` (payer, recipient, gross, platformFee, recipientAmount, platformPercentage). `idempotencyKey @unique`.
- **WalletRefund** — one row per `refund` (originalReference, payer, amount). `idempotencyKey @unique`.

## Accounting model

Each account has two sub-ledgers: **available** (spendable) and **reserved** (escrow hold). Every operation emits a **balanced posting** — the sum of credit legs equals the sum of debit legs — enforced in `assertBalanced` before persistence.

| Op | Legs | Effect |
|---|---|---|
| `credit` | +account.available, −external.available | cash-in |
| `debit` | −account.available, +external.available | cash-out (requires available ≥ amount) |
| `reserve` | −account.available, +account.reserved | place escrow hold |
| `release` | −account.reserved, +account.available | cancel hold |
| `settle` | −payer.(reserved\|available) gross, +recipient.available net, +platform.available fee | split payment → `WalletSettlement` |
| `refund` | −recipient.available net, −platform.available fee, +payer.available gross | reverse → `WalletRefund` |

System accounts: `external:world` (the outside world for cash-in/out) and `platform:starria` (fee collection).

## Rules satisfied

- **Double-entry** — every posting nets to zero; verified by `assertBalanced` + unit tests.
- **Idempotency keys** — `findResultByIdempotencyKey` short-circuits in the service; the adapter re-checks inside the transaction and the unique constraint is the final backstop. Replay returns `{ deduped: true }` with no balance change (tested).
- **Audit trail** — every leg is an immutable `WalletTransaction` with SHA-256 `hash` chained per `(accountId, sub)` via `previousHash` (reuses `computeLedgerEntryHash`/`LEDGER_GENESIS_HASH`).
- **No balance mutation without a ledger entry** — `WalletBalanceSnapshot` is only ever written inside `post()`, in the same transaction as the legs that justify it.
- **Rollback safety** — `post()` runs in a single `Serializable` Prisma transaction; `requireFunds` preconditions are re-checked against committed balances inside the transaction, so an insufficient-funds posting aborts atomically (tested).

## Tests (12, all passing)

`LedgerService`: credit increases available; debit requires funds; reserve↔release; settle splits 80/20 from reserved escrow; refund reverses a settlement; idempotency; rejects non-positive/non-integer amounts.
`PrismaLedgerStore`: balanced postings + snapshot + hash chain; settle writes `WalletSettlement` and splits 75/25; refund writes `WalletRefund` and restores payer; debit rejected on insufficiency; idempotent replay.

## Integration map (the 7 monetary systems)

`LedgerService` is registered globally (`LedgerModule`, exported) and injectable today. To preserve the green 107-test suite and backwards compatibility, the existing call sites are **not yet rip-and-replaced** — that rewiring is the documented follow-on:

| System | Current | Target call |
|---|---|---|
| Gifting | `PrismaCoinLedgerRepository` (single-entry `WalletEntry`) | `ledger.debit(sender)` + `ledger.settle(→creator, platform%)` |
| Ticketing | wallet credit/debit | `ledger.debit(buyer)` → `ledger.settle(→creator)` |
| Campaigns | `InMemoryCampaignLedger` | `ledger.debit(star, reason:'campaign')` |
| Companion sessions | `InMemorySessionLedger` | `ledger.reserve` on book → `ledger.settle` on complete → `ledger.refund` on cancel |
| Arena voting | n/a (free) / paid votes | `ledger.debit(voter)` |
| Prize pools | escrow flags | `ledger.reserve` contributions → `ledger.settle` to winners |
| Subscriptions | wallet credit | `ledger.settle` recurring |

Each is a localized swap of a `*LedgerPort`/`*BillingPort` implementation for a thin adapter over `LedgerService`; it does not touch domain business logic. Sequencing it separately keeps each change independently testable.

## Verification

- `prisma validate` ✅, `prisma format` ✅, `prisma generate` ✅
- Migration `20260620000000_ledger_analytics` applies cleanly on a fresh DB (11/11 migrations, 104 tables) and additively on top of the existing 10.
- `nest build` ✅, `tsc --noEmit` ✅, `npm test` ✅ (107/107).
</content>
