// Paystack provider stub — replace with real Paystack API calls when credentials are available.
import { Injectable, Logger } from '@nestjs/common';
import type { PaymentProvider, InitiatePaymentInput, InitiatePaymentResult, VerifyPaymentInput, VerifyPaymentResult } from './payment-provider.interface';

@Injectable()
export class PaystackProviderStub implements PaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackProviderStub.name);

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    this.logger.warn(`[STUB] Paystack initiate — ref=${input.reference} amount=${input.amountMinorUnits} ${input.currency}`);
    return {
      providerReference: `pstk_stub_${input.reference}`,
      authorizationUrl: `https://paystack.com/pay/stub_${input.reference}`,
      status: 'initiated',
    };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    this.logger.warn(`[STUB] Paystack verify — ref=${input.reference}`);
    return { verified: true, amountMinorUnits: 0, currency: 'NGN', status: 'success' };
  }
}
