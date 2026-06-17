# STARRIA — Database Schema (New Models)

All models below are additions to `apps/api/prisma/schema.prisma`.
Existing models (`User`, `Wallet`, `WalletEntry`, `Notification`, etc.) are unchanged.

---

## New enums

```prisma
// ── support-core ────────────────────────────────────────────────────────────
enum SupporterTier    { FREE FAN SUPERFAN ULTRA }
enum SubscriptionTier { BASIC PREMIUM VIP }
enum SubscriptionStatus { ACTIVE PAUSED CANCELLED EXPIRED }

// ── star-core ───────────────────────────────────────────────────────────────
enum StarTier          { RISING VERIFIED ELITE }
enum StarStatus        { PENDING ACTIVE SUSPENDED DEACTIVATED }
enum VerificationStatus { PENDING APPROVED REJECTED REVOKED }

// ── tap-core ─────────────────────────────────────────────────────────────────
enum TapType   { COIN_GIFT FIAT_TIP }
enum TapStatus { PENDING COMPLETED REFUNDED FAILED }

// ── event-core ───────────────────────────────────────────────────────────────
enum EventVisibility { PUBLIC SUBSCRIBERS_ONLY PRIVATE }

// ── arena-core ───────────────────────────────────────────────────────────────
enum ArenaAccessMode  { PUBLIC SUBSCRIBERS_ONLY INVITE_ONLY }
enum ParticipantRole  { HOST SPEAKER VIEWER }
enum ParticipantStatus { ACTIVE REMOVED BANNED LEFT }
```

---

## support-core models

```prisma
model SupporterProfile {
  id                 String        @id @default(uuid())
  userId             String        @unique
  tier               SupporterTier @default(FREE)
  lifetimeCoinsSpent Int           @default(0)
  lifetimeFiatSpent  Int           @default(0)
  bio                String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptions Subscription[]

  @@index([tier])
}

model Subscription {
  id                 String             @id @default(uuid())
  supporterProfileId String
  starId             String
  tier               SubscriptionTier   @default(BASIC)
  status             SubscriptionStatus @default(ACTIVE)
  startedAt          DateTime           @default(now())
  endsAt             DateTime?
  cancelledAt        DateTime?
  renewalEnabled     Boolean            @default(false)
  idempotencyKey     String             @unique
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  supporterProfile SupporterProfile @relation(fields: [supporterProfileId], references: [id])
  starProfile      StarProfile      @relation(fields: [starId], references: [id])

  @@unique([supporterProfileId, starId])
  @@index([starId, status])
  @@index([status, endsAt])
}
```

---

## star-core models

```prisma
model StarProfile {
  id                String     @id @default(uuid())
  userId            String     @unique
  username          String     @unique
  displayName       String
  avatarUrl         String?
  coverUrl          String?
  bio               String?
  category          String     @default("general")
  tags              String[]
  tier              StarTier   @default(RISING)
  status            StarStatus @default(ACTIVE)
  isVerified        Boolean    @default(false)
  verifiedAt        DateTime?
  discoveryScore    Float      @default(0)
  followerCount     Int        @default(0)
  subscriberCount   Int        @default(0)
  totalEventsHosted Int        @default(0)
  isLive            Boolean    @default(false)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  user                   User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  verificationRequests   StarVerificationRequest[]
  follows                StarFollow[]
  subscriptions          Subscription[]
  arenas                 Arena[]
  events                 Event[]

  @@index([category, discoveryScore])
  @@index([isLive])
  @@index([tier, isVerified])
  @@index([username])
}

model StarVerificationRequest {
  id              String             @id @default(uuid())
  starId          String
  status          VerificationStatus @default(PENDING)
  submittedAt     DateTime           @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
  rejectionReason String?

  starProfile StarProfile              @relation(fields: [starId], references: [id])
  documents   StarVerificationDocument[]

  @@index([starId, status])
}

model StarVerificationDocument {
  id            String   @id @default(uuid())
  requestId     String
  type          String
  mediaUploadId String
  submittedAt   DateTime @default(now())

  request StarVerificationRequest @relation(fields: [requestId], references: [id])
}

model StarFollow {
  id         String   @id @default(uuid())
  followerId String
  starId     String
  createdAt  DateTime @default(now())

  follower User        @relation("StarFollower", fields: [followerId], references: [id])
  star     StarProfile @relation(fields: [starId], references: [id])

  @@unique([followerId, starId])
  @@index([starId])
  @@index([followerId])
}
```

---

## tap-core models

```prisma
model Tap {
  id                 String    @id @default(uuid())
  senderId           String
  receiverId         String
  type               TapType
  status             TapStatus @default(PENDING)
  currency           String    @default("COINS")
  grossAmount        Int
  platformFee        Int
  creatorNet         Int
  platformPercentage Int       @default(40)
  contextType        String?
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

  @@index([receiverId, createdAt])
  @@index([senderId, createdAt])
  @@index([contextType, contextId])
  @@index([status])
}
```

---

## event-core models

```prisma
// Extension fields added to existing Event model:
//   visibility          EventVisibility @default(PUBLIC)
//   durationSeconds     Int?
//   peakViewerCount     Int @default(0)
//   totalViewerCount    Int @default(0)
//   tapCount            Int @default(0)
//   totalCoinsReceived  Int @default(0)

model EventReplay {
  id              String   @id @default(uuid())
  eventId         String   @unique
  mediaUploadId   String
  playbackUrl     String
  durationSeconds Int
  thumbnailUrl    String?
  isReady         Boolean  @default(false)
  createdAt       DateTime @default(now())

  event Event @relation(fields: [eventId], references: [id])
}

model EventWatchSession {
  id                  String    @id @default(uuid())
  eventId             String
  userId              String
  joinedAt            DateTime  @default(now())
  leftAt              DateTime?
  lastPositionSeconds Int?

  event Event @relation(fields: [eventId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([eventId])
  @@index([userId])
}
```

---

## arena-core models

```prisma
// Extension fields added to existing Arena model:
//   accessMode              ArenaAccessMode @default(PUBLIC)
//   currentParticipantCount Int @default(0)
//   totalParticipantCount   Int @default(0)

model ArenaParticipant {
  id         String            @id @default(uuid())
  arenaId    String
  userId     String
  role       ParticipantRole   @default(VIEWER)
  status     ParticipantStatus @default(ACTIVE)
  joinedAt   DateTime          @default(now())
  leftAt     DateTime?
  muteReason String?

  arena Arena @relation(fields: [arenaId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([arenaId, status])
  @@index([userId])
}

model ArenaModerationRecord {
  id           String   @id @default(uuid())
  arenaId      String
  actorId      String
  targetUserId String
  action       String
  reason       String?
  expiresAt    DateTime?
  createdAt    DateTime @default(now())

  arena Arena @relation(fields: [arenaId], references: [id])

  @@index([arenaId])
  @@index([targetUserId])
}
```

---

## Index strategy summary

| Table | Indexes | Rationale |
|---|---|---|
| `SupporterProfile` | `tier` | Filter by tier for leaderboards |
| `Subscription` | `(starId, status)`, `(status, endsAt)` | Active sub lookup, expiry sweep |
| `StarProfile` | `(category, discoveryScore)`, `isLive`, `(tier, isVerified)`, `username` | Discovery queries |
| `StarFollow` | `starId`, `followerId` | Follower list, isFollowing check |
| `Tap` | `(receiverId, createdAt)`, `(senderId, createdAt)`, `(contextType, contextId)`, `status` | History pages, context sums |
| `EventWatchSession` | `eventId`, `userId` | Active count, per-user lookup |
| `ArenaParticipant` | `(arenaId, status)`, `userId` | Active list, per-user lookup |
| `ArenaModerationRecord` | `arenaId`, `targetUserId` | Ban check, audit log |
