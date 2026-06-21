# Sprint 8 — Arena Report

## Overview
Sprint 8 transforms STARRIA into a competitive entertainment platform by introducing
Battles, Voting, Prize Pools, ELO Rankings, Creator Houses, and Season management.

---

## Arena Types Supported

| Type            | Description                                      |
|-----------------|--------------------------------------------------|
| RAP_BATTLE      | Head-to-head lyrical competition                 |
| SING_OFF        | Vocal talent duel                                |
| COMEDY_CLASH    | Comedy performance battle                        |
| YAP_BATTLE      | Long-form verbal debate                          |
| AI_FILM_BATTLE  | AI-generated short film competition              |
| CREATOR_DUEL    | 1v1 content creator showdown                    |
| TEAM_BATTLE     | Multi-creator team vs team (up to 6 per side)   |

---

## Battle Lifecycle

```
DRAFT → REGISTRATION → ACTIVE → VOTING → SETTLED → ARCHIVED
```

- **DRAFT**: Battle created, not yet open for registration
- **REGISTRATION**: Open for participants to join
- **ACTIVE**: Live battle in progress (LiveKit session)
- **VOTING**: Audience/judges vote for winner
- **SETTLED**: Votes tallied, ELO awarded, prize distributed
- **ARCHIVED**: Historical record

---

## Voting System

### Methods
- **AUDIENCE**: All registered users can vote
- **SUPPORTER_WEIGHTED**: Patron and supporter votes carry extra weight
- **JUDGE**: Only designated judges vote (3× base weight)
- **HYBRID**: Mix of audience + judges

### Weight Formula
```
final_weight = base_weight × trust_score × patron_multiplier
```

### Anti-Fraud Protections
- **No self-voting**: Participant cannot vote for themselves (HTTP 400)
- **Duplicate prevention**: One vote per user per battle (UNIQUE constraint)
- **Trust weighting**: Low-trust users get reduced vote weight
- **Velocity abuse**: >20 votes/minute triggers bot flag
- **Fraud flag**: Suspicious votes are recorded but marked `fraudFlag=true` and excluded from final tally

---

## Prize Pools

### Sources
- FAN_CONTRIBUTION — direct fan contributions
- CREATOR_DEPOSIT — creators stake coins
- SPONSORSHIP — brand/sponsor injection
- TICKETS — portion of ticket revenue

### Distribution Modes
- **WINNER_TAKES_ALL**: 100% to winner
- **TOP_3_PAYOUT**: 50% / 30% / 20%
- **SPLIT_PAYOUT**: Configurable split

### Escrow
All prize pools are escrowed until `POST /arenas/:id/settle` is called. Settlement is atomic: votes tally → winner determined → ELO awarded → prize distributed.

---

## New Models (Prisma)

| Model                   | Purpose                                        |
|-------------------------|------------------------------------------------|
| ArenaSeason             | Season metadata + lifecycle                    |
| CreatorElo              | Per-creator ELO per season                     |
| Battle                  | Core battle record                             |
| BattleParticipant       | Creator registered in a battle                 |
| BattleTeam              | Team grouping for TEAM_BATTLE                  |
| BattleVote              | Weighted vote cast by a user                   |
| ArenaPrizePool          | Escrowed prize pool                            |
| PrizePoolContribution   | Individual contribution to prize pool          |
| HouseBattle             | House vs House battle linkage                  |
| BattleHighlight         | Auto-generated highlight clips                 |

---

## API Endpoints (Sprint 8)

| Method | Path                                    | Description                          |
|--------|-----------------------------------------|--------------------------------------|
| POST   | /arenas                                 | Create battle                        |
| GET    | /arenas                                 | List battles (filter by status/type) |
| GET    | /arenas/:id                             | Get battle detail                    |
| POST   | /arenas/:id/join                        | Join battle (registration)           |
| POST   | /arenas/:id/start                       | Start battle                         |
| POST   | /arenas/:id/end                         | End battle → open voting             |
| POST   | /arenas/:id/settle                      | Settle: tally, ELO, prizes           |
| POST   | /arenas/:id/vote                        | Cast weighted vote                   |
| POST   | /arenas/:id/prize-pool/contribute       | Contribute to prize pool             |
| GET    | /arenas/leaderboard/global              | ELO leaderboard                      |
| POST   | /arenas/seasons                         | Create season                        |
| GET    | /arenas/seasons/active                  | Get active season                    |
| POST   | /arenas/seasons/:id/reset               | Soft-reset & end season              |
| GET    | /arenas/houses                          | List creator houses                  |
| GET    | /arenas/houses/:id                      | Get house with members               |

---

## Flutter Screens

| Screen                   | Route                              |
|--------------------------|------------------------------------|
| ArenaLobbyScreen         | /arenas                            |
| BattleRoomScreen         | /arenas/battle/:id                 |
| VotingScreen             | /arenas/battle/:id/vote            |
| LeaderboardScreenV2      | /arenas/leaderboard                |
| HouseProfileScreen       | /arenas/houses/:id                 |
| PrizePoolScreen          | /arenas/battle/:id/prize-pool      |
| ArenaHistoryScreen       | /arenas/history                    |

---

## No Breaking Changes
All Sprint 8 additions are purely additive:
- New enum values added to schema
- New models added (no existing model fields removed or renamed)
- ArenasModule expanded (controllers/services added, existing preserved)
- New packages (`ranking-core`, `voting-core`) do not replace existing ones
