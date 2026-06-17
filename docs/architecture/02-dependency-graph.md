# STARRIA — Dependency Graph

## Package Inter-dependencies

```
@starria/api (NestJS app)
  ├── @starria/wallet-core        (WalletDurableBalanceStore, ledger hash)
  ├── @starria/gifting-core       (CoinGiftingService, FiatGiftingService)
  │     └── depends on → @starria/wallet-core  (types only, via port interface)
  ├── @starria/feed-core          (FeedEngine, FeedContentPort)
  ├── @starria/notification-core  (NotificationService, PushProvider)
  ├── @starria/moderation-core    (ModerationService, ModerationStorePort)
  ├── @starria/analytics-core     (AnalyticsService, EconomyDataPort)
  ├── @starria/video-core         (Python package — REST bridge or port)
  └── @starria/search-core        (Python package — REST bridge or port)
```

## TypeScript Packages (extracted from LifeNest)

```
wallet-core ────────────────────────────── no deps
analytics-core ─────────────────────────── no deps
feed-core ──────────────────────────────── no deps
notification-core ──────────────────────── no deps
moderation-core ────────────────────────── no deps
gifting-core ──── wallet-core (types) ───── optional; wire at app layer
```

All TypeScript packages have **zero runtime `dependencies`**. They are pure
TypeScript with Node built-ins only (`crypto`).

## Python Packages (extracted from Vidzi)

```
video-core ─────────────────────────────── SQLAlchemy, boto3, FastAPI
analytics-core ─────────────────────────── SQLAlchemy, FastAPI
search-core ────────────────────────────── SQLAlchemy, FastAPI
```

These are standalone Python packages. In STARRIA they can be:
- Mounted as micro-services alongside the NestJS API
- Consumed via internal HTTP from the NestJS api
- Ported to TypeScript in a future phase (see migration roadmap)

## NestJS App Module Graph

```
AppModule
  ├── ConfigModule (global)
  ├── ThrottlerModule (global)
  ├── PrismaModule (global)
  ├── RedisModule (global)
  ├── AuthModule
  │     └── UsersModule
  ├── UsersModule
  ├── StarsModule
  ├── SupportersModule
  ├── TapsModule
  ├── EventsModule
  ├── ArenasModule
  └── AiCreatorModule
```

## External Service Dependencies

```
STARRIA API
  ├── PostgreSQL 16     (primary data store — Prisma)
  ├── Redis 7           (cache, queues, pub/sub)
  ├── LiveKit           (real-time video/audio for Arenas)
  ├── S3 / R2           (media storage via video-core)
  ├── FCM               (push notifications via notification-core)
  └── Anthropic API     (AI creator tools)
```
