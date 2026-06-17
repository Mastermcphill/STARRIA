# @starria/tap-core

## Purpose

A **Tap** is STARRIA's branded micropayment — a coin gift or fiat tip sent by a
Supporter to a Star, optionally attached to an event, arena, or profile.

`tap-core` does **not** implement the money movement itself. It delegates to
`@starria/gifting-core` (`CoinGiftingService` / `FiatGiftingService`) and wraps the
result with: a persistent Tap record, context attachment, leaderboard updates,
analytics tracking, and push notifications.

---

## Domain concepts

| Concept | Description |
|---|---|
| `TapRecord` | Persisted record of one Tap with all split amounts |
| `TapType` | `COIN_GIFT` or `FIAT_TIP` |
| `TapStatus` | `PENDING → COMPLETED | REFUNDED | FAILED` |
| `TapContextType` | `event / arena / profile / replay` — where the Tap was sent from |
| `LeaderboardEntry` | Ranked supporter by total gifts to a Star in a period |
| `TapSnapshot` | Aggregated Tap totals for a context (event / arena) |

---

## Service interface

```typescript
class TapService {
  sendCoinTap(input)      // → delegates to CoinGiftingService, persists TapRecord
  sendFiatTap(input)      // → delegates to FiatGiftingService, persists TapRecord
  getById(tapId)
  list(filter)            // paginated Tap history
  getLeaderboard(query)   // top supporters for a Star / event / arena
  getContextSummary(contextType, contextId)  // total coins+fiat on an event
}
```

---

## Idempotency contract

Every Tap carries a client-generated `idempotencyKey`.  
`sendCoinTap` / `sendFiatTap` check `TapStorePort.findByIdempotencyKey` before
calling gifting-core. If a record already exists, the existing result is returned
(`deduped: true`). This is safe to call under concurrent retries.

The same `idempotencyKey` is forwarded to `gifting-core` so that the underlying
ledger operations are also idempotent.

---

## Money flow

```
sendCoinTap({ coins: 100, commission: 40% })

  gifting-core/CoinGiftingService
    debit  sender       100 COINS  (idempotencyKey:debit)
    credit creator       60 COINS  (idempotencyKey:credit)
    credit platform:coins 40 COINS  (idempotencyKey:platform)
                                    ↑ conserved: floor(100*40/100)=40, creator=60

  tap-core/TapService
    persist TapRecord { grossAmount:100, platformFee:40, creatorNet:60 }
    leaderboard.recordContribution(starId, supporterId, coins:100)
    analytics.trackTap(tap)
    notifications.onTapReceived(receiverId, senderId, ...)
    support-core.recordSpend(supporterId, coins:100, fiat:0)  [called by NestJS module]
    event-core.recordTapOnEvent(eventId, coins:100)            [called by NestJS module]
```

---

## Port interfaces

| Port | Implemented by | Used for |
|---|---|---|
| `TapStorePort` | Prisma adapter | TapRecord CRUD, context sums |
| `TapLeaderboardPort` | Redis sorted set adapter | Running leaderboard |
| `TapAnalyticsPort` | analytics-core wrapper | `AnalyticsService.track()` per Tap |
| `TapNotificationPort` | notification-core wrapper | `tip_received` push to Star |

---

## New Prisma models required

```prisma
model Tap {
  id                 String    @id @default(uuid())
  senderId           String
  receiverId         String
  type               TapType
  status             TapStatus @default(PENDING)
  currency           String    @default("COINS")
  grossAmount        Int       // COINS: integer; fiat: minor units
  platformFee        Int
  creatorNet         Int
  platformPercentage Int       @default(40)
  contextType        String?   // event | arena | profile | replay
  contextId          String?
  targetType         String    @default("LIVESTREAM")
  message            String?
  giftType           String?
  idempotencyKey     String    @unique
  reference          String    @unique
  createdAt          DateTime  @default(now())
  settledAt          DateTime?

  sender   User @relation("TapSender",   fields: [senderId],   references: [id])
  receiver User @relation("TapReceiver", fields: [receiverId], references: [id])

  @@index([receiverId])
  @@index([senderId])
  @@index([contextType, contextId])
  @@index([createdAt])
}

enum TapType   { COIN_GIFT FIAT_TIP }
enum TapStatus { PENDING COMPLETED REFUNDED FAILED }
```

The existing Prisma `Tap` model in `schema.prisma` maps to this. The new fields
`platformPercentage`, `targetType`, and `giftType` are additions.

---

## Extracted package relationships

| Package | How used |
|---|---|
| `@starria/gifting-core` | `CoinGiftingService.sendCoinGift()` and `FiatGiftingService.sendGift()` — actual money movement |
| `@starria/wallet-core` | Indirectly via gifting-core's `CoinLedgerPort` and `FiatGiftWalletPort` — no direct import |
| `@starria/analytics-core` | `TapAnalyticsPort` wraps `AnalyticsService.track()` |
| `@starria/notification-core` | `TapNotificationPort` wraps `NotificationService.send({ type: 'tip_received' })` |
