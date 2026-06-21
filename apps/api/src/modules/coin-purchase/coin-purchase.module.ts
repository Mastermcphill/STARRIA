import { Module } from '@nestjs/common';
import { CoinPurchaseController } from './coin-purchase.controller';
import { CoinPurchaseService } from './coin-purchase.service';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackProvider } from './providers/paystack.provider';
import { StripeProvider } from './providers/stripe.provider';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { KorapayProvider } from './providers/korapay.provider';
import { TazapayProvider } from './providers/tazapay.provider';
import { LemonSqueezyProvider } from './providers/lemonsqueezy.provider';
import { PaddleProvider } from './providers/paddle.provider';
import { ApplePayProviderStub } from './providers/apple-pay.stub';
import { GooglePayProviderStub } from './providers/google-pay.stub';

@Module({
  imports: [WalletModule],
  controllers: [CoinPurchaseController],
  providers: [
    CoinPurchaseService,
    PaystackProvider,
    StripeProvider,
    FlutterwaveProvider,
    KorapayProvider,
    TazapayProvider,
    LemonSqueezyProvider,
    PaddleProvider,
    ApplePayProviderStub,
    GooglePayProviderStub,
  ],
  exports: [CoinPurchaseService],
})
export class CoinPurchaseModule {}
