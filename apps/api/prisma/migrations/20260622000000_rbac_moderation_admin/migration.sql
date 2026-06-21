-- RBAC + moderation + admin tooling.
-- 1) Add MODERATOR to the UserRole enum (between STAR and ADMIN, ordering is
--    cosmetic — the privilege hierarchy lives in application code).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR';

-- 2) Account suspension fields on User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

-- 3) Moderation case workflow fields.
ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "severity" TEXT;
ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "resolvedBy" TEXT;

-- 4) UserBlock.
CREATE TABLE IF NOT EXISTS "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) ModerationAuditLog.
CREATE TABLE IF NOT EXISTS "ModerationAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModerationAuditLog_actorId_idx" ON "ModerationAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "ModerationAuditLog_targetType_targetId_idx" ON "ModerationAuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ModerationAuditLog_createdAt_idx" ON "ModerationAuditLog"("createdAt");
