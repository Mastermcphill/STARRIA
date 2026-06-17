import { Injectable, Logger } from '@nestjs/common';
import type { PaymentProvider, InitiatePaymentInput, InitiatePaymentResult, VerifyPaymentInput, VerifyPaymentResult } from './payment-provider.interface';

@Injectable()
export class GooglePayProviderStub implements PaymentProvider {
  readonly name = 'google_pay';
  private readonly logger = new Logger(GooglePayProviderStub.name);

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    this.logger.warn(`[STUB] Google Pay initiate — ref=${input.reference}`);
    return { providerReference: `gpay_stub_${input.reference}`, status: 'initiated' };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    this.logger.warn(`[STUB] Google Pay verify — ref=${input.reference}`);
    return { verified: true, amountMinorUnits: 0, currency: 'USD', status: 'success' };
  }
}
