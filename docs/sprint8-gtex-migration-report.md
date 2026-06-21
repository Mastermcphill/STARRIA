# Sprint 8 — GTEX Migration Report

## Summary
Sprint 8 extracts and formalises two GTEX domain libraries that were previously
either inline or missing: **ranking-core** and **voting-core**. Both are now
standalone `@starria/*` workspace packages that can be consumed by the API and
future microservices without pulling in NestJS or Prisma.

---

## Packages Extracted / Created

### `@starria/ranking-core`

| Attribute     | Value                                       |
|---------------|---------------------------------------------|
| Location      | `packages/ranking-core/`                   |
| Version       | 0.1.0                                       |
| Dependencies  | None (pure TypeScript)                      |
| Exports       | ELO computation, division placement, decay, seasonal reset, leaderboard ranking |

**GTEX contract fulfilled:**
- `computeEloUpdate(input)` — canonical ELO update with per-division K-factors
- `divisionForElo(elo)` — deterministic division from ELO score
- `applyDecay(input)` — inactivity penalty (5% / 3% for Legend)
- `seasonalReset(elo)` — 25% regression toward 1200
- `rankLeaderboard(entries[])` — pure sort + rank assignment

No Prisma, no NestJS. Safe to use in edge functions, workers, or test harnesses.

---

### `@starria/voting-core`

| Attribute     | Value                                       |
|---------------|---------------------------------------------|
| Location      | `packages/voting-core/`                    |
| Version       | 0.1.0                                       |
| Dependencies  | `@starria/domain-events`                    |
| Exports       | VotingService, types, ports                 |

**GTEX contract fulfilled:**
- `VotingService.castVote()` — weight computation + all fraud checks
- `VotingService.determineWinner()` — weighted tally → winner ID
- Port interfaces: `VoteStorePort`, `TrustScorePort`, `PatronMultiplierPort`, `VoteVelocityPort`, `FraudDetectorPort`
- Types: `WeightedVote`, `VoteResult`, `VoteTally`, `FraudCheckResult`

---

### `@starria/arena-core` (extended)

| New exports               | Description                               |
|---------------------------|-------------------------------------------|
| `BattleService`           | Full battle lifecycle orchestration       |
| `battle-types.ts`         | All Sprint 8 type definitions             |
| `battle-ports.ts`         | Port interfaces for storage adapters      |
| `battle-events.ts`        | Domain event builders                     |

---

## Domain Events Added (`@starria/domain-events`)

| Event constant              | Trigger                              |
|-----------------------------|--------------------------------------|
| `BATTLE_CREATED`            | New battle record created            |
| `BATTLE_STARTED`            | Status → ACTIVE                      |
| `BATTLE_VOTING_OPENED`      | Status → VOTING                      |
| `BATTLE_ENDED`              | Status → SETTLED (pre-tally)         |
| `BATTLE_VOTE_CAST`          | Vote accepted into store             |
| `BATTLE_SETTLED`            | Prize pool settled                   |
| `BATTLE_ELO_UPDATED`        | ELO record written for a creator     |
| `BATTLE_HIGHLIGHT_PUSHED`   | Highlight clip pushed to discovery   |
| `ARENA_SEASON_STARTED`      | Season status → ACTIVE               |
| `ARENA_SEASON_ENDED`        | Season reset complete                |
| `HOUSE_BATTLE_CREATED`      | House vs house battle linked         |
| `PRIZE_POOL_SETTLED`        | Prize pool `settled = true`          |

---

## Consumer Map

```
@starria/ranking-core    ← BattlesService._applyElo()
                         ← BattlesService.resetSeason()

@starria/voting-core     ← BattlesService.castVote()  (currently direct, 
                            VotingService wired in full integration)

@starria/arena-core      ← ArenasModule (BattlesService, BattlesController)

@starria/domain-events   ← All packages (battle events exported from index)
```

---

## No Breaking Changes to Existing GTEX Packages

| Package                  | Status         |
|--------------------------|----------------|
| session-engine-core      | Untouched      |
| replay-core              | Untouched      |
| creator-os-core          | Untouched      |
| star-core                | Untouched      |
| domain-events            | Additive only  |
| arena-core               | Additive only  |
