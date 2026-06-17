// ---------------------------------------------------------------------------
// wallet-core — domain event publishers
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  LedgerEntryCreatedEvent,
  PayoutRequestedEvent,
  PayoutCompletedEvent,
} from '@starria/domain-events';
import {
  WALLET_LEDGER_ENTRY_CREATED,
  WALLET_PAYOUT_REQUESTED,
  WALLET_PAYOUT_COMPLETED,
} from '@starria/domain-events';

export function buildLedgerEntryCreatedEvent(params: {
  entryId: string;
  accountId: string;
  accountType: string;
  direction: 'credit' | 'debit';
  amount: number;
  currency: string;
  balanceAfter: number;
  reason: string;
  reference: string;
}): LedgerEntryCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: WALLET_LEDGER_ENTRY_CREATED,
    aggregateId: params.entryId,
    aggregateType: 'WalletLedgerEntry',
    payload: params,
  });
}

export function buildPayoutRequestedEvent(params: {
  payoutId: string;
  accountId: string;
  amount: number;
  currency: string;
  destinationRef: string;
}): PayoutRequestedEvent {
  return createEvent({
    id: randomUUID(),
    type: WALLET_PAYOUT_REQUESTED,
    aggregateId: params.payoutId,
    aggregateType: 'WalletPayout',
    payload: params,
  });
}

export function buildPayoutCompletedEvent(params: {
  payoutId: string;
  accountId: string;
  amount: number;
  currency: string;
  completedAt: string;
}): PayoutCompletedEvent {
  return createEvent({
    id: randomUUID(),
    type: WALLET_PAYOUT_COMPLETED,
    aggregateId: params.payoutId,
    aggregateType: 'WalletPayout',
    payload: params,
  });
}
