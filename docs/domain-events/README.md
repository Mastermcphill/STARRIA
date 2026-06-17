# STARRIA Domain Events

This document describes the domain event system used across STARRIA packages to replace direct package-to-package coupling with a shared event bus contract.

---

## Why Domain Events?

Before this refactor, packages coupled directly:

```
tap-core ──imports──> @starria/gifting-core (CoinGiftingService, FiatGiftingService)
tap-core ──imports──> @starria/gifting-core (GiftTargetType)
```

Cross-package side-effects (analytics, notifications, tier recalculation) were wired through the app layer by calling other services imperiously. This made each service's blast radius hard to reason about.

After this refactor:
- **tap-core has zero runtime dependencies on other domain packages.**
- All cross-package reaction (analytics, tier sync, search indexing) is driven by subscribers on the shared event bus.
- The `EventBus` is optional — injected at startup, no-op if omitted.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     @starria/domain-events                      │
│                                                                 │
│  DomainEvent<TPayload>   EventBus (interface)                   │
│  InMemoryEventBus        NoopEventBus                           │
│  createEvent()           EventHandler<E>                        │
│                                                                 │
│  events/support.ts   events/wallet.ts    events/gifting.ts      │
│  events/tap.ts       events/star.ts      events/discovery.ts    │
│  events/live-event.ts events/arena.ts   events/creator-os.ts   │
└─────────────────────────────────────────────────────────────────┘
          ▲ depends on (all packages)
          │
   ┌──────┴──────────────────────────────────────────┐
   │  support-core  wallet-core  gifting-core         │
   │  tap-core      star-core    event-core           │
   │  arena-core    creator-os-core                   │
   └─────────────────────────────────────────────────┘
```

### EventBus Flow

```
Service method completes
       │
       ├── persist to store (awaited, critical path)
       ├── call notification port (void, fire-and-forget)
       └── eventBus.publish(event) (void, fire-and-forget)
                │
                └─► registered subscribers run asynchronously
                       ├── analytics-core listener
                       ├── feed-core listener (re-rank)
                       ├── star-core subscriber-count sync
                       └── notification-core delivery
```

---

## EventBus Contract

```typescript
import { EventBus, InMemoryEventBus, NoopEventBus } from '@starria/domain-events';

// For production — inject a Redis Streams / SQS / Kafka implementation:
const bus: EventBus = new RedisEventBus(redisClient);

// For tests:
const bus: EventBus = new InMemoryEventBus();

// For services that don't need bus reactions (optional injection):
const bus: EventBus = new NoopEventBus();
```

All service constructors accept `eventBus?: EventBus` as the **last optional parameter**.

---

## Event Shape

```typescript
interface DomainEvent<TPayload> {
  id: string;           // UUID
  type: string;         // 'tap.completed', 'arena.created', …
  aggregateId: string;  // ID of the entity that changed
  aggregateType: string;// 'Tap', 'Arena', 'StarProfile', …
  occurredAt: string;   // ISO 8601
  version: number;      // payload schema version (starts at 1)
  payload: TPayload;
  metadata?: Record<string, unknown>; // tracing, correlation IDs
}
```

---

## Package Dependency Graph (after refactor)

See [dependency-diagram.md](./dependency-diagram.md) for the full Mermaid diagram.

Key change: **tap-core no longer imports gifting-core**. It receives a `TapGiftPort` at construction time, which the app layer wires to an adapter over `CoinGiftingService`/`FiatGiftingService`.

---

## Event Catalog

See [event-catalog.md](./event-catalog.md) for the complete list of 33 domain events across 9 packages.

---

## Wiring Example (NestJS)

```typescript
// In your NestJS module
const bus = new RedisEventBus(redis);

// Subscribe analytics to tap events
bus.subscribe(TAP_COMPLETED, (e: TapCompletedEvent) =>
  analyticsService.trackTap(e.payload),
);

// Subscribe star-core tier sync to subscription events
bus.subscribe(SUPPORTER_SUBSCRIBED, async (e: SubscriptionCreatedEvent) => {
  await starService.onSubscriberAdded(e.payload.starId, e.payload.supporterId, e.payload.tier);
});

bus.subscribe(SUPPORTER_SUBSCRIPTION_CANCELLED, async (e: SubscriptionCancelledEvent) => {
  await starService.onSubscriberRemoved(e.payload.starId, e.payload.supporterId);
});

// Wire services — tap-core no longer imports gifting-core directly
const tapGiftAdapter: TapGiftPort = {
  sendCoinGift: (input) => coinGiftingService.sendCoinGift({ ...input, targetType: input.targetType }),
  sendFiatGift: (input) => fiatGiftingService.sendGift({ ...input }),
};

const tapService = new TapService(
  tapStore,
  tapGiftAdapter,   // ← port, not gifting-core import
  leaderboardAdapter,
  analyticsAdapter,
  notificationAdapter,
  bus,              // ← optional event bus
);
```
