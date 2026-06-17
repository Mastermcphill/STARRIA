# @starria/event-core

## Purpose

Manages the **Event** lifecycle in STARRIA: creation, scheduling, going live,
ending, replay publishing, and viewer watch-session tracking.

---

## Domain concepts

| Concept | Description |
|---|---|
| `EventRecord` | Persisted event with all lifecycle timestamps and viewer metrics |
| `EventType` | `LIVE_STREAM / REPLAY / CLASS / SHOW` |
| `EventStatus` | State machine: `DRAFT → SCHEDULED → LIVE → ENDED` or `CANCELLED` |
| `EventVisibility` | `public / subscribers_only / private` |
| `EventReplay` | VOD produced after a LIVE_STREAM ends |
| `EventWatchSession` | Per-user session tracking (join/leave/position) |

---

## State machine

```
             ┌──────────────┐
             │              │  cancel
  create ──▶ │    DRAFT     │ ─────────────────────────────▶ CANCELLED (terminal)
             │              │
             └──────┬───────┘
                    │ schedule (scheduledAt set)
                    ▼
             ┌──────────────┐
             │  SCHEDULED   │ ─────────────────────────────▶ CANCELLED (terminal)
             └──────┬───────┘
                    │ start()
                    ▼
             ┌──────────────┐
             │     LIVE     │
             └──────┬───────┘
                    │ end()
                    ▼
             ┌──────────────┐
             │    ENDED     │ ─── publishReplay() ──▶ EventReplay created
             └──────────────┘    (terminal)
```

`isValidEventTransition(from, to)` is a pure function exported from `types.ts`.

---

## Service interface

```typescript
class EventService {
  // CRUD
  getById(eventId)
  create(input)    // auto-transitions to SCHEDULED if scheduledAt set
  update(eventId, input)
  list(filter)

  // Lifecycle
  start(input)     // DRAFT/SCHEDULED → LIVE
  end(input)       // LIVE → ENDED
  cancel(eventId, starId)

  // Replay
  getReplay(eventId)
  publishReplay(input)

  // Watch sessions
  joinEvent(input)   // creates WatchSession, updates viewerCount + peakViewers
  leaveEvent(input)  // closes WatchSession, fires analytics
  getActiveViewerCount(eventId)

  // Tap metrics hook (called by NestJS module, not by tap-core directly)
  recordTapOnEvent(eventId, coins)
}
```

---

## Side-effect pipeline

```
start(eventId)
  ├── events.transitionStatus(LIVE)
  ├── analytics.trackEventStarted(...)
  ├── notifications.onEventLive(...)   → followers/subscribers get push
  └── searchIndex.index(event)         → event appears in discovery

joinEvent(userId, eventId)
  ├── watchSessions.join(...)
  ├── events.incrementViewerCount(+1)
  ├── events.updatePeakViewers(count)
  └── analytics.trackViewerJoined(...)

end(eventId)
  ├── events.transitionStatus(ENDED, { durationSeconds })
  ├── analytics.trackEventEnded(peakViewers, duration)
  ├── notifications.onEventEnded(...)
  └── searchIndex.index(event)
```

---

## Port interfaces

| Port | Implemented by | Used for |
|---|---|---|
| `EventStorePort` | Prisma adapter | Event CRUD, status transitions, metric increments |
| `EventReplayPort` | Prisma adapter | Replay record lifecycle |
| `EventWatchSessionPort` | Prisma adapter | Per-user join/leave sessions |
| `EventAnalyticsPort` | analytics-core wrapper | `AnalyticsService.track()` on lifecycle events |
| `EventNotificationPort` | notification-core wrapper | Going live, replay ready, schedule reminder |
| `EventSearchIndexPort` | search-core HTTP adapter | Index/remove from ContentIndex |

---

## New Prisma models required

Extensions to the existing `Event` model plus new models:

```prisma
// Additions to existing Event model:
//   visibility    EventVisibility @default(PUBLIC)
//   durationSeconds Int?
//   peakViewerCount Int @default(0)
//   totalViewerCount Int @default(0)
//   tapCount        Int @default(0)
//   totalCoinsReceived Int @default(0)

enum EventVisibility { PUBLIC SUBSCRIBERS_ONLY PRIVATE }

model EventReplay {
  id            String   @id @default(uuid())
  eventId       String   @unique
  mediaUploadId String
  playbackUrl   String
  durationSeconds Int
  thumbnailUrl  String?
  isReady       Boolean  @default(false)
  createdAt     DateTime @default(now())

  event Event @relation(fields: [eventId], references: [id])
}

model EventWatchSession {
  id                  String    @id @default(uuid())
  eventId             String
  userId              String
  joinedAt            DateTime  @default(now())
  leftAt              DateTime?
  lastPositionSeconds Int?

  event Event @relation(fields: [eventId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([eventId])
  @@index([userId])
}
```

---

## Extracted package relationships

| Package | How used |
|---|---|
| `@starria/analytics-core` | `EventAnalyticsPort` wraps `AnalyticsService.track()` |
| `@starria/notification-core` | `EventNotificationPort` wraps `NotificationService.send()` |
| `video-core` (Python) | Replay `playbackUrl` and `mediaUploadId` come from video-core upload/transcoding pipeline |
| `search-core` (Python) | `EventSearchIndexPort` calls `POST /search/index` on the search-core service |
