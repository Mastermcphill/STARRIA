# STARRIA — Migration Roadmap

## Source Systems

| System | Stack | Packages extracted |
|---|---|---|
| LifeNest | NestJS / Prisma / PostgreSQL | wallet-core, gifting-core, feed-core, notification-core, moderation-core, analytics-core |
| Vidzi | FastAPI / SQLAlchemy / PostgreSQL | video-core (Python), analytics-core (Python), search-core (Python) |

---

## Phase 1 — Monorepo Scaffold ✅ (current)

- [x] pnpm workspace + Turborepo
- [x] tsconfig.base.json shared config
- [x] docker-compose (Postgres + Redis)
- [x] NestJS API skeleton with placeholder modules
- [x] Prisma schema (all domain models)
- [x] Flutter app skeleton
- [x] Architecture docs

---

## Phase 2 — Database Bootstrap

**Goal:** Postgres running with all Prisma tables migrated.

- [ ] Apply pending LifeNest migrations (reference `docs/lifenest-extraction/migration-notes.md`):
  - `20260615150000_platform_payouts`
  - `20260615180000_coin_tip_reasons`
  - `20260615190000_room_access`
  - `20260615200000_room_moderation`
  - `20260615210000_livestream_gifts`
- [ ] Run `prisma migrate dev --name init` on STARRIA schema
- [ ] Verify `media_uploads` column mapping from Vidzi `storage_uploads`
  ```sql
  INSERT INTO media_uploads SELECT id, user_id, purpose, file_name,
    content_type, storage_key, file_url, status, created_at, expires_at, completed_at
  FROM storage_uploads;
  ```
- [ ] Backfill `watch_sessions` from Vidzi `room_participants`:
  ```sql
  INSERT INTO watch_sessions (id, user_id, content_id, content_type, joined_at, left_at)
  SELECT gen_random_uuid()::text, user_id, room_id, 'LIVE', joined_at, left_at
  FROM room_participants WHERE joined_at IS NOT NULL;
  ```

---

## Phase 3 — Port Adapters (TypeScript packages → NestJS)

Wire each `@starria/*` package into the NestJS module tree via Prisma adapters.

| Port interface | Prisma adapter to create | NestJS module |
|---|---|---|
| `WalletDurableBalanceStore` | `PrismaWalletAdapter` | `TapsModule` |
| `WalletLedgerPort` | `PrismaLedgerAdapter` | `TapsModule` |
| `FiatGiftPersistencePort` | `PrismaFiatGiftAdapter` | `TapsModule` |
| `FeedContentPort` | `PrismaFeedContentAdapter` | (Feed endpoint) |
| `NotificationStorePort` | `PrismaNotificationAdapter` | `UsersModule` / global |
| `PushProvider` | `FcmPushAdapter` | `NotificationsModule` |
| `ModerationStorePort` | `PrismaModerationAdapter` | (Moderation module) |
| `AnalyticsStorePort` | `PrismaAnalyticsAdapter` | `EventsModule` |

---

## Phase 4 — Python Services Bridge

video-core, search-core (Python) options:

**Option A — Internal micro-service** (recommended for MVP)
- Run each Python package as a separate FastAPI service
- NestJS calls via internal HTTP (`HttpModule`)
- Delay TypeScript port until Phase 6

**Option B — TypeScript port**
- Rewrite video-core and search-core in TypeScript
- More effort but eliminates Python runtime dependency

Decision: start with Option A. Revisit in Phase 6.

---

## Phase 5 — LiveKit Integration (Arenas)

- [ ] Add `livekit-server-sdk` to api package
- [ ] `ArenasService.generateToken(userId, roomName)` → LiveKit JWT
- [ ] Webhook endpoint `/arenas/livekit-webhook` for participant events
- [ ] Track join/leave via `analytics-core` `WatchSession`

---

## Phase 6 — AI Creator Tools

- [ ] Add `@anthropic-ai/sdk` to api package
- [ ] `AiCreatorService.generate(type, prompt)` → call Claude API
- [ ] Persist `AiGeneration` records
- [ ] Rate-limit AI calls per Star per day

---

## Phase 7 — Flutter App Implementation

- [ ] Auth flow (register / login / JWT storage)
- [ ] Feed screen (FYP, infinite scroll)
- [ ] Star profile screen
- [ ] Arena screen (LiveKit Flutter SDK)
- [ ] Tap widget (send coin gift from event screen)
- [ ] AI Creator dashboard (Star-only)

---

## Phase 8 — Production Hardening

- [ ] BullMQ for async notification delivery
- [ ] Redis caching on feed / search endpoints
- [ ] API Gateway / rate limiting per user
- [ ] CDN for media uploads
- [ ] Sentry error tracking
- [ ] OpenTelemetry traces

---

## Breaking Changes from Source Systems

| Change | Impact | Action |
|---|---|---|
| `X-VIDZI-MEDIA-SCAN-SIGNATURE` → `X-Media-Scan-Signature` | Scanner webhooks | Update scanner config |
| `StorageService` → `UploadService` (instantiated) | Vidzi callsites | N/A — new app |
| `FeedDistrict` → `category: string` | LifeNest consumers | N/A — new app |
| `ModerationCaseType` healthcare types → `string` | LifeNest consumers | N/A — new app |
| `RecommendationFeedback` moved to DB table | Vidzi `UserSettings.metadata_json` | Backfill script (Phase 2) |
