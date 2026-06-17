# STARRIA — Complete Package Dependency Graph

## Legend

```
──▶  hard package dependency (import in package.json)
- -▶  port interface dependency (injected at app layer, no package.json entry)
══▶  data flow (IDs / events cross the boundary at runtime)
```

---

## Full graph

```
External Services
  LiveKit SDK
  FCM / APNS
  Anthropic API
  S3 / R2
  PostgreSQL
  Redis
       │
       │ wrapped by port interfaces
       ▼

Infrastructure Layer (extracted packages — zero runtime deps)

  @starria/wallet-core ────────────────────────────────── standalone
        │ WalletDurableBalanceStore, WalletLedgerEntry
        │ WalletCreditInput / DebitInput
        ▼
  @starria/gifting-core ──▶ @starria/wallet-core (types only)
        │ CoinGiftingService, FiatGiftingService
        │ CoinLedgerPort, FiatGiftWalletPort
        ▼
  @starria/feed-core ──────────────────────────────────── standalone
        │ FeedEngine, FeedContentPort, FeedPersonalisationPort

  @starria/notification-core ─────────────────────────── standalone
        │ NotificationService, NotificationStorePort

  @starria/moderation-core ───────────────────────────── standalone
        │ ModerationService, ModerationStorePort

  @starria/analytics-core ────────────────────────────── standalone
        │ AnalyticsService, AnalyticsStorePort

  video-core (Python / FastAPI) ──────────────────────── standalone
  search-core (Python / FastAPI) ─────────────────────── standalone


Domain Layer (new packages)

  @starria/support-core
        │ SupporterService, SupporterStorePort
        ├─ - ▶ @starria/notification-core  (SupporterNotificationPort)
        ├─ ══▶ @starria/star-core          (calls onSubscriberAdded / Removed)
        └─ ══▶ @starria/tap-core           (recordSpend called by NestJS module)

  @starria/star-core
        │ StarService, StarStorePort, StarDiscoveryPort
        ├─ - ▶ @starria/notification-core  (StarNotificationPort)
        ├─ - ▶ @starria/analytics-core     (discovery score input — background)
        └─ - ▶ search-core                 (StarDiscoveryPort uses pg_trgm adapter)

  @starria/tap-core  ──▶ @starria/gifting-core  (concrete service import)
        │                @starria/wallet-core   (types only, via gifting-core)
        │ TapService, TapStorePort
        ├─ - ▶ @starria/analytics-core     (TapAnalyticsPort)
        ├─ - ▶ @starria/notification-core  (TapNotificationPort)
        ├─ ══▶ @starria/support-core       (recordSpend — app layer wiring)
        └─ ══▶ @starria/event-core         (recordTapOnEvent — app layer wiring)

  @starria/event-core
        │ EventService, EventStorePort
        ├─ - ▶ @starria/analytics-core     (EventAnalyticsPort)
        ├─ - ▶ @starria/notification-core  (EventNotificationPort)
        ├─ - ▶ video-core                  (EventSearchIndexPort via HTTP adapter)
        └─ - ▶ search-core                 (EventSearchIndexPort via HTTP adapter)

  @starria/arena-core
        │ ArenaService, ArenaStorePort, LiveKitPort
        ├─ - ▶ @starria/support-core       (ArenaSubscriptionCheckPort)
        ├─ - ▶ @starria/analytics-core     (ArenaAnalyticsPort)
        ├─ - ▶ @starria/notification-core  (ArenaNotificationPort)
        └─ - ▶ @starria/moderation-core    (admin-level report escalation — optional)


NestJS App (@starria/api)
  imports all 13 packages
  wires ports via @Module providers
  owns the integration of all cross-package calls
```

---

## Topological build order

```
1. wallet-core          (no deps)
2. gifting-core         (→ wallet-core types)
3. feed-core            (no deps)
4. notification-core    (no deps)
5. moderation-core      (no deps)
6. analytics-core       (no deps)
7. video-core           (Python — separate build)
8. search-core          (Python — separate build)
9. support-core         (no package deps)
10. star-core           (no package deps)
11. tap-core            (→ gifting-core, wallet-core)
12. event-core          (no package deps)
13. arena-core          (no package deps)
14. @starria/api        (→ all above)
```

---

## Circular dependency analysis

**None.** All cross-package calls at runtime go through injected port interfaces.
The only package-level edges are:
- `gifting-core → wallet-core` (types only)
- `tap-core → gifting-core` (concrete service)
- `tap-core → wallet-core` (types only, transitively)

All other cross-domain interactions (support-core ↔ star-core, tap-core ↔ support-core)
are resolved at the **NestJS app layer** by passing concrete implementations of port
interfaces. The packages themselves do not import each other.

---

## NestJS module dependency graph

```
AppModule
  ├── PrismaModule (global)
  ├── RedisModule (global)
  ├── AuthModule
  │     └── UsersModule
  ├── UsersModule
  ├── StarsModule          ← wires @starria/star-core
  │     └── SupportersModule (for subscriber count hooks)
  ├── SupportersModule     ← wires @starria/support-core
  ├── TapsModule           ← wires @starria/tap-core + gifting-core + wallet-core
  │     ├── StarsModule
  │     └── SupportersModule
  ├── EventsModule         ← wires @starria/event-core
  │     └── StarsModule
  ├── ArenasModule         ← wires @starria/arena-core
  │     ├── StarsModule
  │     └── SupportersModule (for subscription check)
  └── AiCreatorModule
```
