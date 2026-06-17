# STARRIA — Migration Documentation

## Overview

This document covers:
1. Prisma migrations for the five new packages
2. Data backfill strategy from the existing schema
3. Port adapter wiring plan for each NestJS module
4. Sequencing and rollback considerations

---

## Migration sequence

```
Phase 1 (already done):   init — from initial schema.prisma (existing models)
Phase 2 (this document):  platform — adds all new models for the 5 domain packages
Phase 3 (future):         leaderboard — Redis sorted sets for tap leaderboards
Phase 4 (future):         search-index — backfill ContentIndex from Event table
```

---

## Phase 2 Prisma migration

### File name
```
20260616000001_platform_packages
```

### SQL summary

```sql
-- ── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE "SupporterTier"     AS ENUM ('FREE','FAN','SUPERFAN','ULTRA');
CREATE TYPE "SubscriptionTier"  AS ENUM ('BASIC','PREMIUM','VIP');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE','PAUSED','CANCELLED','EXPIRED');
CREATE TYPE "StarTier"          AS ENUM ('RISING','VERIFIED','ELITE');
CREATE TYPE "StarStatus"        AS ENUM ('PENDING','ACTIVE','SUSPENDED','DEACTIVATED');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING','APPROVED','REJECTED','REVOKED');
CREATE TYPE "TapType"           AS ENUM ('COIN_GIFT','FIAT_TIP');
CREATE TYPE "TapStatus"         AS ENUM ('PENDING','COMPLETED','REFUNDED','FAILED');
CREATE TYPE "EventVisibility"   AS ENUM ('PUBLIC','SUBSCRIBERS_ONLY','PRIVATE');
CREATE TYPE "ArenaAccessMode"   AS ENUM ('PUBLIC','SUBSCRIBERS_ONLY','INVITE_ONLY');
CREATE TYPE "ParticipantRole"   AS ENUM ('HOST','SPEAKER','VIEWER');
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE','REMOVED','BANNED','LEFT');

-- ── NEW TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE "SupporterProfile" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"             UUID UNIQUE NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tier"               "SupporterTier" NOT NULL DEFAULT 'FREE',
  "lifetimeCoinsSpent" INT NOT NULL DEFAULT 0,
  "lifetimeFiatSpent"  INT NOT NULL DEFAULT 0,
  "bio"                TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "SupporterProfile"("tier");

CREATE TABLE "Subscription" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "supporterProfileId" UUID NOT NULL REFERENCES "SupporterProfile"(id),
  "starId"             UUID NOT NULL REFERENCES "StarProfile"(id),
  "tier"               "SubscriptionTier" NOT NULL DEFAULT 'BASIC',
  "status"             "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endsAt"             TIMESTAMPTZ,
  "cancelledAt"        TIMESTAMPTZ,
  "renewalEnabled"     BOOLEAN NOT NULL DEFAULT FALSE,
  "idempotencyKey"     TEXT UNIQUE NOT NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("supporterProfileId","starId")
);
CREATE INDEX ON "Subscription"("starId","status");
CREATE INDEX ON "Subscription"("status","endsAt");

-- StarProfile (replaces/extends existing placeholder)
ALTER TABLE "StarProfile"
  ADD COLUMN IF NOT EXISTS "username"          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "coverUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "status"            "StarStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "discoveryScore"    FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "followerCount"     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subscriberCount"   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalEventsHosted" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isLive"            BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX ON "StarProfile"("category","discoveryScore");
CREATE INDEX ON "StarProfile"("isLive");
CREATE INDEX ON "StarProfile"("tier","isVerified");

CREATE TABLE "StarVerificationRequest" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "starId"          UUID NOT NULL REFERENCES "StarProfile"(id),
  "status"          "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedAt"      TIMESTAMPTZ,
  "reviewedBy"      UUID REFERENCES "User"(id),
  "rejectionReason" TEXT
);
CREATE INDEX ON "StarVerificationRequest"("starId","status");

CREATE TABLE "StarVerificationDocument" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId"     UUID NOT NULL REFERENCES "StarVerificationRequest"(id),
  "type"          TEXT NOT NULL,
  "mediaUploadId" UUID NOT NULL REFERENCES "MediaUpload"(id),
  "submittedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "StarFollow" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "followerId" UUID NOT NULL REFERENCES "User"(id),
  "starId"     UUID NOT NULL REFERENCES "StarProfile"(id),
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("followerId","starId")
);
CREATE INDEX ON "StarFollow"("starId");
CREATE INDEX ON "StarFollow"("followerId");

-- Tap extensions
ALTER TABLE "Tap"
  ADD COLUMN IF NOT EXISTS "platformPercentage" INT NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "targetType"         TEXT NOT NULL DEFAULT 'LIVESTREAM',
  ADD COLUMN IF NOT EXISTS "giftType"           TEXT;

-- Event extensions
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "visibility"         "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "durationSeconds"    INT,
  ADD COLUMN IF NOT EXISTS "peakViewerCount"    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalViewerCount"   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tapCount"           INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalCoinsReceived" INT NOT NULL DEFAULT 0;

CREATE TABLE "EventReplay" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"         UUID UNIQUE NOT NULL REFERENCES "Event"(id),
  "mediaUploadId"   UUID NOT NULL REFERENCES "MediaUpload"(id),
  "playbackUrl"     TEXT NOT NULL,
  "durationSeconds" INT NOT NULL,
  "thumbnailUrl"    TEXT,
  "isReady"         BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "EventWatchSession" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"             UUID NOT NULL REFERENCES "Event"(id),
  "userId"              UUID NOT NULL REFERENCES "User"(id),
  "joinedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leftAt"              TIMESTAMPTZ,
  "lastPositionSeconds" INT
);
CREATE INDEX ON "EventWatchSession"("eventId");
CREATE INDEX ON "EventWatchSession"("userId");

-- Arena extensions
ALTER TABLE "Arena"
  ADD COLUMN IF NOT EXISTS "accessMode"              "ArenaAccessMode" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "currentParticipantCount" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalParticipantCount"   INT NOT NULL DEFAULT 0;

CREATE TABLE "ArenaParticipant" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "arenaId"    UUID NOT NULL REFERENCES "Arena"(id),
  "userId"     UUID NOT NULL REFERENCES "User"(id),
  "role"       "ParticipantRole"   NOT NULL DEFAULT 'VIEWER',
  "status"     "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leftAt"     TIMESTAMPTZ,
  "muteReason" TEXT
);
CREATE INDEX ON "ArenaParticipant"("arenaId","status");
CREATE INDEX ON "ArenaParticipant"("userId");

CREATE TABLE "ArenaModerationRecord" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "arenaId"      UUID NOT NULL REFERENCES "Arena"(id),
  "actorId"      UUID NOT NULL REFERENCES "User"(id),
  "targetUserId" UUID NOT NULL REFERENCES "User"(id),
  "action"       TEXT NOT NULL,
  "reason"       TEXT,
  "expiresAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "ArenaModerationRecord"("arenaId");
CREATE INDEX ON "ArenaModerationRecord"("targetUserId");
```

---

## Data backfill plan

### 1. SupporterProfile from User (where role = SUPPORTER)

```sql
INSERT INTO "SupporterProfile" ("id","userId","tier","createdAt","updatedAt")
SELECT gen_random_uuid(), id, 'FREE', "createdAt", NOW()
FROM "User"
WHERE role = 'SUPPORTER'
ON CONFLICT ("userId") DO NOTHING;
```

### 2. StarProfile from User (where role = STAR)

Existing `StarProfile` rows should already exist.  
Add `username` backfill from `User.username`:

```sql
UPDATE "StarProfile" sp
SET username = u.username
FROM "User" u
WHERE sp."userId" = u.id AND sp.username IS NULL;
```

### 3. Tap fields backfill

```sql
UPDATE "Tap"
SET "targetType" = 'LIVESTREAM',
    "platformPercentage" = 40
WHERE "targetType" IS NULL;
```

### 4. ContentIndex backfill for ended Events

```sql
INSERT INTO "ContentIndex" ("id","contentType","contentId","title","tags","isActive","createdAt","updatedAt")
SELECT gen_random_uuid(), 'event', id, title, tags, status IN ('LIVE','SCHEDULED'), "createdAt", NOW()
FROM "Event"
WHERE status IN ('LIVE','SCHEDULED','ENDED')
ON CONFLICT ("contentType","contentId") DO NOTHING;
```

---

## Port adapter wiring (NestJS modules)

Each `@starria/*-core` package is wired into its NestJS module by providing
Prisma adapters for each port. The pattern is:

```typescript
// Example: taps.module.ts
@Module({
  imports: [StarsModule, SupportersModule],
  providers: [
    // Adapters
    { provide: 'TAP_STORE',        useClass: PrismaTapStore },
    { provide: 'TAP_LEADERBOARD',  useClass: RedisTapLeaderboard },
    { provide: 'TAP_ANALYTICS',    useClass: AnalyticsCoreAdapter },
    { provide: 'TAP_NOTIFICATION', useClass: NotificationCoreAdapter },
    // Service
    {
      provide: TapService,
      useFactory: (store, coinGifting, fiatGifting, leaderboard, analytics, notifications) =>
        new TapService(store, coinGifting, fiatGifting, leaderboard, analytics, notifications),
      inject: ['TAP_STORE','COIN_GIFTING_SERVICE','FIAT_GIFTING_SERVICE',
               'TAP_LEADERBOARD','TAP_ANALYTICS','TAP_NOTIFICATION'],
    },
    TapsController,
  ],
  exports: [TapService],
})
export class TapsModule {}
```

### Adapter implementation schedule

| Adapter | Package | Priority | Notes |
|---|---|---|---|
| `PrismaSupporterStore` | support-core | Sprint 2 | Basic CRUD |
| `PrismaSubscriptionStore` | support-core | Sprint 2 | With idempotency check |
| `PrismaStarStore` | star-core | Sprint 2 | Counter increments as atomic updates |
| `PrismaStarDiscovery` | star-core | Sprint 2 | Uses `pg_trgm` for search |
| `PrismaTapStore` | tap-core | Sprint 4 | Include `sumByContext` aggregate |
| `RedisTapLeaderboard` | tap-core | Sprint 5 | Redis ZADD / ZRANGE |
| `PrismaEventStore` | event-core | Sprint 3 | Status transition + metric increments |
| `PrismaEventWatchSession` | event-core | Sprint 3 | Join/leave with active count |
| `PrismaArenaStore` | arena-core | Sprint 3 | Participant count atomic updates |
| `LiveKitAdapter` | arena-core | Sprint 3 | Wraps `livekit-server-sdk` |
| `PrismaArenaParticipant` | arena-core | Sprint 3 | Join/leave/ban |

---

## Rollback strategy

All schema changes are additive (new tables, new nullable columns) for Phase 2.
A rollback drops only the new tables and removes the new columns:

```sql
-- Rollback Phase 2
DROP TABLE IF EXISTS "ArenaModerationRecord";
DROP TABLE IF EXISTS "ArenaParticipant";
DROP TABLE IF EXISTS "EventWatchSession";
DROP TABLE IF EXISTS "EventReplay";
DROP TABLE IF EXISTS "StarFollow";
DROP TABLE IF EXISTS "StarVerificationDocument";
DROP TABLE IF EXISTS "StarVerificationRequest";
DROP TABLE IF EXISTS "Subscription";
DROP TABLE IF EXISTS "SupporterProfile";

ALTER TABLE "Arena"  DROP COLUMN IF EXISTS "accessMode","currentParticipantCount","totalParticipantCount";
ALTER TABLE "Event"  DROP COLUMN IF EXISTS "visibility","durationSeconds","peakViewerCount","totalViewerCount","tapCount","totalCoinsReceived";
ALTER TABLE "StarProfile" DROP COLUMN IF EXISTS "username","coverUrl","status","discoveryScore","followerCount","subscriberCount","totalEventsHosted","isLive";
ALTER TABLE "Tap"    DROP COLUMN IF EXISTS "platformPercentage","targetType","giftType";

DROP TYPE IF EXISTS "ParticipantStatus","ParticipantRole","ArenaAccessMode",
  "EventVisibility","TapStatus","TapType","VerificationStatus",
  "StarStatus","StarTier","SubscriptionStatus","SubscriptionTier","SupporterTier";
```

No data loss risk from rollback as long as it is run before live traffic uses the new fields.
