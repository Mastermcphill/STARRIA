-- Migration: 20260616000002_support_economy_fields
-- Adds fields required by support-core SupporterProfile and Subscription domain types.

-- ── SupporterProfile additions ────────────────────────────────────────────────

ALTER TABLE "SupporterProfile"
  ADD COLUMN IF NOT EXISTS "displayName"        TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "avatarUrl"           TEXT,
  ADD COLUMN IF NOT EXISTS "bio"                 TEXT,
  ADD COLUMN IF NOT EXISTS "tier"                TEXT    NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "lifetimeCoinsSpent"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetimeFiatSpent"   INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "SupporterProfile_tier_idx" ON "SupporterProfile"("tier");

-- ── Subscription additions ────────────────────────────────────────────────────

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "tier"           TEXT    NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS "status"         TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "cancelledAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "renewalEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Back-fill idempotencyKey for existing rows (generate from id)
UPDATE "Subscription" SET "idempotencyKey" = 'legacy:' || id WHERE "idempotencyKey" IS NULL;

-- Now enforce NOT NULL and UNIQUE
ALTER TABLE "Subscription"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_idempotencyKey_key" ON "Subscription"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
