import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COIN_PAYOUT_USD_MICROS,
  DEFAULT_CURRENCY_MULTIPLIER,
  DEFAULT_FEE_FLAT_MINOR,
  DEFAULT_FEE_PERCENT,
  DEFAULT_FX_PER_USD,
  DEFAULT_MIN_PAYOUT_COINS,
  PAYOUT_CURRENCY_BY_PROVIDER,
  type Conversion,
} from './coin-conversion';

/**
 * Converts a coin amount into a payout figure in a destination currency, using
 * the USD peg + per-currency multiplier + FX, and deducts the creator-absorbed
 * fee. Pure/deterministic given its config — used both by the quote endpoint and
 * by requestWithdrawal so the quoted net is exactly what gets sent.
 */
@Injectable()
export class CoinConversionService {
  private readonly logger = new Logger(CoinConversionService.name);
  private readonly fx: Record<string, number>;
  private readonly multiplier: Record<string, number>;
  private readonly feePercent: number;
  private readonly feeFlat: Record<string, number>;
  private readonly minCoins: number;

  constructor(config: ConfigService) {
    this.fx = { ...DEFAULT_FX_PER_USD, ...parseJsonMap(config.get<string>('PAYOUT_FX_RATES'), this.logger) };
    this.multiplier = {
      ...DEFAULT_CURRENCY_MULTIPLIER,
      ...parseJsonMap(config.get<string>('PAYOUT_CURRENCY_MULTIPLIERS'), this.logger),
    };
    const pct = Number(config.get<string>('PAYOUT_FEE_PERCENT'));
    this.feePercent = Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_FEE_PERCENT;
    this.feeFlat = { ...DEFAULT_FEE_FLAT_MINOR, ...parseJsonMap(config.get<string>('PAYOUT_FEE_FLAT'), this.logger) };
    const min = Number(config.get<string>('PAYOUT_MIN_COINS'));
    this.minCoins = Number.isFinite(min) && min > 0 ? min : DEFAULT_MIN_PAYOUT_COINS;
  }

  /** Minimum withdrawal in coins (below this is rejected as dust). */
  get minWithdrawalCoins(): number {
    return this.minCoins;
  }

  /** The currency a rail pays out in (Wise/onboarding rails pass an explicit one). */
  resolveCurrency(provider: string, requested?: string, recipientCurrency?: string): string {
    return (requested ?? recipientCurrency ?? PAYOUT_CURRENCY_BY_PROVIDER[provider] ?? 'USD').toUpperCase();
  }

  /** Throws if the currency has no FX rate configured (fail closed, never guess). */
  convert(coins: number, currency: string): Conversion {
    const cur = currency.toUpperCase();
    const fx = this.fx[cur];
    if (!fx || fx <= 0) {
      throw new Error(`No FX rate configured for payout currency '${cur}'`);
    }
    const mult = this.multiplier[cur] ?? 1.0;

    // µUSD → destination minor units: (µUSD × mult × fx) / 10_000
    //   (10_000 = 1_000_000 µUSD/USD ÷ 100 minor-units/unit).
    const valueUsdMicros = coins * COIN_PAYOUT_USD_MICROS * mult;
    const grossMinorUnits = Math.round((valueUsdMicros * fx) / 10_000);

    const feeMinorUnits = Math.round(grossMinorUnits * this.feePercent) + (this.feeFlat[cur] ?? 0);
    const netMinorUnits = grossMinorUnits - feeMinorUnits;

    return {
      coins,
      currency: cur,
      grossMinorUnits,
      feeMinorUnits,
      netMinorUnits,
      fxRate: String(fx),
    };
  }
}

function parseJsonMap(raw: string | undefined, logger: Logger): Record<string, number> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k.toUpperCase()] = n;
    }
    return out;
  } catch {
    logger.warn(`Ignoring malformed payout rate override: ${raw.slice(0, 40)}…`);
    return {};
  }
}
