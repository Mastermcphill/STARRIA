import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { WalletService } from '../wallet/wallet.service';
import { ProviderToggleService } from '../payments/provider-toggle.service';
import { getCatalogEntry } from '../payments/provider-catalog';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { PaystackProvider } from './providers/paystack.provider';
import { StripeProvider } from './providers/stripe.provider';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { KorapayProvider } from './providers/korapay.provider';
import { TazapayProvider } from './providers/tazapay.provider';
import { LemonSqueezyProvider } from './providers/lemonsqueezy.provider';
import { PaddleProvider } from './providers/paddle.provider';
import { ApplePayProviderStub } from './providers/apple-pay.stub';
import { GooglePayProviderStub } from './providers/google-pay.stub';
import { COIN_PACKAGES, billingCurrencyFor } from './dto/purchase-coins.dto';
import type { BillingCurrency, PurchaseCoinsDto, VerifyCoinPurchaseDto } from './dto/purchase-coins.dto';

@Injectable()
export class CoinPurchaseService {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    private readonly walletService: WalletService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly toggles: ProviderToggleService,
    paystack: PaystackProvider,
    stripe: StripeProvider,
    flutterwave: FlutterwaveProvider,
    korapay: KorapayProvider,
    tazapay: TazapayProvider,
    lemonsqueezy: LemonSqueezyProvider,
    paddle: PaddleProvider,
    applePayStub: ApplePayProviderStub,
    googlePayStub: GooglePayProviderStub,
  ) {
    const all = [paystack, stripe, flutterwave, korapay, tazapay, lemonsqueezy, paddle, applePayStub, googlePayStub];
    for (const p of all) this.providers.set(p.name, p);
  }

  /**
   * Handle a provider webhook generically. The provider verifies its own
   * signature (each scheme differs) and parses the body into a normalised
   * result; a successful charge credits the buyer idempotently (creditCoins is
   * keyed on the reference, so duplicate deliveries are harmless).
   */
  async handleWebhook(
    providerName: string,
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ) {
    const provider = this.providers.get(providerName);
    if (!provider?.verifyWebhook || !provider.parseWebhook) {
      return { handled: false, reason: 'unsupported_provider' as const };
    }
    if (!provider.verifyWebhook(rawBody, headers)) {
      return { handled: false, reason: 'invalid_signature' as const };
    }

    const parsed = provider.parseWebhook(rawBody);
    if (!parsed.success) {
      return { handled: true, ignored: parsed.event };
    }
    if (parsed.userId && parsed.coins && parsed.reference) {
      await this.walletService.creditCoins(
        parsed.userId,
        parsed.coins,
        `coins_credited:${parsed.reference}`,
      );
      return { handled: true, credited: true, reference: parsed.reference };
    }
    return { handled: true, credited: false, reference: parsed.reference };
  }

  getPackages() {
    return COIN_PACKAGES;
  }

  async initiatePurchase(userId: string, dto: PurchaseCoinsDto) {
    const pkg = COIN_PACKAGES.find(p => p.id === dto.packageId);
    if (!pkg) throw new NotFoundException(`Package '${dto.packageId}' not found`);

    const provider = this.providers.get(dto.provider);
    if (!provider) throw new NotFoundException(`Payment provider '${dto.provider}' not configured`);

    // Server-side rails (Paystack, Stripe, …) are gated by the toggle registry.
    // Native store rails (apple_pay/google_pay) aren't in the catalog and are
    // governed by the app store, so they bypass this check.
    if (getCatalogEntry(dto.provider)) {
      await this.toggles.assertEnabled(dto.provider, 'checkout');
    }

    // Charge in the currency the chosen rail settles in (NGN for African rails,
    // USD for global rails) — picked from the package's per-currency price map.
    const currency = billingCurrencyFor(dto.provider);
    const amountMinorUnits = pkg.prices[currency];

    const reference = dto.idempotencyKey ?? `coin_purchase:${randomUUID()}`;
    const result = await provider.initiate({
      userId,
      amountMinorUnits,
      currency,
      reference,
      metadata: { userId, packageId: dto.packageId, coins: pkg.coins },
    });

    return {
      reference,
      providerReference: result.providerReference,
      coins: pkg.coins,
      priceMinorUnits: amountMinorUnits,
      currency,
      status: result.status,
      authorizationUrl: result.authorizationUrl,
    };
  }

  async verifyAndCredit(userId: string, dto: VerifyCoinPurchaseDto) {
    const provider = this.providers.get(dto.provider);
    if (!provider) throw new NotFoundException(`Payment provider '${dto.provider}' not configured`);

    const result = await provider.verify({ reference: dto.reference });
    if (!result.verified || result.status !== 'success') {
      return { credited: false, reference: dto.reference, reason: result.status };
    }

    // Resolve the package strictly by the verified amount AND currency. We must
    // NOT fall back to a default package: the provider's verify() returns no
    // metadata, so a fallback would credit arbitrary coins for an unrecognised
    // amount (and the unconfigured dev stub reports amount 0, which would mint
    // free coins). Require an exact, unambiguous (amount, currency) match;
    // otherwise refuse and let the signed webhook (which carries metadata.coins)
    // be the source of truth. Matching currency too prevents an NGN price from
    // colliding with a USD price that happens to share minor units.
    const currency = (result.currency?.toUpperCase() ?? '') as BillingCurrency;
    const matches = COIN_PACKAGES.filter(p => p.prices[currency] === result.amountMinorUnits);
    if (matches.length !== 1) {
      return {
        credited: false,
        reference: dto.reference,
        reason: matches.length === 0 ? 'no_matching_package' : 'ambiguous_package',
      };
    }
    const pkg = matches[0];
    await this.walletService.creditCoins(userId, pkg.coins, `coins_credited:${dto.reference}`);

    return { credited: true, reference: dto.reference, coins: pkg.coins };
  }
}
