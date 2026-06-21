import { Global, Module } from '@nestjs/common';
import { ProviderToggleService } from './provider-toggle.service';
import { PaymentsAdminController } from './payments-admin.controller';

/**
 * Cross-cutting payments registry. Global so any flow (coin checkout,
 * subscriptions, payouts) can inject ProviderToggleService to gate a provider
 * without importing this module explicitly. PrismaService and ConfigService are
 * both already global, so no imports are needed here.
 */
@Global()
@Module({
  controllers: [PaymentsAdminController],
  providers: [ProviderToggleService],
  exports: [ProviderToggleService],
})
export class PaymentsModule {}
