-- Migration: 20260625000003_payout_recipient_onboarding
-- Onboarding-heavy payout rails (Stripe Connect / Wise / Trolley / Tipalti):
-- a persistent payee entity per (user, provider) plus its onboarding webhook log.

-- CreateTable
CREATE TABLE "PayoutRecipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payable" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientOnboardingWebhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientOnboardingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecipient_userId_provider_key" ON "PayoutRecipient"("userId", "provider");
CREATE UNIQUE INDEX "PayoutRecipient_provider_providerRef_key" ON "PayoutRecipient"("provider", "providerRef");
CREATE INDEX "PayoutRecipient_userId_status_idx" ON "PayoutRecipient"("userId", "status");

CREATE UNIQUE INDEX "RecipientOnboardingWebhook_dedupeKey_key" ON "RecipientOnboardingWebhook"("dedupeKey");
CREATE INDEX "RecipientOnboardingWebhook_providerRef_idx" ON "RecipientOnboardingWebhook"("providerRef");
