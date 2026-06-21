-- Migration: 20260625000002_billing_subscriptions
-- Multi-provider recurring billing (Stripe / Lemon Squeezy / Paddle).

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPlanId" TEXT NOT NULL,
    "priceMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionWebhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON "SubscriptionPlan"("key");
CREATE INDEX "SubscriptionPlan_provider_idx" ON "SubscriptionPlan"("provider");
CREATE INDEX "SubscriptionPlan_active_idx" ON "SubscriptionPlan"("active");

CREATE UNIQUE INDEX "PaymentSubscription_idempotencyKey_key" ON "PaymentSubscription"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentSubscription_provider_providerSubscriptionId_key" ON "PaymentSubscription"("provider", "providerSubscriptionId");
CREATE INDEX "PaymentSubscription_userId_status_idx" ON "PaymentSubscription"("userId", "status");
CREATE INDEX "PaymentSubscription_providerSubscriptionId_idx" ON "PaymentSubscription"("providerSubscriptionId");

CREATE UNIQUE INDEX "SubscriptionWebhook_dedupeKey_key" ON "SubscriptionWebhook"("dedupeKey");
CREATE INDEX "SubscriptionWebhook_providerSubscriptionId_idx" ON "SubscriptionWebhook"("providerSubscriptionId");

-- AddForeignKey
ALTER TABLE "PaymentSubscription" ADD CONSTRAINT "PaymentSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
