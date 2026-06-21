# Sprint 8 — Database Migration Report

## Migration File
`apps/api/prisma/migrations/20260617000004_sprint8_arenas_battles/migration.sql`

---

## Changes Summary

### New ENUMs (8)

| Enum               | Values                                                   |
|--------------------|----------------------------------------------------------|
| BattleType         | RAP_BATTLE, SING_OFF, COMEDY_CLASH, YAP_BATTLE, AI_FILM_BATTLE, CREATOR_DUEL, TEAM_BATTLE |
| BattleStatus       | DRAFT, REGISTRATION, ACTIVE, VOTING, SETTLED, ARCHIVED   |
| VotingMethod       | AUDIENCE, SUPPORTER_WEIGHTED, JUDGE, HYBRID              |
| ArenaDivision      | BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, LEGEND          |
| ArenaSeasonStatus  | UPCOMING, ACTIVE, ENDED                                  |
| PrizePoolSource    | TICKETS, SPONSORSHIP, CREATOR_DEPOSIT, FAN_CONTRIBUTION  |
| PrizeDistribution  | WINNER_TAKES_ALL, TOP_3_PAYOUT, SPLIT_PAYOUT             |
| BattleParticipantRole | CHALLENGER, DEFENDER, TEAM_MEMBER, JUDGE              |
| HouseBattleStatus  | PENDING, ACTIVE, COMPLETED, CANCELLED                    |

### New Tables (10)

| Table                  | Rows (new) | FK dependencies                          |
|------------------------|------------|------------------------------------------|
| ArenaSeason            | 0          | —                                        |
| CreatorElo             | 0          | StarProfile, ArenaSeason                 |
| Battle                 | 0          | Arena (nullable), ArenaSeason (nullable) |
| BattleParticipant      | 0          | Battle, StarProfile, BattleTeam          |
| BattleTeam             | 0          | Battle                                   |
| BattleVote             | 0          | Battle, User, BattleParticipant          |
| ArenaPrizePool         | 0          | Battle (1:1 optional)                    |
| PrizePoolContribution  | 0          | ArenaPrizePool, User                     |
| HouseBattle            | 0          | CreatorHouse ×2, Battle                  |
| BattleHighlight        | 0          | Battle                                   |

### Modified Tables

| Table         | Change                                              |
|---------------|-----------------------------------------------------|
| Arena         | `battles Battle[]` relation added                   |
| StarProfile   | `battleParticipations`, `creatorEloRecords` added   |
| User          | `battleVotesCast`, `prizeContributions` added       |
| CreatorHouse  | `challengerBattles`, `defenderBattles` added        |

---

## Safety Analysis

**No destructive changes.** Every change is additive:
- No existing columns dropped or renamed
- No existing indexes removed
- All new FK relations are nullable or on new tables only
- New enums do not alter existing enum types

**Zero-downtime compatible:** The migration can run against a live database
without requiring application downtime (all ADD TABLE / ADD COLUMN operations).

---

## Index Strategy

| Index                              | Purpose                              |
|------------------------------------|--------------------------------------|
| Battle(type, status)               | Type-filtered listing queries        |
| Battle(arenaSeasonId)              | Season leaderboard joins             |
| BattleVote(battleId, voterId) UNIQUE | Duplicate vote prevention          |
| BattleVote(fraudFlag)              | Fraud audit queries                  |
| CreatorElo(division, elo DESC)     | Leaderboard ordering                 |
| CreatorElo(starProfileId, seasonId) UNIQUE | One record per creator per season |
| ArenaPrizePool(battleId) UNIQUE    | One pool per battle                  |
| BattleHighlight(pushedToDiscovery) | Discovery push queue                 |

---

## Rollback Plan

All tables can be dropped in reverse dependency order if rollback is needed:

```sql
DROP TABLE "BattleHighlight", "HouseBattle", "PrizePoolContribution",
           "ArenaPrizePool", "BattleVote", "BattleTeam",
           "BattleParticipant", "Battle", "CreatorElo", "ArenaSeason";

DROP TYPE "HouseBattleStatus", "BattleParticipantRole", "PrizeDistribution",
          "PrizePoolSource", "ArenaSeasonStatus", "ArenaDivision",
          "VotingMethod", "BattleStatus", "BattleType";
```

No data loss to existing tables — all pre-Sprint 8 data is untouched.
