import { Module } from '@nestjs/common';
import { GiftingController } from './gifting.controller';
import { GiftingService } from './gifting.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [GiftingController],
  providers: [GiftingService],
  exports: [GiftingService],
})
export class GiftingModule {}
