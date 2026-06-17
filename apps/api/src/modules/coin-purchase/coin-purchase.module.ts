import { Module } from '@nestjs/common';
import { CoinPurchaseController } from './coin-purchase.controller';
import { CoinPurchaseService } from './coin-purchase.service';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackProviderStub } from './providers/paystack.stub';
import { ApplePayProviderStub } from './providers/apple-pay.stub';
import { GooglePayProviderStub } from './providers/google-pay.stub';

@Module({
  imports: [WalletModule],
  controllers: [CoinPurchaseController],
  providers: [
    CoinPurchaseService,
    PaystackProviderStub,
    ApplePayProviderStub,
    GooglePayProviderStub,
  ],
  exports: [CoinPurchaseService],
})
export class CoinPurchaseModule {}
