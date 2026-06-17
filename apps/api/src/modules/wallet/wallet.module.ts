import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaCoinLedgerRepository } from './prisma-coin-ledger.repository';

@Module({
  controllers: [WalletController],
  providers: [WalletService, PrismaCoinLedgerRepository],
  exports: [WalletService, PrismaCoinLedgerRepository],
})
export class WalletModule {}
