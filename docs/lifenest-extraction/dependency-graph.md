# Dependency Graph

## Inter-package dependencies

```
@starria/analytics-core
  └── (none — standalone)

@starria/feed-core
  └── (none — standalone)

@starria/moderation-core
  └── (none — standalone)

@starria/notification-core
  └── (none — standalone)

@starria/gifting-core
  ├── @starria/wallet-core   (FiatGiftingService → FiatGiftWalletPort, typed against WalletCreditInput/DebitInput)
  └── (notification port is injected, no hard package dep)

@starria/wallet-core
  └── (none — standalone)
```

> All cross-package relationships are expressed through **port interfaces**, not concrete imports. `gifting-core` references `wallet-core` types only if you wire them together in your app. You can use `gifting-core` with a custom wallet adapter without installing `wallet-core`.

---

## LifeNest internal dependencies (source context)

The table below maps each extracted package to its LifeNest internal module dependencies. These do NOT become dependencies of the STARRIA packages — they are documented here for migration reference only.

| STARRIA package | LifeNest modules consumed |
|---|---|
| `wallet-core` | `audit/`, `operational-outbox/`, `realtime/`, `healthcare-marketplace-ops/` (optional), `common/prisma/` |
| `gifting-core` | `wallet/`, `tipping/`, `coins/`, `notifications/`, `audit/`, `common/prisma/` |
| `feed-core` | `common/prisma/` (indirect via EngagementService stub) |
| `notification-core` | `common/prisma/` (NotificationRepository), `push/` (worker) |
| `moderation-core` | `audit/`, `operational-outbox/`, `redis/` (queue), `common/prisma/` |
| `analytics-core` | `common/prisma/` (direct Prisma reads in EconomyAnalyticsService) |

---

## External dependencies (all packages)

| Dependency | Packages | Notes |
|---|---|---|
| `crypto` (Node built-in) | `wallet-core`, `gifting-core`, `notification-core`, `moderation-core`, `analytics-core` | `randomUUID`, `createHash` — no extra install |
| None | `feed-core` | Zero external deps |

All packages have **zero `dependencies`** in `package.json`. They are pure TypeScript with Node built-ins only.
