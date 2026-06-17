-- Migration: 20260617000001_video_discovery
-- Sprint 2 — Video Discovery Engine.
-- Adds Genre/VideoStatus enums and Video, VideoWatch, ContentTap,
-- DiscoveryScore, RegionalTapBoost, TrendingScore tables.

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "Genre" AS ENUM (
  'COMEDY', 'AI_MOVIES', 'AI_SERIES', 'MUSIC',
  'ANIMALS', 'ANIMATION', 'EDUCATION', 'LIFESTYLE'
);

CREATE TYPE "VideoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- ── Video ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Video" (
  "id"              TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "starProfileId"   TEXT          NOT NULL,
  "uploaderUserId"  TEXT          NOT NULL,
  "title"           TEXT          NOT NULL,
  "description"     TEXT,
  "genre"           "Genre"       NOT NULL,
  "country"         TEXT,
  "language"        TEXT,
  "tags"            TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"          "VideoStatus" NOT NULL DEFAULT 'UPLOADING',
  "storageKey"      TEXT          NOT NULL,
  "playbackUrl"     TEXT,
  "thumbnailUrl"    TEXT,
  "durationSeconds" INTEGER,
  "width"           INTEGER,
  "height"          INTEGER,
  "viewCount"       INTEGER       NOT NULL DEFAULT 0,
  "tapCount"        INTEGER       NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "publishedAt"     TIMESTAMPTZ,

  CONSTRAINT "Video_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Video_starProfileId_fkey" FOREIGN KEY ("starProfileId") REFERENCES "StarProfile"("id"),
  CONSTRAINT "Video_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id")
);

CREATE INDEX "Video_starProfileId_idx"     ON "Video"("starProfileId");
CREATE INDEX "Video_genre_status_idx"      ON "Video"("genre", "status");
CREATE INDEX "Video_country_status_idx"    ON "Video"("country", "status");
CREATE INDEX "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");

-- ── VideoWatch ────────────────────────────────────────────────────────────────

CREATE TABLE "VideoWatch" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"          TEXT        NOT NULL,
  "videoId"         TEXT        NOT NULL,
  "country"         TEXT,
  "region"          TEXT,
  "watchSeconds"    INTEGER     NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER     NOT NULL DEFAULT 0,
  "retention"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completed"       BOOLEAN     NOT NULL DEFAULT FALSE,
  "startedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"     TIMESTAMPTZ,

  CONSTRAINT "VideoWatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VideoWatch_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id"),
  CONSTRAINT "VideoWatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE
);

CREATE INDEX "VideoWatch_videoId_idx"           ON "VideoWatch"("videoId");
CREATE INDEX "VideoWatch_userId_idx"            ON "VideoWatch"("userId");
CREATE INDEX "VideoWatch_videoId_completed_idx" ON "VideoWatch"("videoId", "completed");

-- ── ContentTap ────────────────────────────────────────────────────────────────

CREATE TABLE "ContentTap" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"     TEXT        NOT NULL,
  "videoId"    TEXT        NOT NULL,
  "weight"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "region"     TEXT        NOT NULL DEFAULT 'XX',
  "country"    TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "ContentTap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentTap_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id"),
  CONSTRAINT "ContentTap_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE
);

CREATE INDEX "ContentTap_videoId_idx"           ON "ContentTap"("videoId");
CREATE INDEX "ContentTap_userId_videoId_idx"    ON "ContentTap"("userId", "videoId");
CREATE INDEX "ContentTap_videoId_region_idx"    ON "ContentTap"("videoId", "region");
CREATE INDEX "ContentTap_videoId_createdAt_idx" ON "ContentTap"("videoId", "createdAt");

-- ── DiscoveryScore ────────────────────────────────────────────────────────────

CREATE TABLE "DiscoveryScore" (
  "id"                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "videoId"             TEXT        NOT NULL,
  "score"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "watchTimeScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "supportersScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tapVelocityScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "retentionScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "starMultiplierScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "DiscoveryScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscoveryScore_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "DiscoveryScore_videoId_key" ON "DiscoveryScore"("videoId");
CREATE INDEX "DiscoveryScore_score_idx"          ON "DiscoveryScore"("score");

-- ── RegionalTapBoost ──────────────────────────────────────────────────────────

CREATE TABLE "RegionalTapBoost" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "videoId"    TEXT        NOT NULL,
  "region"     TEXT        NOT NULL,
  "boostScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tapCount"   INTEGER     NOT NULL DEFAULT 0,
  "lastTapAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "RegionalTapBoost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegionalTapBoost_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "RegionalTapBoost_videoId_region_key" ON "RegionalTapBoost"("videoId", "region");
CREATE INDEX "RegionalTapBoost_region_boostScore_idx"     ON "RegionalTapBoost"("region", "boostScore");

-- ── TrendingScore ─────────────────────────────────────────────────────────────

CREATE TABLE "TrendingScore" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "videoId"   TEXT        NOT NULL,
  "scope"     TEXT        NOT NULL DEFAULT 'GLOBAL',
  "score"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rank"      INTEGER     NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "TrendingScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrendingScore_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "TrendingScore_videoId_scope_key" ON "TrendingScore"("videoId", "scope");
CREATE INDEX "TrendingScore_scope_rank_idx"           ON "TrendingScore"("scope", "rank");
CREATE INDEX "TrendingScore_scope_score_idx"          ON "TrendingScore"("scope", "score");
