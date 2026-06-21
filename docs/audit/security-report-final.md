# STARRIA Security Report — Final (Sprint 9)
**Date:** 2026-06-18
**Track:** C — Security Hardening

This supersedes the audit `security-report.md`. It records what was fixed in
Sprint 9 and what residual items remain.

---

## Findings Resolution Matrix

| ID    | Finding                                              | Audit | Sprint 9 |
|-------|------------------------------------------------------|-------|----------|
| S-01  | 9+ controllers unguarded                             | P1    | ✅ Fixed — global guard |
| S-02  | Self-vote bypass (client-supplied voterId)           | P1    | ✅ Fixed — server-derived |
| S-03  | `JWT_SECRET` default, no validation                  | P1    | ✅ Fixed — boot guard |
| S-04  | No class-validator on most DTOs                       | P2    | ◑ Partial — auth + battle DTOs done |
| S-05  | No `ParseUUIDPipe` on params                          | P2    | ◑ Partial — UUID validators on battle DTO bodies |
| S-06  | CORS open to all origins                              | P2    | ✅ Fixed — allowlist |
| S-07  | No rate limit on auth endpoints                       | P2    | ✅ Fixed — 5/min on auth |
| S-08  | Blank API keys not validated                          | P2    | ✅ Fixed (JWT/DB/Redis); keys warned |
| P0-01 | Auth endpoints unimplemented                          | P0    | ✅ Fixed — register/login/refresh |

---

## 1. Secure-by-default Authentication (S-01) — FIXED

**Before:** Only 10 controllers carried `@UseGuards(AuthGuard('jwt'))` inline;
~19 controllers (companion, messaging, trust, presence, patrons, battles,
session-engine, replay, campaigns, …) had **no guard at all** — every endpoint
was publicly callable.

**After:** A global `JwtAuthGuard` is registered via `APP_GUARD` in `AppModule`,
so **every route requires a valid JWT by default**. Intentionally-public routes
opt out with a new `@Public()` decorator:

- `auth` (register/login/refresh), `health`, `discovery`, `search`, `stars`
  (prestige read-only) are marked `@Public()`.
- The payment webhook (`POST /coins/webhook/paystack`) is `@Public()` but
  HMAC-verified.

Files: `modules/auth/jwt-auth.guard.ts`, `modules/auth/public.decorator.ts`,
`app.module.ts`.

> This single change closes the entire unguarded-controller class of findings at
> the framework level rather than controller-by-controller.

## 2. Auth Endpoints (P0-01) — IMPLEMENTED

`AuthService` + `AuthController` now implement:

- `POST /auth/register` — bcrypt (cost 12) hash, unique email/username check,
  returns access + refresh tokens.
- `POST /auth/login` — constant-work credential check, `UnauthorizedException`
  on failure (no user-enumeration distinction).
- `POST /auth/refresh` — verifies a dedicated refresh token (separate secret,
  `typ: 'refresh'` claim) and re-issues.
- `GET /auth/me` — guarded; returns the JWT subject.

All auth routes carry a tightened rate limit (`@Throttle 5–10/min`).

## 3. Self-Vote / Vote-Spoofing Bypass (S-02) — FIXED

**Before:** `castVote` trusted a client-supplied `voterId`, and the self-vote
guard compared a `userId` against a `starProfileId` (never equal) — so the guard
never fired and any user could vote as anyone.

**After:**
- `voterId` is taken from `req.user.userId` server-side; the body value is
  ignored (`battles.controller.ts`).
- The self-vote check loads the target participant's owning user
  (`participant.starProfile.userId`) and compares against the authenticated
  voter (`battles.service.ts`).
- The Flutter client no longer sends a voter id at all.

## 4. JWT Secret + Config Validation (S-03, S-08) — FIXED

`main.ts` `validateProductionConfig()` throws on boot in production if
`JWT_SECRET` is unset, equals the placeholder, or is <32 chars; and if
`DATABASE_URL`/`REDIS_URL` are missing. Missing `CORS_ORIGINS` is warned.

## 5. CORS Lockdown (S-06) — FIXED

`enableCors()` (all origins) replaced with an allowlist read from
`CORS_ORIGINS` (comma-separated). In production an empty list = no cross-origin
access; in development all origins are allowed for convenience.

## 6. Auth Rate Limiting (S-07) — FIXED

Global throttle stays 100/60s; `auth` routes drop to 5/min (login/register) and
10/min (refresh) via `@Throttle`, plus `ThrottlerGuard` registered as a second
global `APP_GUARD`.

## 7. DTO Validation (S-04, S-05) — PARTIAL

- `auth` DTOs: full `class-validator` (`@IsEmail`, `@MinLength`, `@Matches`).
- `battle` DTOs: `@IsUUID`, `@IsIn`, `@IsInt`, `@Min/@Max`, `@IsDateString`.
- **Residual:** companion / messaging / session-engine / patron / trust /
  presence DTOs still lack decorators. `forbidNonWhitelisted` is intentionally
  **off** globally until they are decorated (turning it on now would reject all
  fields of decorator-less DTOs). Tracked as remaining P2.

---

## Injection / Secrets (unchanged, informational)

- **SQL injection:** none — all queries via Prisma parameterised builder.
- **Hardcoded secrets:** none in source — all via `ConfigService`.
- **Webhook security:** Paystack webhook verified with HMAC-SHA512
  (`timingSafeEqual`) over the raw request body.

---

## Residual Security Work (post-Sprint 9)

| Item | Severity | Note |
|------|----------|------|
| Decorate remaining Sprint 5–7 DTOs, then enable `forbidNonWhitelisted` | P2 | mechanical |
| `ParseUUIDPipe` on all `@Param('id')` | P2 | defensive |
| Role-based authorization (currently any valid JWT passes) | P2 | add `@Roles` guard for admin/star-only ops |
| Rotate refresh tokens / revocation list | P3 | currently stateless refresh |
