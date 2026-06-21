# STARRIA Security Report
**Audit Date:** 2026-06-18

---

## Authentication Architecture

### JWT Strategy

`apps/api/src/modules/auth/jwt.strategy.ts` implements `PassportStrategy(Strategy)`.
The strategy reads `JWT_SECRET` from `ConfigService` and validates the bearer token
on every guarded request.

**Correct patterns:**
- `@UseGuards(JwtAuthGuard)` applied per-controller where used
- `@ApiBearerAuth()` on protected controllers
- Tokens validated against secret on every request (stateless, no session)

**Incorrect patterns:**
- Auth endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`) are not 
  implemented — no user can obtain a token
- `JWT_SECRET` defaults to `"change-me-in-production"` with no env check at startup

---

## Auth Guard Coverage

### Guarded Controllers (correct)

| Controller      | Guard            |
|-----------------|------------------|
| wallet          | JwtAuthGuard     |
| gifting         | JwtAuthGuard     |
| supporters      | JwtAuthGuard     |
| coin-purchase   | JwtAuthGuard     |
| content-tap     | JwtAuthGuard     |
| video           | JwtAuthGuard (partial) |
| watch           | JwtAuthGuard     |
| live            | JwtAuthGuard     |
| ticketing       | JwtAuthGuard     |
| poster          | JwtAuthGuard     |

### Unguarded Controllers Handling Sensitive Data (P1)

| Controller      | Sensitive Operations                      |
|-----------------|-------------------------------------------|
| patrons         | Tier upgrades, recurring charges          |
| messaging       | Send/read private messages                |
| trust           | Modify trust scores, flag users           |
| presence        | Set online/offline status                 |
| companion       | Book paid sessions, create profiles       |
| battles         | Cast votes (weighted prize distribution)  |
| session-engine  | Create/end rooms, manage participants     |
| replay          | Download/access session recordings        |
| campaigns       | Spend coins on promotion campaigns        |

Any of the above can be called without a JWT by any unauthenticated HTTP client.

---

## Injection Vulnerabilities

### SQL Injection

**Result: Not exploitable via Prisma ORM.**

All database queries use Prisma's type-safe query builder:

```typescript
await this.prisma.battle.findUnique({ where: { id: dto.battleId } });
```

Prisma parameterises all inputs — raw SQL is never constructed from user input
across any module. No SQL injection surface exists in the current codebase.

### NoSQL / Redis Injection

Redis is used for distributed state (presence, leaderboard caching). Keys are
constructed as template literals:

```typescript
`presence:${userId}`
`leaderboard:${seasonId}`
```

If `userId` or `seasonId` contain Redis wildcard characters (`*`, `?`, `[`) they
could match unintended keys in SCAN or KEYS operations. No such operations are
called in the current codebase — only GET/SET/ZADD/ZRANGE — so this is not 
currently exploitable.

### Command Injection

No `exec`, `spawn`, or `child_process` calls. No shell execution anywhere in the
API source. Not applicable.

### XSS

The API is a JSON REST service with no HTML rendering. XSS is not applicable to 
the API layer. The Flutter mobile client renders API data; all screen content is
rendered through Flutter's widget system, which does not interpret HTML — XSS is
not applicable to Flutter either.

---

## Input Validation

### Global ValidationPipe

`main.ts` wires `ValidationPipe({ whitelist: true, transform: true })` globally.
With `whitelist: true`, any property not declared in the DTO class is stripped
before the handler runs.

**The problem:** `whitelist: true` strips undeclared properties but cannot reject
missing or malformed values without `class-validator` decorators. A DTO with no
`@IsString()` / `@IsUUID()` decorators passes validation entirely:

```typescript
// No decorators — accepts any shape
export class CastVoteDto {
  battleId: string;   // accepts null, 42, {}, [] — all pass
  voterId: string;
  candidateId: string;
}
```

### DTOs Without Validation Decorators

The following DTOs pass any input directly to Prisma:

| DTO File                                  | Properties | Validators |
|-------------------------------------------|------------|------------|
| battles/dto/battle.dto.ts (all 5 DTOs)    | 15         | 0          |
| companion/dto/*.ts                        | ~20        | 0          |
| messaging/dto/*.ts                        | ~15        | 0          |
| session-engine/dto/*.ts                   | ~12        | 0          |
| patrons/dto/*.ts                          | ~8         | 0          |
| trust/dto/*.ts                            | ~6         | 0          |
| presence/dto/*.ts                         | ~4         | 0          |

**Impact:** `{ battleId: null }` reaches Prisma, which throws an unhandled 
`PrismaClientValidationError`. NestJS returns a 500 instead of a 400. In repeated
calls, this pattern could mask logic errors or be used as an oracle for schema
discovery.

**Severity: P2.**

### No `ParseUUIDPipe` on Route Parameters

`@Param('id')` on every controller accepts any string. A request to 
`GET /battles/not-a-uuid` passes through to Prisma:

```typescript
await this.prisma.battle.findUnique({ where: { id: 'not-a-uuid' } });
```

Prisma throws `PrismaClientValidationError` (invalid UUID format) — unhandled 
500. The correct pattern:

```typescript
@Param('id', ParseUUIDPipe) id: string
```

**Severity: P2.**

---

## Secrets Management

### Hardcoded Defaults

| Secret           | Default Value                    | Risk                              |
|------------------|----------------------------------|-----------------------------------|
| `JWT_SECRET`     | `"change-me-in-production"`      | Tokens forgeable if not rotated   |
| All payment keys | `""` (blank)                     | Payments silently stub in prod    |
| `FCM_SERVER_KEY` | `""` (blank)                     | Push notifications silent         |
| `LIVEKIT_API_KEY`| `""` (blank)                     | All rooms return stub tokens      |

**No secrets are hardcoded in source files.** All sensitive values are read via
`ConfigService.get()`. The risk is default values surviving into production 
deployments.

**No startup validation exists** — the application boots successfully with 
`JWT_SECRET="change-me-in-production"` and no log warning is emitted.

---

## Rate Limiting

### Global Throttler

`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` — 100 requests per 60s
per IP across all routes.

**Gaps:**

| Endpoint type          | Current limit | Recommended |
|------------------------|---------------|-------------|
| Auth (`/auth/login`)   | 100/60s       | 5/60s       |
| Coin purchase          | 100/60s       | 10/60s      |
| Vote casting           | 100/60s       | 20/60s      |
| Public discovery       | 100/60s       | Higher or unlimited OK |

The `/auth/login` endpoint (when implemented) is particularly exposed — 100 
attempts per minute is sufficient for a credential-stuffing or brute-force attack.

**Severity: P2** for `/auth` — no auth endpoints exist yet, so not immediately
exploitable.

---

## CORS Configuration

`app.enableCors()` with no options is equivalent to:

```typescript
app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE' });
```

Any origin (web or mobile) can make credentialed requests to the API. In a 
mobile-first product this is low risk (the primary client is a native app, not
a browser), but any web dashboard, admin panel, or future web app would be 
exposed to cross-origin requests from arbitrary domains.

**Severity: P2** — low urgency for a pure-mobile launch, but must be locked down
before any web client ships.

---

## Business Logic Security

### Self-Vote Guard (Broken)

`battles.controller.ts → castVote()` calls `battlesService.castVote(dto)`. The 
service checks:

```typescript
if (participant.starProfileId === dto.voterId) throw new ForbiddenException();
```

`dto.voterId` is passed by the caller as a free-form string (unauthenticated 
endpoint — no JWT). The check compares a `starProfileId` (UUID) against a caller-
supplied `voterId` that is expected to also be a `starProfileId`. However:

1. No guard enforces that `dto.voterId` is the authenticated user's `starProfileId`
2. The endpoint has no `@UseGuards` — any caller can set `voterId` to any value

An attacker can simply set `voterId` to a different UUID to bypass the self-vote
check entirely.

**Severity: P1.**

---

## Security Findings Summary

| ID    | Finding                                              | Severity |
|-------|------------------------------------------------------|----------|
| S-01  | 9 controllers with sensitive routes have no `@UseGuards` | P1   |
| S-02  | Self-vote check bypassable (no JWT enforces voterId) | P1       |
| S-03  | `JWT_SECRET` defaults to known string, no startup validation | P1 |
| S-04  | No `class-validator` decorators on most DTOs — 500 on bad input | P2 |
| S-05  | No `ParseUUIDPipe` on `@Param` — Prisma errors on invalid UUIDs | P2 |
| S-06  | CORS open to all origins (`enableCors()` no options) | P2       |
| S-07  | No rate limit overrides on auth endpoints            | P2       |
| S-08  | Blank API keys (`FCM`, `OpenAI`, `Anthropic`, `Paystack`) not validated at startup | P2 |
| S-09  | No SQL injection surface (Prisma ORM — informational) | None    |
| S-10  | No hardcoded secrets in source (env-only — informational) | None |
