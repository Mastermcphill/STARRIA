# Sprint 1 — Support Economy MVP

## Implementation Summary

Implements the complete Support Economy vertical slice: a creator can receive coin gifts from supporters, earn split earnings, have their support relationships tracked, and all domain events flow correctly.

---

## Changed / Created Files

### Schema & Migrations

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added fields to `SupporterProfile` (displayName, tier, lifetimeCoinsSpent, lifetimeFiatSpent) and `Subscription` (tier, status, startedAt, cancelledAt, renewalEnabled, idempotencyKey) |
| `apps/api/prisma/migrations/20260616000002_support_economy_fields/migration.sql` | SQL to apply the above additions to a live database |

### EventBus

| File | Purpose |
|---|---|
| `apps/api/src/event-bus/event-bus.module.ts` | Global NestJS module providing `EVENT_BUS` token (InMemoryEventBus in dev) |

### Wallet Module

| File | Purpose |
|---|---|
| `apps/api/src/modules/wallet/wallet.module.ts` | Module wiring |
| `apps/api/src/modules/wallet/wallet.service.ts` | createWallet, getBalance, getTransactions, withdraw, creditCoins, verifyLedgerIntegrity |
| `apps/api/src/modules/wallet/wallet.controller.ts` | POST /wallet/create, GET /wallet/balance, GET /wallet/transactions, POST /wallet/withdraw |
| `apps/api/src/modules/wallet/prisma-coin-ledger.repository.ts` | Implements `CoinLedgerPort` (gifting-core) with Prisma + hash-chained ledger |
| `apps/api/src/modules/wallet/dto/create-wallet.dto.ts` | DTOs |
| `apps/api/src/modules/wallet/dto/wallet-balance.dto.ts` | DTOs |
| `apps/api/src/modules/wallet/dto/withdraw.dto.ts` | DTOs |

### Coin Purchase Module

| File | Purpose |
|---|---|
| `apps/api/src/modules/coin-purchase/coin-purchase.module.ts` | Module wiring |
| `apps/api/src/modules/coin-purchase/coin-purchase.service.ts` | initiatePurchase, verifyAndCredit |
| `apps/api/src/modules/coin-purchase/coin-purchase.controller.ts` | GET /coins/packages, POST /coins/purchase, POST /coins/verify |
| `apps/api/src/modules/coin-purchase/dto/purchase-coins.dto.ts` | Coin packages, DTOs |
| `apps/api/src/modules/coin-purchase/providers/payment-provider.interface.ts` | PaymentProvider interface |
| `apps/api/src/modules/coin-purchase/providers/paystack.stub.ts` | Paystack stub |
| `apps/api/src/modules/coin-purchase/providers/apple-pay.stub.ts` | Apple Pay stub |
| `apps/api/src/modules/coin-purchase/providers/google-pay.stub.ts` | Google Pay stub |

### Gifting Module

| File | Purpose |
|---|---|
| `apps/api/src/modules/gifting/gifting.module.ts` | Module wiring |
| `apps/api/src/modules/gifting/gifting.service.ts` | Wires CoinGiftingService with star-tier-aware commission |
| `apps/api/src/modules/gifting/gifting.controller.ts` | GET /gifting/catalog, POST /gifting/coin, GET /gifting/history |
| `apps/api/src/modules/gifting/gift-catalog.ts` | Star/Rocket/Crown/Galaxy/Supernova catalog |
| `apps/api/src/modules/gifting/platform-fee.ts` | Fee ladder: NONE=50%, RISING=40%, VERIFIED=30%, ELITE=20%, GOLD_STAR=10% |
| `apps/api/src/modules/gifting/dto/send-coin-gift.dto.ts` | DTOs |
| `apps/api/src/modules/gifting/dto/gift-history.dto.ts` | DTOs |

### Supporters Module

| File | Purpose |
|---|---|
| `apps/api/src/modules/supporters/supporters.module.ts` | Module wiring |
| `apps/api/src/modules/supporters/supporters.service.ts` | Facade over SupporterService (support-core) |
| `apps/api/src/modules/supporters/supporters.controller.ts` | Profile CRUD, subscribe, cancel, relationship, top supporters |
| `apps/api/src/modules/supporters/prisma-supporter.store.ts` | SupporterStorePort implementation |
| `apps/api/src/modules/supporters/prisma-subscription.store.ts` | SubscriptionStorePort implementation |
| `apps/api/src/modules/supporters/patron-level.ts` | Patron tiers: Supporter/Patron/Champion/Benefactor/Legendary Patron |
| `apps/api/src/modules/supporters/support-graph.service.ts` | Upserts SupportRelationship, evaluates milestones |
| `apps/api/src/modules/supporters/support-graph.listeners.ts` | Subscribes to CoinGiftSentEvent → triggers support graph update |
| `apps/api/src/modules/supporters/dto/supporter.dto.ts` | DTOs |

### App Module

| File | Change |
|---|---|
| `apps/api/src/app.module.ts` | Added EventBusModule, WalletModule, CoinPurchaseModule, GiftingModule |

---

## API Endpoints Added

### Wallet
```
POST   /api/v1/wallet/create          Create wallet for authenticated user
GET    /api/v1/wallet/balance         Get coin balance
GET    /api/v1/wallet/transactions    Get ledger history (paginated)
POST   /api/v1/wallet/withdraw        Request fiat payout
```

### Coin Purchase
```
GET    /api/v1/coins/packages         Get coin package catalog
POST   /api/v1/coins/purchase         Initiate coin purchase (returns payment URL)
POST   /api/v1/coins/verify           Verify payment and credit coins
```

### Gifting
```
GET    /api/v1/gifting/catalog        Gift catalog (star/rocket/crown/galaxy/supernova)
POST   /api/v1/gifting/coin           Send coin gift to a creator
GET    /api/v1/gifting/history        Gift history (filterable)
```

### Supporters
```
POST   /api/v1/supporters/profile             Create supporter profile
GET    /api/v1/supporters/profile/me          Get own profile
PUT    /api/v1/supporters/profile/me          Update profile
GET    /api/v1/supporters/profile/:id         Get profile by ID
POST   /api/v1/supporters/subscribe           Subscribe to a star
DELETE /api/v1/supporters/subscriptions/:id/cancel  Cancel subscription
GET    /api/v1/supporters/subscriptions       List subscriptions
GET    /api/v1/supporters/relationship/:starProfileId  Get relationship + patron level
GET    /api/v1/supporters/:starProfileId/top-supporters  Patron leaderboard
GET    /api/v1/supporters/:starProfileId/subscriber-count  Active subscriber count
```

---

## Gift Catalog

| Gift | Coins |
|---|---|
| Star ⭐ | 10 |
| Rocket 🚀 | 50 |
| Crown 👑 | 100 |
| Galaxy 🌌 | 500 |
| Supernova 💥 | 1000 |

---

## Platform Fee Ladder

| Creator Tier | Platform % | Creator % |
|---|---|---|
| No profile (new) | 50% | 50% |
| RISING | 40% | 60% |
| VERIFIED | 30% | 70% |
| ELITE | 20% | 80% |
| Gold Star (active) | 10% | 90% |

---

## Patron Tiers (per creator)

| Level | Coins Gifted to that Star |
|---|---|
| Supporter | 0+ |
| Patron | 500+ |
| Champion | 2,000+ |
| Benefactor | 10,000+ |
| Legendary Patron | 50,000+ |

---

## Global Supporter Tiers (lifetime across all stars)

| Tier | Lifetime Coins Spent |
|---|---|
| Free | 0 |
| Fan | 100+ |
| SuperFan | 1,000+ |
| Ultra | 10,000+ |

---

## Event Flow

```
POST /gifting/coin
  └─ CoinGiftingService.sendCoinGift()
       ├─ Debit sender wallet
       ├─ Credit creator wallet (net)
       ├─ Credit platform wallet (fee)
       └─ emit CoinGiftSentEvent
            └─ SupportGraphListeners (subscriber)
                 ├─ SupportersService.recordSpend()  ← updates lifetimeCoinsSpent + tier
                 └─ SupportGraphService.handleGift()
                      ├─ Upsert SupportRelationship (idempotent)
                      ├─ Evaluate milestones (FIRST_TAP, TAP_COUNT, COIN_THRESHOLD)
                      └─ emit starria.support.milestone_reached (if new milestone)
```

---

## Test Report

| Test file | Tests | Description |
|---|---|---|
| `wallet.service.spec.ts` | 5 | createWallet, dedup, getBalance, withdraw event, ledger verify |
| `gifting.service.spec.ts` | 12 | catalog, fee ladder (5 tiers), gift execution, insufficient balance, event emission |
| `support-graph.service.spec.ts` | 8 | patron level computation, threshold boundaries, tier ordering |
| `test/support-economy.e2e.spec.ts` | 8 | Full end-to-end: coin balance, gift, creator earnings, event emission, supporter profile, patron escalation, subscription idempotency, insufficient balance |

**Total: 33 tests**

All tests are runnable with:
```bash
cd apps/api
pnpm test
```

---

## Remaining TODOs

1. **Real payment providers** — Replace `PaystackProviderStub`, `ApplePayProviderStub`, `GooglePayProviderStub` with live API calls when credentials are available.

2. **Fiat gifting** — `FiatGiftingService` from gifting-core is wired in the package but not exposed via an API endpoint yet. Requires `FiatGiftWalletPort` adapter (debit/credit fiat wallet account).

3. **Redis EventBus** — `EventBusModule` currently uses `InMemoryEventBus`. Swap for `RedisEventBusAdapter` (already implemented in `apps/api/src/adapters/redis-event-bus.adapter.ts`) for multi-replica deployments.

4. **PayoutRecord persistence** — `WalletService.withdraw()` emits an event but does not persist a payout record to the DB. Wire a `PayoutRequest` Prisma model row.

5. **Webhook handler** — Payment providers call back via webhook to confirm transactions. Add a public `POST /coins/webhook/:provider` endpoint that calls `verifyAndCredit()` without auth.

6. **Rate limiting for gifting** — Add a per-user gifting rate limit (e.g. max 100 gifts/min) at the controller layer.

7. **Subscription renewal** — `Subscription.renewalEnabled` is persisted but a cron job to auto-renew is not yet implemented. Register a handler for `JOB_TYPES.CONFIRM_TICKET_PURCHASE` equivalent.

8. **Streak milestones** — `SupportMilestoneType.STREAK` and `ANNIVERSARY` are defined but not yet evaluated in `SupportGraphService.evaluateMilestones()`.
