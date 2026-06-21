-- Migration: 20260625000004_payout_conversion
-- Multi-currency payout conversion snapshot on each withdrawal: coins → gross in
-- the payout currency, minus fees (creator absorbs) = net actually sent.

ALTER TABLE "PayoutRequest" ADD COLUMN "grossMinorUnits" INTEGER;
ALTER TABLE "PayoutRequest" ADD COLUMN "feeMinorUnits" INTEGER;
ALTER TABLE "PayoutRequest" ADD COLUMN "netMinorUnits" INTEGER;
ALTER TABLE "PayoutRequest" ADD COLUMN "fxRate" TEXT;
