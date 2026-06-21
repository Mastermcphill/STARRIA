-- Phase 1 (payouts) + Phase 5 (ledger chain) schema.

-- Wallet: reserved-funds bucket for in-flight payouts.
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "reservedCoins" INTEGER NOT NULL DEFAULT 0;

-- WalletEntry: per-wallet monotonic chain position.
ALTER TABLE "WalletEntry" ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "WalletEntry_walletId_sequence_idx" ON "WalletEntry"("walletId", "sequence");

-- Payout status enum.
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PayoutRequest.
CREATE TABLE IF NOT EXISTS "PayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCoins" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "destination" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_idempotencyKey_key" ON "PayoutRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PayoutRequest_userId_idx" ON "PayoutRequest"("userId");
CREATE INDEX IF NOT EXISTS "PayoutRequest_status_idx" ON "PayoutRequest"("status");
CREATE INDEX IF NOT EXISTS "PayoutRequest_providerRef_idx" ON "PayoutRequest"("providerRef");
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Wallet"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- PayoutAttempt.
CREATE TABLE IF NOT EXISTS "PayoutAttempt" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayoutAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayoutAttempt_payoutId_idx" ON "PayoutAttempt"("payoutId");
ALTER TABLE "PayoutAttempt" ADD CONSTRAINT "PayoutAttempt_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PayoutRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PayoutWebhook (replay protection via unique dedupeKey).
CREATE TABLE IF NOT EXISTS "PayoutWebhook" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT,
    "event" TEXT NOT NULL,
    "providerRef" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayoutWebhook_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutWebhook_dedupeKey_key" ON "PayoutWebhook"("dedupeKey");
CREATE INDEX IF NOT EXISTS "PayoutWebhook_payoutId_idx" ON "PayoutWebhook"("payoutId");
ALTER TABLE "PayoutWebhook" ADD CONSTRAINT "PayoutWebhook_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
