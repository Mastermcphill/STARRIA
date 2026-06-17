import { Injectable, Logger } from '@nestjs/common';
import type { PaymentProvider, InitiatePaymentInput, InitiatePaymentResult, VerifyPaymentInput, VerifyPaymentResult } from './payment-provider.interface';

@Injectable()
export class ApplePayProviderStub implements PaymentProvider {
  readonly name = 'apple_pay';
  private readonly logger = new Logger(ApplePayProviderStub.name);

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    this.logger.warn(`[STUB] Apple Pay initiate — ref=${input.reference}`);
    return { providerReference: `apple_stub_${input.reference}`, status: 'initiated' };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    this.logger.warn(`[STUB] Apple Pay verify — ref=${input.reference}`);
    return { verified: true, amountMinorUnits: 0, currency: 'USD', status: 'success' };
  }
}
