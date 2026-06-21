# Sprint 6 Deliverables — Companion Economy

**Status:** Complete  
**Branch:** main

---

## Packages Shipped

| Package | Purpose |
|---|---|
| `packages/companion-core` | CompanionProfile CRUD, discovery, reviews, blocks, reports, loneliness index |
| `packages/session-core` | Booking, escrow, start/end/extend, payout split, participant invites, panic leave |
| `packages/age-gate-core` | 18+/21+ verification, consent management, content warnings, safe mode |

All packages are framework-agnostic, emit domain events, and define Port interfaces for storage adapters.

---

## Domain Events Added

17 new event types added to `packages/domain-events/src/events/companion.ts` (see Vidzi extraction report for full list).

---

## API Endpoints (NestJS)

### Companion Discovery
| Method | Path | Description |
|---|---|---|
| GET | `/companion/discovery` | Age-gated companion discovery feed |
| GET | `/companion/recommendations` | Loneliness-based recommendations (score never exposed) |

### Companion Profiles
| Method | Path | Description |
|---|---|---|
| GET | `/companions` | List companions |
| GET | `/companions/:id` | Companion profile + rates |
| POST | `/companions` | Create companion profile |
| PATCH | `/companions/:id/availability` | Toggle availability |
| POST | `/companions/:id/rates` | Set session rates |
| POST | `/companions/:id/review` | Leave a review |
| POST | `/companions/:id/block` | Block a companion |
| POST | `/companions/:id/report` | Report a companion |

### Bookings
| Method | Path | Description |
|---|---|---|
| POST | `/bookings` | Book a session (idempotent) |
| POST | `/bookings/:id/cancel` | Cancel + refund escrow |
| POST | `/bookings/:id/extend` | Extend session (debits additional coins) |

### Sessions
| Method | Path | Description |
|---|---|---|
| POST | `/sessions/start` | Mark session LIVE, set endsAt |
| POST | `/sessions/end` | End session, settle payout |
| POST | `/sessions/invite` | Invite participant (GUEST or CO_HOST) |
| POST | `/sessions/panic-leave` | Emergency exit |
| POST | `/sessions/flag` | Flag session for moderation |

### Age Gate
| Method | Path | Description |
|---|---|---|
| GET | `/age-gate` | Get current age gate profile |
| POST | `/age-gate/verify` | Submit self-declaration (DOB validated) |
| POST | `/age-gate/consent` | Record explicit consent by type |
| PATCH | `/age-gate/safe-mode` | Toggle safe mode |

---

## Flutter Screens

| Screen | Route | Description |
|---|---|---|
| `AgeGateScreen` | `/companion/gate/:userId` | DOB entry, 4 consent checkboxes, content warnings |
| `CompanionDiscoveryScreen` | `/companion/discovery/:userId` | 2-col grid, available-now chip, verified badge |
| `CompanionProfileScreen` | `/companion/:id` | Hero image, chip rows, rates, Book CTA, Block/Report |
| `SessionBookingScreen` | `/companion/:id/book` | Session type, duration, schedule picker, cost summary |
| `SessionTimerScreen` | `/sessions/:id/timer` | Countdown ring, 5-min extend modal, end session |
| `AudioSessionScreen` | `/sessions/:id/audio` | Animated waveform, mute, end, timer controls |
| `VideoSessionScreen` | `/sessions/:id/video` | PiP self-view, SmartStageView stub, camera/mic/end/flip |
| `CompanionDashboardScreen` | `/companion/dashboard/:userId` | Overview, Sessions, Earnings tabs; availability toggle |

---

## Tests

**File:** `apps/api/test/sprint6-companion.e2e.spec.ts`

| # | Scenario |
|---|---|
| 1 | Creates a companion profile with required fields |
| 2 | Sets and reads availability |
| 3 | Adds rates to a companion profile |
| 4 | Calculates average rating after multiple reviews |
| 5 | Blocks a user from a companion profile |
| 6 | Rejects under-18 self-declaration |
| 7 | Passes 18+ self-declaration for a 20-year-old |
| 8 | Records companion discovery consent separately |
| 9 | checkAgeGate returns failed when profile is null |
| 10 | checkAgeGate returns passed for valid 18+ profile |
| 11 | Books a session and debits escrow |
| 12 | Idempotent duplicate booking key returns existing booking |
| 13 | Rejects booking when patron has insufficient coins |
| 14 | Cancels booking and refunds escrow |
| 15 | Starts a session — status becomes LIVE |
| 16 | Ends a session — payout released to companion |
| 17 | Extends a session at the 5-min warning |
| 18 | Invites a participant to a GROUP session |
| 19 | Triggers panic leave and emits PANIC_LEAVE_TRIGGERED event |
| 20 | Calculates loneliness score — high inactivity raises score |
| 21 | Calculates loneliness score — active user scores low |
| 22 | getRecommendations never exposes the loneliness score |
| 23 | Discovers available companions |
| 24 | Filters discovery by session type |
| 25 | Reports a companion — adds to report queue |
| 26 | Blocks a companion — isBlocked returns true |
| 27 | Settles payout with 80/20 split |

---

## Safety Architecture

- **Age gate surface separation**: Companion discovery served exclusively from `/companion/discovery`, never from `/discovery`. Gate check enforced at controller layer.
- **Loneliness score privacy**: Score computed in `LonelinessService`, stored in `LonelinessStorePort`, but **never returned in any API response**. `getRecommendations()` returns only `{ companions, reason }`.
- **Panic leave**: Available in `SessionTimerScreen` (top bar) and `VideoSessionScreen` (top-left). Calls `POST /sessions/panic-leave` then routes to `/`.
- **Block/Report**: Available on `CompanionProfileScreen`. Block prevents future discovery. Report goes to moderation queue without immediately suspending the companion.
- **Session recording flags**: `POST /sessions/flag` stored for moderation review.
- **Trust score restrictions**: `TrustService` restrictions enforced at booking gate (PATRON_INELIGIBLE at score < 30 blocks booking creation).

---

## Payout Model

```
Session coin cost: C
Platform fee (20%): C × 0.20
Companion share (80%): C × 0.80

Multi-participant GROUP sessions support PayoutSplit[] for revenue sharing.
```

---

## Constraint Compliance

- ✅ No breaking changes to Sprint 1–5 routes or APIs
- ✅ All existing packages untouched
- ✅ `AppModule` additions are additive only
- ✅ `domain-events` additions are purely additive

---

## Sprint 7 Roadmap (LiveKit Integration)

1. Provision LiveKit server (cloud or self-hosted)
2. Add `livekit_client` token service to NestJS API
3. Replace `VideoSessionScreen` placeholder with `VideoTrackRenderer`
4. Wire `AudioSessionScreen` waveform to `RemoteAudioTrack.onAudioSample`
5. Implement `SmartStageView` — primary track 70%, secondary tiles row
6. Add camera/mic permission handling via `permission_handler`
7. Screen share via LiveKit egress
8. Recording flag enforcement (LiveKit egress API)

See `docs/vidzi-companion-extraction/extraction-report.md` for full integration checklist.
