# STARRIA Sprint 10 — Persistence Migration Report

**Date:** 2026-06-18
**Outcome:** All remaining in-memory domain repositories migrated to Prisma-backed persistence. Domain state now survives process restart.

## Summary

| Metric | Before | After |
|---|---|---|
| In-memory **domain** repositories | 14 | 0 |
| Prisma migrations | 9 | 10 |
| Prisma models | 55 | 98 (43 added) |
| Unit tests | 71 | 92 |
| API build | ✅ | ✅ |

A single additive migration — `20260619000000_domain_persistence` (43 `CREATE TABLE`, 0 `ALTER`/`DROP` on existing tables) — introduces all new tables. It applies cleanly on top of the 9 existing migrations **and** from scratch on a fresh database (10/10 migrations, 98 tables).

## Per-domain work

Each domain followed the messaging reference pattern: a `Prisma<Domain>Repository` implementing the existing `*StorePort` with row→domain mappers, wired into the Nest module/service in place of the in-memory adapter. Business logic in the `@starria/*-core` packages was untouched; all port contracts and public service APIs are unchanged.

### Phase 3 — Campaign
- **Added:** `apps/api/src/modules/campaigns/prisma-campaign.repository.ts` (`PrismaCampaignRepository` → `CampaignStorePort`).
- **Tables:** `VisibilityCampaign`, `CampaignLedgerEntry`, `CampaignAnalytics`.
- **Rewired:** `campaigns.module.ts`, `campaigns.service.ts`.
- **Retained:** `InMemoryCampaignLedger` (coin payment ledger — out of scope, see audit).

### Phase 4 — Companion
- **Added:** `prisma-companion.repository.ts` (`PrismaCompanionRepository` → `CompanionStorePort`; `PrismaLonelinessRepository` → `LonelinessStorePort`), `prisma-age-gate.repository.ts` (`PrismaAgeGateRepository` → `AgeGateStorePort`), `prisma-session.repository.ts` (`PrismaSessionRepository` → `SessionStorePort`).
- **Tables:** `CompanionProfile`, `CompanionRate`, `CompanionAvailabilitySlot`, `CompanionReview`, `CompanionMedia`, `CompanionBlock`, `CompanionReport`, `LonelinessProfile`, `AgeGateProfile`, `ConsentRecord`, `SessionBooking`, `SessionEscrow`, `SessionReservation`, `SessionExtension`, `CompanionSessionParticipant`, `SessionPayout`.
- **Rewired:** `companion.module.ts`, `companion.service.ts`. Deleted `in-memory-companion.repository.ts`, `in-memory-age-gate.repository.ts`.
- **Retained:** `InMemorySessionLedger` (coin escrow ledger).

### Phase 5 — Patron + Trust
- **Added:** `patrons/prisma-patron.repository.ts` (`PrismaPatronRepository` → `PatronStorePort`), `trust/prisma-trust.repository.ts` (`PrismaTrustRepository` → `TrustStorePort`).
- **Tables:** `PatronProfile`, `PatronHistory`, `CreatorRelationship`, `PatronAchievement`, `PatronMilestone`, `TrustProfile`, `TrustFlag`, `TrustRestrictionRecord`.
- **Rewired:** both modules + services. Deleted both in-memory repos.

### Phase 6 — Session Engine
- **Added:** `prisma-session-engine.repository.ts` (`PrismaSessionEngineRepository` → `SessionEngineStorePort`).
- **Tables:** `SessionRoom` (room idempotency key stored on `SessionRoom.idempotencyKey`), `SessionRoomParticipant`, `SessionRecording`, `SessionModeration`.
- **Rewired:** module + service.
- **Retained:** `InMemorySessionBilling` (billing ledger), `StubLiveKitProvider` (LiveKit stub).

### Phase 7 — Replay
- **Added:** `prisma-replay.repository.ts` (`PrismaReplayRepository` → `ReplayStorePort`).
- **Tables:** `Replay` (view counter via `viewCount` + atomic `increment`).
- **Rewired:** module + service.
- **Retained:** `StubMediaProcessor`, `InMemoryDiscoveryPublisher`, `InMemoryReplayAccess` (transcode / discovery push / entitlement gate).

### Phase 8 — Prestige (star-core)
- **Added:** `prisma-prestige.repository.ts` (`PrismaWhiteStarRepository` → `WhiteStarStorePort`; `PrismaGoldStarRepository` → `GoldStarStorePort`; `PrismaLeaderboardRepository` → `LeaderboardPort`, now reading the DB instead of an in-memory map).
- **Tables:** `WhiteStarProfile`, `WhiteStarHistory`, `StarDecay`, `WhiteStarSeasonScore`, `GoldStarPrestigeProfile`, `GoldStarAchievement`, `CreatorReputation`.
- **Rewired:** module + service. Deleted in-memory repo.

### Phase 9 — Creator OS
- **Added:** `prisma-creator-os.repository.ts` (`PrismaCalendarStore` → `CalendarStorePort`; `PrismaCommerceStore` → `CommerceStorePort`; `PrismaClipStore` → `ClipStorePort`).
- **Tables:** `CreatorCalendarEntry`, `CreatorCommerceItem`, `CreatorCommercePurchase`, `CreatorClip`.
- **Rewired:** module + service.
- **Retained:** `InMemoryCreatorLedger` (coin ledger), `StubPosterGenerator`, `StubClipGenerator`, `StubAnalyticsSource` (generators / computed analytics).

## Schema conventions

- Standalone models with no foreign keys to existing tables (mirrors the messaging models) → the migration is fully additive with no breaking changes.
- Status/type union fields stored as `String` (consistent with existing `SupporterProfile.tier`, `Subscription.status`).
- Nested objects (`factors`, `signals`, `splits`, `billing`, `permissions`, `metadata`, `flags`, `topCountries`) stored as `Json`; lists as `String[]`.
- Service-controlled timestamps written verbatim (`new Date(iso)`); repository-generated timestamps use `@default(now())` / `@updatedAt`.

## Naming-collision resolutions

`GoldStarProfile` and `StarProfile` already exist in the schema, so prestige models use distinct names: `GoldStarPrestigeProfile`, `GoldStarAchievement` (was `LegacyAchievement`), `WhiteStarSeasonScore` (was `SeasonScore`); session-engine participants are `SessionRoomParticipant` (vs companion `CompanionSessionParticipant`). Domain types and `*Port` contracts are unchanged — these are column-mapping names only.

## Explicitly out of scope (documented in the audit)

Coin/billing ledger adapters (`CampaignCoinLedgerPort`, `SessionCoinLedgerPort`, `CreatorCoinLedgerPort`, `SessionBillingPort`) and external-service stubs (poster/clip generators, media processor, LiveKit provider, analytics source, discovery publisher, replay access gate) are payment adapters / external-service stubs, not domain repositories. They are excluded from the 16-table objective and retained unchanged to preserve seed-based test contracts and avoid touching business logic. Creator analytics remain computed on demand (no store); replay views persist as a counter on `Replay`.

## Verification

- `prisma format` ✅  `prisma validate` ✅
- Migration `20260619000000_domain_persistence` generated via `prisma migrate diff` (additive slice extracted), applies cleanly on the baselined DB **and** end-to-end on a fresh DB (10/10).
- `npm run build` (`prisma generate && nest build`) ✅ exit 0.
- `npx tsc --noEmit` ✅ exit 0.
- `npm test` ✅ 92/92.
</content>
