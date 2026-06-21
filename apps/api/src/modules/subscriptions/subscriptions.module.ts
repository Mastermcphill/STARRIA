import { Module } from '@nestjs/common';
import { SubscriptionsController, SubscriptionWebhookController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeSubscriptionProvider } from './providers/stripe-subscription.provider';
import { LemonSqueezySubscriptionProvider } from './providers/lemonsqueezy-subscription.provider';
import { PaddleSubscriptionProvider } from './providers/paddle-subscription.provider';
import { SubscriptionProviderRegistry } from './subscription-provider.registry';

/**
 * Recurring billing. Each rail implements SubscriptionProviderPort and is
 * collected into the SubscriptionProviderRegistry, from which SubscriptionsService
 * resolves the rail for a plan by name (SubscriptionPlan.provider). Add a rail by
 * binding its provider class and listing it in the registry factory's inject array.
 */
@Module({
  controllers: [SubscriptionsController, SubscriptionWebhookController],
  providers: [
    SubscriptionsService,
    StripeSubscriptionProvider,
    LemonSqueezySubscriptionProvider,
    PaddleSubscriptionProvider,
    {
      provide: SubscriptionProviderRegistry,
      useFactory: (
        stripe: StripeSubscriptionProvider,
        lemonsqueezy: LemonSqueezySubscriptionProvider,
        paddle: PaddleSubscriptionProvider,
      ) => new SubscriptionProviderRegistry([stripe, lemonsqueezy, paddle]),
      inject: [StripeSubscriptionProvider, LemonSqueezySubscriptionProvider, PaddleSubscriptionProvider],
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
