-- Migration: 20260625000000_provider_settings
-- Payments multi-provider registry — runtime on/off overrides.
-- Backs ProviderToggleService: a row forces a (provider, capability) on/off,
-- overriding the PAYMENTS_<PROVIDER>_<CAPABILITY>_ENABLED env default.

-- CreateTable
CREATE TABLE "ProviderSetting" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "enabled" BOOLEAN,
    "updatedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetting_provider_capability_key" ON "ProviderSetting"("provider", "capability");

-- CreateIndex
CREATE INDEX "ProviderSetting_capability_idx" ON "ProviderSetting"("capability");
