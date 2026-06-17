# STARRIA — Package Relationships

## How the Shared Packages Connect to Domain Modules

```
                      ┌─────────────────────────────────────────┐
                      │           NestJS App Modules             │
                      └─────────────────────────────────────────┘
                             │           │            │
               ┌─────────────┘     ┌─────┘     ┌──────┘
               │                   │           │
        ┌──────▼──────┐    ┌───────▼──┐  ┌────▼───────┐
        │  taps/      │    │ events/  │  │ stars/     │
        │  service    │    │ service  │  │ service    │
        └──────┬──────┘    └──────────┘  └────────────┘
               │
    ┌──────────┼──────────────────────────┐
    │          │                          │
    ▼          ▼                          ▼
gifting-core  wallet-core         notification-core
(CoinGifting  (WalletDurable      (NotificationService)
 FiatGifting)  BalanceStore)
    │
    └── wallet-core (types via port interface)
```

## Port Interface Pattern

Each shared package exposes a **port interface** rather than a concrete
implementation. The NestJS app provides the implementation via module providers.

### Example: Taps → gifting-core → wallet-core

```typescript
// packages/gifting-core/src/coin-gifting.ts
export class CoinGiftingService {
  constructor(
    private readonly ledger: WalletLedgerPort,     // ← port
    private readonly config: GiftCommissionConfig,
    private readonly notify?: NotificationPort,     // ← port (optional)
  ) {}
}

// apps/api/src/modules/taps/taps.module.ts (TODO: implement)
@Module({
  providers: [
    { provide: WALLET_LEDGER_PORT, useClass: PrismaWalletAdapter },
    {
      provide: CoinGiftingService,
      useFactory: (ledger, config) => new CoinGiftingService(ledger, config),
      inject: [WALLET_LEDGER_PORT, GIFT_COMMISSION_CONFIG],
    },
  ],
})
export class TapsModule {}
```

## Feed → Search → Analytics Pipeline

```
User opens app
  ▼
FeedEngine (feed-core)
  │  FeedContentPort.listItems() → queries ContentIndex (search-core)
  │  FeedPersonalisationPort.rank() → weights by RecommendationFeedback
  ▼
FeedPage rendered on device
  ▼
User watches content
  ▼
AnalyticsService (analytics-core)
  │  join_session() / leave_session()
  ▼
WatchSession table → ContentAnalyticsSnapshot
  ▼
FeedPersonalisationPort uses snapshots to re-rank next page
```

## Notification Fan-Out

```
Any domain event (Tap received, Event goes live, Star posts)
  ▼
NotificationService.send({ userId, type, channel })
  ▼
  ├── channel: IN_APP  → writes Notification row (Prisma)
  ├── channel: PUSH    → PushProvider → FCM
  ├── channel: EMAIL   → EmailProvider → SMTP / SES
  └── channel: SMS     → SmsProvider (future)
```

## Moderation Integration

```
Any content or user action
  ▼
ModerationService.report({ targetType, targetId, caseType })
  ▼
ModerationStorePort → ModerationReport row
  ▼
Admin reviews case
  ├── RESOLVED → no further action
  ├── ESCALATED → human review queue (Redis BullMQ)
  └── DISMISSED → noop
```
