// ---------------------------------------------------------------------------
// wallet-core — shared types & interfaces
// Extracted from LifeNest (LifeNestOmegaMerged) for reuse across STARRIA apps.
// All Prisma / NestJS references have been removed; implement adapters in
// the consuming app.
// ---------------------------------------------------------------------------

export type WalletAccountType =
  | 'customer'
  | 'creator'
  | 'professional'
  | 'store'
  | 'storefront'
  | 'platform';

export type WalletLedgerDirection = 'credit' | 'debit';

export type WalletLedgerReason =
  | 'payment_split'
  | 'manual_credit'
  | 'withdrawal'
  | 'refund'
  | 'adjustment';

export type WalletSettlementPurpose =
  | 'order'
  | 'consultation'
  | 'subscription'
  | 'room_rental'
  | 'tip'
  | 'wallet_topup'
  | 'other';

export type WalletPayoutStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface WalletLedgerEntry {
  readonly id: string;
  readonly sequence: number;
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly direction: WalletLedgerDirection;
  readonly amount: number;
  readonly currency: string;
  readonly balanceAfter: number;
  readonly reference: string;
  readonly reason: WalletLedgerReason;
  readonly previousHash: string;
  readonly hash: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

/** Platform always takes the configured percentage; creator receives the rest. */
export interface WalletSettlementPreview {
  readonly grossAmount: number;
  readonly platformFee: number;
  readonly creatorAmount: number;
  readonly platformPercentage: number;
  readonly recipientPercentage: number;
}

export interface WalletSettlementInput {
  readonly amount: number;
  readonly recipientId: string;
  readonly recipientType: WalletAccountType;
  readonly reference?: string;
  readonly currency?: string;
  readonly purpose?: WalletSettlementPurpose;
  readonly actorId?: string;
  readonly metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Credit / Debit / Reversal
// ---------------------------------------------------------------------------

export interface WalletCreditInput {
  readonly accountId: string;
  readonly accountType?: WalletAccountType;
  readonly amount: number;
  readonly currency?: string;
  readonly reference?: string;
  readonly reason?: WalletLedgerReason;
  readonly actorId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface WalletDebitInput {
  readonly accountId: string;
  readonly accountType?: WalletAccountType;
  readonly amount: number;
  readonly currency?: string;
  readonly reference: string;
  readonly reason?: WalletLedgerReason;
  readonly actorId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface WalletReversalInput extends WalletDebitInput {
  readonly originalReference?: string;
}

export interface WalletReversalResult {
  readonly reference: string;
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly currency: string;
  readonly requestedAmount: number;
  readonly reversedAmount: number;
  readonly reversalEntry?: WalletLedgerEntry;
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

export interface WalletPayoutRequest {
  readonly userId: string;
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly amount: number;
  readonly currency: string;
  readonly destination?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface WalletPayoutRecord {
  readonly id: string;
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly amount: number;
  readonly currency: string;
  readonly status: WalletPayoutStatus;
  readonly reference: string;
  readonly providerReference?: string;
  readonly destination?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface WalletBalanceSnapshot {
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly currency: string;
  readonly available: number;
  readonly pending: number;
  readonly total: number;
  readonly version: number;
}
