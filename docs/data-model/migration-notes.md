# Migration Notes

## Migration: `20260616000001_add_domain_models`

**File:** `apps/api/prisma/migrations/20260616000001_add_domain_models/migration.sql`

### What it creates

- 12 new PostgreSQL enum types
- 14 new tables (12 primary models + `creator_house_members` + `arena_vote_responses`)
- All associated indexes

### Prerequisites

- PostgreSQL 14+ (uses `gen_random_uuid()`, `TIMESTAMPTZ`, `JSONB`)
- `pgcrypto` extension must be enabled (for `gen_random_uuid()`). If not already present, run once: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- The following tables must already exist: `users`, `star_profiles`, `supporter_profiles`, `arenas`, `events`
- Previous migration `20260616000000_init` (or equivalent) must have run successfully

### Running the migration

```bash
# From the repo root
cd apps/api
npx prisma migrate deploy
```

For local development, you can also use:

```bash
npx prisma migrate dev --name add_domain_models
```

> **Note:** `migrate dev` re-generates the migration file from the current schema state. Use `migrate deploy` in CI/CD and production to apply the pre-written SQL exactly.

### Rollback

There is no automatic rollback. To revert in development:

```sql
-- Drop tables in reverse dependency order (children before parents)
DROP TABLE IF EXISTS arena_vote_responses;
DROP TABLE IF EXISTS arena_votes;
DROP TABLE IF EXISTS creator_house_members;
DROP TABLE IF EXISTS creator_seasons;
DROP TABLE IF EXISTS creator_houses;
DROP TABLE IF EXISTS poster_generations;
DROP TABLE IF EXISTS ticket_attributions;
DROP TABLE IF EXISTS ticket_purchases;
DROP TABLE IF EXISTS tap_storms;
DROP TABLE IF EXISTS regional_boosts;
DROP TABLE IF EXISTS star_histories;
DROP TABLE IF EXISTS gold_star_profiles;
DROP TABLE IF EXISTS support_milestones;
DROP TABLE IF EXISTS support_relationships;

-- Drop enum types
DROP TYPE IF EXISTS "SupportRelationshipStatus";
DROP TYPE IF EXISTS "SupportMilestoneType";
DROP TYPE IF EXISTS "GoldStarStatus";
DROP TYPE IF EXISTS "StarHistoryEventType";
DROP TYPE IF EXISTS "TapStormStatus";
DROP TYPE IF EXISTS "TicketPurchaseStatus";
DROP TYPE IF EXISTS "TicketAttributionType";
DROP TYPE IF EXISTS "PosterGenerationStatus";
DROP TYPE IF EXISTS "CreatorHouseStatus";
DROP TYPE IF EXISTS "CreatorSeasonStatus";
DROP TYPE IF EXISTS "ArenaVoteStatus";
DROP TYPE IF EXISTS "RegionalEntityType";
```

### Zero-downtime considerations

All new tables and columns are additive — no existing data is modified. The migration is safe to run against a live database with the following notes:

- Table creation acquires an `ACCESS EXCLUSIVE` lock for the duration of the statement, but since these are new tables with no existing rows, the lock window is sub-millisecond.
- No existing tables are altered, so no lock contention with running queries.
- Enum type creation also acquires brief system catalog locks but does not block DML on existing tables.

### Idempotency

The migration is **not** idempotent as written (uses `CREATE TABLE`, not `CREATE TABLE IF NOT EXISTS`). Do not run it twice. Prisma's migration engine tracks applied migrations in `_prisma_migrations` and will not re-apply a migration that has already been recorded.

### Indexes created

| Table | Index | Columns |
|---|---|---|
| `support_relationships` | unique | `(supporterProfileId, starProfileId)` |
| `gold_star_profiles` | unique | `starProfileId` |
| `regional_boosts` | btree | `(region, active)` |
| `regional_boosts` | btree | `(entityType, entityId)` |
| `tap_storms` | btree | `(starProfileId, status)` |
| `ticket_purchases` | unique | `idempotencyKey` |
| `ticket_purchases` | btree | `(eventId, status)` |
| `ticket_attributions` | unique | `ticketPurchaseId` |
| `ticket_attributions` | btree | `campaignId` |
| `poster_generations` | btree | `(starProfileId, createdAt DESC)` |
| `creator_houses` | unique | `slug` |
| `creator_house_members` | unique | `(creatorHouseId, starProfileId)` |
| `creator_seasons` | unique | `(starProfileId, number)` |
| `arena_votes` | btree | `(arenaId, status)` |
| `arena_vote_responses` | unique | `(arenaVoteId, userId)` |
