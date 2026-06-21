// ---------------------------------------------------------------------------
// LedgerModule — exposes wallet-core's LedgerService backed by Prisma.
//
// LedgerService is the single source of truth for money movement. Other
// monetary modules (gifting, ticketing, campaigns, companion sessions, arena
// voting, prize pools, subscriptions) inject LedgerService and call
// debit / credit / reserve / release / settle / refund instead of mutating
// balances directly. See docs/sprint11/ledger-report.md for the integration map.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { LedgerService } from '@starria/wallet-core';
import { PrismaLedgerStore } from './prisma-ledger-store';

@Module({
  providers: [
    PrismaLedgerStore,
    {
      provide: LedgerService,
      useFactory: (store: PrismaLedgerStore) => new LedgerService(store),
      inject: [PrismaLedgerStore],
    },
  ],
  exports: [LedgerService, PrismaLedgerStore],
})
export class LedgerModule {}
