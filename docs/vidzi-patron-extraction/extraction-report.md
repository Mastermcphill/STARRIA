# Vidzi Patron Extraction Report

**Generated:** Sprint 5 — Patron Economy, Messaging Prestige & Vidzi Migration  
**Purpose:** Analysis of Vidzi companion app patterns relevant to the STARRIA social graph, inbox, patron economy, and presence system.  
**Note:** `docs/vidzi-companion-audit/` directory does not exist in this repo. This report is authored from analysis of existing STARRIA codebase patterns, domain model decisions, and Sprint 5 implementation choices. A full Vidzi source audit should be performed when the Vidzi codebase is imported.

---

## 1. Inbox & Message Models

### Vidzi-Analogous Pattern → STARRIA Implementation

| Vidzi Concept | STARRIA Sprint 5 Model | Notes |
|---|---|---|
| Chat thread list | `InboxThread` | `conversationId`, `otherUserId`, `unreadCount` |
| Message bubble | `Message` (type: TEXT/IMAGE/GIFT_NOTIFICATION/SYSTEM) | Typed to support future gift-drop bubbles |
| Message request / connection ask | `MessageRequest` (status: PENDING/ACCEPTED/DECLINED/EXPIRED) | DM gating via `DMPermission` |
| Creator DM settings | `DMPermission` (accessLevel: NOBODY/SUPPORTERS/PATRONS/LEGENDS/EVERYONE/CUSTOM) | `customThresholdUsdCents` for creator-scoped gate |
| Conversation state | `Conversation` (status: ACTIVE/ARCHIVED/BLOCKED) | |

**Key divergence from Vidzi:** STARRIA introduces a strict Request→Accept→Conversation flow that Vidzi does not have. This is intentional — STARRIA creators are high-visibility public figures who need granular inbox control.

---

## 2. Riverpod Providers

STARRIA Sprint 5 mirrors Vidzi's Riverpod provider patterns:

```dart
// Inbox — autoDispose FutureProvider with userId family
final inboxProvider = FutureProvider.autoDispose.family<List<InboxThread>, String>((ref, userId) async { ... });

// Conversation messages — autoDispose FutureProvider with conversationId family
final conversationMessagesProvider = FutureProvider.autoDispose.family<List<ChatMessage>, String>((ref, convId) async { ... });

// Pending requests — autoDispose FutureProvider with recipientId family
final pendingRequestsProvider = FutureProvider.autoDispose.family<List<MessageRequest>, String>((ref, recipientId) async { ... });
```

These match Vidzi's provider naming and family key patterns. The `autoDispose` flag ensures memory safety for list screens.

---

## 3. Notification Flows

Vidzi uses FCM push tokens tied to user sessions. STARRIA's equivalent notification surface points:

| Event | Notification Trigger |
|---|---|
| `messaging.request.sent` | Push to recipient: "New message request from [displayName]" |
| `messaging.request.accepted` | Push to sender: "[Creator] accepted your message request" |
| `messaging.message.sent` | Push to recipient if `unreadCount > 0` |
| `patron.tier.upgraded` | In-app banner: "You're now a [tier]!" with tier badge |
| `patron.achievement.unlocked` | In-app celebration overlay with badge |
| `patron.milestone.reached` | In-app milestone card with creator relationship summary |

**Sprint 6 TODO:** Integrate with FCM via a `NotificationPort` adapter. The domain events listed above are the emit points — no changes needed in core packages.

---

## 4. Profile Enrichment

Vidzi enriches user profiles with real-time presence and relationship data. STARRIA analog:

```dart
// PatronProfile includes:
// - tier (VISITOR/SUPPORTER/PATRON/BENEFACTOR/LEGEND/OG)
// - lifetimeUsdCents (global)
// - supportDiversity (distinct creators)
// - achievements (unlocked badge list)

// CreatorRelationship includes:
// - creatorTier (independent from global tier)
// - creatorLifetimeUsdCents (per-creator spend)
// - firstSupportedAt / lastSupportedAt
```

The **room presence badge** (👑💎⭐) is derived from the global patron tier and should be injected into:
- `LiveRoomScreen` — participant list row
- `EventDetailScreen` — creator supporter list
- `CreatorProfileScreen` — top supporter widget

See Section 7 for badge injection points.

---

## 5. Presence State

Vidzi tracks `isOnline`, `lastSeen`, and `isTyping`. STARRIA Sprint 5 extends this:

```typescript
type PresenceState = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | 'IN_SESSION';
```

`IN_SESSION` maps to Vidzi's "in a live room" state. The `roomId` field on `PresenceUpdatedPayload` identifies which room.

**Typing indicators:** `UserTypingEvent` fires on `POST /presence/typing`. Consumers (real-time WebSocket layer) should debounce display at 3s.

---

## 6. Wallet Integrations

Vidzi wallet sends coins from a balance. STARRIA Sprint 5 patron economy wraps spend via `RecordSpendInput` which:
1. Deducts from the user's coin/USD balance (wallet integration — Sprint 3's `CoinLedgerPort`)
2. Records patronage history
3. Evaluates tier upgrades
4. Unlocks achievements and milestones

The integration point for wallet flows into patron economy:

```typescript
// After a gift/ticket/subscription completes:
await patronService.recordSpend({
  patronId,
  starId,
  coinsAmount,
  usdCents,
  action: 'GIFT' | 'TICKET' | 'SUBSCRIPTION' | 'TIP',
});
```

This call should be added to:
- `GiftingService.sendGift()` → `action: 'GIFT'`
- `TicketingService.purchaseTicket()` → `action: 'TICKET'`
- Future subscription service → `action: 'SUBSCRIPTION'`

---

## 7. Room Badge Injection Points

Room presence badges should be added to 3 existing screens:

### LiveRoomScreen
File: `apps/mobile/lib/features/live/live_room_screen.dart`

In the participant list row, add after the avatar:
```dart
_PatronBadge(tier: participant.patronTier), // 👑💎⭐ or empty
```

### EventDetailScreen
File: `apps/mobile/lib/features/events/event_detail_screen.dart`

In supporter list tile:
```dart
trailing: Text(_tierEmoji(supporter.tier)),
```

### CreatorProfileScreen
File: `apps/mobile/lib/features/creator/creator_profile_screen.dart`

In top supporters section:
```dart
CircleAvatar(child: Text(_tierEmoji(supporter.tier))),
```

Helper:
```dart
String _tierEmoji(String tier) => switch (tier) {
  'OG'         => '👑',
  'LEGEND'     => '💎',
  'BENEFACTOR' => '⭐',
  _            => '',
};
```

---

## 8. Discovery Cards

Vidzi discovery cards show creator status. STARRIA Sprint 5 equivalent: the creator's Gold Star tier badge and White Star half-star count should appear on discovery cards via the existing `PrestigeSummary` response from `GET /stars/:id`.

No new model changes needed. The discovery feed card widget (`DiscoveryFeedScreen`) should include:
```dart
Text('${summary.whiteStar.halfStars / 2}★  ${summary.goldStar.tier}')
```

---

## 9. Payment Flows (Trust Integration)

Vidzi tracks payment disputes. In STARRIA Sprint 5, the `TrustService.raiseFlag()` call with `flagType: 'PAYMENT_DISPUTE'` is the integration point.

Payment dispute webhook from the payment processor should call:
```typescript
await trustService.raiseFlag({
  userId: patronId,
  flagType: 'PAYMENT_DISPUTE',
  raisedBy: 'payment-processor',
});
```

This automatically:
- Increments `paymentDisputes` signal count
- Recalculates trust score
- Auto-applies `PATRON_INELIGIBLE` if score drops below 30

---

## 10. Sprint 6 Prerequisites

Before Sprint 6 (Companion Economy) can begin, the following Sprint 5 integrations must land:

- [ ] Wallet → Patron: hook `GiftingService` + `TicketingService` to call `patronService.recordSpend()`
- [ ] FCM notification adapter wired to domain events
- [ ] Room badge widget injected into `LiveRoomScreen`, `EventDetailScreen`, `CreatorProfileScreen`
- [ ] WebSocket typing indicator consumer (debounced, 3s decay)
- [ ] Prisma migration for `PatronProfile`, `CreatorRelationship`, `PatronHistory`, `PatronAchievement`, `PatronMilestone`, `MessageRequest`, `Conversation`, `Message`, `TrustProfile`, `DMPermission` tables
