# LifeNest → STARRIA Extraction Overview

Extraction date: 2026-06-16  
Source repo: `LifeNestOmegaMerged/` (NestJS monorepo, `apps/api`)  
Target: `STARRIA/packages/`

---

## What was extracted

| Package | Source modules | Description |
|---|---|---|
| `@starria/wallet-core` | `modules/wallet/`, `modules/payments/providers/` | Ledger types, hash-chain logic, durable balance store interface, payment provider contract |
| `@starria/gifting-core` | `modules/tipping/`, `modules/coins/`, `modules/livestream-gifts/` | Coin gifting, fiat tipping, commission config, gift target types |
| `@starria/feed-core` | `modules/feeds/`, `modules/engagement/` | FYP engine, infinite-scroll cursor, engagement tracking |
| `@starria/notification-core` | `modules/notifications/`, `modules/push/`, `modules/email/` | In-app, push, and email notification abstractions |
| `@starria/moderation-core` | `modules/moderation/`, `modules/rooms/room-moderation.service.ts` | Reporting, blocking, moderation queues, content safety |
| `@starria/analytics-core` | `modules/analytics/` | Watch time, engagement metrics, creator/platform economy dashboards |

---

## Design principles

1. **No NestJS decorators in core packages.** All `@Injectable()`, `@Inject()`, `@Optional()` have been removed. Each package exports plain TypeScript classes + interfaces. NestJS wrappers live in the consuming app's module.

2. **No Prisma.** Every persistence operation is represented as a *Port interface* (e.g. `WalletDurableBalanceStore`, `FiatGiftPersistencePort`). Implement with Prisma, MongoDB, Redis, or an in-memory Map.

3. **App-specific logic converted to interfaces.** LifeNest's healthcare districts (`vively`, `medsphere`…) become the generic `category: string` on `FeedItem`. LifeNest-specific `NotificationType` values are extended with a `| string` fallback so consumers can add their own.

4. **Backward-compatible hash chain.** `ledger.ts` in `wallet-core` reproduces the exact SHA-256 hash algorithm from LifeNest so that entries produced by STARRIA apps are chain-compatible with existing LifeNest ledger rows.

5. **Idempotency preserved.** Every write operation that was idempotent in LifeNest (businessKey / dedupeKey / reference) retains its idempotency contract in the extracted service.

---

## LifeNest remains unchanged

No files in `LifeNestOmegaMerged/` were modified. The extraction is additive only.
