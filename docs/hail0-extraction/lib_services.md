# lib/services

## Purpose

Domain services that run inside the Flutter app (client-side, not the Dart backend) and operate directly on the local SQLite database. These are financial/savings services that manage wallet balances, autosave rules, and locked savings ("moneybox") accounts.

| Service | Responsibility |
|---------|---------------|
| `WalletService` | Multi-wallet ledger: credit, debit, transfer, balance query. Handles rider, driver, fleet-owner, and platform wallets. Idempotency-keyed transactions. |
| `AutosaveService` | On every confirmed commission credit, automatically deducts a user-configured percentage and routes it to the MoneyBox savings account. |
| `MoneyBoxService` | Tiered locked savings accounts (tiers 1–4, each with a lock duration). Creates accounts, handles deposits, tracks maturity dates, projected bonus, auto-open dates. |
| `PayoutAutosaveService` | Variant of autosave logic triggered at payout time rather than commission credit time. |
| `WalletScheduler` | Cron-style scheduler (probably triggered by the job system) for periodic sweeps — autosave maturity, payout triggers. |

## Reusable Files

| File | Extraction value |
|------|-----------------|
| `wallet_service.dart` | Multi-wallet ledger with full transaction support. High value — any fintech feature needs this. |
| `moneybox_service.dart` | Tiered savings with maturity logic. Extract if STARRIA has a savings product. |
| `autosave_service.dart` | Rule-based automatic deduction on earnings. Extract if STARRIA has autosave for drivers. |
| `payout_autosave_service.dart` | Payout-event-triggered savings sweep. |
| `wallet_scheduler.dart` | Periodic maturity sweep scheduler. |

## STARRIA Use Case

STARRIA likely needs a wallet ledger for driver earnings, rider payments, and fleet owner commissions. `WalletService` is the core of this — it's already multi-party (platform, driver, fleet owner, rider wallets), idempotency-safe, and SQLite-backed.

`MoneyBoxService` maps to any STARRIA "driver savings" or "wallet lock" product. The tier system (1–4 with escalating lock durations) can be reused verbatim or simplified.

`AutosaveService` is a direct extraction for STARRIA's driver income auto-allocation feature if planned.

## Extraction Difficulty

**Medium.** Services depend on:
- `hailo_shared/sqlite_api.dart` (SQLite abstraction — extractable as `starria_shared`)
- `lib/data/repositories/` (SQLite DAOs and repository classes)
- `lib/domain/models/` (Wallet, WalletLedgerEntry, MoneyBoxAccount, etc.)
- `lib/domain/services/finance_utils.dart` and `cancel_ride_service.dart`

The DAO + domain model layer must be extracted alongside the services. No Flutter UI dependencies — these are pure Dart services. The financial logic (idempotency hashing via `crypto`, ledger double-entry pattern) is solid and worth preserving exactly.

## Candidate Package

`starria_wallet_services` — internal Dart package (not Flutter, pure Dart) containing wallet, moneybox, and autosave services plus their DAO/repository dependencies. Can run in both the Flutter app (local SQLite) and the backend server.
