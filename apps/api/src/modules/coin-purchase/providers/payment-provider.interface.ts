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

/**
 * Normalised webhook parse result. The webhook is the source of truth for
 * crediting coins: unlike verify(), it carries the original metadata (userId +
 * coins) the charge was created with, so we credit exactly what was bought.
 */
export interface ParsedCheckoutWebhook {
  /** Raw provider event name, for logging (e.g. 'charge.success'). */
  event: string;
  /** Our reference passed at initiate() time. */
  reference?: string;
  /** Buyer id, from charge metadata. */
  userId?: string;
  /** Coins to credit, from charge metadata. */
  coins?: number;
  /** True only for a settled, successful charge event. */
  success: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  /**
   * Constant-time verification of a webhook delivery. Different providers sign
   * differently (HMAC body, header equality, timestamped schemes), so the whole
   * header map is passed and each provider reads what it needs. Optional: a
   * provider without server-side webhooks (e.g. native IAP stubs) omits it.
   */
  verifyWebhook?(
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ): boolean;

  /** Parse an already-verified webhook body into a normalised result. */
  parseWebhook?(rawBody: Buffer | string): ParsedCheckoutWebhook;
}
