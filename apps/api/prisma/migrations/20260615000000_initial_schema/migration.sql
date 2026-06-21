-- Migration: 20260615000000_initial_schema
-- Base schema for STARRIA — Users, Stars, Supporters, Taps, Events, Arenas,
-- Wallet/Ledger, Notifications, Moderation, Analytics, Media, Search, AI tools.
-- All subsequent migrations build on top of these tables.
--
-- NOTE: ContentIndex.contentId standalone @unique is added in
--       20260617000002_content_index_unique_constraint to keep concerns separate.

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "UserRole"             AS ENUM ('SUPPORTER', 'STAR', 'ADMIN');
CREATE TYPE "StarTier"             AS ENUM ('RISING', 'VERIFIED', 'ELITE');
CREATE TYPE "TapType"              AS ENUM ('COIN_GIFT', 'FIAT_TIP', 'SUBSCRIPTION');
CREATE TYPE "TapStatus"            AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED');
CREATE TYPE "EventStatus"          AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "EventType"            AS ENUM ('LIVE_STREAM', 'REPLAY', 'CLASS', 'SHOW');
CREATE TYPE "ArenaStatus"          AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "WalletEntryType"      AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "NotificationChannel"  AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS');
CREATE TYPE "ModerationCaseStatus" AS ENUM (
  'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'DISMISSED'
);
CREATE TYPE "MediaScanStatus" AS ENUM (
  'PENDING', 'SCAN_CLEAN', 'COMPLETED', 'FLAGGED', 'REJECTED', 'QUARANTINED'
);
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'DOCUMENT');

-- ── User ──────────────────────────────────────────────────────────────────────

CREATE TABLE "User" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "email"        TEXT        NOT NULL,
  "username"     TEXT        NOT NULL,
  "displayName"  TEXT        NOT NULL,
  "avatarUrl"    TEXT,
  "role"         "UserRole"  NOT NULL DEFAULT 'SUPPORTER',
  "passwordHash" TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key"    ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX        "User_email_idx"    ON "User"("email");
CREATE INDEX        "User_username_idx" ON "User"("username");

-- ── StarProfile ───────────────────────────────────────────────────────────────

CREATE TABLE "StarProfile" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"     TEXT        NOT NULL,
  "tier"       "StarTier"  NOT NULL DEFAULT 'RISING',
  "bio"        TEXT,
  "category"   TEXT        NOT NULL DEFAULT 'general',
  "tags"       TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isVerified" BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "StarProfile_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "StarProfile_userId_key"  UNIQUE ("userId"),
  CONSTRAINT "StarProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "StarProfile_category_idx" ON "StarProfile"("category");
CREATE INDEX "StarProfile_tier_idx"     ON "StarProfile"("tier");

-- ── SupporterProfile ──────────────────────────────────────────────────────────

CREATE TABLE "SupporterProfile" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"             TEXT        NOT NULL,
  "displayName"        TEXT        NOT NULL DEFAULT '',
  "avatarUrl"          TEXT,
  "bio"                TEXT,
  "tier"               TEXT        NOT NULL DEFAULT 'free',
  "lifetimeCoinsSpent" INTEGER     NOT NULL DEFAULT 0,
  "lifetimeFiatSpent"  INTEGER     NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "SupporterProfile_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "SupporterProfile_userId_key"  UNIQUE ("userId"),
  CONSTRAINT "SupporterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── Subscription ──────────────────────────────────────────────────────────────

CREATE TABLE "Subscription" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "supporterProfileId" TEXT        NOT NULL,
  "starProfileId"      TEXT        NOT NULL,
  "tier"               TEXT        NOT NULL DEFAULT 'basic',
  "status"             TEXT        NOT NULL DEFAULT 'active',
  "startedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endsAt"             TIMESTAMPTZ,
  "cancelledAt"        TIMESTAMPTZ,
  "renewalEnabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "idempotencyKey"     TEXT        NOT NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Subscription_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "Subscription_supporterProfileId_fkey"
    FOREIGN KEY ("supporterProfileId") REFERENCES "SupporterProfile"("id")
);

CREATE INDEX "Subscription_supporterProfileId_status_idx"
  ON "Subscription"("supporterProfileId", "status");
CREATE INDEX "Subscription_starProfileId_idx" ON "Subscription"("starProfileId");

-- ── Arena (declared before Event because Event has an optional FK to Arena) ───

CREATE TABLE "Arena" (
  "id"              TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "starProfileId"   TEXT          NOT NULL,
  "name"            TEXT          NOT NULL,
  "description"     TEXT,
  "status"          "ArenaStatus" NOT NULL DEFAULT 'ACTIVE',
  "livekitRoom"     TEXT,
  "maxParticipants" INTEGER       NOT NULL DEFAULT 500,
  "isPrivate"       BOOLEAN       NOT NULL DEFAULT FALSE,
  "createdAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "Arena_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "Arena_livekitRoom_key" UNIQUE ("livekitRoom"),
  CONSTRAINT "Arena_starProfileId_fkey"
    FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id")
);

CREATE INDEX "Arena_starProfileId_idx" ON "Arena"("starProfileId");
CREATE INDEX "Arena_status_idx"        ON "Arena"("status");

-- ── Event ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Event" (
  "id"            TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "starProfileId" TEXT          NOT NULL,
  "title"         TEXT          NOT NULL,
  "description"   TEXT,
  "type"          "EventType"   NOT NULL DEFAULT 'LIVE_STREAM',
  "status"        "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt"   TIMESTAMPTZ,
  "startedAt"     TIMESTAMPTZ,
  "endedAt"       TIMESTAMPTZ,
  "thumbnailUrl"  TEXT,
  "replayUrl"     TEXT,
  "category"      TEXT          NOT NULL DEFAULT 'general',
  "tags"          TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "arenaId"       TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "Event_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "Event_starProfileId_fkey"
    FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id"),
  CONSTRAINT "Event_arenaId_fkey"
    FOREIGN KEY ("arenaId") REFERENCES "Arena"("id")
);

CREATE INDEX "Event_starProfileId_idx" ON "Event"("starProfileId");
CREATE INDEX "Event_status_idx"        ON "Event"("status");
CREATE INDEX "Event_scheduledAt_idx"   ON "Event"("scheduledAt");

-- ── Tap ───────────────────────────────────────────────────────────────────────

CREATE TABLE "Tap" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "senderId"       TEXT        NOT NULL,
  "receiverId"     TEXT        NOT NULL,
  "type"           "TapType"   NOT NULL,
  "status"         "TapStatus" NOT NULL DEFAULT 'PENDING',
  "coinAmount"     INTEGER,
  "fiatAmount"     INTEGER,
  "currency"       TEXT        NOT NULL DEFAULT 'USD',
  "message"        TEXT,
  "contextType"    TEXT,
  "contextId"      TEXT,
  "idempotencyKey" TEXT        NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "settledAt"      TIMESTAMPTZ,

  CONSTRAINT "Tap_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "Tap_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "Tap_senderId_fkey"   FOREIGN KEY ("senderId")   REFERENCES "User"("id"),
  CONSTRAINT "Tap_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id")
);

CREATE INDEX "Tap_senderId_idx"              ON "Tap"("senderId");
CREATE INDEX "Tap_receiverId_idx"            ON "Tap"("receiverId");
CREATE INDEX "Tap_contextType_contextId_idx" ON "Tap"("contextType", "contextId");

-- ── Wallet ────────────────────────────────────────────────────────────────────

CREATE TABLE "Wallet" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"      TEXT        NOT NULL,
  "coinBalance" INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Wallet_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "Wallet_userId_key"  UNIQUE ("userId"),
  CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── WalletEntry ───────────────────────────────────────────────────────────────

CREATE TABLE "WalletEntry" (
  "id"             TEXT              NOT NULL DEFAULT gen_random_uuid()::text,
  "walletId"       TEXT              NOT NULL,
  "type"           "WalletEntryType" NOT NULL,
  "coinAmount"     INTEGER,
  "fiatAmount"     INTEGER,
  "currency"       TEXT              NOT NULL DEFAULT 'USD',
  "description"    TEXT,
  "tapId"          TEXT,
  "previousHash"   TEXT,
  "hash"           TEXT              NOT NULL,
  "idempotencyKey" TEXT              NOT NULL,
  "createdAt"      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT "WalletEntry_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "WalletEntry_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "WalletEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id"),
  CONSTRAINT "WalletEntry_tapId_fkey"    FOREIGN KEY ("tapId")    REFERENCES "Tap"("id")
);

CREATE INDEX "WalletEntry_walletId_idx" ON "WalletEntry"("walletId");
CREATE INDEX "WalletEntry_tapId_idx"    ON "WalletEntry"("tapId");

-- ── Notification ──────────────────────────────────────────────────────────────

CREATE TABLE "Notification" (
  "id"        TEXT                  NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT                  NOT NULL,
  "type"      TEXT                  NOT NULL,
  "channel"   "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "title"     TEXT,
  "body"      TEXT                  NOT NULL,
  "data"      JSONB,
  "isRead"    BOOLEAN               NOT NULL DEFAULT FALSE,
  "readAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

  CONSTRAINT "Notification_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "Notification_userId_isRead_idx"    ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- ── ModerationReport ──────────────────────────────────────────────────────────

CREATE TABLE "ModerationReport" (
  "id"         TEXT                   NOT NULL DEFAULT gen_random_uuid()::text,
  "reporterId" TEXT                   NOT NULL,
  "targetType" TEXT                   NOT NULL,
  "targetId"   TEXT                   NOT NULL,
  "caseType"   TEXT                   NOT NULL,
  "reason"     TEXT,
  "status"     "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ            NOT NULL DEFAULT NOW(),

  CONSTRAINT "ModerationReport_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "ModerationReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id")
);

CREATE INDEX "ModerationReport_targetType_targetId_idx"
  ON "ModerationReport"("targetType", "targetId");
CREATE INDEX "ModerationReport_status_idx" ON "ModerationReport"("status");

-- ── WatchSession ──────────────────────────────────────────────────────────────

CREATE TABLE "WatchSession" (
  "id"                     TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"                 TEXT        NOT NULL,
  "contentId"              TEXT        NOT NULL,
  "contentType"            TEXT        NOT NULL,
  "joinedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leftAt"                 TIMESTAMPTZ,
  "lastPositionSeconds"    INTEGER,
  "contentDurationSeconds" INTEGER,

  CONSTRAINT "WatchSession_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "WatchSession_userId_fkey"   FOREIGN KEY ("userId")    REFERENCES "User"("id"),
  CONSTRAINT "WatchSession_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Event"("id")
);

CREATE INDEX "WatchSession_contentId_contentType_idx" ON "WatchSession"("contentId", "contentType");
CREATE INDEX "WatchSession_userId_idx"                ON "WatchSession"("userId");

-- ── FeedEngagement ────────────────────────────────────────────────────────────

CREATE TABLE "FeedEngagement" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"      TEXT        NOT NULL,
  "contentId"   TEXT        NOT NULL,
  "contentType" TEXT        NOT NULL,
  "action"      TEXT        NOT NULL,
  "category"    TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "FeedEngagement_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "FeedEngagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE INDEX "FeedEngagement_userId_idx"    ON "FeedEngagement"("userId");
CREATE INDEX "FeedEngagement_contentId_idx" ON "FeedEngagement"("contentId");

-- ── MediaUpload ───────────────────────────────────────────────────────────────

CREATE TABLE "MediaUpload" (
  "id"          TEXT              NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"      TEXT              NOT NULL,
  "purpose"     TEXT              NOT NULL,
  "fileName"    TEXT              NOT NULL,
  "contentType" TEXT              NOT NULL,
  "storageKey"  TEXT              NOT NULL,
  "fileUrl"     TEXT,
  "status"      "MediaScanStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "expiresAt"   TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,

  CONSTRAINT "MediaUpload_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "MediaUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE INDEX "MediaUpload_userId_idx" ON "MediaUpload"("userId");
CREATE INDEX "MediaUpload_status_idx" ON "MediaUpload"("status");

-- ── ContentIndex ──────────────────────────────────────────────────────────────
-- Standalone contentId @unique is intentionally deferred to
-- migration 20260617000002_content_index_unique_constraint.

CREATE TABLE "ContentIndex" (
  "id"           TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "contentType"  TEXT             NOT NULL,
  "contentId"    TEXT             NOT NULL,
  "title"        TEXT             NOT NULL,
  "body"         TEXT,
  "tags"         TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "languageCode" TEXT             NOT NULL DEFAULT 'en',
  "score"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN          NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "ContentIndex_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentIndex_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Event"("id")
);

CREATE UNIQUE INDEX "ContentIndex_contentType_contentId_key"
  ON "ContentIndex"("contentType", "contentId");
CREATE INDEX "ContentIndex_contentType_idx" ON "ContentIndex"("contentType");
CREATE INDEX "ContentIndex_score_idx"       ON "ContentIndex"("score");

-- ── RecommendationFeedback ────────────────────────────────────────────────────

CREATE TABLE "RecommendationFeedback" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"         TEXT        NOT NULL,
  "contentIndexId" TEXT        NOT NULL,
  "action"         TEXT        NOT NULL,
  "reason"         TEXT,
  "context"        JSONB,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationFeedback_userId_idx"
  ON "RecommendationFeedback"("userId");
CREATE INDEX "RecommendationFeedback_contentIndexId_idx"
  ON "RecommendationFeedback"("contentIndexId");

-- ── AiCreatorProfile ──────────────────────────────────────────────────────────

CREATE TABLE "AiCreatorProfile" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "starProfileId" TEXT        NOT NULL,
  "preferences"   JSONB,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AiCreatorProfile_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "AiCreatorProfile_starProfileId_key" UNIQUE ("starProfileId"),
  CONSTRAINT "AiCreatorProfile_starProfileId_fkey"
    FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id")
);

-- ── AiGeneration ──────────────────────────────────────────────────────────────

CREATE TABLE "AiGeneration" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "aiCreatorProfileId" TEXT        NOT NULL,
  "type"               TEXT        NOT NULL,
  "prompt"             TEXT        NOT NULL,
  "result"             TEXT,
  "model"              TEXT,
  "tokensUsed"         INTEGER,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiGeneration_aiCreatorProfileId_fkey"
    FOREIGN KEY ("aiCreatorProfileId") REFERENCES "AiCreatorProfile"("id")
);

CREATE INDEX "AiGeneration_aiCreatorProfileId_idx" ON "AiGeneration"("aiCreatorProfileId");
