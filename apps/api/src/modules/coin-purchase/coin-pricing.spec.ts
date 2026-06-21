import { CoinPurchaseService } from './coin-purchase.service';
import {
  COIN_PACKAGES,
  billingCurrencyFor,
  type BillingCurrency,
} from './dto/purchase-coins.dto';

// Minimal provider double: records the initiate() input and returns a canned
// verify() result so we can assert the service's currency/amount decisions.
class FakeProvider {
  lastInitiate: any = null;
  constructor(
    readonly name: string,
    private readonly verifyResult: { verified: boolean; amountMinorUnits: number; currency: string; status: string },
  ) {}
  async initiate(input: any) {
    this.lastInitiate = input;
    return { providerReference: 'pref', status: 'initiated' as const };
  }
  async verify() {
    return this.verifyResult;
  }
}

const wallet = () => ({ creditCoins: jest.fn().mockResolvedValue(undefined) });
const toggles = () => ({ assertEnabled: jest.fn().mockResolvedValue(undefined) });

// getCatalogEntry is consulted before the toggle gate; African + global rails
// are all in the catalog. We don't need the real catalog here because the fake
// providers' names match real ones, so build the service with the providers in
// the exact constructor order.
function buildService(stripe: FakeProvider, paystack: FakeProvider) {
  // The constructor positional order: wallet, eventBus, toggles, paystack,
  // stripe, flutterwave, korapay, tazapay, lemonsqueezy, paddle, apple, google.
  const noop = new FakeProvider('noop', { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' });
  return new CoinPurchaseService(
    wallet() as any,
    { publish: jest.fn() } as any,
    toggles() as any,
    paystack as any,
    stripe as any,
    new FakeProvider('flutterwave', noop as any) as any,
    new FakeProvider('korapay', noop as any) as any,
    new FakeProvider('tazapay', noop as any) as any,
    new FakeProvider('lemonsqueezy', noop as any) as any,
    new FakeProvider('paddle', noop as any) as any,
    new FakeProvider('apple_pay', noop as any) as any,
    new FakeProvider('google_pay', noop as any) as any,
  );
}

describe('coin package multi-currency pricing', () => {
  it('every package has a positive price in both NGN and USD', () => {
    for (const p of COIN_PACKAGES) {
      expect(p.prices.NGN).toBeGreaterThan(0);
      expect(p.prices.USD).toBeGreaterThan(0);
    }
  });

  it('within each currency, minor-unit prices are unique (verify() stays unambiguous)', () => {
    for (const cur of ['NGN', 'USD'] as BillingCurrency[]) {
      const amounts = COIN_PACKAGES.map((p) => p.prices[cur]);
      expect(new Set(amounts).size).toBe(amounts.length);
    }
  });

  it('maps African rails to NGN and global rails to USD', () => {
    expect(billingCurrencyFor('paystack')).toBe('NGN');
    expect(billingCurrencyFor('flutterwave')).toBe('NGN');
    expect(billingCurrencyFor('korapay')).toBe('NGN');
    expect(billingCurrencyFor('stripe')).toBe('USD');
    expect(billingCurrencyFor('paddle')).toBe('USD');
    expect(billingCurrencyFor('unknown')).toBe('USD');
  });

  it('charges the USD price on Stripe and the NGN price on Paystack for the same package', async () => {
    const stripe = new FakeProvider('stripe', { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' });
    const paystack = new FakeProvider('paystack', { verified: false, amountMinorUnits: 0, currency: 'NGN', status: 'pending' });
    const svc = buildService(stripe, paystack);

    await svc.initiatePurchase('u1', { packageId: 'pro', provider: 'stripe' } as any);
    expect(stripe.lastInitiate).toMatchObject({ currency: 'USD', amountMinorUnits: 1999 });

    await svc.initiatePurchase('u1', { packageId: 'pro', provider: 'paystack' } as any);
    expect(paystack.lastInitiate).toMatchObject({ currency: 'NGN', amountMinorUnits: 500000 });
  });

  it('verify credits the package matching BOTH amount and currency', async () => {
    const stripe = new FakeProvider('stripe', { verified: true, amountMinorUnits: 199, currency: 'USD', status: 'success' });
    const paystack = new FakeProvider('paystack', { verified: false, amountMinorUnits: 0, currency: 'NGN', status: 'pending' });
    const svc = buildService(stripe, paystack);
    const res = await svc.verifyAndCredit('u1', { reference: 'r', provider: 'stripe' } as any);
    expect(res).toMatchObject({ credited: true, coins: 100 });
  });

  it('refuses to credit when the currency does not match a price (anti-fraud guard)', async () => {
    // 199 is the USD starter price, but a claim of 199 NGN matches no package.
    const stripe = new FakeProvider('stripe', { verified: false, amountMinorUnits: 0, currency: 'USD', status: 'pending' });
    const paystack = new FakeProvider('paystack', { verified: true, amountMinorUnits: 199, currency: 'NGN', status: 'success' });
    const svc = buildService(stripe, paystack);
    const res = await svc.verifyAndCredit('u1', { reference: 'r', provider: 'paystack' } as any);
    expect(res).toMatchObject({ credited: false, reason: 'no_matching_package' });
  });
});
