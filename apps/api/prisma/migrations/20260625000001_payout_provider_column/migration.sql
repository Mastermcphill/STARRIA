-- Migration: 20260625000001_payout_provider_column
-- Multi-provider payouts — record which rail handles each withdrawal so
-- executePayout() and webhook reconciliation route to the right provider.

ALTER TABLE "PayoutRequest" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'paystack';
