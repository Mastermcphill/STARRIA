// ---------------------------------------------------------------------------
// Coin → fiat payout conversion (see docs/payments/onboarding-payout-rails-design
// §10 and the locked decisions):
//   - Coins are pegged to a USD value (COIN_PAYOUT_USD_MICROS).
//   - Each currency derives from USD via a live/configured FX rate.
//   - A per-currency value multiplier lets some currencies be relatively cheaper
//     than the USD peg (NGN is intentionally < 1).
//   - The creator absorbs FX spread + transfer fees: net = gross − fee is sent.
//
// All maps are overridable from env (JSON) so ops can retune without a deploy.
// ---------------------------------------------------------------------------

/** Payout value of one coin, in micro-USD (1 USD = 1_000_000 µUSD). $0.015/coin. */
export const COIN_PAYOUT_USD_MICROS = 15_000;

/** Units of a currency per 1 USD (defaults; override via PAYOUT_FX_RATES). */
export const DEFAULT_FX_PER_USD: Record<string, number> = {
  USD: 1,
  NGN: 1600,
  EUR: 0.92,
  GBP: 0.79,
  KES: 129,
  GHS: 15,
  ZAR: 18,
};

/**
 * Per-currency value multiplier applied to the USD peg. 1.0 = at parity with the
 * USD peg; < 1 makes a coin worth relatively less in that currency. NGN is set
 * below 1 by product decision (override via PAYOUT_CURRENCY_MULTIPLIERS).
 */
export const DEFAULT_CURRENCY_MULTIPLIER: Record<string, number> = {
  USD: 1.0,
  NGN: 0.85,
};

/**
 * Minimum withdrawal, in coins. Below this the flat fee eats most of the payout
 * (dust withdrawal). At $0.015/coin, 100 coins ≈ $1.50 gross. Override via
 * PAYOUT_MIN_COINS.
 */
export const DEFAULT_MIN_PAYOUT_COINS = 100;

/** Fee model — creator absorbs. Percentage of gross + a flat amount (minor units). */
export const DEFAULT_FEE_PERCENT = 0.02; // 2%
export const DEFAULT_FEE_FLAT_MINOR: Record<string, number> = {
  USD: 50, // $0.50
  NGN: 10000, // ₦100
};

/** Which payout currency a rail settles in (Wise resolves per recipient). */
export const PAYOUT_CURRENCY_BY_PROVIDER: Record<string, string> = {
  paystack: 'NGN',
  flutterwave: 'NGN',
  korapay: 'NGN',
  stripe_connect: 'USD',
};

export interface Conversion {
  coins: number;
  currency: string;
  grossMinorUnits: number;
  feeMinorUnits: number;
  netMinorUnits: number;
  /** USD→currency rate used, as a string for the audit trail. */
  fxRate: string;
}
