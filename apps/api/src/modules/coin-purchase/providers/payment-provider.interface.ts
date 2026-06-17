export interface InitiatePaymentInput {
  userId: string;
  amountMinorUnits: number;
  currency: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  providerReference: string;
  authorizationUrl?: string;
  status: 'pending' | 'initiated';
}

export interface VerifyPaymentInput {
  reference: string;
  providerReference?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  amountMinorUnits: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
