# STARRIA — System Architecture

## Overview

STARRIA is a creator-economy platform where **Stars** (creators) host live events inside **Arenas** (rooms), receive **Taps** (micropayments / gifts) from **Supporters** (fans), and use **AI Creator Tools** to produce content.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│   Flutter Mobile App          Web (future)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS / WebSocket
┌─────────────────────▼───────────────────────────────────────────┐
│                    STARRIA API  (NestJS / Fastify)               │
│                                                                  │
│  ┌──────────┐ ┌───────────┐ ┌──────┐ ┌────────┐ ┌──────────┐  │
│  │  /auth   │ │  /stars   │ │/taps │ │/events │ │ /arenas  │  │
│  │  /users  │ │/supporters│ │      │ │        │ │          │  │
│  └──────────┘ └───────────┘ └──────┘ └────────┘ └──────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               SHARED PACKAGES  (@starria/*)                │ │
│  │  wallet-core  gifting-core  feed-core  notification-core   │ │
│  │  moderation-core  analytics-core  video-core  search-core  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────┬───────────────────┬────────────────┬──────────────────┘
          │                   │                │
┌─────────▼──────┐  ┌────────▼──────┐  ┌──────▼─────────────────┐
│  PostgreSQL 16 │  │  Redis 7      │  │  External Services      │
│  (Prisma ORM)  │  │  • Job queues │  │  • LiveKit  (Arenas)    │
│                │  │  • Caching    │  │  • S3/R2    (Media)     │
│                │  │  • Pub/Sub    │  │  • FCM      (Push)      │
│                │  │               │  │  • Anthropic (AI tools) │
└────────────────┘  └───────────────┘  └────────────────────────┘
```

---

## Module Responsibilities

| Module | Responsibility | Key packages |
|---|---|---|
| **auth** | JWT issuance, registration, token refresh | — |
| **users** | Profile CRUD, avatar upload | video-core (upload) |
| **stars** | Star profile, tier management, category tagging | analytics-core |
| **supporters** | Fan profile, subscription management | wallet-core |
| **taps** | Coin gifts + fiat tips — idempotent, hash-chained | gifting-core, wallet-core |
| **events** | Live streams, replays, scheduling | video-core, analytics-core |
| **arenas** | LiveKit room lifecycle, participant access | — |
| **ai-creator** | Caption/title/script generation, hashtag suggestions | Anthropic API |

---

## Data Flow: Tap (Gift)

```
Supporter App
  │  POST /taps  { receiverId, type: COIN_GIFT, coinAmount: 50 }
  ▼
TapsController
  │
TapsService
  ├── validate idempotencyKey (Redis SET NX)
  ├── CoinGiftingService.gift()          ← @starria/gifting-core
  │     ├── debit sender wallet          ← WalletDurableBalanceStore (Prisma)
  │     └── credit receiver wallet
  ├── persist Tap record (Prisma)
  ├── NotificationService.send()         ← @starria/notification-core
  │     └── FCM push to receiver
  └── publish analytics event            ← @starria/analytics-core
```

---

## Data Flow: Live Event

```
Star App
  │  POST /events  { type: LIVE_STREAM, arenaId }
  ▼
EventsController → EventsService
  │  ├── create Event record (status: SCHEDULED)
  │  └── index content  ← @starria/search-core
  │
  │  POST /arenas/:id/token
  ▼
ArenasService
  │  └── LiveKit API → room token → Star app
  │
  Star goes live in LiveKit room
  │
  Supporters join Arena
  │  └── WatchSession created  ← @starria/analytics-core
  │
  Taps flow in during broadcast
  │  └── TapsService (see above)
```

---

## Concurrency & Caching Strategy

| Layer | Tool | Usage |
|---|---|---|
| HTTP rate limiting | NestJS ThrottlerModule | 100 req / 60s per IP |
| Session cache | Redis | JWT blocklist, online presence |
| Feed cache | Redis | FYP cursor results, 60s TTL |
| Tap idempotency | Redis SET NX (30s TTL) | Dedup concurrent tap submissions |
| Search index | PostgreSQL `pg_trgm` | Full-text content search |
| Push queues | Redis pub/sub → BullMQ | Async notification delivery |
