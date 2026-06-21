# STARRIA — Sprint 9 Hardening, Final Pass Report

**Date:** 2026-06-18
**Scope:** Resolve unresolved Sprint 9 blockers (lockfile, Prisma pipeline, build, tests). Do **not** rewrite completed Sprint 9 work.
**Entry state (claimed):** ~83/100. **Actual entry state on inspection:** lower — the **API app did not compile** (20 TS errors), a fact the prior report missed because it had only type-checked the *packages*, not the NestJS app.

---

## 1. Gap analysis — verified against repository state

| # | Blocker | Claimed | Verified reality | Severity |
|---|---------|---------|------------------|----------|
| 1 | Lockfile drift | "needs install" | **Confirmed severe** — 0/12 Sprint 5–8 packages in `pnpm-lock.yaml`. `pnpm install --frozen-lockfile` (used by Dockerfile L25) **would fail** → clean Docker build impossible. | P0 |
| 2 | Prisma generation | "not in pipeline" | Client not generated (`node_modules/.prisma/client/index.d.ts` missing). Wired in Dockerfile but **not** in local `build`/turbo. | P0 |
| 3 | API build | "30 packages tsc-clean" | **API app failed to build** — 19× `TS2564` (DTOs missing `!`) + 1× `TS2345` (`PrismaTicketRepository` ↛ `CoinLedgerPort`). Latent: ts-jest only compiled test-imported files. | P0 |
| 4 | Test failures | "64/65, 1 streak" | Streak failure **+** wallet suite **failed to compile** (TS7006) → its 6 tests never ran. | P1 |
| 5 | In-memory adapters | "P1 multi-day" | **Confirmed** — 11 in-memory repos; none of their domains have Prisma models → needs schema + migrations + DB. | P1 |
| 6 | Migrations untracked | (not flagged) | Dev DB built via `prisma db push` — **no `_prisma_migrations` table**; migration chain never deploy-tested. | P1 |

---

## 2. Files modified (this pass)

**Build pipeline / lockfile**
- `pnpm-lock.yaml` — regenerated; all 12 Sprint 5–8 packages now present; `--frozen-lockfile` passes.
- `apps/api/package.json` — `build` → `prisma generate && nest build` (root-cause Prisma pipeline integration).

**API compile fixes (root cause: `strict` / missing `!`)**
- `apps/api/src/modules/arenas/dto/battle.dto.ts` — 10 props → `!`
- `apps/api/src/modules/live/dto/send-live-gift.dto.ts` — 3 props → `!`
- `apps/api/src/modules/poster/dto/generate-poster.dto.ts` — 2 props → `!`
- `apps/api/src/modules/ticketing/dto/purchase-ticket.dto.ts` — 4 props → `!`
- `apps/api/src/modules/ticketing/prisma-ticket-store.repository.ts` — ledger methods now return `{ userId, balance }` to satisfy `CoinBalance` (fixes `CoinLedgerPort` mismatch in `live.service.ts`).

**Test fixes (root cause, not expectation edits)**
- `apps/api/src/modules/supporters/support-streak.spec.ts` — removed the spurious "gap" gift; a streak break is the *absence* of gifts. Both assertions (`longest=7`, `current=2`) preserved and now truthful.
- `apps/api/src/modules/wallet/wallet.service.spec.ts` — added missing `wallet.findUnique` mock in withdraw test; subscribed to the correct event constant `WALLET_PAYOUT_REQUESTED` (was a wrong magic string `starria.wallet.payout_requested` → 0 deliveries).

---

## 3. Implementation order (by impact) — executed

1. **Tests** → green (streak data + wallet mock/event). ✅
2. **Prisma generate** → client generated; wired into `build`. ✅
3. **API compile** → 20 → 0 errors. ✅
4. **Lockfile** → regenerated; frozen install passes. ✅
5. **Full build** → all 30 packages + API. ✅
6. **DB/migration validation** → blocked (see §5). ⚠️

---

## 4. Validation results (after each phase)

| Check | Command | Result |
|-------|---------|--------|
| Unit tests | `jest` | **71/71 pass, 5/5 suites** (was 64 run + 1 fail + wallet suite uncompilable) |
| API typecheck | `tsc --noEmit` | **0 errors** (was 20) |
| API build | `prisma generate && nest build` | **`dist/main.js` emitted** |
| Workspace build | `pnpm --filter "@starria/api..." run build` | **exit 0, all 30 pkgs + API** |
| Lockfile | `pnpm install --frozen-lockfile` | **passes** (Docker `deps` stage unblocked) |
| Prisma schema | `prisma validate` | **valid** |
| Migration/schema parity | CREATE TABLE count vs models | **49 = 49** (no table-count drift) |

**Code-verified (not runtime-tested — needs live services):** global `JwtAuthGuard` via `APP_GUARD` + `@Public()` on auth routes; Paystack webhook `createHmac('sha512')` + `timingSafeEqual`; LiveKit `AccessToken` adapter; Redis EventBus `XADD` + `EVENT_BUS_DRIVER` toggle.

---

## 5. Remaining risks

- **Data durability (P1, multi-day).** 11 in-memory repos still volatile: `campaigns, companion×3, creator-os, messaging, patrons, prestige, replay, session-engine, trust`. Each needs a Prisma model + migration + repo. **No schema models exist** for these domains yet. Restart = data loss.
- **Migrations never deploy-tested (P1).** Running DB was `db push`-ed; `_prisma_migrations` absent. Migration chain not proven against a clean DB. *Validation against the live container was attempted but correctly blocked by the write guardrail — needs explicit authorization or a CI step (`prisma migrate deploy` on a throwaway DB).*
- **Runtime unverified (P1).** JWT/Paystack/LiveKit/Redis confirmed by code only; no end-to-end run (Redis not running; needs provider keys).
- **Stubs remain:** Apple/Google IAP providers.
- **DB credential mismatch:** `.env` `DATABASE_URL` password ≠ the running container's role password (host auth `P1000`). Reconcile before deploy.

---

## 6. Production readiness score

**Entry (honest): ~80** (the API didn't build — the claimed 83 was optimistic).
**Exit: 89/100.**

| Dimension | Score | Note |
|-----------|------:|------|
| Build / CI / deployability | 93 | API + all packages build clean; lockfile + Prisma pipeline fixed; Docker `deps`+`build` unblocked |
| Tests | 90 | 71/71; integration/E2E still need a DB |
| Security wiring | 88 | Guard/HMAC/CORS in place (code-verified) |
| Data durability | 70 | 11 volatile in-memory stores; migrations untracked |
| Runtime verification | 75 | Not exercised against live services |

**To reach 92+:** migrate the top in-memory domains (messaging → patron → trust) to Prisma with migrations, run `prisma migrate deploy` against a clean DB in CI, and do one live smoke of the JWT + Paystack-webhook + LiveKit-token paths.

---

## 7. Post-report addendum (same session — user-authorized follow-ups)

### 7a. Migration chain validated against a clean database ✅
Root cause of the earlier host-auth `P1000`: a **native `postgresql-x64-18` Windows service also listens on `localhost:5432`**, intercepting host connections meant for the `starria-postgres` container (deployment footgun — document this). Validated inside the container instead: created throwaway DBs and applied every `migration.sql` in order with `ON_ERROR_STOP=1`.
- **8/8 migrations apply cleanly → 49 tables + 35 enums** (= 49 schema models). Throwaway DB/role dropped after.
- Blocker #6 substantially closed: the migration chain is proven to build the full schema from empty.

### 7b. Messaging in-memory → Prisma (blocker #3, domain 1 of 11) ✅
- **Schema:** +4 enums (`MessageRequestStatus`, `ConversationStatus`, `DMAccessLevel`, `MessageType`) and +5 models (`DmPermission`, `MessageRequest`, `Conversation`, `DirectMessage`, `ConversationUnread`) in `prisma/schema.prisma`. `senderPatronTier` stored as `String` to avoid premature coupling with the not-yet-migrated patron domain.
- **Migration:** `prisma/migrations/20260618000000_messaging_persistence/migration.sql` (generated via `migrate diff`, prisma-format-compatible).
- **Repo:** new `src/modules/messaging/prisma-messaging.repository.ts` — `PrismaMessageRepository` + `PrismaDMPermissionRepository` implement `MessageStorePort` / `DMPermissionStorePort` exactly; unread counts move from a process `Map` to the `ConversationUnread` table.
- **Wiring:** `messaging.service.ts` + `messaging.module.ts` now inject the Prisma repos; `in-memory-messaging.repository.ts` **deleted** (no remaining references).
- **Validation:** full chain now **9/9 migrations → 54 tables** (all 5 messaging tables present) against a clean DB; `tsc --noEmit` clean against the freshly generated client (validates every field name, `participantIds: { has }`, the `conversationId_userId` composite-key upsert, and enum literals); **71/71 tests pass**; **API builds** (`dist/main.js`).
- **Not done:** a DB-connected runtime integration test for the repo (host can't reach the container DB; PG container has no Node). Recommended as a CI follow-up with a test database.

### Remaining in-memory domains (10): `campaigns, companion×3, creator-os, patrons, prestige, replay, session-engine, trust` — same pattern as messaging.

### Updated score: **89 → 90/100** (data-durability 70 → 74; migrations now deploy-validated). Messaging is now restart-durable and serves as the verified template for the remaining 10 domains.
