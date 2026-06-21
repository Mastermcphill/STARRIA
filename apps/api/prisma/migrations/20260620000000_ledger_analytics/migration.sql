-- Sprint 11 — double-entry ledger + analytics pipeline (additive: 6 new tables)

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "txnType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COINS',
    "balanceAfter" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalanceSnapshot" (
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COINS',
    "accountType" TEXT NOT NULL DEFAULT 'customer',
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalanceSnapshot_pkey" PRIMARY KEY ("accountId","currency")
);

-- CreateTable
CREATE TABLE "WalletSettlement" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "payerAccountId" TEXT NOT NULL,
    "recipientAccountId" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "recipientAmount" INTEGER NOT NULL,
    "platformPercentage" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COINS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRefund" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "originalReference" TEXT NOT NULL,
    "payerAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COINS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "creatorId" TEXT,
    "actorId" TEXT,
    "subjectId" TEXT,
    "subjectType" TEXT,
    "value" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRollup" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_idempotencyKey_idx" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_postingId_idx" ON "WalletTransaction"("postingId");

-- CreateIndex
CREATE INDEX "WalletTransaction_accountId_currency_idx" ON "WalletTransaction"("accountId", "currency");

-- CreateIndex
CREATE INDEX "WalletTransaction_reference_idx" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_accountId_sub_direction_key" ON "WalletTransaction"("idempotencyKey", "accountId", "sub", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSettlement_idempotencyKey_key" ON "WalletSettlement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletSettlement_recipientAccountId_idx" ON "WalletSettlement"("recipientAccountId");

-- CreateIndex
CREATE INDEX "WalletSettlement_payerAccountId_idx" ON "WalletSettlement"("payerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRefund_idempotencyKey_key" ON "WalletRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletRefund_originalReference_idx" ON "WalletRefund"("originalReference");

-- CreateIndex
CREATE INDEX "WalletRefund_payerAccountId_idx" ON "WalletRefund"("payerAccountId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_creatorId_occurredAt_idx" ON "AnalyticsEvent"("creatorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_creatorId_period_idx" ON "AnalyticsRollup"("creatorId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsRollup_creatorId_period_periodKey_metric_key" ON "AnalyticsRollup"("creatorId", "period", "periodKey", "metric");

