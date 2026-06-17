# Migration Notes — LifeNest → STARRIA

This document describes what changed, what was removed, what was generalised, and how to wire each package back into a NestJS app.

---

## wallet-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `WalletService` (NestJS `@Injectable`) | Plain class `WalletService` in consumer app | Remove framework coupling |
| `WalletSettlementPreview.platformPercentage: 40` (literal) | `platformPercentage: number` | Hardcoded 40/60 was Phase 6 target; now configurable |
| `PrismaService` injected directly | `WalletDurableBalanceStore` port | Storage-agnostic |
| `AuditService`, `RealtimeEventService`, `OperationalOutboxService` | Optional ports / callbacks | Side-effects injected at app layer |
| `HealthcarePilotOperationsService` | Removed — LifeNest-specific | No equivalent in generic package |

### Wiring into a NestJS app
```typescript
// wallet.module.ts
import { Module } from '@nestjs/common';
import { WALLET_DURABLE_BALANCE_STORE } from '@starria/wallet-core';
import { PrismaWalletStore } from './prisma-wallet-store';   // your adapter
import { AppWalletService } from './app-wallet.service';     // wraps wallet-core

@Module({
  providers: [
    { provide: WALLET_DURABLE_BALANCE_STORE, useClass: PrismaWalletStore },
    AppWalletService,
  ],
  exports: [AppWalletService],
})
export class WalletModule {}
```

### Backward compatibility
The `computeLedgerEntryHash` function in `ledger.ts` produces **identical hashes** to the original LifeNest implementation. Existing ledger rows in Postgres remain valid; new rows appended via STARRIA will chain correctly.

---

## gifting-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `CoinTippingService` (`@Injectable`) | `CoinGiftingService` (plain class) | Framework-agnostic |
| `TippingService` | `FiatGiftingService` | Name generalised |
| `TipTargetType` enum | `GiftTargetType` type union + `normalizeGiftTargetType()` | Easier to extend |
| `TipCommissionConfig` (`@Injectable`) | `GiftCommissionConfig` interface + `createCommissionConfig()` factory | No DI required |
| `PLATFORM_FEES_ACCOUNT = 'platform:fees'` | Same constant, same value | No change |
| `PLATFORM_COINS_ACCOUNT = 'platform:coins'` | Same constant, same value | No change |
| Revenue split: `Math.round(gross * pct) / 100` | Same formula | No change |
| Coin conservation: `floor(coins * pct / 100)` | Same formula | No change |

### Wiring
```typescript
import { CoinGiftingService, createCommissionConfig } from '@starria/gifting-core';

const commission = createCommissionConfig(
  parseInt(process.env.TIP_COMMISSION_PERCENT ?? '40', 10),
);
const giftingService = new CoinGiftingService(myLedgerPort, commission, myNotifPort);
```

---

## feed-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `FeedDistrict` union (`'vively' \| 'thrivemen' \| …`) | `category: string` on `FeedItem` | LifeNest-specific vertical names removed |
| `FeedService` with hardcoded in-memory items | `FeedEngine` with `FeedContentPort` | Data source is now injectable |
| No pagination | Opaque base64url cursor + `hasMore` | Proper infinite-scroll support |
| No ranking | Optional `FeedPersonalisationPort` | Pluggable personalisation |

### LifeNest FeedService → FeedEngine migration
```typescript
// Wrap your existing items as a FeedContentPort:
class LifeNestFeedContentAdapter implements FeedContentPort {
  async listItems({ limit, offset }) {
    return STATIC_ITEMS.slice(offset, offset + limit);
  }
  async countItems() { return STATIC_ITEMS.length; }
}
const engine = new FeedEngine(new LifeNestFeedContentAdapter());
```

---

## notification-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `NotificationRepository` (Prisma) | `NotificationStorePort` interface | Storage-agnostic |
| `NotificationChannel: 'in_app'` (only) | `'in_app' \| 'push' \| 'email' \| 'sms'` | Multi-channel support |
| Push worker in `notifications/workers/` | `PushProvider` + `PushTokenStore` interfaces | Framework-agnostic |
| Delivery fire-and-forget | Same pattern, callback to `NotificationDeliveryPort` | No change |
| `NotificationType` union | Same union + `\| string` fallback | App-extensible |

### Wiring
```typescript
const service = new NotificationService(
  new PrismaNotificationStore(prisma),
  new FcmDeliveryAdapter(fcm, tokenStore),
);
await service.send({ userId, type: 'tip_received', body: 'You received a gift!' });
```

---

## moderation-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `ModerationCaseType` includes `'medical_misinformation' \| 'harmful_advice' \| 'support_group_safety'` | Moved to `\| string` extension | Healthcare-specific kept optional |
| `ModerationEscalationStatus` (`'medical_safety_review' \| 'crisis_response' \| 'emergency_care'`) | Collapsed into `ModerationCaseStatus: 'escalated'` | App-specific escalation tiers belong in consuming app |
| `RoomModerationService` (ban/kick/mute in rooms) | Not extracted — depends on LiveKit + Room entities | Still in LifeNest; wire separately |
| `AuditService`, `OperationalOutboxService` injected | Side-effect hooks in `ModerationStorePort` | App-layer concern |

### LifeNest-specific types still in LifeNest
`SupportGroupSafetyAssessment`, `SafeMedicalOutputGuardrail`, `ModerationReviewGate` — these are healthcare-specific and not included in moderation-core.

---

## analytics-core

### What changed
| LifeNest | STARRIA | Why |
|---|---|---|
| `AnalyticsService` stores events in-memory (`Map`) | `AnalyticsService` delegates to `AnalyticsStorePort` | Durable by default |
| `EconomyAnalyticsService` reads Prisma directly | `EconomyDataPort` interface | Storage-agnostic |
| `district` field on events | `category` field | Generalised |
| `RecommendationRankingInputs` with LifeNest `activeRooms`/`activeReplays` | `ActiveEntity[]` with `type: string` | Generalised |

---

## Common pattern: NestJS module wrapper

For any STARRIA package in a NestJS app, the recommended wrapper pattern is:

```typescript
@Module({
  providers: [
    { provide: 'MY_STORE_PORT', useClass: MyPrismaAdapter },
    {
      provide: MyStarriaService,
      useFactory: (store) => new MyStarriaService(store),
      inject: ['MY_STORE_PORT'],
    },
  ],
  exports: [MyStarriaService],
})
export class MyFeatureModule {}
```

This keeps STARRIA packages free of NestJS while the app module provides the DI glue.

---

## Pending migrations not yet applied to LifeNest DB

These Prisma migrations were generated during Phase 3–12 and are pending application to production. They are not affected by this extraction but should be applied before running the new analytics/economy dashboards:

- `20260615150000_platform_payouts`
- `20260615180000_coin_tip_reasons`
- `20260615190000_room_access`
- `20260615200000_room_moderation`
- `20260615210000_livestream_gifts`
