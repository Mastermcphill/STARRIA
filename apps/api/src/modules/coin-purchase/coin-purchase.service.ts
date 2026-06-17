import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { WalletService } from '../wallet/wallet.service';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { PaystackProviderStub } from './providers/paystack.stub';
import { ApplePayProviderStub } from './providers/apple-pay.stub';
import { GooglePayProviderStub } from './providers/google-pay.stub';
import { COIN_PACKAGES } from './dto/purchase-coins.dto';
import type { PurchaseCoinsDto, VerifyCoinPurchaseDto } from './dto/purchase-coins.dto';

@Injectable()
export class CoinPurchaseService {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    private readonly walletService: WalletService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    paystackStub: PaystackProviderStub,
    applePayStub: ApplePayProviderStub,
    googlePayStub: GooglePayProviderStub,
  ) {
    this.providers.set(paystackStub.name, paystackStub);
    this.providers.set(applePayStub.name, applePayStub);
    this.providers.set(googlePayStub.name, googlePayStub);
  }

  getPackages() {
    return COIN_PACKAGES;
  }

  async initiatePurchase(userId: string, dto: PurchaseCoinsDto) {
    const pkg = COIN_PACKAGES.find(p => p.id === dto.packageId);
    if (!pkg) throw new NotFoundException(`Package '${dto.packageId}' not found`);

    const provider = this.providers.get(dto.provider);
    if (!provider) throw new NotFoundException(`Payment provider '${dto.provider}' not configured`);

    const reference = dto.idempotencyKey ?? `coin_purchase:${randomUUID()}`;
    const result = await provider.initiate({
      userId,
      amountMinorUnits: pkg.priceMinorUnits,
      currency: pkg.currency,
      reference,
      metadata: { packageId: dto.packageId, coins: pkg.coins },
    });

    return {
      reference,
      providerReference: result.providerReference,
      coins: pkg.coins,
      priceMinorUnits: pkg.priceMinorUnits,
      currency: pkg.currency,
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

    // Credit coins — find package by matching amount (or use metadata in a real implementation)
    const pkg = COIN_PACKAGES.find(p => p.priceMinorUnits === result.amountMinorUnits) ?? COIN_PACKAGES[0];
    await this.walletService.creditCoins(userId, pkg.coins, `coins_credited:${dto.reference}`);

    return { credited: true, reference: dto.reference, coins: pkg.coins };
  }
}
