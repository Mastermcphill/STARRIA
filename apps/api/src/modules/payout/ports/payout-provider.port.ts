// ---------------------------------------------------------------------------
// PayoutProviderPort — provider abstraction for outbound transfers.
// The service depends only on this interface; PaystackPayoutProvider is the
// production implementation. Swap providers by binding a different class to the
// PAYOUT_PROVIDER token.
// ---------------------------------------------------------------------------

export const PAYOUT_PROVIDER = 'PAYOUT_PROVIDER';

export interface PayoutTransferInput {
  /** Our PayoutRequest.id — echoed back by the provider on its webhook. */
  reference: string;
  amountMinorUnits: number;
  currency: string;
  /** Provider recipient handle (e.g. a Paystack recipient_code). */
  destination: string;
}

export interface PayoutTransferResult {
  /** True if the provider accepted the transfer for processing. */
  accepted: boolean;
  /** Provider-side transfer identifier (e.g. transfer_code). */
  providerRef?: string;
  status: 'processing' | 'failed';
  error?: string;
}

export interface PayoutWebhookParseResult {
  event: string;
  /** The reference we passed to transfer() — equals PayoutRequest.id. */
  reference?: string;
  /** Provider transfer id (= PayoutRequest.providerRef). Used to match the local
   * row when the rail's webhook carries only its own id, not our reference
   * (e.g. Wise transfer state-change events). */
  providerRef?: string;
  /** Provider event identity; the replay-protection key. */
  dedupeKey: string;
  outcome: 'success' | 'failed' | 'other';
}

export interface PayoutProviderPort {
  readonly name: string;
  /** Initiate an outbound transfer. Throws only on transport errors (retryable);
   * business failures are returned as { accepted:false, status:'failed' }. */
  transfer(input: PayoutTransferInput): Promise<PayoutTransferResult>;
  /** Constant-time HMAC verification over the raw body. */
  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean;
  /** Parse a verified webhook body into a normalised result. */
  parseWebhook(rawBody: Buffer | string): PayoutWebhookParseResult;
}
