-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260616000001_add_domain_models
-- Adds 12 domain models + 2 implicit join/response tables.
-- Safe to run against a database that already has the initial STARRIA schema.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── New Enum Types ────────────────────────────────────────────────────────────

CREATE TYPE "SupportRelationshipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "SupportMilestoneType"      AS ENUM ('FIRST_TAP', 'COIN_THRESHOLD', 'TAP_COUNT', 'STREAK', 'ANNIVERSARY');
CREATE TYPE "GoldStarStatus"            AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "StarHistoryEventType"      AS ENUM (
  'TIER_CHANGE',
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'SUSPENSION',
  'REACTIVATION',
  'PROFILE_UPDATE',
  'GOLD_STAR_GRANTED',
  'GOLD_STAR_REVOKED'
);
CREATE TYPE "TapStormStatus"            AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "TicketPurchaseStatus"      AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "TicketAttributionType"     AS ENUM ('DIRECT', 'REFERRAL', 'ORGANIC', 'PROMO');
CREATE TYPE "PosterGenerationStatus"    AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "CreatorHouseStatus"        AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CreatorSeasonStatus"       AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED');
CREATE TYPE "ArenaVoteStatus"           AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "RegionalEntityType"        AS ENUM ('STAR', 'EVENT', 'ARENA');

-- ── SupportRelationship ───────────────────────────────────────────────────────

CREATE TABLE "SupportRelationship" (
    "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "supporterProfileId" TEXT        NOT NULL,
    "starProfileId"      TEXT        NOT NULL,
    "status"             "SupportRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "totalCoinsGifted"   INTEGER     NOT NULL DEFAULT 0,
    "totalFiatGifted"    INTEGER     NOT NULL DEFAULT 0,
    "tapCount"           INTEGER     NOT NULL DEFAULT 0,
    "milestoneLevel"     INTEGER     NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "SupportRelationship_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportRelationship_supporterProfileId_starProfileId_key"
        UNIQUE ("supporterProfileId", "starProfileId"),
    CONSTRAINT "SupportRelationship_supporterProfileId_fkey"
        FOREIGN KEY ("supporterProfileId") REFERENCES "SupporterProfile"("id") ON DELETE RESTRICT,
    CONSTRAINT "SupportRelationship_starProfileId_fkey"
        FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id") ON DELETE RESTRICT
);

CREATE INDEX "SupportRelationship_starProfileId_idx"   ON "SupportRelationship"("starProfileId");
CREATE INDEX "SupportRelationship_status_idx"          ON "SupportRelationship"("status");

-- ── SupportMilestone ──────────────────────────────────────────────────────────

CREATE TABLE "SupportMilestone" (
    "id"                    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "supportRelationshipId" TEXT        NOT NULL,
    "type"                  "SupportMilestoneType" NOT NULL,
    "thresholdValue"        INTEGER     NOT NULL,
    "achievedAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "notifiedAt"            TIMESTAMPTZ,
    "metadata"              JSONB,

    CONSTRAINT "SupportMilestone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportMilestone_supportRelationshipId_fkey"
        FOREIGN KEY ("supportRelationshipId") REFERENCES "SupportRelationship"("id") ON DELETE CASCADE
);

CREATE INDEX "SupportMilestone_supportRelationshipId_idx" ON "SupportMilestone"("supportRelationshipId");
CREATE INDEX "SupportMilestone_type_idx"                  ON "SupportMilestone"("type");

-- ── GoldStarProfile ───────────────────────────────────────────────────────────

CREATE TABLE "GoldStarProfile" (
    "id"              TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
    "starProfileId"   TEXT           NOT NULL,
    "status"          "GoldStarStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt"       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "grantedByUserId" TEXT           NOT NULL,
    "expiresAt"       TIMESTAMPTZ,
    "revokedAt"       TIMESTAMPTZ,
    "revokedByUserId" TEXT,
    "reason"          TEXT,
    "benefits"        JSONB,

    CONSTRAINT "GoldStarProfile_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "GoldStarProfile_starProfileId_key" UNIQUE ("starProfileId"),
    CONSTRAINT "GoldStarProfile_starProfileId_fkey"
        FOREIGN KEY ("starProfileId")   REFERENCES "StarProfile"("id") ON DELETE CASCADE,
    CONSTRAINT "GoldStarProfile_grantedByUserId_fkey"
        FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id"),
    CONSTRAINT "GoldStarProfile_revokedByUserId_fkey"
        FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id")
);

CREATE INDEX "GoldStarProfile_status_idx"        ON "GoldStarProfile"("status");
CREATE INDEX "GoldStarProfile_grantedByUserId_idx" ON "GoldStarProfile"("grantedByUserId");

-- ── StarHistory ───────────────────────────────────────────────────────────────

CREATE TABLE "StarHistory" (
    "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "starProfileId"   TEXT        NOT NULL,
    "eventType"       "StarHistoryEventType" NOT NULL,
    "previousValue"   JSONB,
    "newValue"        JSONB,
    "changedByUserId" TEXT,
    "changedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "reason"          TEXT,

    CONSTRAINT "StarHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StarHistory_starProfileId_fkey"
        FOREIGN KEY ("starProfileId")   REFERENCES "StarProfile"("id") ON DELETE CASCADE,
    CONSTRAINT "StarHistory_changedByUserId_fkey"
        FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "StarHistory_starProfileId_idx" ON "StarHistory"("starProfileId");
CREATE INDEX "StarHistory_eventType_idx"     ON "StarHistory"("eventType");
CREATE INDEX "StarHistory_changedAt_idx"     ON "StarHistory"("changedAt");

-- ── RegionalBoost ─────────────────────────────────────────────────────────────

CREATE TABLE "RegionalBoost" (
    "id"                 TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
    "entityType"         "RegionalEntityType" NOT NULL,
    "entityId"           TEXT               NOT NULL,
    "region"             TEXT               NOT NULL,
    "boostScore"         DOUBLE PRECISION   NOT NULL DEFAULT 1.0,
    "isActive"           BOOLEAN            NOT NULL DEFAULT true,
    "startedAt"          TIMESTAMPTZ        NOT NULL DEFAULT now(),
    "expiresAt"          TIMESTAMPTZ,
    "authorizedByUserId" TEXT               NOT NULL,
    "reason"             TEXT,
    "createdAt"          TIMESTAMPTZ        NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ        NOT NULL DEFAULT now(),

    CONSTRAINT "RegionalBoost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RegionalBoost_authorizedByUserId_fkey"
        FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id")
);

CREATE INDEX "RegionalBoost_entityType_entityId_idx" ON "RegionalBoost"("entityType", "entityId");
CREATE INDEX "RegionalBoost_region_isActive_idx"     ON "RegionalBoost"("region", "isActive");
CREATE INDEX "RegionalBoost_expiresAt_idx"           ON "RegionalBoost"("expiresAt");

-- ── TapStorm ──────────────────────────────────────────────────────────────────

CREATE TABLE "TapStorm" (
    "id"                  TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
    "starProfileId"       TEXT           NOT NULL,
    "title"               TEXT           NOT NULL,
    "description"         TEXT,
    "contextType"         TEXT,
    "contextId"           TEXT,
    "startsAt"            TIMESTAMPTZ    NOT NULL,
    "endsAt"              TIMESTAMPTZ    NOT NULL,
    "goalCoins"           INTEGER        NOT NULL,
    "totalCoinsCollected" INTEGER        NOT NULL DEFAULT 0,
    "participantCount"    INTEGER        NOT NULL DEFAULT 0,
    "tapCount"            INTEGER        NOT NULL DEFAULT 0,
    "status"              "TapStormStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt"           TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT "TapStorm_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TapStorm_starProfileId_fkey"
        FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id")
);

CREATE INDEX "TapStorm_starProfileId_idx"        ON "TapStorm"("starProfileId");
CREATE INDEX "TapStorm_status_idx"               ON "TapStorm"("status");
CREATE INDEX "TapStorm_startsAt_endsAt_idx"      ON "TapStorm"("startsAt", "endsAt");
CREATE INDEX "TapStorm_contextType_contextId_idx" ON "TapStorm"("contextType", "contextId");

-- ── TicketPurchase ────────────────────────────────────────────────────────────

CREATE TABLE "TicketPurchase" (
    "id"                       TEXT                  NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"                   TEXT                  NOT NULL,
    "eventId"                  TEXT                  NOT NULL,
    "quantity"                 INTEGER               NOT NULL DEFAULT 1,
    "unitPriceFiatMinorUnits"  INTEGER               NOT NULL,
    "currency"                 TEXT                  NOT NULL DEFAULT 'NGN',
    "totalFiatMinorUnits"      INTEGER               NOT NULL,
    "status"                   "TicketPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "reference"                TEXT                  NOT NULL,
    "idempotencyKey"           TEXT                  NOT NULL,
    "purchasedAt"              TIMESTAMPTZ           NOT NULL DEFAULT now(),
    "refundedAt"               TIMESTAMPTZ,
    "metadata"                 JSONB,

    CONSTRAINT "TicketPurchase_pkey"           PRIMARY KEY ("id"),
    CONSTRAINT "TicketPurchase_idempotencyKey_key" UNIQUE ("idempotencyKey"),
    CONSTRAINT "TicketPurchase_userId_fkey"
        FOREIGN KEY ("userId")  REFERENCES "User"("id"),
    CONSTRAINT "TicketPurchase_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id")
);

CREATE INDEX "TicketPurchase_userId_idx"    ON "TicketPurchase"("userId");
CREATE INDEX "TicketPurchase_eventId_idx"   ON "TicketPurchase"("eventId");
CREATE INDEX "TicketPurchase_status_idx"    ON "TicketPurchase"("status");
CREATE INDEX "TicketPurchase_reference_idx" ON "TicketPurchase"("reference");

-- ── TicketAttribution ─────────────────────────────────────────────────────────

CREATE TABLE "TicketAttribution" (
    "id"                TEXT                  NOT NULL DEFAULT gen_random_uuid()::text,
    "ticketPurchaseId"  TEXT                  NOT NULL,
    "attributedToUserId" TEXT,
    "attributionType"   "TicketAttributionType" NOT NULL DEFAULT 'DIRECT',
    "promoCode"         TEXT,
    "campaignId"        TEXT,
    "metadata"          JSONB,
    "createdAt"         TIMESTAMPTZ           NOT NULL DEFAULT now(),

    CONSTRAINT "TicketAttribution_pkey"               PRIMARY KEY ("id"),
    CONSTRAINT "TicketAttribution_ticketPurchaseId_key" UNIQUE ("ticketPurchaseId"),
    CONSTRAINT "TicketAttribution_ticketPurchaseId_fkey"
        FOREIGN KEY ("ticketPurchaseId")  REFERENCES "TicketPurchase"("id") ON DELETE CASCADE,
    CONSTRAINT "TicketAttribution_attributedToUserId_fkey"
        FOREIGN KEY ("attributedToUserId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "TicketAttribution_attributedToUserId_idx" ON "TicketAttribution"("attributedToUserId");
CREATE INDEX "TicketAttribution_campaignId_idx"         ON "TicketAttribution"("campaignId");

-- ── PosterGeneration ──────────────────────────────────────────────────────────

CREATE TABLE "PosterGeneration" (
    "id"             TEXT                   NOT NULL DEFAULT gen_random_uuid()::text,
    "starProfileId"  TEXT                   NOT NULL,
    "eventId"        TEXT,
    "prompt"         TEXT                   NOT NULL,
    "style"          TEXT,
    "resultImageUrl" TEXT,
    "storageKey"     TEXT,
    "status"         "PosterGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "model"          TEXT,
    "generationMs"   INTEGER,
    "createdAt"      TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT "PosterGeneration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PosterGeneration_starProfileId_fkey"
        FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id"),
    CONSTRAINT "PosterGeneration_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL
);

CREATE INDEX "PosterGeneration_starProfileId_idx" ON "PosterGeneration"("starProfileId");
CREATE INDEX "PosterGeneration_eventId_idx"       ON "PosterGeneration"("eventId");
CREATE INDEX "PosterGeneration_status_idx"        ON "PosterGeneration"("status");

-- ── CreatorHouse ──────────────────────────────────────────────────────────────

CREATE TABLE "CreatorHouse" (
    "id"                 TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
    "name"               TEXT               NOT NULL,
    "slug"               TEXT               NOT NULL,
    "description"        TEXT,
    "avatarUrl"          TEXT,
    "bannerUrl"          TEXT,
    "ownerStarProfileId" TEXT               NOT NULL,
    "status"             "CreatorHouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberCount"        INTEGER            NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMPTZ        NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ        NOT NULL DEFAULT now(),

    CONSTRAINT "CreatorHouse_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "CreatorHouse_slug_key" UNIQUE ("slug"),
    CONSTRAINT "CreatorHouse_ownerStarProfileId_fkey"
        FOREIGN KEY ("ownerStarProfileId") REFERENCES "StarProfile"("id")
);

CREATE INDEX "CreatorHouse_ownerStarProfileId_idx" ON "CreatorHouse"("ownerStarProfileId");
CREATE INDEX "CreatorHouse_status_idx"             ON "CreatorHouse"("status");

-- ── CreatorHouseMember ────────────────────────────────────────────────────────

CREATE TABLE "CreatorHouseMember" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "creatorHouseId" TEXT        NOT NULL,
    "starProfileId"  TEXT        NOT NULL,
    "userId"         TEXT        NOT NULL,
    "role"           TEXT        NOT NULL DEFAULT 'member',
    "joinedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "leftAt"         TIMESTAMPTZ,

    CONSTRAINT "CreatorHouseMember_pkey"                          PRIMARY KEY ("id"),
    CONSTRAINT "CreatorHouseMember_creatorHouseId_starProfileId_key" UNIQUE ("creatorHouseId", "starProfileId"),
    CONSTRAINT "CreatorHouseMember_creatorHouseId_fkey"
        FOREIGN KEY ("creatorHouseId") REFERENCES "CreatorHouse"("id") ON DELETE CASCADE,
    CONSTRAINT "CreatorHouseMember_starProfileId_fkey"
        FOREIGN KEY ("starProfileId")  REFERENCES "StarProfile"("id"),
    CONSTRAINT "CreatorHouseMember_userId_fkey"
        FOREIGN KEY ("userId")         REFERENCES "User"("id")
);

CREATE INDEX "CreatorHouseMember_starProfileId_idx" ON "CreatorHouseMember"("starProfileId");
CREATE INDEX "CreatorHouseMember_userId_idx"        ON "CreatorHouseMember"("userId");

-- ── CreatorSeason ─────────────────────────────────────────────────────────────

CREATE TABLE "CreatorSeason" (
    "id"               TEXT                NOT NULL DEFAULT gen_random_uuid()::text,
    "starProfileId"    TEXT                NOT NULL,
    "name"             TEXT                NOT NULL,
    "number"           INTEGER             NOT NULL,
    "description"      TEXT,
    "coverImageUrl"    TEXT,
    "startsAt"         TIMESTAMPTZ         NOT NULL,
    "endsAt"           TIMESTAMPTZ         NOT NULL,
    "status"           "CreatorSeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "totalCoinsEarned" INTEGER             NOT NULL DEFAULT 0,
    "totalEvents"      INTEGER             NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ         NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT "CreatorSeason_pkey"                      PRIMARY KEY ("id"),
    CONSTRAINT "CreatorSeason_starProfileId_number_key"  UNIQUE ("starProfileId", "number"),
    CONSTRAINT "CreatorSeason_starProfileId_fkey"
        FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id")
);

CREATE INDEX "CreatorSeason_starProfileId_idx"   ON "CreatorSeason"("starProfileId");
CREATE INDEX "CreatorSeason_status_idx"          ON "CreatorSeason"("status");
CREATE INDEX "CreatorSeason_startsAt_endsAt_idx" ON "CreatorSeason"("startsAt", "endsAt");

-- ── ArenaVote ─────────────────────────────────────────────────────────────────

CREATE TABLE "ArenaVote" (
    "id"              TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
    "arenaId"         TEXT            NOT NULL,
    "createdByUserId" TEXT            NOT NULL,
    "question"        TEXT            NOT NULL,
    "options"         JSONB           NOT NULL,
    "status"          "ArenaVoteStatus" NOT NULL DEFAULT 'OPEN',
    "endsAt"          TIMESTAMPTZ,
    "totalVotes"      INTEGER         NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "closedAt"        TIMESTAMPTZ,

    CONSTRAINT "ArenaVote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArenaVote_arenaId_fkey"
        FOREIGN KEY ("arenaId")         REFERENCES "Arena"("id"),
    CONSTRAINT "ArenaVote_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
);

CREATE INDEX "ArenaVote_arenaId_idx"  ON "ArenaVote"("arenaId");
CREATE INDEX "ArenaVote_status_idx"   ON "ArenaVote"("status");
CREATE INDEX "ArenaVote_createdAt_idx" ON "ArenaVote"("createdAt");

-- ── ArenaVoteResponse ─────────────────────────────────────────────────────────

CREATE TABLE "ArenaVoteResponse" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "arenaVoteId" TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "optionId"    TEXT        NOT NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "ArenaVoteResponse_pkey"               PRIMARY KEY ("id"),
    CONSTRAINT "ArenaVoteResponse_arenaVoteId_userId_key" UNIQUE ("arenaVoteId", "userId"),
    CONSTRAINT "ArenaVoteResponse_arenaVoteId_fkey"
        FOREIGN KEY ("arenaVoteId") REFERENCES "ArenaVote"("id") ON DELETE CASCADE,
    CONSTRAINT "ArenaVoteResponse_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE INDEX "ArenaVoteResponse_arenaVoteId_idx" ON "ArenaVoteResponse"("arenaVoteId");
CREATE INDEX "ArenaVoteResponse_userId_idx"      ON "ArenaVoteResponse"("userId");
