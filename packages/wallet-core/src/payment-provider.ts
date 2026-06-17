// ---------------------------------------------------------------------------
// wallet-core — payment provider abstractions
// Extracted from LifeNest payments/providers/*.ts
// Implement PaymentProvider for each gateway (Paystack, Korapay, Stripe…).
// ---------------------------------------------------------------------------

export type PaymentProviderName = string;
export type PaymentProviderStatus = 'healthy' | 'degraded' | 'offline';
export type DisbursementStatus = 'pending' | 'success' | 'failed';

// ---------------------------------------------------------------------------
// Transaction initialisation
// ---------------------------------------------------------------------------

export interface InitTransactionInput {
  readonly amount: number;
  readonly currency?: string;
  readonly reference?: string;
  readonly email?: string;
  readonly callbackUrl?: string;
  readonly webhookUrl?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface InitTransactionResult {
  readonly provider: PaymentProviderName;
  readonly amount: number;
  readonly currency: string;
  readonly reference?: string;
  readonly email?: string;
  readonly callbackUrl?: string;
  readonly authorizationUrl?: string;
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

export interface WebhookVerificationInput {
  readonly payload: Buffer | string | Record<string, unknown>;
  readonly signature?: string | string[];
  readonly secret: string;
}

// ---------------------------------------------------------------------------
// Disbursement (bank transfer / payout)
// ---------------------------------------------------------------------------

export interface DisbursementInput {
  readonly amount: number;
  readonly currency?: string;
  readonly reference: string;
  readonly narration?: string;
  readonly email?: string;
  /** Pre-created recipient code (provider-specific). */
  readonly recipientCode?: string;
  readonly accountNumber?: string;
  readonly bankCode?: string;
  readonly accountName?: string;
}

export interface DisbursementResult {
  readonly provider: PaymentProviderName;
  readonly status: DisbursementStatus;
  readonly providerReference?: string;
  readonly raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  initializeTransaction(input: InitTransactionInput): InitTransactionResult;
  verifyWebhookSignature(input: WebhookVerificationInput): boolean;
  disburse(input: DisbursementInput): Promise<DisbursementResult>;
}

// ---------------------------------------------------------------------------
// Provider registry — failover + health tracking
// ---------------------------------------------------------------------------

export interface ProviderHealthState {
  readonly name: PaymentProviderName;
  readonly status: PaymentProviderStatus;
  readonly consecutiveFailures: number;
  readonly lastCheckedAt?: string;
}

export interface ProviderRegistryConfig {
  defaultProvider: PaymentProviderName;
  autoFailover: boolean;
  unhealthyThreshold: number;
  enabledProviders: Set<PaymentProviderName>;
}

export interface PaymentProviderRegistry {
  register(provider: PaymentProvider): void;
  get(name: PaymentProviderName): PaymentProvider;
  getDefault(): PaymentProvider;
  getHealth(): ProviderHealthState[];
  markSuccess(name: PaymentProviderName): void;
  markFailure(name: PaymentProviderName): void;
  executeWithFailover<T>(
    fn: (provider: PaymentProvider) => Promise<T>,
    preferredProvider?: PaymentProviderName,
  ): Promise<T>;
}
