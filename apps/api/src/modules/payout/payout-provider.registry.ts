import type { PayoutProviderPort } from './ports/payout-provider.port';

export const PAYOUT_PROVIDERS = 'PAYOUT_PROVIDERS';

/**
 * Lookup of payout rails by name. Built from every PayoutProviderPort bound in
 * the module (see PayoutModule). The PayoutService resolves the rail for a
 * withdrawal from PayoutRequest.provider, so a single pipeline can fan out to
 * Paystack, Flutterwave, Korapay, … each with its own transfer + webhook logic.
 */
export class PayoutProviderRegistry {
  private readonly byName = new Map<string, PayoutProviderPort>();

  constructor(providers: PayoutProviderPort[]) {
    for (const p of providers) this.byName.set(p.name, p);
  }

  get(name: string): PayoutProviderPort | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return [...this.byName.keys()];
  }
}
