// ---------------------------------------------------------------------------
// wallet-core — LedgerService (Sprint 11)
//
// A framework-agnostic, double-entry ledger orchestrator. It builds *balanced*
// postings (sum of credits === sum of debits), enforces input invariants and
// idempotency, and delegates atomic persistence + balance mutation to a
// LedgerStorePort (implemented with Prisma in the API). Money never moves
// without a posting; every posting is immutable and (in the adapter) hash-chained.
//
// Balances are split into two sub-ledgers per account:
//   available — spendable funds
//   reserved  — funds held against an in-flight operation (escrow)
//
// Capabilities: credit, debit, reserve, release, settle, refund.
// ---------------------------------------------------------------------------

import type { WalletAccountType, WalletLedgerDirection } from './types';

/** Sentinel account representing the outside world (cash-in / cash-out). */
export const EXTERNAL_ACCOUNT_ID = 'external:world';
/** Platform house account that collects fees. */
export const PLATFORM_ACCOUNT_ID = 'platform:starria';
export const DEFAULT_CURRENCY = 'COINS';

export type LedgerSubAccount = 'available' | 'reserved';

export type LedgerTxnType =
  | 'credit'
  | 'debit'
  | 'reserve'
  | 'release'
  | 'settle'
  | 'refund';

/** One leg of a double-entry posting. `credit` increases a bucket, `debit` decreases it. */
export interface LedgerLeg {
  readonly accountId: string;
  readonly accountType: WalletAccountType;
  readonly sub: LedgerSubAccount;
  readonly direction: WalletLedgerDirection;
  readonly amount: number;
}

export interface LedgerPosting {
  readonly idempotencyKey: string;
  readonly reference: string;
  readonly reason: string;
  readonly currency: string;
  readonly txnType: LedgerTxnType;
  readonly legs: readonly LedgerLeg[];
  /** Accounts whose `available` (or `reserved`) must be >= the debited amount. */
  readonly requireFunds: ReadonlyArray<{ accountId: string; sub: LedgerSubAccount; amount: number }>;
  readonly settlement?: LedgerSettlementRecord;
  readonly refund?: LedgerRefundRecord;
  readonly metadata?: Record<string, unknown>;
}

export interface LedgerSettlementRecord {
  readonly payerAccountId: string;
  readonly recipientAccountId: string;
  readonly grossAmount: number;
  readonly platformFee: number;
  readonly recipientAmount: number;
  readonly platformPercentage: number;
}

export interface LedgerRefundRecord {
  readonly originalReference: string;
  readonly payerAccountId: string;
  readonly amount: number;
}

export interface LedgerBalance {
  readonly accountId: string;
  readonly currency: string;
  readonly available: number;
  readonly reserved: number;
  readonly version: number;
}

export interface LedgerResult {
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly txnType: LedgerTxnType;
  readonly currency: string;
  readonly deduped: boolean;
  readonly balances: readonly LedgerBalance[];
}

/**
 * Persistence port. The adapter MUST execute `post` atomically: re-check the
 * `requireFunds` preconditions inside the transaction, write one immutable
 * WalletTransaction row per leg (hash-chained), update WalletBalanceSnapshot,
 * and (when present) write WalletSettlement / WalletRefund. It must be
 * idempotent on `idempotencyKey`.
 */
export interface LedgerStorePort {
  findResultByIdempotencyKey(key: string): Promise<LedgerResult | null>;
  getBalance(accountId: string, currency: string): Promise<LedgerBalance>;
  post(posting: LedgerPosting): Promise<LedgerResult>;
}

export interface LedgerOpOptions {
  readonly idempotencyKey: string;
  readonly reference?: string;
  readonly reason?: string;
  readonly currency?: string;
  readonly accountType?: WalletAccountType;
  readonly counterAccountId?: string;
  readonly metadata?: Record<string, unknown>;
}

function assertPositiveInt(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
    throw new Error(`${label} must be a positive integer (got ${amount})`);
  }
}

/** Sum credits and debits per (account, sub) and assert the posting nets to zero. */
function assertBalanced(legs: readonly LedgerLeg[]): void {
  let credits = 0;
  let debits = 0;
  for (const leg of legs) {
    assertPositiveInt(leg.amount, 'leg amount');
    if (leg.direction === 'credit') credits += leg.amount;
    else debits += leg.amount;
  }
  if (credits !== debits) {
    throw new Error(`Unbalanced posting: credits=${credits} debits=${debits}`);
  }
}

export class LedgerService {
  constructor(private readonly store: LedgerStorePort) {}

  /** Atomically post a balanced double-entry transaction with idempotency. */
  private async postOrDedupe(posting: LedgerPosting): Promise<LedgerResult> {
    assertBalanced(posting.legs);
    const existing = await this.store.findResultByIdempotencyKey(posting.idempotencyKey);
    if (existing) return { ...existing, deduped: true };
    return this.store.post(posting);
  }

  /** Bring external funds into an account's available balance (cash-in). */
  async credit(accountId: string, amount: number, opts: LedgerOpOptions): Promise<LedgerResult> {
    assertPositiveInt(amount, 'credit amount');
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const accountType = opts.accountType ?? 'customer';
    const counter = opts.counterAccountId ?? EXTERNAL_ACCOUNT_ID;
    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'manual_credit',
      currency,
      txnType: 'credit',
      legs: [
        { accountId, accountType, sub: 'available', direction: 'credit', amount },
        { accountId: counter, accountType: 'platform', sub: 'available', direction: 'debit', amount },
      ],
      requireFunds: [],
      metadata: opts.metadata,
    });
  }

  /** Remove funds from an account's available balance (cash-out). */
  async debit(accountId: string, amount: number, opts: LedgerOpOptions): Promise<LedgerResult> {
    assertPositiveInt(amount, 'debit amount');
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const accountType = opts.accountType ?? 'customer';
    const counter = opts.counterAccountId ?? EXTERNAL_ACCOUNT_ID;
    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'withdrawal',
      currency,
      txnType: 'debit',
      legs: [
        { accountId, accountType, sub: 'available', direction: 'debit', amount },
        { accountId: counter, accountType: 'platform', sub: 'available', direction: 'credit', amount },
      ],
      requireFunds: [{ accountId, sub: 'available', amount }],
      metadata: opts.metadata,
    });
  }

  /** Move funds from available → reserved (place an escrow hold). */
  async reserve(accountId: string, amount: number, opts: LedgerOpOptions): Promise<LedgerResult> {
    assertPositiveInt(amount, 'reserve amount');
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const accountType = opts.accountType ?? 'customer';
    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'adjustment',
      currency,
      txnType: 'reserve',
      legs: [
        { accountId, accountType, sub: 'available', direction: 'debit', amount },
        { accountId, accountType, sub: 'reserved', direction: 'credit', amount },
      ],
      requireFunds: [{ accountId, sub: 'available', amount }],
      metadata: opts.metadata,
    });
  }

  /** Move funds from reserved → available (cancel an escrow hold). */
  async release(accountId: string, amount: number, opts: LedgerOpOptions): Promise<LedgerResult> {
    assertPositiveInt(amount, 'release amount');
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const accountType = opts.accountType ?? 'customer';
    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'adjustment',
      currency,
      txnType: 'release',
      legs: [
        { accountId, accountType, sub: 'reserved', direction: 'debit', amount },
        { accountId, accountType, sub: 'available', direction: 'credit', amount },
      ],
      requireFunds: [{ accountId, sub: 'reserved', amount }],
      metadata: opts.metadata,
    });
  }

  /**
   * Settle a payment: consume `gross` from the payer (from reserved if
   * `fromReserved`, else available), credit the recipient `gross - fee`, and
   * credit the platform the `fee`. Writes a WalletSettlement record.
   */
  async settle(
    input: {
      payerAccountId: string;
      recipientAccountId: string;
      grossAmount: number;
      platformPercentage: number;
      fromReserved?: boolean;
      recipientType?: WalletAccountType;
      payerType?: WalletAccountType;
    },
    opts: LedgerOpOptions,
  ): Promise<LedgerResult> {
    assertPositiveInt(input.grossAmount, 'gross amount');
    if (input.platformPercentage < 0 || input.platformPercentage > 100) {
      throw new Error(`platformPercentage must be 0..100 (got ${input.platformPercentage})`);
    }
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const platformFee = Math.floor((input.grossAmount * input.platformPercentage) / 100);
    const recipientAmount = input.grossAmount - platformFee;
    const payerSub: LedgerSubAccount = input.fromReserved ? 'reserved' : 'available';
    const payerType = input.payerType ?? 'customer';
    const recipientType = input.recipientType ?? 'creator';

    const legs: LedgerLeg[] = [
      { accountId: input.payerAccountId, accountType: payerType, sub: payerSub, direction: 'debit', amount: input.grossAmount },
      { accountId: input.recipientAccountId, accountType: recipientType, sub: 'available', direction: 'credit', amount: recipientAmount },
    ];
    if (platformFee > 0) {
      legs.push({ accountId: PLATFORM_ACCOUNT_ID, accountType: 'platform', sub: 'available', direction: 'credit', amount: platformFee });
    } else {
      // keep balanced when fee rounds to 0 by giving the rounding to the recipient
      legs[1] = { ...legs[1], amount: input.grossAmount };
    }

    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'payment_split',
      currency,
      txnType: 'settle',
      legs,
      requireFunds: [{ accountId: input.payerAccountId, sub: payerSub, amount: input.grossAmount }],
      settlement: {
        payerAccountId: input.payerAccountId,
        recipientAccountId: input.recipientAccountId,
        grossAmount: input.grossAmount,
        platformFee,
        recipientAmount: input.grossAmount - platformFee,
        platformPercentage: input.platformPercentage,
      },
      metadata: opts.metadata,
    });
  }

  /**
   * Refund a prior settlement: pull `recipientAmount` back from the recipient
   * and `platformFee` back from the platform, returning `gross` to the payer's
   * available balance. Writes a WalletRefund record.
   */
  async refund(
    input: {
      originalReference: string;
      payerAccountId: string;
      recipientAccountId: string;
      grossAmount: number;
      platformFee: number;
      payerType?: WalletAccountType;
      recipientType?: WalletAccountType;
    },
    opts: LedgerOpOptions,
  ): Promise<LedgerResult> {
    assertPositiveInt(input.grossAmount, 'refund gross amount');
    const currency = opts.currency ?? DEFAULT_CURRENCY;
    const recipientAmount = input.grossAmount - input.platformFee;
    const payerType = input.payerType ?? 'customer';
    const recipientType = input.recipientType ?? 'creator';

    const legs: LedgerLeg[] = [
      { accountId: input.recipientAccountId, accountType: recipientType, sub: 'available', direction: 'debit', amount: recipientAmount },
      { accountId: input.payerAccountId, accountType: payerType, sub: 'available', direction: 'credit', amount: input.grossAmount },
    ];
    const requireFunds = [{ accountId: input.recipientAccountId, sub: 'available' as const, amount: recipientAmount }];
    if (input.platformFee > 0) {
      legs.splice(1, 0, { accountId: PLATFORM_ACCOUNT_ID, accountType: 'platform', sub: 'available', direction: 'debit', amount: input.platformFee });
      requireFunds.push({ accountId: PLATFORM_ACCOUNT_ID, sub: 'available' as const, amount: input.platformFee });
    }

    return this.postOrDedupe({
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference ?? opts.idempotencyKey,
      reason: opts.reason ?? 'refund',
      currency,
      txnType: 'refund',
      legs,
      requireFunds,
      refund: {
        originalReference: input.originalReference,
        payerAccountId: input.payerAccountId,
        amount: input.grossAmount,
      },
      metadata: opts.metadata,
    });
  }

  /** Read current balances for an account. */
  async balance(accountId: string, currency = DEFAULT_CURRENCY): Promise<LedgerBalance> {
    return this.store.getBalance(accountId, currency);
  }
}
