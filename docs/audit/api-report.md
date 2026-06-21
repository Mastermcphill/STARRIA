# STARRIA API Report
**Audit Date:** 2026-06-18

---

## Module Registration

All modules are registered in `AppModule`. Total: **29 modules** (+ core infrastructure).

```
Auth, Users, Stars, Wallet, CoinPurchase, Gifting, Supporters, Taps,
Events, Arenas, AiCreator, Video, Watch, Discovery, ContentTap, Search,
Live, Ticketing, Poster, Prestige, Campaigns, Patrons, Messaging, Trust,
Presence, Companion, SessionEngine, Replay, CreatorOs
```

✓ No module registered without being imported. No import without registration.

---

## Global Infrastructure

| Component          | Status | Notes                                          |
|--------------------|--------|------------------------------------------------|
| ValidationPipe     | ✓ wired | `useGlobalPipes` in `main.ts`, whitelist+transform |
| Swagger            | ✓ wired | `/docs` endpoint, Bearer auth configured       |
| API prefix         | ✓ wired | `api/v1` (configurable via env)                |
| CORS               | ⚠ open  | `enableCors()` with no origin whitelist — **P2** |
| Throttler          | ✓ wired | 100 req/60s global — no per-route overrides    |
| Redis              | ✓ wired | `REDIS_CLIENT` token globally provided         |
| EventBus           | ⚠ in-memory | `InMemoryEventBus` — not durable — **P1**  |
| JWT Auth           | ✓ wired | passport-jwt, `JwtStrategy` registered         |

---

## Endpoint Inventory & Auth Coverage

| Module           | Endpoints | Auth Guard        | DTO Validation | Swagger     |
|------------------|-----------|-------------------|----------------|-------------|
| auth             | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| users            | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| stars            | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| taps             | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| ai-creator       | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| events           | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| arenas (old)     | 0 (stub)  | —                 | —              | @ApiTags ✓  |
| battles (Sprint 8)| 15       | **None** ⚠        | Partial        | @ApiTags ✓  |
| wallet           | 4         | ✓ JWT             | Partial        | ✓           |
| gifting          | 3         | ✓ JWT             | Partial        | ✓           |
| supporters       | 10        | ✓ JWT             | Partial        | ✓           |
| coin-purchase    | 3         | ✓ JWT             | ✓ class-validator | ✓        |
| content-tap      | 3         | ✓ JWT             | Partial        | ✓           |
| video            | 2         | ✓ JWT (partial)   | Partial        | ✓           |
| watch            | 2         | ✓ JWT             | Partial        | ✓           |
| discovery        | 6         | None (public OK)  | Partial        | ✓           |
| search           | 1         | None (public OK)  | None           | ✓           |
| live             | 4         | ✓ JWT             | Partial        | ✓           |
| ticketing        | 4         | ✓ JWT             | Partial        | ✓           |
| poster           | 2         | ✓ JWT             | Partial        | ✓           |
| prestige         | 7         | None (read-only)  | None           | ✓           |
| campaigns        | 7         | None              | None           | ✓           |
| patrons          | 6         | None ⚠            | None           | **No @ApiTags** |
| messaging        | 10        | None ⚠            | None           | **No @ApiTags** |
| trust            | 6         | None ⚠            | None           | **No @ApiTags** |
| presence         | 3         | None ⚠            | None           | **No @ApiTags** |
| companion        | 22        | None ⚠            | None           | **No @ApiTags** |
| session-engine   | 15        | None ⚠            | None           | ✓           |
| replay           | 4         | None ⚠            | None           | ✓           |
| creator-os       | 12        | None              | None           | ✓           |

**Total endpoints: ~152 across all modules.**

---

## DTO Validation Status

`ValidationPipe` with `whitelist: true` is globally enabled. However, the 
`class-validator` decorators (`@IsString`, `@IsNumber`, `@IsUUID`, etc.) are only 
present on a handful of DTOs:

### DTOs WITH class-validator decorators
- `coin-purchase/dto/purchase-coins.dto.ts` — `@IsIn`, `@IsNumber` ✓
- Some sprint 3–4 DTOs have basic validation

### DTOs WITHOUT class-validator (accept any input)
- All battle DTOs (`CreateBattleDto`, `CastVoteDto`, etc.) — strings passed directly to Prisma
- All companion DTOs
- All messaging DTOs
- All session-engine DTOs

**Impact:** Without `@IsString()`, `@IsUUID()` etc., the `ValidationPipe` 
whitelists properties but cannot reject malformed/missing values. A caller can 
send `{ title: null }` to `POST /arenas` and it will reach Prisma, which throws 
an unhandled exception (500 instead of 400).

**Severity: P2** — not a crash blocker in development, but a production quality issue.

---

## Auth Coverage Gaps (P1)

Controllers with no `@UseGuards` that handle sensitive data:

| Controller        | Sensitive operations             |
|-------------------|----------------------------------|
| patrons           | Patron tier upgrades, charges    |
| messaging         | Send/read messages               |
| trust             | Flag users, modify trust scores  |
| presence          | Set online status                |
| companion         | Book sessions, create profiles   |
| battles           | Vote, join, settle (prize money) |
| session-engine    | Create/end rooms                 |
| replay            | Download recordings              |
| campaigns         | Spend coins on campaigns         |

**Any of these can be called by unauthenticated users.**

---

## Core Stub Modules (P1)

These modules are fully registered but have zero endpoints:

| Module     | Expected functionality                         |
|------------|------------------------------------------------|
| auth       | POST /auth/register, /auth/login, /auth/refresh |
| users      | GET/PUT /users/:id, profile management         |
| stars      | GET /stars, GET /stars/:id, creator profiles   |
| taps       | POST /taps (send a tap/payment)                |
| events     | GET /events, GET /events/:id, create events    |
| ai-creator | POST /ai-creator/generate (AI content)         |

Without `auth`, the entire platform has no login flow — no user can obtain a JWT.

---

## Route Conflicts

| Conflict | Description |
|----------|-------------|
| `/arenas/leaderboard/global` vs `/arenas/:id` | `leaderboard` is treated as `:id` param — **route ordering bug** in battles.controller.ts. Static segments must be declared before parameterised routes in NestJS. |
| `/arenas/seasons` vs `/arenas/:id` | Same issue — `seasons` captures as `:id` |
| `/arenas/houses` vs `/arenas/:id` | Same issue |

**Severity: P1** — these endpoints will return 404/wrong responses in current order.
The fix is to move static routes (`/leaderboard/global`, `/seasons`, `/houses`) 
to a separate controller or reorder declarations.
