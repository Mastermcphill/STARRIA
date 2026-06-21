# Sprint 5 Deliverables — Patron Economy, Messaging Prestige & Vidzi Migration

**Date:** 2026-06-17  
**Sprint:** 5 of 6  
**Constraint:** No breaking changes. Preserve existing APIs. Sprint 6 (Companion Economy) depends on this sprint.

---

## Summary

Sprint 5 establishes the foundational social graph for STARRIA:
- **Patron Economy** — Crown-based tier system with lifetime spend tracking, achievements, milestones, and creator relationships
- **Messaging Prestige** — Strict DM gating via `DMPermission`, Request→Accept→Conversation flow, inbox threading
- **Trust System** — Composite 0–100 trust score from 7 behavioural signals with automatic restriction enforcement
- **Presence System** — ONLINE/AWAY/BUSY/OFFLINE/IN_SESSION states with typing indicators
- **Vidzi Extraction** — Analysis document mapping Vidzi patterns to STARRIA Sprint 5 implementation

Companion sessions are explicitly **not** implemented. Sprint 6 (Companion Economy) depends on this sprint's domain models.

---

## Patron Tier Reference

| Tier | Badge | Lifetime Spend | DM Eligible | Broadcast |
|---|---|---|---|---|
| VISITOR | — | $0 | ✗ | ✗ |
| SUPPORTER | ⭐ | $100 | ✗ | ✗ |
| PATRON | 💜 | $1,000 | ✓ | ✗ |
| BENEFACTOR | ⭐ | $5,000 | ✓ | ✗ |
| LEGEND | 💎 | $20,000 | ✓ | ✓ |
| OG | 👑 | $50,000 | ✓ | ✓ |

**Key rule:** Supporting once does NOT unlock DM. SUPPORTER tier (`$100 lifetime`) is explicitly `dmEligible: false`. DM access requires PATRON tier ($1,000) OR creator-specific spend/duration/rank qualifying under the creator's `DMPermission` CUSTOM setting.

---

## Trust Score Formula

```
score = moderationScore × 0.25
      + fraudScore      × 0.20
      + spamScore       × 0.15
      + accountAge(norm)× 0.15  (capped at 365 days)
      + conversationQuality × 0.10
      + creatorFeedback × 0.10
      + disputeScore    × 0.05  (100 - min(disputes×20, 100))
```

**Auto-restriction thresholds:**
- `SHADOW_RESTRICTED`: score ≤ 40
- `PATRON_INELIGIBLE`: score ≤ 30
- `MESSAGING_BLOCKED`: score ≤ 20

---

## New Packages

### `@starria/patron-core`
- `src/types.ts` — PatronProfile, PatronHistory, CreatorRelationship, PatronAchievement, PatronMilestone, PatronStorePort, PatronTierConfig, PATRON_TIER_CONFIGS, resolvePatronTier(), getPatronTierConfig()
- `src/events.ts` — 6 event builders (buildPatronProfileCreated, buildPatronTierUpgraded, buildPatronAchievementUnlocked, buildPatronMilestoneReached, buildPatronRelationshipCreated, buildPatronSpendRecorded)
- `src/patron.service.ts` — PatronService.createProfile(), recordSpend() (tier evaluation, achievement unlocking, milestone checks), getProfile(), getRelationships(), getAchievements(), getMilestones()
- `src/index.ts`

### `@starria/messaging-core`
- `src/types.ts` — DMPermission, MessageRequest, Conversation, Message, InboxThread, checkDMAccess(), canBroadcast(), MessageStorePort, DMPermissionStorePort
- `src/events.ts` — 7 event builders
- `src/messaging.service.ts` — MessagingService.sendRequest() (DM gate check), acceptRequest(), declineRequest(), sendMessage(), archiveConversation(), getInbox(), getDMPermission(), updateDMPermission()
- `src/index.ts`

### `@starria/trust-core`
- `src/types.ts` — TrustProfile, TrustSignals, TrustFlag, TrustRestrictionRecord, calculateTrustScore(), resolveAutoRestrictions(), RESTRICTION_THRESHOLDS, TrustStorePort
- `src/events.ts` — 3 event builders (buildTrustScoreUpdated, buildTrustFlagRaised, buildTrustRestrictionSet)
- `src/trust.service.ts` — TrustService.getProfile() (bootstrap), updateSignals(), raiseFlag() (signal penalty by type), setRestriction(), checkEligibility()
- `src/index.ts`

---

## New Domain Events (`@starria/domain-events`)

| Event | Aggregate |
|---|---|
| `patron.profile.created` | PatronProfile |
| `patron.tier.upgraded` | PatronProfile |
| `patron.achievement.unlocked` | PatronProfile |
| `patron.milestone.reached` | PatronProfile |
| `patron.relationship.created` | PatronProfile |
| `patron.spend.recorded` | PatronProfile |
| `messaging.request.sent` | MessageRequest |
| `messaging.request.accepted` | MessageRequest |
| `messaging.request.declined` | MessageRequest |
| `messaging.message.sent` | Conversation |
| `messaging.conversation.opened` | Conversation |
| `messaging.conversation.archived` | Conversation |
| `messaging.dm_permission.updated` | DMPermission |
| `trust.score.updated` | TrustProfile |
| `trust.flag.raised` | TrustProfile |
| `trust.restriction.set` | TrustProfile |
| `presence.updated` | PresenceProfile |
| `presence.user.typing` | Conversation |

---

## New API Modules

### Patrons (`apps/api/src/modules/patrons/`)
| Method | Path | Description |
|---|---|---|
| GET | /patrons/me?userId= | My patron profile + relationships + achievements |
| GET | /patrons/:id | Public patron profile |
| POST | /patrons | Create patron profile |
| POST | /patrons/spend | Record spend (triggers tier + achievement evaluation) |
| GET | /patrons/:id/achievements | Patron achievements |
| GET | /patrons/:id/milestones?starId= | Patron milestones (optionally scoped to creator) |

### Messaging (`apps/api/src/modules/messaging/`)
| Method | Path | Description |
|---|---|---|
| GET | /messages/requests?recipientId= | Pending DM requests |
| POST | /messages/request | Send DM request (gate-checked) |
| POST | /messages/accept | Accept request, creates conversation |
| POST | /messages/decline | Decline request |
| GET | /conversations/:id | Conversation detail |
| GET | /conversations/:id/messages | Message history |
| POST | /messages/send | Send message within conversation |
| GET | /inbox?userId= | Inbox thread list |
| GET | /dm-permissions/:userId | Creator's DM permission setting |
| PATCH | /dm-permissions | Update DM permission |

### Trust (`apps/api/src/modules/trust/`)
| Method | Path | Description |
|---|---|---|
| GET | /trust/me?userId= | Trust profile + eligibility |
| POST | /trust/signals | Update trust signals |
| POST | /trust/flag | Raise trust flag |
| POST | /trust/restrict | Manual restriction |
| GET | /trust/eligibility?userId= | Quick eligibility check |

### Presence (`apps/api/src/modules/presence/`)
| Method | Path | Description |
|---|---|---|
| GET | /presence?userId= | Current presence state |
| PATCH | /presence | Update presence state |
| POST | /presence/typing | Typing indicator |

---

## Flutter Screens

| Screen | File | Route |
|---|---|---|
| PatronDashboardScreen | `features/patron/patron_dashboard_screen.dart` | `/patrons/:userId` |
| InboxScreen | `features/messaging/inbox_screen.dart` | `/inbox/:userId` |
| ConversationScreen | `features/messaging/conversation_screen.dart` | `/conversations/:id` |
| MessageRequestScreen | `features/messaging/message_request_screen.dart` | `/messages/requests/:userId` |
| TrustProfileScreen | `features/trust/trust_profile_screen.dart` | `/trust/:userId` |
| PresenceSettingsScreen | `features/presence/presence_settings_screen.dart` | `/presence/:userId` |

---

## E2E Test Report

**File:** `apps/api/test/sprint5-patron-messaging.e2e.spec.ts`  
**Total scenarios:** 19  
**Dependencies:** None (pure in-memory, no HTTP/DB/external services)

| Suite | Tests | Coverage |
|---|---|---|
| Patron Economy | 8 | create profile, tier upgrades, achievements (no-double), milestones, creator-scoped tier, spend events |
| Messaging Prestige | 7 | send request, NOBODY gate, PATRONS gate, accept, decline, send message, inbox, duplicate prevention |
| Trust System | 6 | bootstrap, signal update, spam flag, auto-restriction at score ≤ 20, eligibility, manual restriction |
| Full patron→DM flow | 1 | end-to-end: create patron → spend $1K → PATRON tier → send DM request → accept → message; all 9 events verified |

---

## Changed Files

### New files
- `packages/patron-core/package.json`
- `packages/patron-core/tsconfig.json`
- `packages/patron-core/src/types.ts`
- `packages/patron-core/src/events.ts`
- `packages/patron-core/src/patron.service.ts`
- `packages/patron-core/src/index.ts`
- `packages/messaging-core/package.json`
- `packages/messaging-core/tsconfig.json`
- `packages/messaging-core/src/types.ts`
- `packages/messaging-core/src/events.ts`
- `packages/messaging-core/src/messaging.service.ts`
- `packages/messaging-core/src/index.ts`
- `packages/trust-core/package.json`
- `packages/trust-core/tsconfig.json`
- `packages/trust-core/src/types.ts`
- `packages/trust-core/src/events.ts`
- `packages/trust-core/src/trust.service.ts`
- `packages/trust-core/src/index.ts`
- `apps/api/src/modules/patrons/in-memory-patron.repository.ts`
- `apps/api/src/modules/patrons/patrons.service.ts`
- `apps/api/src/modules/patrons/patrons.controller.ts`
- `apps/api/src/modules/patrons/patrons.module.ts`
- `apps/api/src/modules/messaging/in-memory-messaging.repository.ts`
- `apps/api/src/modules/messaging/messaging.service.ts`
- `apps/api/src/modules/messaging/messaging.controller.ts`
- `apps/api/src/modules/messaging/messaging.module.ts`
- `apps/api/src/modules/trust/in-memory-trust.repository.ts`
- `apps/api/src/modules/trust/trust.service.ts`
- `apps/api/src/modules/trust/trust.controller.ts`
- `apps/api/src/modules/trust/trust.module.ts`
- `apps/api/src/modules/presence/presence.service.ts`
- `apps/api/src/modules/presence/presence.controller.ts`
- `apps/api/src/modules/presence/presence.module.ts`
- `apps/mobile/lib/features/patron/patron_provider.dart`
- `apps/mobile/lib/features/patron/patron_dashboard_screen.dart`
- `apps/mobile/lib/features/messaging/messaging_provider.dart`
- `apps/mobile/lib/features/messaging/inbox_screen.dart`
- `apps/mobile/lib/features/messaging/conversation_screen.dart`
- `apps/mobile/lib/features/messaging/message_request_screen.dart`
- `apps/mobile/lib/features/trust/trust_profile_screen.dart`
- `apps/mobile/lib/features/presence/presence_settings_screen.dart`
- `apps/api/test/sprint5-patron-messaging.e2e.spec.ts`
- `docs/vidzi-patron-extraction/extraction-report.md`

### Modified files
- `packages/domain-events/src/events/patron.ts` (new)
- `packages/domain-events/src/events/messaging.ts` (new)
- `packages/domain-events/src/events/trust.ts` (new)
- `packages/domain-events/src/events/presence.ts` (new)
- `packages/domain-events/src/index.ts` (exports for patron/messaging/trust/presence)
- `apps/api/src/app.module.ts` (PatronsModule, MessagingModule, TrustModule, PresenceModule added)
- `apps/mobile/lib/core/router/app_router.dart` (6 Sprint 5 routes added)

---

## Build Caveats

1. **In-memory persistence** — All Sprint 5 stores use process-scoped Maps. Prisma migrations for these models are Sprint 6 prerequisites (see Section 10 of Vidzi extraction report).

2. **DM gate `allowedUserIds` check** — `checkDMAccess()` returns null for CUSTOM mode when `allowedUserIds` is set, with a comment that the caller must verify the specific user is in the list. This is intentional — the API controller receives the full context and can perform the membership check without loading the full list into the gate function.

3. **Presence typing indicator** — `PresenceService.setTyping()` emits the domain event but there is no WebSocket subscriber yet. Real-time delivery requires a WebSocket gateway (Sprint 6 or infrastructure sprint).

4. **Trust flag penalty is computed from stored profile** — `TrustService.raiseFlag()` reads the current profile to calculate the post-flag signal values, then calls `updateSignals()`. This is two reads + one write, not atomic. For production, this should be wrapped in a transaction.

---

## Sprint 6 TODO

1. **Companion Economy** — `CompanionSession`, `CompanionProfile`, `SessionRequest`, session coin ledger; integration with messaging-core for request flow and presence-core for `IN_SESSION` state
2. **Wallet → Patron hookup** — `GiftingService.sendGift()` and `TicketingService.purchaseTicket()` should call `patronService.recordSpend()` on transaction completion
3. **Prisma migrations** — Full SQL schema for 10 new models
4. **FCM notifications** — Wire domain events to push notification adapter
5. **WebSocket gateway** — Real-time typing indicators and presence state for open conversations and live rooms
6. **Room badges** — Inject patron tier emoji into `LiveRoomScreen`, `EventDetailScreen`, `CreatorProfileScreen`
7. **Trust → Messaging gate** — `MessagingService.sendRequest()` should call `TrustService.checkEligibility()` before the DM gate check; blocked users cannot send requests regardless of tier
