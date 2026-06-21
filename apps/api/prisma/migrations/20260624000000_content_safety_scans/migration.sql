-- Phase 3 (content-safety automation): persistent scan records + enums.

-- Scan outcome + payload kind enums.
DO $$ BEGIN
  CREATE TYPE "ContentScanStatus" AS ENUM ('PENDING', 'ALLOWED', 'FLAGGED', 'BLOCKED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ContentScanKind" AS ENUM ('TEXT', 'IMAGE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ContentScan: one row per scanned payload; the human-review queue for FLAGGED
-- items and the retry queue for PENDING/ERROR items.
CREATE TABLE IF NOT EXISTS "ContentScan" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "kind" "ContentScanKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ContentScanStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "severity" TEXT,
    "findings" JSONB,
    "reportId" TEXT,
    "submittedBy" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentScan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContentScan_status_idx" ON "ContentScan"("status");
CREATE INDEX IF NOT EXISTS "ContentScan_targetType_targetId_idx" ON "ContentScan"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ContentScan_createdAt_idx" ON "ContentScan"("createdAt");
