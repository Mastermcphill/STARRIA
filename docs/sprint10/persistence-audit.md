# STARRIA Sprint 10 — Persistence Audit (Phase 1)

**Date:** 2026-06-18
**Goal:** Catalogue every in-memory repository still in production code and plan its migration to Prisma-backed persistence, following the messaging reference pattern (`apps/api/src/modules/messaging/prisma-messaging.repository.ts`, migration `20260618000000_messaging_persistence`).

## Method

- Scanned `apps/api/src/modules/**` for `in-memory-*.repository.ts` files.
- Cross-referenced each adapter against the `*StorePort` / `*LedgerPort` interface it implements in the corresponding `packages/*-core` package.
- Classified each adapter as **domain store** (persistent state that must survive restart → migrate to Prisma) or **service adapter** (payment ledger / external-service stub / generator → *out of scope* for this sprint, documented below).

## Reference pattern (already migrated)

| File | Implements | Tables |
|---|---|---|
| `messaging/prisma-messaging.repository.ts` | `MessageStorePort`, `DMPermissionStorePort` | `Conversation`, `DirectMessage`, `MessageRequest`, `DmPermission`, `ConversationUnread` |

Pattern: standalone Prisma models (no FK to `User`; string id columns), row→domain mapper functions, `@Injectable()` repository classes constructed with `PrismaService`, wired into the Nest module which constructs the core service with `new XService(repo, ..., eventBus)`.

---

## In-memory domain stores to migrate

| # | File path | Repository class | Port implemented | Entities stored | Prisma tables needed |
|---|---|---|---|---|---|
| 1 | `modules/campaigns/in-memory-campaign.repository.ts` | `InMemoryCampaignRepository` | `CampaignStorePort` | VisibilityCampaign, CampaignLedgerEntry, CampaignAnalytics, idempotency map | `VisibilityCampaign`, `CampaignLedgerEntry`, `CampaignAnalytics` |
| 2 | `modules/companion/in-memory-companion.repository.ts` | `InMemoryCompanionRepository` | `CompanionStorePort` | CompanionProfile, CompanionRate, CompanionAvailabilitySlot, CompanionReview, CompanionMedia, CompanionBlock, CompanionReport | `CompanionProfile`, `CompanionRate`, `CompanionAvailabilitySlot`, `CompanionReview`, `CompanionMedia`, `CompanionBlock`, `CompanionReport` |
| 3 | `modules/companion/in-memory-companion.repository.ts` | `InMemoryLonelinessRepository` | `LonelinessStorePort` | LonelinessProfile (private signals) | `LonelinessProfile` |
| 4 | `modules/companion/in-memory-age-gate.repository.ts` | `InMemoryAgeGateRepository` | `AgeGateStorePort` | AgeGateProfile, ConsentRecord | `AgeGateProfile`, `ConsentRecord` |
| 5 | `modules/companion/in-memory-session.repository.ts` | `InMemorySessionRepository` | `SessionStorePort` | SessionBooking, SessionEscrow, SessionReservation, SessionExtension, SessionParticipant, SessionPayout | `SessionBooking`, `SessionEscrow`, `SessionReservation`, `SessionExtension`, `CompanionSessionParticipant`, `SessionPayout` |
| 6 | `modules/patrons/in-memory-patron.repository.ts` | `InMemoryPatronRepository` | `PatronStorePort` | PatronProfile, PatronHistory, CreatorRelationship, PatronAchievement, PatronMilestone | `PatronProfile`, `PatronHistory`, `CreatorRelationship`, `PatronAchievement`, `PatronMilestone` |
| 7 | `modules/trust/in-memory-trust.repository.ts` | `InMemoryTrustRepository` | `TrustStorePort` | TrustProfile, TrustFlag, TrustRestrictionRecord | `TrustProfile`, `TrustFlag`, `TrustRestrictionRecord` |
| 8 | `modules/session-engine/in-memory-session-engine.repository.ts` | `InMemorySessionEngineRepository` | `SessionEngineStorePort` | SessionRoom, SessionParticipant, SessionRecording, SessionModeration, room idempotency keys | `SessionRoom`, `SessionRoomParticipant`, `SessionRecording`, `SessionModeration` |
| 9 | `modules/replay/in-memory-replay.repository.ts` | `InMemoryReplayRepository` | `ReplayStorePort` | Replay (incl. view counter, discovery flag) | `Replay` |
| 10 | `modules/prestige/in-memory-prestige.repository.ts` | `InMemoryWhiteStarRepository` | `WhiteStarStorePort` | WhiteStarProfile, WhiteStarHistory, StarDecay, SeasonScore | `WhiteStarProfile`, `WhiteStarHistory`, `StarDecay`, `WhiteStarSeasonScore` |
| 11 | `modules/prestige/in-memory-prestige.repository.ts` | `InMemoryGoldStarRepository` | `GoldStarStorePort` | GoldStarProfile (prestige), LegacyAchievement, CreatorReputation | `GoldStarPrestigeProfile`, `GoldStarAchievement`, `CreatorReputation` |
| 12 | `modules/creator-os/in-memory-creator-os.repository.ts` | `InMemoryCalendarStore` | `CalendarStorePort` | CalendarEntry | `CreatorCalendarEntry` |
| 13 | `modules/creator-os/in-memory-creator-os.repository.ts` | `InMemoryCommerceStore` | `CommerceStorePort` | CommerceItem, purchase idempotency | `CreatorCommerceItem`, `CreatorCommercePurchase` |
| 14 | `modules/creator-os/in-memory-creator-os.repository.ts` | `InMemoryClipStore` | `ClipStorePort` | Clip | `CreatorClip` |

### Naming collisions resolved

The existing schema already declares `GoldStarProfile` (admin-granted badge) and `StarProfile` (creator profile). The Sprint 4 *prestige* models are distinct concepts and are therefore named:

- prestige `GoldStarProfile` → **`GoldStarPrestigeProfile`**
- prestige `LegacyAchievement` → **`GoldStarAchievement`**
- prestige `SeasonScore` → **`WhiteStarSeasonScore`**
- session-engine `SessionParticipant` → **`SessionRoomParticipant`** (distinct from companion-session `CompanionSessionParticipant`)

These are repository-internal column-mapping names only; the domain `*Port` contracts and TypeScript types are unchanged.

---

## Service adapters intentionally OUT OF SCOPE (not domain repositories)

These adapters are **not** persistence repositories — they are payment-ledger adapters and external-service stubs whose contracts deliberately abstract a downstream system. They are excluded from the explicit 16-table objective list, and converting them would change business logic and break the existing seed-based test contracts. They are left untouched per the rule *"Keep business logic untouched whenever possible."*

| File | Class | Why out of scope |
|---|---|---|
| `campaigns/in-memory-campaign.repository.ts` | `InMemoryCampaignLedger` (`CampaignCoinLedgerPort`) | Coin payment ledger; belongs to a future wallet-integration sprint. Provides `seed()` used by tests. |
| `companion/in-memory-session.repository.ts` | `InMemorySessionLedger` (`SessionCoinLedgerPort`) | Coin escrow ledger; wallet-integration concern. |
| `creator-os/in-memory-creator-os.repository.ts` | `InMemoryCreatorLedger` (`CreatorCoinLedgerPort`) | Coin ledger; wallet-integration concern. |
| `creator-os/in-memory-creator-os.repository.ts` | `StubPosterGenerator`, `StubClipGenerator`, `StubAnalyticsSource` | External generator/analytics stubs (image-gen, video-cut, analytics aggregation). Compute on demand; no persisted state. |
| `session-engine/in-memory-session-engine.repository.ts` | `InMemorySessionBilling` (`SessionBillingPort`), `StubLiveKitProvider` (`LiveKitProviderPort`) | Billing ledger + LiveKit provider stub. |
| `replay/in-memory-replay.repository.ts` | `StubMediaProcessor`, `InMemoryDiscoveryPublisher`, `InMemoryReplayAccess` | Transcode stub, discovery push, entitlement gate. |

**Analytics / ReplayViews note:** the objective table list mentions `CreatorAnalytics` and `ReplayViews`. Creator analytics are *computed* on demand by `StubAnalyticsSource` (no in-memory store exists), and replay views are an integer counter on `Replay` (`incrementViews`) with no per-view records. Creating empty tables nothing writes to would violate *"Do NOT create fake implementations."* Replay view counts persist via `Replay.viewCount`; analytics persistence is deferred to a future analytics-aggregation sprint.

---

## Estimated Prisma tables (final list — 43 models, all additive)

Campaign (3): `VisibilityCampaign`, `CampaignLedgerEntry`, `CampaignAnalytics`
Companion (7): `CompanionProfile`, `CompanionRate`, `CompanionAvailabilitySlot`, `CompanionReview`, `CompanionMedia`, `CompanionBlock`, `CompanionReport`
Companion adjunct (3): `LonelinessProfile`, `AgeGateProfile`, `ConsentRecord`
Companion sessions (6): `SessionBooking`, `SessionEscrow`, `SessionReservation`, `SessionExtension`, `CompanionSessionParticipant`, `SessionPayout`
Patron (5): `PatronProfile`, `PatronHistory`, `CreatorRelationship`, `PatronAchievement`, `PatronMilestone`
Trust (3): `TrustProfile`, `TrustFlag`, `TrustRestrictionRecord`
Session engine (4): `SessionRoom`, `SessionRoomParticipant`, `SessionRecording`, `SessionModeration`
Replay (1): `Replay`
Prestige (7): `WhiteStarProfile`, `WhiteStarHistory`, `StarDecay`, `WhiteStarSeasonScore`, `GoldStarPrestigeProfile`, `GoldStarAchievement`, `CreatorReputation`
Creator OS (4): `CreatorCalendarEntry`, `CreatorCommerceItem`, `CreatorCommercePurchase`, `CreatorClip`

**Convention:** status/type union fields stored as `String` (consistent with existing `SupporterProfile.tier`, `Subscription.status`); nested objects (`factors`, `signals`, `splits`, `billing`, `permissions`, `metadata`, `topCountries`) as `Json`; lists as `String[]`. No foreign keys to existing tables (mirrors the messaging models) → fully additive, no breaking changes.

---

## Migration order

All 43 models ship in a single additive migration **`20260619000000_domain_persistence`** (no inter-table FKs across domains, so ordering within the file is irrelevant; child→parent FKs exist only within Companion/Patron/Session-engine clusters and are emitted after their parent `CREATE TABLE`).

Rewiring order (one phase per domain, build + tests after each):

1. Campaign (Phase 3)
2. Companion: profiles, loneliness, age-gate, sessions, bookings (Phase 4)
3. Patron + Trust (Phase 5)
4. Session Engine (Phase 6)
5. Replay (Phase 7)
6. Prestige / star-core (Phase 8)
7. Creator OS (Phase 9)

## Verification environment

- Ephemeral Postgres 16 container `starria-mig-verify` on `127.0.0.1:5544` (host port 5432 is occupied by an unrelated process).
- All 9 pre-existing migrations apply cleanly to it (`prisma migrate deploy`).
- Baseline: `npm test` → **71/71 unit tests pass**.
</content>
</invoke>
