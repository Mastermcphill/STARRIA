# Sprint 8 — Test Report

## Test File
`apps/api/test/sprint8-arenas-battles.e2e.spec.ts`

---

## Test Coverage

### Suite 1: Arena Season
| Test                                               | Expected |
|----------------------------------------------------|----------|
| POST /arenas/seasons — creates a new season        | 201, id set, number=1 |
| GET /arenas/seasons/active — null when no active   | 200, null |

### Suite 2: Battle Lifecycle
| Test                                               | Expected |
|----------------------------------------------------|----------|
| POST /arenas — creates RAP_BATTLE with prize pool  | 201, status=DRAFT |
| POST /arenas/:id/join — registers CHALLENGER       | 200, role=CHALLENGER |
| POST /arenas/:id/join — registers DEFENDER         | 200, role=DEFENDER |
| POST /arenas/:id/start — ACTIVE                    | 200, status=ACTIVE |
| POST /arenas/:id/end — VOTING                      | 200, status=VOTING |
| GET /arenas/:id — participants + status            | 200, 2 participants |

### Suite 3: Voting & Anti-Fraud ✓
| Test                                               | Expected |
|----------------------------------------------------|----------|
| Cast valid vote                                    | 200, finalWeight>0, fraudFlag=false |
| Duplicate vote rejection                           | 400 |
| Second voter casts vote                            | 200 |
| Self-vote rejection                                | 400 |

### Suite 4: Prize Pool
| Test                                               | Expected |
|----------------------------------------------------|----------|
| Fan contributes 500 coins                          | 200, totalCoins≥500 |
| Sponsor contributes 2000 coins                     | 200, totalCoins≥2500 |

### Suite 5: ELO Updates & Settlement
| Test                                               | Expected |
|----------------------------------------------------|----------|
| POST /arenas/:id/settle — settles, awards ELO      | 200, status=SETTLED, eloAwarded=true |
| GET /arenas/leaderboard/global — ranked entries    | 200, winner.elo > loser.elo |

### Suite 6: Team Battle
| Test                                               | Expected |
|----------------------------------------------------|----------|
| POST /arenas — TEAM_BATTLE created                 | 201, isTeamBattle=true |
| Join team battle ×4 members                        | 200 each |

### Suite 7: Creator Houses
| Test                                               | Expected |
|----------------------------------------------------|----------|
| GET /arenas/houses — lists active houses           | 200, array |

### Suite 8: Season Reset
| Test                                               | Expected |
|----------------------------------------------------|----------|
| POST /arenas/seasons/:id/reset                     | 200, status=ENDED |

### Suite 9: Battle Listing
| Test                                               | Expected |
|----------------------------------------------------|----------|
| GET /arenas?status=SETTLED                         | 200, includes settled battle |
| GET /arenas?type=RAP_BATTLE                        | 200, all type=RAP_BATTLE |

---

## Anti-Fraud Coverage

| Fraud Vector          | Test Coverage | Mechanism                    |
|-----------------------|--------------|-------------------------------|
| Self-voting           | ✓            | HTTP 400, guard in castVote() |
| Duplicate voting      | ✓            | UNIQUE(battleId, voterId), HTTP 400 |
| Voting outside window | ✓            | Status != VOTING guard        |
| Low trust score       | Partial      | fraudFlag set, weight reduced |
| Bot velocity abuse    | Unit-only    | VotingService velocity check  |

---

## Voting Weight Verification

```
final_weight = base_weight × trust_score × patron_multiplier

Judge vote:    3.0 × 1.0 × 1.0 = 3.0
Normal fan:    1.0 × 1.0 × 1.0 = 1.0  (default trust + no patron)
Patron fan:    1.0 × 1.0 × 2.0 = 2.0  (example patron multiplier)
Low-trust:     1.0 × 0.3 × 1.0 = 0.3  (flagged but counted with penalty)
```

---

## ELO Settlement Verification

Post-settlement assertions:
1. `battle.status === 'SETTLED'`
2. `battle.eloAwarded === true`
3. `ArenaPrizePool.settled === true`
4. Winner's ELO > loser's ELO (leaderboard check)

---

## How to Run

```bash
# From project root
cd apps/api
jest --testPathPattern=sprint8 --runInBand
```

`--runInBand` required — tests share battle/season IDs across suites.

---

## Known Gaps (Sprint 9 targets)

| Gap                                      | Priority |
|------------------------------------------|----------|
| Live audio/video battle room integration | High     |
| Patron multiplier pulled from patron-core | High    |
| Trust score pulled from trust-core        | High    |
| Highlight replay generation              | Medium   |
| House battle E2E test                    | Medium   |
| Judge appointment flow                   | Low      |
