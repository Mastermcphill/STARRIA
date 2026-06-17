# @starria/support-core

## Purpose

Models the **Supporter** identity in STARRIA: a fan who follows, subscribes to, and gifts Stars.

---

## Domain concepts

| Concept | Description |
|---|---|
| `SupporterProfile` | Fan identity, lifetime spend totals, tier label |
| `SupporterTier` | `free → fan → superfan → ultra` — driven by `lifetimeCoinsSpent` |
| `Subscription` | Time-bounded access grant from a Supporter to a Star's content |
| `SubscriptionTier` | `basic / premium / vip` — set by the Star's pricing |
| `SupporterGiftingSummary` | Derived view: total coins/fiat gifted to a specific Star |

---

## Service interface

```typescript
class SupporterService {
  // Profile
  getById(supporterId)
  getByUserId(userId)
  createProfile(input)
  updateProfile(supporterId, input)
  recordSpend(supporterId, coins, fiatMinorUnits)  // → tier re-evaluation
  list(filter)

  // Subscriptions
  subscribe(input)             // idempotent via idempotencyKey
  cancelSubscription(input)
  listSubscriptions(filter)
  hasActiveSubscription(supporterId, starId)  // used by arena-core
  subscriberCount(starId)

  // Gifting summary
  getGiftingSummary(supporterId, starId)
  getTopSupporters(starId, limit)
}
```

---

## Port interfaces

| Port | Implemented by | Used for |
|---|---|---|
| `SupporterStorePort` | Prisma adapter | Supporter profile CRUD |
| `SubscriptionStorePort` | Prisma adapter | Subscription CRUD |
| `SupporterGiftingSummaryPort` | Prisma adapter reading from `taps` table | Leaderboard / gifting totals |
| `SupporterNotificationPort` | notification-core wrapper | Subscribe / cancel / tier-up events |

---

## Tier progression

```
lifetimeCoinsSpent:   0      100      1 000    10 000
tier:                free → fan  → superfan → ultra
                              │        │         │
perks added:             badge   priority   exclusive
                                  queue     content
```

`computeSupporterTier(lifetimeCoinsSpent)` is a pure function — no DB call required.
`recordSpend()` calls this after each increment and fires `onTierUpgraded` only on change.

---

## New Prisma models required

```prisma
model SupporterProfile {
  id                  String         @id @default(uuid())
  userId              String         @unique
  tier                SupporterTier  @default(FREE)
  lifetimeCoinsSpent  Int            @default(0)
  lifetimeFiatSpent   Int            @default(0)   // minor units
  bio                 String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  subscriptions Subscription[]
  user          User           @relation(fields: [userId], references: [id])

  @@index([tier])
}

enum SupporterTier { FREE FAN SUPERFAN ULTRA }

model Subscription {
  id                  String             @id @default(uuid())
  supporterProfileId  String
  starId              String
  tier                SubscriptionTier   @default(BASIC)
  status              SubscriptionStatus @default(ACTIVE)
  startedAt           DateTime           @default(now())
  endsAt              DateTime?
  cancelledAt         DateTime?
  renewalEnabled      Boolean            @default(false)
  idempotencyKey      String             @unique
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  supporterProfile SupporterProfile @relation(fields: [supporterProfileId], references: [id])
  starProfile      StarProfile      @relation(fields: [starId], references: [id])

  @@unique([supporterProfileId, starId])
  @@index([starId, status])
}

enum SubscriptionTier  { BASIC PREMIUM VIP }
enum SubscriptionStatus { ACTIVE PAUSED CANCELLED EXPIRED }
```

---

## Extracted package relationships

- **notification-core**: `SupporterNotificationPort` wraps `NotificationService.send()`
- **wallet-core**: No direct dep — coin balance lives in `@starria/wallet-core`; `recordSpend` only updates the lifetime-spend counter, not the live balance.
- **tap-core**: tap-core calls `supporterService.recordSpend()` after each completed Tap.
- **star-core**: `subscribe()` calls `starService.onSubscriberAdded()` to keep `StarProfile.subscriberCount` in sync.
