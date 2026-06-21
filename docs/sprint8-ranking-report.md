# Sprint 8 — Ranking Report

## Overview
STARRIA's competitive ranking system uses an ELO-based engine with division tiers,
seasonal soft-resets, inactivity decay, and per-season leaderboards.

---

## ELO Engine (`packages/ranking-core`)

### Algorithm
Standard Elo with per-division K-factors. Lower K at higher ranks means established
players change rank more slowly — protecting Legend/Diamond from single-game swings.

```
expected_score(A, B) = 1 / (1 + 10^((B-A)/400))

new_elo = current_elo + K × (actual_score - expected_score)
  where actual_score: win=1, draw=0.5, loss=0
```

### K-Factors by Division

| Division  | K-Factor | ELO Threshold |
|-----------|----------|---------------|
| BRONZE    | 32       | 0             |
| SILVER    | 28       | 1,100         |
| GOLD      | 24       | 1,300         |
| PLATINUM  | 20       | 1,600         |
| DIAMOND   | 16       | 2,000         |
| LEGEND    | 12       | 2,400         |

Starting ELO: **1,200** (mid-Silver range).

---

## Division Placement

Divisions are recalculated automatically after each battle settlement.

```
divisionForElo(elo):
  elo >= 2400 → LEGEND
  elo >= 2000 → DIAMOND
  elo >= 1600 → PLATINUM
  elo >= 1300 → GOLD
  elo >= 1100 → SILVER
  else        → BRONZE
```

---

## Seasonal Resets

At the end of each `ArenaSeason`, ELO is soft-reset (not wiped):

```
reset_elo = current_elo + (1200 - current_elo) × 0.25
```

A Legend at 2,800 resets to ~2,600. A Bronze at 900 resets to ~975.
This preserves relative standing while compressing the range to promote
competitive play in the new season.

---

## Inactivity Decay

Players who skip seasons lose ELO each missed season:

```
decayed_elo = current_elo × (1 - decay_rate)^inactive_seasons
  decay_rate: LEGEND=3%, all others=5%
  floor: BRONZE + 100 (never drops below 200)
```

---

## Leaderboard

- Ranked by ELO descending, wins as tiebreaker
- Filterable by season and division
- Returns rank number, ELO, division, W/L record
- Endpoint: `GET /arenas/leaderboard/global?seasonId=&division=&limit=`

---

## `CreatorElo` Model

Each creator has one ELO record per season (plus an all-time record where
`arenaSeasonId IS NULL`). Fields:

| Field           | Type    | Notes                              |
|-----------------|---------|------------------------------------|
| elo             | Int     | Current ELO (default 1200)         |
| division        | Enum    | Recalculated on every settlement   |
| wins            | Int     | Cumulative wins this season        |
| losses          | Int     | Cumulative losses this season      |
| draws           | Int     | Cumulative draws this season       |
| peakElo         | Int     | Highest ELO ever reached           |
| decayAppliedAt  | DateTime| Last decay application timestamp   |

---

## Integration Points

- `BattlesService._applyElo()` — called automatically during `settleBattle()`
- `BattlesService.resetSeason()` — applies `seasonalReset()` to all records
- `GET /arenas/leaderboard/global` — public leaderboard with division filter
