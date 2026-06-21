import type { SubscriptionProviderPort } from './ports/subscription-provider.port';

/** Lookup of subscription rails by name, built from the bound providers. */
export class SubscriptionProviderRegistry {
  private readonly byName = new Map<string, SubscriptionProviderPort>();

  constructor(providers: SubscriptionProviderPort[]) {
    for (const p of providers) this.byName.set(p.name, p);
  }

  get(name: string): SubscriptionProviderPort | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return [...this.byName.keys()];
  }
}
