import { ProviderToggleService } from './provider-toggle.service';

/**
 * Unit tests for the toggle precedence:  DB override → env flag → "configured?".
 * The service is constructed directly with hand-rolled fakes for ConfigService
 * and PrismaService so we exercise pure resolution logic without a DB.
 */

type Row = { provider: string; capability: string; enabled: boolean | null };

function makeService(env: Record<string, string>, rows: Row[] = []) {
  const config = {
    get: (k: string): string | undefined => env[k],
  };
  const store = [...rows];
  const db = {
    providerSetting: {
      findMany: jest.fn(async () => store),
      upsert: jest.fn(async ({ create }: { create: Row }) => {
        const i = store.findIndex(
          (r) => r.provider === create.provider && r.capability === create.capability,
        );
        if (i >= 0) store[i] = { ...store[i], ...create };
        else store.push(create);
        return create;
      }),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ProviderToggleService(config as any, db as any);
}

describe('ProviderToggleService', () => {
  it('defaults to "configured?" when no override and no env flag', async () => {
    const svc = makeService({ STRIPE_SECRET_KEY: 'sk_test_x' });
    expect(await svc.isEnabled('stripe', 'checkout')).toBe(true);

    const svc2 = makeService({}); // no credentials
    expect(await svc2.isEnabled('stripe', 'checkout')).toBe(false);
  });

  it('env flag overrides the configured default (can enable an unconfigured stub)', async () => {
    const on = makeService({ PAYMENTS_STRIPE_CHECKOUT_ENABLED: 'true' });
    expect(await on.isEnabled('stripe', 'checkout')).toBe(true);

    const off = makeService({
      STRIPE_SECRET_KEY: 'sk_test_x',
      PAYMENTS_STRIPE_CHECKOUT_ENABLED: 'false',
    });
    expect(await off.isEnabled('stripe', 'checkout')).toBe(false);
  });

  it('DB override beats both env flag and configured state', async () => {
    const svc = makeService(
      { STRIPE_SECRET_KEY: 'sk_test_x', PAYMENTS_STRIPE_CHECKOUT_ENABLED: 'true' },
      [{ provider: 'stripe', capability: 'checkout', enabled: false }],
    );
    expect(await svc.isEnabled('stripe', 'checkout')).toBe(false);
  });

  it('never enables a capability the provider does not support', async () => {
    // Wise is payout-only — must never be a checkout option, even if forced on.
    const svc = makeService(
      { WISE_API_TOKEN: 'tok', PAYMENTS_WISE_CHECKOUT_ENABLED: 'true' },
      [{ provider: 'wise', capability: 'checkout', enabled: true }],
    );
    expect(await svc.isEnabled('wise', 'checkout')).toBe(false); // unsupported → always off
    expect(await svc.isEnabled('wise', 'payout')).toBe(true); // supported + configured
  });

  it('assertEnabled rejects unknown providers and unsupported capabilities', async () => {
    const svc = makeService({});
    await expect(svc.assertEnabled('nope', 'checkout')).rejects.toThrow(/Unknown/);
    await expect(svc.assertEnabled('tazapay', 'payout')).rejects.toThrow(/does not support/);
  });

  it('setOverride(null) clears the override, reverting to the env default', async () => {
    const svc = makeService({ PAYMENTS_STRIPE_CHECKOUT_ENABLED: 'true' }, [
      { provider: 'stripe', capability: 'checkout', enabled: false },
    ]);
    expect(await svc.isEnabled('stripe', 'checkout')).toBe(false);
    await svc.setOverride('stripe', 'checkout', null);
    expect(await svc.isEnabled('stripe', 'checkout')).toBe(true);
  });

  it('lists resolved state across the catalog for a capability', async () => {
    const svc = makeService({ PAYSTACK_SECRET_KEY: 'sk' });
    const payout = await svc.listStates('payout');
    const wise = payout.find((s) => s.provider === 'wise');
    const paystack = payout.find((s) => s.provider === 'paystack');
    expect(wise).toBeDefined();
    expect(wise!.enabled).toBe(false); // no creds, no flag
    expect(paystack!.enabled).toBe(true); // configured
    // checkout-only providers must not appear under payout
    expect(payout.find((s) => s.provider === 'tazapay')).toBeUndefined();
  });
});
