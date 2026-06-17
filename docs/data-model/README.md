# STARRIA Data Model

This directory documents the full PostgreSQL data model for the STARRIA platform, including the 12 new models added in migration `20260616000001_add_domain_models`.

## Model Inventory

### Existing Models (before migration)

| Model | Package | Purpose |
|---|---|---|
| User | core | Authentication identity |
| StarProfile | star-core | Creator/star public identity |
| SupporterProfile | support-core | Fan/supporter profile |
| Follow | star-core | Star follow relationships |
| Subscription | support-core | Fan subscriptions to stars |
| WalletAccount | wallet-core | Coin/fiat wallet |
| WalletEntry | wallet-core | Immutable ledger entries |
| PayoutRequest | wallet-core | Settlement requests |
| TapRecord | tap-core | Individual tap events |
| LeaderboardEntry | tap-core | Aggregated leaderboard positions |
| CoinGiftRecord | gifting-core | Coin gift transactions |
| FiatGiftRecord | gifting-core | Fiat gift transactions |
| Event | event-core | Livestream events |
| EventParticipant | event-core | Event viewers/participants |
| Arena | arena-core | Audio/video arena rooms |
| ArenaParticipant | arena-core | Arena participants |

### New Models (migration 20260616000001)

| Model | Domain | Purpose |
|---|---|---|
| SupportRelationship | support-core | Aggregated supporter↔star state |
| SupportMilestone | support-core | Milestone achievements in a relationship |
| GoldStarProfile | star-core | Verified gold-star status grants |
| StarHistory | star-core | Append-only tier/event history |
| RegionalBoost | discovery-core | Polymorphic regional promotion records |
| TapStorm | tap-core | Coordinated tap campaign windows |
| TicketPurchase | event-core | Event ticket purchases |
| TicketAttribution | event-core | Referral/campaign attribution for tickets |
| PosterGeneration | creator-os | AI-generated promotional posters |
| CreatorHouse | creator-os | Creator collective/squad |
| CreatorHouseMember | creator-os | House membership records |
| CreatorSeason | creator-os | Creator season windows (totals, status) |
| ArenaVote | arena-core | Poll/vote within an arena |
| ArenaVoteResponse | arena-core | Individual user responses to votes |

## Enum Inventory

### Existing Enums

`WalletCurrency`, `WalletEntryType`, `PayoutStatus`, `GiftTargetType`, `EventStatus`, `EventType`, `ArenaStatus`, `ParticipantRole`, `VerificationStatus`

### New Enums (migration 20260616000001)

| Enum | Values |
|---|---|
| `SupportRelationshipStatus` | ACTIVE, CHURNED, BLOCKED |
| `SupportMilestoneType` | FIRST_TAP, FIRST_GIFT, STREAK_7D, STREAK_30D, SPEND_100, SPEND_1000 |
| `GoldStarStatus` | ACTIVE, EXPIRED, REVOKED |
| `StarHistoryEventType` | TIER_CHANGE, VERIFICATION_CHANGE, GOLD_STAR_GRANTED, GOLD_STAR_REVOKED |
| `TapStormStatus` | SCHEDULED, ACTIVE, ENDED, CANCELLED |
| `TicketPurchaseStatus` | PENDING, CONFIRMED, REFUNDED, FAILED |
| `TicketAttributionType` | REFERRAL, CAMPAIGN, ORGANIC |
| `PosterGenerationStatus` | PENDING, PROCESSING, COMPLETED, FAILED |
| `CreatorHouseStatus` | ACTIVE, ARCHIVED |
| `CreatorSeasonStatus` | UPCOMING, ACTIVE, ENDED |
| `ArenaVoteStatus` | OPEN, CLOSED |
| `RegionalEntityType` | STAR_PROFILE, EVENT, ARENA, CREATOR_HOUSE |

## Schema Location

- Schema: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)
- Migration: [`apps/api/prisma/migrations/20260616000001_add_domain_models/migration.sql`](../../apps/api/prisma/migrations/20260616000001_add_domain_models/migration.sql)

## Adapter Stubs

All Prisma repository stubs live under `apps/api/src/adapters/prisma/`. See individual files for the read/write interface each repository exposes.

| Repository | File |
|---|---|
| SupportRelationship | `prisma/support-relationship.repository.ts` |
| SupportMilestone | `prisma/support-milestone.repository.ts` |
| GoldStarProfile | `prisma/gold-star-profile.repository.ts` |
| StarHistory | `prisma/star-history.repository.ts` |
| RegionalBoost | `prisma/regional-boost.repository.ts` |
| TapStorm | `prisma/tap-storm.repository.ts` |
| TicketPurchase | `prisma/ticket-purchase.repository.ts` |
| TicketAttribution | `prisma/ticket-attribution.repository.ts` |
| PosterGeneration | `prisma/poster-generation.repository.ts` |
| CreatorHouse + Member | `prisma/creator-house.repository.ts` |
| CreatorSeason | `prisma/creator-season.repository.ts` |
| ArenaVote + Response | `prisma/arena-vote.repository.ts` |

Infrastructure adapters:

| Adapter | File |
|---|---|
| Redis event bus | `redis-event-bus.adapter.ts` |
| Job scheduler | `job-scheduler.adapter.ts` |

## Further Reading

- [ER Diagram — All Models](./er-diagram-overview.md)
- [ER Diagram — New Models Only](./er-diagram-new-models.md)
- [Dependency Graph & Circular Dependency Analysis](./dependency-graph.md)
- [Migration Notes](./migration-notes.md)
