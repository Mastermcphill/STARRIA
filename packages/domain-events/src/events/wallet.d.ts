import type { DomainEvent } from '../event';
export declare const WALLET_LEDGER_ENTRY_CREATED = "wallet.ledger.entry.created";
export declare const WALLET_PAYOUT_REQUESTED = "wallet.payout.requested";
export declare const WALLET_PAYOUT_COMPLETED = "wallet.payout.completed";
export declare const WALLET_BALANCE_UPDATED = "wallet.balance.updated";
export interface LedgerEntryCreatedPayload {
    readonly entryId: string;
    readonly accountId: string;
    readonly accountType: string;
    readonly direction: 'credit' | 'debit';
    readonly amount: number;
    readonly currency: string;
    readonly balanceAfter: number;
    readonly reason: string;
    readonly reference: string;
}
export interface PayoutRequestedPayload {
    readonly payoutId: string;
    readonly accountId: string;
    readonly amount: number;
    readonly currency: string;
    readonly destinationRef: string;
}
export interface PayoutCompletedPayload {
    readonly payoutId: string;
    readonly accountId: string;
    readonly amount: number;
    readonly currency: string;
    readonly completedAt: string;
}
export interface BalanceUpdatedPayload {
    readonly accountId: string;
    readonly availableBalance: number;
    readonly pendingBalance: number;
    readonly currency: string;
}
export type LedgerEntryCreatedEvent = DomainEvent<LedgerEntryCreatedPayload>;
export type PayoutRequestedEvent = DomainEvent<PayoutRequestedPayload>;
export type PayoutCompletedEvent = DomainEvent<PayoutCompletedPayload>;
export type BalanceUpdatedEvent = DomainEvent<BalanceUpdatedPayload>;
