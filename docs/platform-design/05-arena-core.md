# @starria/arena-core

## Purpose

An **Arena** is a persistent LiveKit room owned by a Star. Stars open Arenas to
host live interactions; Supporters join to watch, chat, and send Taps.

`arena-core` owns: Arena lifecycle, participant management, access control
decisions, and in-room moderation. It delegates real-time operations to `LiveKitPort`.

---

## Domain concepts

| Concept | Description |
|---|---|
| `ArenaRecord` | Persistent room metadata — name, access mode, participant counts |
| `ArenaStatus` | `ACTIVE / CLOSED / ARCHIVED` |
| `ArenaAccessMode` | `public / subscribers_only / invite_only` |
| `ArenaParticipant` | Join record for one user session in one Arena |
| `ParticipantRole` | `host / speaker / viewer` |
| `ArenaJoinToken` | LiveKit JWT returned to the client on join |
| `ArenaModerationRecord` | Audit log of mute/remove/ban/promote actions |

---

## Service interface

```typescript
class ArenaService {
  // CRUD
  getById(arenaId)
  create(input, displayName)  // → ensureRoom in LiveKit, persist ArenaRecord
  update(arenaId, input)
  close(arenaId, starId)       // → closeRoom in LiveKit, status → CLOSED
  list(filter)

  // Join / Leave
  join(input, displayName)     // access check → generateToken → persist participant
  leave(input)                 // close participant session → analytics
  getParticipants(arenaId)

  // Moderation
  moderate(input)              // mute | remove | ban | promote | demote
}
```

---

## Access control decision (pure function)

```typescript
resolveArenaAccess(arena, ctx, bannedUserIds) → ArenaAccessDecision

Decision matrix:
  arena.status !== ACTIVE  → { allowed: false, reason: 'arena_closed' }
  userId in bannedIds      → { allowed: false, reason: 'banned' }
  ctx.isOwner              → { allowed: true,  role: 'host' }
  currentCount ≥ max       → { allowed: false, reason: 'participant_limit_reached' }
  mode: subscribers_only
    && !hasSubscription    → { allowed: false, reason: 'not_subscribed' }
  mode: invite_only
    && !isInvited          → { allowed: false, reason: 'not_invited' }
  else                     → { allowed: true,  role: 'viewer' }
```

`resolveArenaAccess` is a pure function exported from `types.ts`.
`hasSubscription` is fetched via `ArenaSubscriptionCheckPort` (implemented by support-core).

---

## LiveKit token flow

```
Supporter App
  │  POST /arenas/:id/token
  ▼
ArenaService.join(input, displayName)
  ├── arenas.findById(arenaId)
  ├── moderation.listBanned(arenaId)
  ├── subscriptionCheck.hasActiveSubscription(userId, starId)
  ├── resolveArenaAccess(arena, ctx, bannedIds)
  │     → { allowed: true, role: 'viewer' }
  ├── participants.join({ id, arenaId, userId, role: 'viewer', joinedAt })
  ├── liveKit.generateToken({ roomName, userId, displayName, role })
  │     → { token, expiresAt, serverUrl }
  └── return { participant, token: ArenaJoinToken }

Client receives token → connects to LiveKit room directly
```

---

## Moderation cascade

```
moderate({ action: 'ban', targetUserId })
  ├── moderation.record(...)            → ArenaModerationRecord
  ├── liveKit.removeParticipant(...)    → user disconnected immediately
  ├── participants.updateStatus('banned')
  ├── notifications.onUserRemoved(...)
  └── analytics.trackModerationAction(...)
```

---

## Port interfaces

| Port | Implemented by | Used for |
|---|---|---|
| `ArenaStorePort` | Prisma adapter | Arena CRUD, participant counts |
| `ArenaParticipantPort` | Prisma adapter | Join/leave/role records |
| `ArenaModerationPort` | Prisma + Redis adapter | Ban list, moderation log |
| `LiveKitPort` | LiveKit Server SDK wrapper | Room management, token generation |
| `ArenaSubscriptionCheckPort` | support-core `SupporterService.hasActiveSubscription()` | Access control for `subscribers_only` arenas |
| `ArenaAnalyticsPort` | analytics-core wrapper | Participant and moderation tracking |
| `ArenaNotificationPort` | notification-core wrapper | Arena open/close, user removed |

---

## New Prisma models required

```prisma
// Additions to existing Arena model:
//   accessMode    ArenaAccessMode @default(PUBLIC)
//   currentParticipantCount Int @default(0)
//   totalParticipantCount   Int @default(0)

enum ArenaAccessMode { PUBLIC SUBSCRIBERS_ONLY INVITE_ONLY }

model ArenaParticipant {
  id          String            @id @default(uuid())
  arenaId     String
  userId      String
  role        ParticipantRole   @default(VIEWER)
  status      ParticipantStatus @default(ACTIVE)
  joinedAt    DateTime          @default(now())
  leftAt      DateTime?
  muteReason  String?

  arena Arena @relation(fields: [arenaId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([arenaId, status])
  @@index([userId])
}

enum ParticipantRole   { HOST SPEAKER VIEWER }
enum ParticipantStatus { ACTIVE REMOVED BANNED LEFT }

model ArenaModerationRecord {
  id            String   @id @default(uuid())
  arenaId       String
  actorId       String
  targetUserId  String
  action        String   // mute | unmute | remove | ban | promote | demote
  reason        String?
  expiresAt     DateTime?
  createdAt     DateTime @default(now())

  arena Arena @relation(fields: [arenaId], references: [id])

  @@index([arenaId])
  @@index([targetUserId])
}
```

---

## Extracted package relationships

| Package | How used |
|---|---|
| `@starria/moderation-core` | Arena-level moderation records map to `ModerationReportRecord` for admin-level review; `ArenaModerationPort` handles room-level actions independently |
| `@starria/notification-core` | `ArenaNotificationPort` wraps `NotificationService.send()` |
| `@starria/analytics-core` | `ArenaAnalyticsPort` wraps `AnalyticsService.track()` |
| `support-core` | `ArenaSubscriptionCheckPort` is implemented by `SupporterService.hasActiveSubscription()` — injected at the NestJS module level |
| `event-core` | Events reference an `arenaId`; when an Event goes LIVE, the Arena hosts it — but `arena-core` has no dep on `event-core`; the coupling is through shared IDs resolved at the app layer |
