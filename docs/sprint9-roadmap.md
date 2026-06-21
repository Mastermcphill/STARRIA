# Sprint 9 Roadmap — Live Battles, Monetisation & Creator Economy 2.0

## Theme
**"Make battles feel real."** Sprint 9 wires Sprint 8's skeleton to live infrastructure:
real-time audio/video battles via LiveKit, patron multipliers integrated into voting,
trust scores flowing into fraud detection, and a full creator economy layer with
revenue sharing, battle subscriptions, and fan challenges.

---

## Phase 1: Live Battle Rooms (LiveKit Integration)

**Objective:** Connect `Battle.status=ACTIVE` to a live LiveKit session so creators
can actually battle in real-time with audience participation.

### Tasks
- [ ] `BattleRoomService` — wraps `session-engine-core` to create/destroy LiveKit rooms on battle start/end
- [ ] LiveKit tokens scoped to battle participants (CHALLENGER/DEFENDER get publisher rights, audience gets subscriber)
- [ ] `BattleRoomScreen` — wire Flutter screen to real LiveKit token via `POST /arenas/:id/room-token`
- [ ] Real-time gifting overlay during live battles (reuse gifting-core)
- [ ] Viewer count pushed via WebSocket / SSE during ACTIVE state
- [ ] `POST /arenas/:id/room-token` endpoint

---

## Phase 2: Voting Integration (Trust + Patron)

**Objective:** Replace `VotingService` stubs with real trust scores and patron multipliers.

### Tasks
- [ ] Wire `TrustScorePort` → `TrustService` (from trust-core Sprint 5)
- [ ] Wire `PatronMultiplierPort` → `PatronService` (from patron-core Sprint 5)
- [ ] Implement `VoteVelocityPort` backed by Redis sliding window counter
- [ ] Full `FraudDetectorPort` implementation (low-trust + bot pattern checks)
- [ ] Patron vote multiplier: Silver=1.25×, Gold=1.5×, Diamond=2×, Platinum=3×
- [ ] Voting UI shows live vote counts (WebSocket push during VOTING phase)

---

## Phase 3: Fan Challenges & Bets

**Objective:** Fans can challenge creators to battles and place coin-backed predictions.

### Tasks
- [ ] `FanChallenge` model — fan issues a challenge to a star, star accepts/declines
- [ ] Challenge acceptance triggers `DRAFT` battle with fan as spectator
- [ ] `BattlePrediction` model — fans bet coins on a winner before voting opens
- [ ] Prediction settlement: correct predictions earn 1.8× return (house edge 10%)
- [ ] `POST /battles/:id/challenge`, `POST /battles/:id/predict`
- [ ] Flutter: FanChallengeScreen, PredictionScreen

---

## Phase 4: Battle Subscriptions

**Objective:** Creators can gate specific battle formats behind a subscription tier.

### Tasks
- [ ] `BattleAccess` model — access modes: FREE, TICKET, SUBSCRIPTION
- [ ] Integrate with ticketing-core for paid battle entry
- [ ] Integrate with patron-core for subscriber-only battles
- [ ] PPV battle support: `POST /battles/:id/purchase-access`
- [ ] Subscription-only voting: only subscribers can vote (SUBSCRIBER_ONLY voting method)

---

## Phase 5: Battle Replays & Highlights (Automated)

**Objective:** Auto-generate highlight reels from completed battles and push to Discovery.

### Tasks
- [ ] `ReplayService.clipBattle()` — trigger replay-core to clip battle session recording
- [ ] Auto-extract winner's best moment via metadata (peak vote timestamp)
- [ ] Push to `BattleHighlight` with `pushedToDiscovery=true`
- [ ] Discovery feed receives battle highlights as a new content type
- [ ] Flutter `BattleHighlightCard` widget in discovery feed

---

## Phase 6: Creator Houses 2.0

**Objective:** Make houses functional competitive entities with rep, roles, and battles.

### Tasks
- [ ] `HouseReputation` model — aggregate house ELO from member battle results
- [ ] Role management: Owner, Admin, Captain, Member, Prospect
- [ ] House recruitment: Prospect → Member approval flow
- [ ] `HouseBattle` fully wired: challenge another house, auto-create TEAM_BATTLE
- [ ] House leaderboard: ranked by aggregate ELO and total house wins
- [ ] Flutter: HouseManagementScreen, HouseBattleScreen

---

## Phase 7: Season Championship

**Objective:** Season-end tournament bracket for top-ranked creators.

### Tasks
- [ ] Auto-generate championship bracket at season end (top 16 by ELO)
- [ ] `ChampionshipBracket` model — single elimination, 4 rounds
- [ ] Auto-advance winners, notify losers
- [ ] Championship prize pool funded by season ticket revenue share
- [ ] Champion badge minted to winner's StarProfile

---

## Phase 8: Revenue Sharing

**Objective:** Creators earn a percentage of battle revenue they generate.

### Tasks
- [ ] Battle revenue split: 60% winner / 20% loser / 10% house / 10% platform
- [ ] `RevenueAllocation` model tied to ArenaPrizePool settlement
- [ ] Creator revenue dashboard in Creator OS
- [ ] Monthly payout scheduling

---

## Phase 9: Creator OS Integration

**Objective:** Battle analytics in Creator OS dashboard.

### Tasks
- [ ] Battle history widget in `CreatorOSDashboard`
- [ ] ELO trend chart (30-day)
- [ ] Revenue from battles in `RevenueAnalyticsScreen`
- [ ] Battle schedule planner in `ShowPlannerScreen`
- [ ] Highlight reel manager in `RecordingManagerScreen`

---

## Phase 10: Admin & Moderation

### Tasks
- [ ] Admin panel: manually set battle winner (dispute resolution)
- [ ] Fraud review queue: surfaced via `BattleVote.fraudFlag=true`
- [ ] Judge management: appoint / remove judges per battle
- [ ] House suspension for repeated ToS violations

---

## Technical Debt to Clear in Sprint 9

| Item                                       | Impact |
|--------------------------------------------|--------|
| VotingService trust/patron stubs           | High   |
| BattlesController self-vote check uses stub userId | High |
| LiveKit room cleanup on battle end         | High   |
| Missing tsconfig path aliases for new packages | Medium |
| PrizePoolContribution missing wallet debit | Medium |
| BattleHighlight clipUrl not yet generated  | Medium |
| House memberCount not auto-incremented     | Low    |

---

## Sprint 9 Acceptance Criteria

1. Two creators can join a live battle room, speak/perform in real time
2. Audience casts votes during VOTING phase with real trust × patron weights
3. Battle settles, ELO updates, prize distributed to winner's wallet
4. Highlight clip auto-posted to Discovery feed within 30s of settlement
5. House battle triggers team battle room with team scores tracked
6. Season championship bracket auto-generated from top-16 ELO at season end
