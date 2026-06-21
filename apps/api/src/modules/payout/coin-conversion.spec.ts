import { ConfigService } from '@nestjs/config';
import { CoinConversionService } from './coin-conversion.service';
import { COIN_PAYOUT_USD_MICROS } from './coin-conversion';

/** ConfigService stub backed by a plain map (undefined for unset keys). */
function configWith(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

describe('CoinConversionService', () => {
  describe('convert', () => {
    it('pegs USD to $0.015/coin at parity (no multiplier, no fx scaling)', () => {
      const svc = new CoinConversionService(configWith());
      // 1000 coins × 15_000 µUSD × 1.0 × fx(1) / 10_000 = 1500 minor units = $15.00 gross
      const c = svc.convert(1000, 'USD');
      expect(c.grossMinorUnits).toBe(1500);
      // fee = 2% of 1500 (=30) + flat 50 = 80; net = 1420
      expect(c.feeMinorUnits).toBe(80);
      expect(c.netMinorUnits).toBe(1420);
      expect(c.fxRate).toBe('1');
    });

    it('makes NGN relatively cheaper than USD via the sub-1 multiplier', () => {
      const svc = new CoinConversionService(configWith());
      const coins = 1000;
      const usd = svc.convert(coins, 'USD');
      const ngn = svc.convert(coins, 'NGN');

      // Convert NGN gross back to USD via its fx rate; with multiplier 0.85 it must
      // be worth ~85% of the USD peg — i.e. strictly cheaper per coin.
      const ngnInUsd = ngn.grossMinorUnits / 1600;
      expect(ngnInUsd).toBeLessThan(usd.grossMinorUnits);
      expect(ngnInUsd).toBeCloseTo(usd.grossMinorUnits * 0.85, 0);
    });

    it('fails closed for a currency with no configured FX rate', () => {
      const svc = new CoinConversionService(configWith());
      expect(() => svc.convert(1000, 'JPY')).toThrow(/No FX rate configured/);
    });

    it('honours env FX + multiplier overrides', () => {
      const svc = new CoinConversionService(
        configWith({
          PAYOUT_FX_RATES: '{"JPY":150}',
          PAYOUT_CURRENCY_MULTIPLIERS: '{"JPY":0.5}',
          PAYOUT_FEE_PERCENT: '0',
          PAYOUT_FEE_FLAT: '{"JPY":0}',
        }),
      );
      // 1000 × 15_000 × 0.5 × 150 / 10_000 = 112_500 minor units; no fees
      const c = svc.convert(1000, 'JPY');
      expect(c.grossMinorUnits).toBe(112500);
      expect(c.feeMinorUnits).toBe(0);
      expect(c.netMinorUnits).toBe(112500);
    });

    it('can produce a negative net when the flat fee exceeds a tiny gross', () => {
      const svc = new CoinConversionService(configWith());
      // 1 coin USD: gross = round(1 × 15_000 × 1 / 10_000) = 2 minor units;
      // fee = round(2 × 0.02) + 50 = 50 → net = -48. Guards belong upstream
      // (min-withdrawal); this documents the unguarded boundary.
      const c = svc.convert(1, 'USD');
      expect(c.grossMinorUnits).toBe(2);
      expect(c.netMinorUnits).toBeLessThan(0);
    });

    it('ignores malformed JSON overrides and falls back to defaults', () => {
      const svc = new CoinConversionService(configWith({ PAYOUT_FX_RATES: 'not-json' }));
      expect(svc.convert(1000, 'USD').grossMinorUnits).toBe(1500);
    });

    it('prices an NGN coin at a sane naira value (not the legacy ₦1-kobo parity)', () => {
      const svc = new CoinConversionService(configWith());
      // 1 coin: round(1 × 15_000 × 0.85 × 1600 / 10_000) = 2040 kobo = ₦20.40.
      // The legacy implicit rate was 1 coin = 1 kobo (₦0.01); this proves the
      // conversion layer now governs NGN.
      const c = svc.convert(1, 'NGN');
      expect(c.grossMinorUnits).toBe(2040);
      expect(c.grossMinorUnits).toBeGreaterThan(1);
    });
  });

  describe('minWithdrawalCoins', () => {
    it('defaults to 100 coins', () => {
      expect(new CoinConversionService(configWith()).minWithdrawalCoins).toBe(100);
    });

    it('honours the PAYOUT_MIN_COINS override', () => {
      expect(new CoinConversionService(configWith({ PAYOUT_MIN_COINS: '250' })).minWithdrawalCoins).toBe(250);
    });

    it('falls back to the default for a non-positive or malformed override', () => {
      expect(new CoinConversionService(configWith({ PAYOUT_MIN_COINS: '0' })).minWithdrawalCoins).toBe(100);
      expect(new CoinConversionService(configWith({ PAYOUT_MIN_COINS: 'nope' })).minWithdrawalCoins).toBe(100);
    });
  });

  describe('resolveCurrency', () => {
    const svc = new CoinConversionService(configWith());

    it('prefers an explicit requested currency', () => {
      expect(svc.resolveCurrency('paystack', 'eur', 'USD')).toBe('EUR');
    });

    it('falls back to the recipient currency, then the provider default', () => {
      expect(svc.resolveCurrency('paystack', undefined, 'gbp')).toBe('GBP');
      expect(svc.resolveCurrency('paystack')).toBe('NGN');
      expect(svc.resolveCurrency('stripe_connect')).toBe('USD');
    });

    it('defaults to USD for an unknown provider', () => {
      expect(svc.resolveCurrency('mystery-rail')).toBe('USD');
    });
  });

  it('exposes the $0.015/coin peg', () => {
    expect(COIN_PAYOUT_USD_MICROS).toBe(15_000);
  });
});
