// ---------------------------------------------------------------------------
// wallet-core — durable balance store interface
// Extracted verbatim from LifeNest wallet-durable-balance-store.ts.
// Implement this interface with Prisma, Redis, or an in-memory Map.
// ---------------------------------------------------------------------------

/**
 * A single mutation applied to a wallet balance inside one critical section:
 *   read current balance → check sufficiency → compute next → commit atomically.
 *
 * WHY THIS EXISTS
 * ---------------
 * Wallet balance arithmetic that relies on per-process in-memory state admits
 * double-spend, payout races, and stale-balance authorization under a
 * multi-instance API tier.  This contract makes the balance decision
 * authoritative and serialised per wallet.
 *
 * Idempotency: a businessKey that has already been APPLIED returns the
 * original result (replayed=true) without re-applying.  Rejections
 * (insufficient funds) are NOT cached, so a later top-up + retry can succeed.
 */
export interface WalletBalanceMutationInput {
  readonly walletKey: string;
  readonly accountId: string;
  readonly accountType: string;
  readonly currency: string;
  readonly direction: 'credit' | 'debit';
  readonly amount: number;
  /** Must be globally unique per logical operation (use `<purpose>:<uuid>`). */
  readonly businessKey: string;
}

export interface WalletBalanceMutationResult {
  /** true when the balance moved (or was already applied on replay). */
  readonly applied: boolean;
  /** true when this businessKey had already been applied (idempotent replay). */
  readonly replayed: boolean;
  readonly balanceAfter: number;
  readonly version: number;
  readonly reason?: 'insufficient_funds';
}

export interface WalletDurableBalanceSnapshot {
  readonly walletKey: string;
  readonly accountId: string;
  readonly accountType: string;
  readonly currency: string;
  readonly balance: number;
  readonly version: number;
}

/** Implement this to back WalletService with a durable, serialised store. */
export interface WalletDurableBalanceStore {
  applyMutation(input: WalletBalanceMutationInput): Promise<WalletBalanceMutationResult>;
  readBalance(walletKey: string): Promise<{ balance: number; version: number } | undefined>;
  snapshot(): Promise<ReadonlyArray<WalletDurableBalanceSnapshot>>;
}

/** Token for NestJS DI — inject with @Inject(WALLET_DURABLE_BALANCE_STORE). */
export const WALLET_DURABLE_BALANCE_STORE = 'WALLET_DURABLE_BALANCE_STORE';
