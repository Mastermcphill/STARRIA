# Package Dependency Diagram

## Before Refactor

Direct runtime imports between domain packages:

```mermaid
graph TD
    tap["@starria/tap-core"]
    gifting["@starria/gifting-core"]
    wallet["@starria/wallet-core"]

    tap -->|"imports CoinGiftingService\nFiatGiftingService\nGiftTargetType"| gifting
    tap -->|"imports (unused types)"| wallet

    style tap fill:#f9a,stroke:#c33
    style gifting fill:#fdb,stroke:#c33
    style wallet fill:#fdb,stroke:#c33
```

Cross-service orchestration happened at the app layer (NestJS modules) through direct service-to-service calls — invisible in the package graph but still tightly coupled:

```
TapService.sendCoinTap()
  └── calls: SupporterService.recordSpend()   [app layer coupling]
  └── calls: StarService.syncTier()           [app layer coupling]

SupporterService.subscribe()
  └── calls: StarService.syncTier()           [app layer coupling]
  └── calls: StarService.onSubscriberAdded()  [app layer coupling]
```

---

## After Refactor

### Package-Level Dependencies

```mermaid
graph TD
    DE["@starria/domain-events\n(shared contracts)"]

    support["@starria/support-core"]
    wallet["@starria/wallet-core"]
    gifting["@starria/gifting-core"]
    tap["@starria/tap-core"]
    star["@starria/star-core"]
    event["@starria/event-core"]
    arena["@starria/arena-core"]
    creator["@starria/creator-os-core"]

    support --> DE
    wallet --> DE
    gifting --> DE
    tap --> DE
    star --> DE
    event --> DE
    arena --> DE
    creator --> DE

    style DE fill:#9cf,stroke:#369,stroke-width:2px
    style tap fill:#bfb,stroke:#393
    style gifting fill:#bfb,stroke:#393
    style wallet fill:#bfb,stroke:#393
```

**Zero direct runtime dependencies between domain packages.** All depend only on `@starria/domain-events`.

---

### Event Bus Message Flow

```mermaid
sequenceDiagram
    participant Client
    participant TapService
    participant TapGiftPort
    participant CoinGiftingService
    participant EventBus
    participant SupporterService
    participant StarService
    participant AnalyticsCore

    Client->>TapService: sendCoinTap(input)
    TapService->>TapGiftPort: sendCoinGift(input)
    TapGiftPort->>CoinGiftingService: sendCoinGift(input)
    CoinGiftingService-->>TapGiftPort: CoinGiftPortResult
    TapGiftPort-->>TapService: CoinGiftPortResult
    TapService->>TapService: store.create(tap)
    TapService->>EventBus: publish(tap.completed)
    TapService-->>Client: TapResult

    Note over EventBus,AnalyticsCore: async / fire-and-forget

    EventBus->>AnalyticsCore: tap.completed handler
    EventBus->>SupporterService: tap.completed → recordSpend()
    SupporterService->>EventBus: publish(supporter.spend.recorded)
    SupporterService->>EventBus: publish(supporter.tier.upgraded) [if tier changed]
    EventBus->>StarService: supporter.subscribed → onSubscriberAdded()
    StarService->>EventBus: publish(star.subscriber.added)
    StarService->>EventBus: publish(star.tier.upgraded) [if tier changed]
```

---

### TapGiftPort Adapter (eliminates tap-core → gifting-core dep)

```mermaid
graph LR
    tap["tap-core\nTapService"]
    port["TapGiftPort\n(interface in tap-core)"]
    adapter["GiftingCoreAdapter\n(app layer)"]
    coin["CoinGiftingService\n(gifting-core)"]
    fiat["FiatGiftingService\n(gifting-core)"]

    tap -->|"injects"| port
    adapter -.->|"implements"| port
    adapter -->|"delegates to"| coin
    adapter -->|"delegates to"| fiat

    style port fill:#9cf,stroke:#369
    style adapter fill:#ff9,stroke:#960
```

The adapter lives in the app layer (`apps/api/`), not in any domain package. This keeps gifting-core's service implementations decoupled from tap-core's type system.

---

### Full Dependency Matrix (after refactor)

| Package | Depends On | Depended On By |
|---|---|---|
| `domain-events` | — | all packages |
| `support-core` | domain-events | app layer |
| `wallet-core` | domain-events | app layer |
| `gifting-core` | domain-events | app layer (via adapter) |
| `tap-core` | domain-events | app layer |
| `star-core` | domain-events | app layer |
| `event-core` | domain-events | app layer |
| `arena-core` | domain-events | app layer |
| `creator-os-core` | domain-events | app layer |

All cross-domain coupling is now mediated by the event bus at runtime, with the app layer as the only place that wires packages together.
