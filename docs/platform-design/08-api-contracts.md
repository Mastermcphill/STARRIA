# STARRIA — API Contracts (Platform Packages)

Base URL: `https://api.starria.app/api/v1`  
Auth: `Authorization: Bearer <jwt>` (required unless noted)

---

## Stars (`@starria/star-core`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/stars` | Discover stars | optional |
| GET | `/stars/trending` | Trending stars | optional |
| GET | `/stars/live` | Currently live stars | optional |
| GET | `/stars/:id` | Star profile | optional |
| GET | `/stars/by-username/:username` | Profile by username | optional |
| POST | `/stars/onboard` | Become a Star | required |
| PATCH | `/stars/me` | Update Star profile | Star only |
| POST | `/stars/:id/follow` | Follow a Star | required |
| DELETE | `/stars/:id/follow` | Unfollow | required |
| GET | `/stars/:id/followers` | Follower list | optional |
| POST | `/stars/me/verification` | Submit verification docs | Star only |

### GET /stars?category=music&tier=VERIFIED&query=aria&limit=20&cursor=...
```json
{
  "items": [
    {
      "id": "uuid",
      "displayName": "Aria M.",
      "username": "ariam",
      "avatarUrl": "https://...",
      "category": "music",
      "tier": "VERIFIED",
      "isVerified": true,
      "subscriberCount": 8420,
      "isLive": false,
      "discoveryScore": 0.87
    }
  ],
  "nextCursor": "base64...",
  "hasMore": true
}
```

### POST /stars/onboard
```json
// Request
{ "displayName": "Aria M.", "username": "ariam", "bio": "Jazz & soul.", "category": "music", "tags": ["jazz","soul"] }
// Response 201
{ "starId": "uuid", "tier": "RISING", "status": "ACTIVE" }
```

---

## Supporters (`@starria/support-core`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/supporters/me` | Supporter profile | required |
| PATCH | `/supporters/me` | Update profile | required |
| GET | `/supporters/me/subscriptions` | My subscriptions | required |
| POST | `/supporters/me/subscriptions` | Subscribe to a Star | required |
| DELETE | `/supporters/me/subscriptions/:starId` | Cancel subscription | required |
| GET | `/supporters/me/gifting-summary/:starId` | My gifts to a Star | required |
| GET | `/stars/:id/top-supporters` | Leaderboard for a Star | optional |

### POST /supporters/me/subscriptions
```json
// Request
{ "starId": "uuid", "tier": "BASIC", "durationDays": 30, "idempotencyKey": "client-uuid" }
// Response 201
{
  "subscriptionId": "uuid",
  "starId": "uuid",
  "tier": "BASIC",
  "status": "ACTIVE",
  "endsAt": "2026-07-16T...",
  "deduped": false
}
```

---

## Taps (`@starria/tap-core`)

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/taps/coin` | Send a Coin Tap | required |
| POST | `/taps/fiat` | Send a Fiat Tap | required |
| GET | `/taps` | Tap history (sent or received) | required |
| GET | `/taps/:id` | Single Tap | required |
| GET | `/taps/leaderboard` | Supporter leaderboard for a Star | optional |
| GET | `/taps/context-summary` | Total taps on an event/arena | optional |

### POST /taps/coin
```json
// Request
{
  "receiverId": "star-uuid",
  "coins": 100,
  "contextType": "event",
  "contextId": "event-uuid",
  "message": "Amazing performance! 🎷",
  "giftType": "star_burst",
  "idempotencyKey": "client-uuid"
}
// Response 201
{
  "tapId": "uuid",
  "status": "COMPLETED",
  "reference": "coin_gift:...",
  "type": "COIN_GIFT",
  "grossAmount": 100,
  "platformFee": 40,
  "creatorNet": 60,
  "senderBalanceAfter": 900,
  "deduped": false
}
```

### POST /taps/fiat
```json
// Request
{
  "receiverId": "star-uuid",
  "amount": 50000,      // 500.00 NGN in kobo
  "currency": "NGN",
  "contextType": "arena",
  "contextId": "arena-uuid",
  "idempotencyKey": "client-uuid"
}
// Response 201
{ "tapId": "uuid", "status": "COMPLETED", "grossAmount": 50000, "platformFee": 20000, "creatorNet": 30000 }
```

### GET /taps/leaderboard?starId=uuid&period=weekly&limit=10
```json
{
  "period": "weekly",
  "items": [
    { "rank": 1, "supporterId": "uuid", "displayName": "TopFan", "avatarUrl": "...", "totalCoins": 5000, "totalFiat": 0, "tapCount": 42 }
  ]
}
```

---

## Events (`@starria/event-core`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/events` | List events | optional |
| GET | `/events/:id` | Event detail | optional |
| POST | `/events` | Create event | Star only |
| PATCH | `/events/:id` | Update event | Star only |
| POST | `/events/:id/start` | Go live | Star only |
| POST | `/events/:id/end` | End event | Star only |
| DELETE | `/events/:id` | Cancel event | Star only |
| GET | `/events/:id/replay` | Get replay | optional |
| POST | `/events/:id/replay` | Publish replay | Star only |
| POST | `/events/:id/join` | Join (watch session) | required |
| POST | `/events/:id/leave` | Leave | required |
| GET | `/events/:id/viewers` | Active viewer count | optional |

### POST /events
```json
// Request
{
  "title": "Midnight Jazz Session",
  "description": "Live improv — bring requests.",
  "type": "LIVE_STREAM",
  "visibility": "PUBLIC",
  "category": "music",
  "tags": ["jazz", "live"],
  "scheduledAt": "2026-06-20T22:00:00Z",
  "arenaId": "arena-uuid"
}
// Response 201
{ "eventId": "uuid", "status": "SCHEDULED", "scheduledAt": "2026-06-20T22:00:00Z" }
```

### POST /events/:id/start → 200 `{ "status": "LIVE", "startedAt": "..." }`
### POST /events/:id/end  → 200 `{ "status": "ENDED", "durationSeconds": 3600 }`

### GET /events/:id/replay
```json
{ "playbackUrl": "https://cdn.starria.app/replays/...", "durationSeconds": 3600, "thumbnailUrl": "..." }
```

---

## Arenas (`@starria/arena-core`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/arenas` | List arenas | optional |
| GET | `/arenas/:id` | Arena detail | optional |
| POST | `/arenas` | Create arena | Star only |
| PATCH | `/arenas/:id` | Update arena | Star only |
| DELETE | `/arenas/:id` | Close arena | Star only |
| POST | `/arenas/:id/join` | Join (get LiveKit token) | required |
| POST | `/arenas/:id/leave` | Leave | required |
| GET | `/arenas/:id/participants` | Participant list | optional |
| POST | `/arenas/:id/moderate` | Moderation action | Star only |

### POST /arenas/:id/join
```json
// Response 200
{
  "provider": "livekit",
  "roomName": "arena-uuid",
  "token": "eyJhb...",
  "uid": "user-uuid",
  "expiresAt": "2026-06-16T23:00:00Z",
  "serverUrl": "wss://livekit.starria.app",
  "role": "viewer"
}
```

### POST /arenas/:id/moderate
```json
// Request
{ "targetUserId": "uuid", "action": "ban", "reason": "Repeated harassment" }
// Response 200
{ "id": "record-uuid", "action": "ban", "targetUserId": "uuid", "createdAt": "..." }
```

### Access denied responses
```json
// 403 subscribers_only arena
{ "statusCode": 403, "code": "NOT_SUBSCRIBED", "message": "Subscribe to Aria M. to join this arena" }

// 403 banned
{ "statusCode": 403, "code": "BANNED", "message": "You have been removed from this arena" }

// 409 at capacity
{ "statusCode": 409, "code": "ARENA_FULL", "message": "Arena is at maximum capacity" }
```

---

## Pagination envelope (all list endpoints)

```json
{
  "items": [...],
  "nextCursor": "base64url or null",
  "hasMore": true,
  "total": 1240       // optional — omitted when expensive to compute
}
```
