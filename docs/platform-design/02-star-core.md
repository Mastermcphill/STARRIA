# @starria/star-core

## Purpose

Models the **Star** (creator) identity: their profile, tier, discoverability,
follows, and verification workflow.

---

## Domain concepts

| Concept | Description |
|---|---|
| `StarProfile` | Creator identity — bio, category, tier, discovery score |
| `StarTier` | `rising → verified → elite` — driven by `subscriberCount` |
| `StarStatus` | `pending / active / suspended / deactivated` |
| `StarVerificationRequest` | KYC/identity verification submitted to admin |
| `StarFollow` | A Supporter follows a Star (free, not a subscription) |
| `StarDiscoveryResult` | Read-optimised projection used by feed and search |

---

## Service interface

```typescript
class StarService {
  // Profile
  getById(starId)
  getByUserId(userId)
  getByUsername(username)
  createProfile(input)
  updateProfile(starId, input)
  syncTier(starId)               // recalculates tier from subscriberCount
  setLiveStatus(starId, isLive)  // called by arena-core on join/leave

  // Discovery
  search(filter)
  listByCategory(category, limit, cursor)
  listTrending(limit)
  listLive(limit)

  // Follows
  follow(followerId, starId)
  unfollow(followerId, starId)
  isFollowing(followerId, starId)
  listFollowers(starId, limit, cursor)

  // Verification
  submitVerification(input)
  approveVerification(requestId, reviewerId)
  rejectVerification(requestId, reviewerId, reason)

  // Hooks (called by support-core)
  onSubscriberAdded(starId, supporterId, tier)
  onSubscriberRemoved(starId)
}
```

---

## Port interfaces

| Port | Implemented by | Used for |
|---|---|---|
| `StarStorePort` | Prisma adapter | Star profile CRUD, counter increments |
| `StarDiscoveryPort` | Prisma + `pg_trgm` full-text adapter | Discovery queries, trending, live list |
| `StarVerificationStorePort` | Prisma adapter | Verification CRUD |
| `StarFollowPort` | Prisma adapter | Follow/unfollow, follow lists |
| `StarNotificationPort` | notification-core wrapper | Verification result, tier upgrade, new follow, new subscriber |

---

## Tier progression

```
subscriberCount:   0       100        5 000
tier:           rising → verified → elite
perks:           events    badge      revenue
                           analytics  boost
```

`computeStarTier(subscriberCount)` is a pure function called inside `syncTier()`.
`syncTier()` is called by `support-core` after every subscribe/cancel.

---

## Discovery score

`discoveryScore` is a platform-controlled float stored on `StarProfile`.  
It is updated by a background worker (not implemented here) based on:
- Recent Tap volume
- Watch-time growth rate (analytics-core)
- Subscriber growth rate
- Live event frequency

The score is used by `StarDiscoveryPort.listTrending()` to sort results.

---

## New Prisma models required

```prisma
model StarProfile {
  id               String     @id @default(uuid())
  userId           String     @unique
  username         String     @unique
  tier             StarTier   @default(RISING)
  status           StarStatus @default(ACTIVE)
  category         String     @default("general")
  tags             String[]
  bio              String?
  coverUrl         String?
  isVerified       Boolean    @default(false)
  verifiedAt       DateTime?
  discoveryScore   Float      @default(0)
  followerCount    Int        @default(0)
  subscriberCount  Int        @default(0)
  totalEventsHosted Int       @default(0)
  isLive           Boolean    @default(false)
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  user                  User                   @relation(...)
  verificationRequests  StarVerificationRequest[]
  follows               StarFollow[]
  subscriptions         Subscription[]
  arenas                Arena[]
  events                Event[]

  @@index([category, discoveryScore])
  @@index([isLive])
  @@index([tier])
}

enum StarTier   { RISING VERIFIED ELITE }
enum StarStatus { PENDING ACTIVE SUSPENDED DEACTIVATED }

model StarVerificationRequest {
  id               String             @id @default(uuid())
  starId           String
  status           VerificationStatus @default(PENDING)
  submittedAt      DateTime           @default(now())
  reviewedAt       DateTime?
  reviewedBy       String?
  rejectionReason  String?

  starProfile StarProfile              @relation(...)
  documents   StarVerificationDocument[]
}

enum VerificationStatus { PENDING APPROVED REJECTED REVOKED }

model StarVerificationDocument {
  id          String   @id @default(uuid())
  requestId   String
  type        String   // id_card | selfie | social_proof | other
  mediaUploadId String
  submittedAt DateTime @default(now())

  request StarVerificationRequest @relation(...)
}

model StarFollow {
  id         String   @id @default(uuid())
  followerId String
  starId     String
  createdAt  DateTime @default(now())

  @@unique([followerId, starId])
  @@index([starId])
}
```

---

## Extracted package relationships

- **feed-core**: `StarDiscoveryResult` maps to `FeedItem` in the app layer.
- **analytics-core**: Discovery score worker reads `CreatorEarningsSummary` and `WatchTimeAggregate`.
- **moderation-core**: `StarStatus.SUSPENDED` is applied by admin after moderation case resolution.
- **notification-core**: `StarNotificationPort` wraps `NotificationService.send()`.
