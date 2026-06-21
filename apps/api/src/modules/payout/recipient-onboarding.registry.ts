import type { RecipientOnboardingPort } from './ports/recipient-onboarding.port';

/**
 * Lookup of payout rails that require recipient onboarding, by name. Only rails
 * implementing RecipientOnboardingPort are bound here (Stripe Connect, Wise,
 * Trolley, Tipalti). PayoutService uses `has(provider)` to decide whether a
 * withdrawal must resolve a pre-onboarded, payable PayoutRecipient first.
 */
export class RecipientOnboardingRegistry {
  private readonly byName = new Map<string, RecipientOnboardingPort>();

  constructor(providers: RecipientOnboardingPort[]) {
    for (const p of providers) this.byName.set(p.name, p);
  }

  get(name: string): RecipientOnboardingPort | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return [...this.byName.keys()];
  }
}
