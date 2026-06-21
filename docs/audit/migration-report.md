# STARRIA Database Migration Report
**Audit Date:** 2026-06-18

---

## Migration Inventory

| File                                              | Tables/Types | Sprint Coverage      | Status  |
|---------------------------------------------------|-------------|----------------------|---------|
| 20260615000000_initial_schema                     | 30          | Sprint 1 core        | ✓       |
| 20260616000001_add_domain_models                  | 26          | Sprints 2–4 models   | ✓       |
| 20260616000002_support_economy_fields             | 0           | ALTER TABLE cols only| ✓       |
| 20260616000003_support_streaks_anniversaries      | 1           | SupportStreak        | ✓       |
| 20260617000001_video_discovery                    | 8           | Sprint 2 video       | ✓       |
| 20260617000002_content_index_unique_constraint    | 0           | Constraint only      | ✓       |
| 20260617000003_sprint3_event_enums                | 0           | Enum alterations     | ✓       |
| 20260617000004_sprint8_arenas_battles             | 19          | Sprint 8 battles     | ✓       |
| **migration_lock.toml**                           | —           | Provider = postgresql| ✓       |

**Total: 8 migration files, 84 table/type CREATE statements.**

---

## Critical Gap: Sprints 5–7 Have No Migration SQL

All 49 models in `schema.prisma` are accounted for across the initial migrations
**except** the following Sprint 5–7 models — which exist in the schema Prisma
definition but were **never serialised into a migration SQL file**:

### Missing from migrations

| Model / Concept              | Sprint | In schema.prisma | In migration SQL |
|------------------------------|--------|------------------|------------------|
| CompanionProfile             | 6      | NO               | NO               |
| CompanionSession             | 6      | NO               | NO               |
| MessageThread                | 5      | NO               | NO               |
| ConversationMessage          | 5      | NO               | NO               |
| PresenceStatus               | 5      | NO               | NO               |
| TrustProfile                 | 5      | NO               | NO               |
| PatronProfile                | 5      | NO               | NO               |
| ReplaySession                | 7      | NO               | NO               |
| SessionEngineSession         | 7      | NO               | NO               |

> **Root cause:** Sprints 5–7 modules use in-memory Maps, so no Prisma models
> were ever added to `schema.prisma` for them. The modules work at runtime via 
> in-memory repositories but have **zero persistence** — all data is lost on restart.

**Severity: P1** — data loss on restart is unacceptable for production.

**Resolution required in Sprint 9:**
1. Add Prisma models for companion, messaging, presence, trust, patron, replay, session-engine
2. Create migration `20260618000001_sprint5_7_persistence`
3. Replace all `in-memory-*.repository.ts` with Prisma adapters

---

## Migration Ordering Analysis

Timestamps follow chronological ordering. No gaps or out-of-order files detected.

```
20260615 → 20260616 → 20260617 (×5) → 20260617000004
```

Note: `20260617000004` covers Sprint 8, which was built on 2026-06-17/18. The
timestamp prefix is slightly ahead of the sprint numbering, but this is consistent
with the sprint delivery cadence and does not affect migration execution order.

---

## Migration Completeness: Prisma Schema vs SQL

### Confirmed covered in SQL migrations
All 49 models declared in `schema.prisma` that have a corresponding `model X`
block are either:
- Covered by an existing `CREATE TABLE "X"` in a migration file, OR
- Are Sprint 5–7 models that intentionally have no Prisma schema entry (in-memory)

The 49 Prisma models map to exactly these migration-covered tables:

| Group | Tables | Migration |
|-------|--------|-----------|
| Core auth/users | User, StarProfile, SupporterProfile, Subscription, Tap, Wallet, WalletEntry, Notification, ModerationReport | initial_schema |
| Events/Arena | Event, Arena, WatchSession, FeedEngagement, MediaUpload, ContentIndex, RecommendationFeedback, AiCreatorProfile, AiGeneration | initial_schema + domain_models |
| Support economy | SupportRelationship, SupportStreak, SupportMilestone, GoldStarProfile, StarHistory, RegionalBoost, TapStorm | add_domain_models + streaks |
| Ticketing/Poster | TicketPurchase, TicketAttribution, PosterGeneration | add_domain_models |
| Houses/Seasons | CreatorHouse, CreatorHouseMember, CreatorSeason, ArenaVote, ArenaVoteResponse | add_domain_models |
| Video discovery | Video, VideoWatch, ContentTap, DiscoveryScore, RegionalTapBoost, TrendingScore | video_discovery |
| Sprint 8 battles | ArenaSeason, CreatorElo, Battle, BattleParticipant, BattleTeam, BattleVote, ArenaPrizePool, PrizePoolContribution, HouseBattle, BattleHighlight | sprint8_arenas_battles |

---

## `prisma migrate deploy` Readiness

| Check                           | Status  |
|---------------------------------|---------|
| Migration files exist           | ✓       |
| migration_lock.toml present     | ✓       |
| No duplicate timestamps         | ✓       |
| No timestamp gaps               | ✓       |
| All SQL is additive (no drops)  | ✓       |
| DATABASE_URL in .env            | ✓ (dev) |
| DATABASE_URL in Docker env      | ✓       |

`prisma migrate deploy` will succeed when DATABASE_URL points to a clean or 
pre-existing PostgreSQL 16 instance. The init.sql in `infra/postgres/` seeds
the database extension requirements.
