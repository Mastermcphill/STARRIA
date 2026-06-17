-- Migration: 20260616000003_support_streaks_anniversaries
-- Adds SupportStreak table for tracking daily gifting continuity.

CREATE TABLE "SupportStreak" (
  "id"                    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "supportRelationshipId" TEXT        NOT NULL,
  "currentStreakDays"     INTEGER     NOT NULL DEFAULT 1,
  "longestStreakDays"     INTEGER     NOT NULL DEFAULT 1,
  "lastGiftAt"            TIMESTAMPTZ NOT NULL,
  "streakStartedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "SupportStreak_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportStreak_supportRelationshipId_fkey"
    FOREIGN KEY ("supportRelationshipId")
    REFERENCES "SupportRelationship"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX "SupportStreak_supportRelationshipId_key"
  ON "SupportStreak"("supportRelationshipId");

CREATE INDEX "SupportStreak_currentStreakDays_idx"
  ON "SupportStreak"("currentStreakDays");
