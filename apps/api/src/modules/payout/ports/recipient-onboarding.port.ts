// ---------------------------------------------------------------------------
// RecipientOnboardingPort — for payout rails that require a pre-onboarded payee
// entity before any transfer (Stripe Connect, Wise, Trolley, Tipalti). The
// African rails (Paystack/Flutterwave/Korapay) take bank details at transfer
// time and do NOT implement this port.
//
// Lifecycle (PayoutRecipient.status):
//   pending → onboarding → active(payable) ; → restricted | rejected | disabled
// Only `active`/payable recipients may receive a transfer (enforced in
// PayoutService.requestWithdrawal).
// ---------------------------------------------------------------------------

export type RecipientStatusValue =
  | 'pending'
  | 'onboarding'
  | 'active'
  | 'restricted'
  | 'rejected'
  | 'disabled';

export interface OnboardingLinkInput {
  userId: string;
  /** Our PayoutRecipient.id — passed as provider metadata so webhooks can link back. */
  recipientId: string;
  /** Where the hosted flow returns the user. */
  returnUrl: string;
  /** Stripe Account Links require a separate refresh URL. */
  refreshUrl?: string;
  email?: string;
  country?: string;
}

export interface OnboardingLinkResult {
  /** Created/resolved provider entity id (acct_… / wise recipientId / R-… / payeeId). */
  providerRef: string;
  /** Hosted onboarding URL to open. Absent for API-only rails (e.g. Wise). */
  url?: string;
  /** True when the recipient is payable immediately with no hosted step. */
  ready?: boolean;
}

export interface RecipientStatus {
  providerRef: string;
  status: RecipientStatusValue;
  payable: boolean;
  details?: Record<string, unknown>;
}

export interface ParsedOnboardingWebhook {
  event: string;
  /** Provider event identity; the replay-protection key. */
  dedupeKey: string;
  providerRef?: string;
  status: RecipientStatusValue;
  payable: boolean;
}

export interface RecipientOnboardingPort {
  readonly name: string;
  /** Create/find the provider payee entity and (if hosted) an onboarding URL. */
  createOnboardingLink(input: OnboardingLinkInput): Promise<OnboardingLinkResult>;
  /** Pull current status (used on return-from-redirect and for reconciliation). */
  getRecipientStatus(providerRef: string): Promise<RecipientStatus>;
  /** Constant-time signature verification over the raw onboarding webhook body. */
  verifyOnboardingWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ): boolean;
  /** Parse a verified onboarding webhook; null for events we don't act on. */
  parseOnboardingWebhook(rawBody: Buffer | string): ParsedOnboardingWebhook | null;
}
