# STARRIA — API Contracts

Base URL: `https://api.starria.app/api/v1`  
Auth: `Authorization: Bearer <jwt>`

---

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account (email + password) |
| POST | `/auth/login` | Issue JWT pair |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |

### POST /auth/register
```json
// Request
{ "email": "fan@example.com", "username": "superfan", "displayName": "Super Fan", "password": "..." }

// Response 201
{ "accessToken": "...", "refreshToken": "...", "user": { "id": "uuid", "email": "...", "role": "SUPPORTER" } }
```

---

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Current user profile |
| PATCH | `/users/me` | Update display name / avatar |
| GET | `/users/:id` | Public profile |

---

## Stars

| Method | Path | Description |
|---|---|---|
| GET | `/stars` | List stars (paginated, filterable by category/tier) |
| GET | `/stars/:id` | Star public profile |
| POST | `/stars/onboard` | Convert current user to Star |
| PATCH | `/stars/me` | Update Star profile (bio, category, tags) |

### GET /stars?category=music&tier=VERIFIED&cursor=...&limit=20
```json
{
  "items": [
    { "id": "uuid", "displayName": "Aria M.", "tier": "VERIFIED", "category": "music", "avatarUrl": "..." }
  ],
  "nextCursor": "base64...",
  "hasMore": true
}
```

---

## Supporters

| Method | Path | Description |
|---|---|---|
| GET | `/supporters/me` | Current supporter profile |
| GET | `/supporters/me/subscriptions` | Active subscriptions to Stars |
| POST | `/supporters/me/subscriptions/:starId` | Subscribe to a Star |
| DELETE | `/supporters/me/subscriptions/:starId` | Unsubscribe |

---

## Taps (Micropayments / Gifts)

| Method | Path | Description |
|---|---|---|
| POST | `/taps` | Send a tap (coin gift or fiat tip) |
| GET | `/taps/received` | Taps received by current user |
| GET | `/taps/sent` | Taps sent by current user |
| GET | `/taps/:id` | Single tap detail |

### POST /taps
```json
// Request
{
  "receiverId": "star-uuid",
  "type": "COIN_GIFT",
  "coinAmount": 50,
  "message": "Great set!",
  "contextType": "event",
  "contextId": "event-uuid",
  "idempotencyKey": "client-generated-uuid"
}

// Response 201
{
  "id": "tap-uuid",
  "status": "COMPLETED",
  "senderCoinBalance": 950,
  "receiverCoinBalance": 50,
  "platformFee": 20,
  "creatorNet": 30
}
```

---

## Events

| Method | Path | Description |
|---|---|---|
| GET | `/events` | List upcoming/live events |
| GET | `/events/:id` | Event detail |
| POST | `/events` | Create event (Stars only) |
| PATCH | `/events/:id` | Update event |
| POST | `/events/:id/start` | Go live |
| POST | `/events/:id/end` | End event |
| GET | `/events/:id/watch-token` | Get LiveKit token to watch |

---

## Arenas

| Method | Path | Description |
|---|---|---|
| GET | `/arenas` | List arenas |
| POST | `/arenas` | Create arena (Stars only) |
| GET | `/arenas/:id` | Arena detail |
| POST | `/arenas/:id/token` | Get LiveKit join token |
| DELETE | `/arenas/:id` | Close arena |

### POST /arenas/:id/token
```json
// Response 200
{
  "provider": "livekit",
  "roomName": "arena-uuid",
  "token": "livekit-jwt",
  "uid": "user-uuid",
  "expiresAt": "2026-06-16T22:00:00Z",
  "serverUrl": "wss://livekit.starria.app"
}
```

---

## AI Creator Tools

| Method | Path | Description |
|---|---|---|
| POST | `/ai-creator/generate` | Generate content suggestion |
| GET | `/ai-creator/history` | Past generations |

### POST /ai-creator/generate
```json
// Request
{
  "type": "caption",   // caption | title | hashtags | script | thumbnail_prompt
  "prompt": "I just released a new jazz cover of 'Autumn Leaves'"
}

// Response 201
{
  "id": "gen-uuid",
  "type": "caption",
  "result": "🍂 Autumn Leaves reimagined — drop your instruments, pick up your feelings. Link in bio 🎷",
  "tokensUsed": 87
}
```

---

## Feed

| Method | Path | Description |
|---|---|---|
| GET | `/feed` | Personalised For-You feed |
| POST | `/feed/engagement` | Report engagement action |

### GET /feed?cursor=...&limit=20
```json
{
  "items": [
    {
      "id": "event-uuid",
      "type": "event",
      "title": "Midnight Jazz Session",
      "starName": "Aria M.",
      "thumbnailUrl": "...",
      "isLive": true,
      "viewerCount": 432
    }
  ],
  "nextCursor": "base64...",
  "hasMore": true
}
```

---

## Error Format

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Insufficient coin balance",
  "code": "INSUFFICIENT_BALANCE"
}
```
