import { Module } from '@nestjs/common';
import { PayoutController, PayoutWebhookController } from './payout.controller';
import { RecipientController, RecipientOnboardingWebhookController } from './recipient.controller';
import { PayoutService } from './payout.service';
import { RecipientService } from './recipient.service';
import { PaystackPayoutProvider } from './providers/paystack-payout.provider';
import { FlutterwavePayoutProvider } from './providers/flutterwave-payout.provider';
import { KorapayPayoutProvider } from './providers/korapay-payout.provider';
import { StripeConnectProvider } from './providers/stripe-connect.provider';
import { WisePayoutProvider } from './providers/wise-payout.provider';
import { TrolleyPayoutProvider } from './providers/trolley-payout.provider';
import { TipaltiPayoutProvider } from './providers/tipalti-payout.provider';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { RecipientOnboardingRegistry } from './recipient-onboarding.registry';
import { CoinConversionService } from './coin-conversion.service';

/**
 * Payout rails. Each provider implements PayoutProviderPort and is collected
 * into the PayoutProviderRegistry, from which PayoutService resolves the rail
 * for a withdrawal by name (PayoutRequest.provider). Add a rail by binding its
 * provider class and listing it in the registry factory's inject array.
 */
@Module({
  controllers: [
    PayoutController,
    PayoutWebhookController,
    RecipientController,
    RecipientOnboardingWebhookController,
  ],
  providers: [
    PayoutService,
    RecipientService,
    CoinConversionService,
    PaystackPayoutProvider,
    FlutterwavePayoutProvider,
    KorapayPayoutProvider,
    StripeConnectProvider,
    WisePayoutProvider,
    TrolleyPayoutProvider,
    TipaltiPayoutProvider,
    {
      provide: PayoutProviderRegistry,
      useFactory: (
        paystack: PaystackPayoutProvider,
        flutterwave: FlutterwavePayoutProvider,
        korapay: KorapayPayoutProvider,
        stripeConnect: StripeConnectProvider,
        wise: WisePayoutProvider,
        trolley: TrolleyPayoutProvider,
        tipalti: TipaltiPayoutProvider,
      ) => new PayoutProviderRegistry([paystack, flutterwave, korapay, stripeConnect, wise, trolley, tipalti]),
      inject: [
        PaystackPayoutProvider,
        FlutterwavePayoutProvider,
        KorapayPayoutProvider,
        StripeConnectProvider,
        WisePayoutProvider,
        TrolleyPayoutProvider,
        TipaltiPayoutProvider,
      ],
    },
    {
      // Onboarding rails (implement RecipientOnboardingPort) — all rails landed.
      provide: RecipientOnboardingRegistry,
      useFactory: (
        stripeConnect: StripeConnectProvider,
        trolley: TrolleyPayoutProvider,
        tipalti: TipaltiPayoutProvider,
      ) => new RecipientOnboardingRegistry([stripeConnect, trolley, tipalti]),
      inject: [StripeConnectProvider, TrolleyPayoutProvider, TipaltiPayoutProvider],
    },
  ],
  exports: [PayoutService, RecipientService],
})
export class PayoutModule {}
