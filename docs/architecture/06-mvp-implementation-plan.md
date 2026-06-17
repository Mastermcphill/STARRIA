# STARRIA — MVP Implementation Plan

## MVP Scope

The MVP proves the core loop:
**Supporter discovers Star → watches an Arena/Event → sends Tap → Star receives payout preview.**

---

## Sprint 1 — Foundation (Week 1–2)

### Backend
- [ ] `pnpm install` — resolve workspace deps
- [ ] `docker compose up postgres redis` — boot infra
- [ ] `prisma migrate dev --name init` — apply schema
- [ ] Auth module: `POST /auth/register`, `POST /auth/login`
- [ ] Users module: `GET /users/me`, `PATCH /users/me`

### Flutter
- [ ] `flutter pub get`
- [ ] `AuthRepository` → HTTP client wrapper
- [ ] Login + Register screens
- [ ] JWT storage (`flutter_secure_storage`)
- [ ] App router setup (`go_router`)

---

## Sprint 2 — Stars & Supporters (Week 3–4)

### Backend
- [ ] Stars module: list, get, onboard, update profile
- [ ] Supporters module: profile, subscriptions
- [ ] Seed script: 5 Stars, 10 Supporters

### Flutter
- [ ] Discover screen (list Stars, search)
- [ ] Star profile screen
- [ ] Subscribe button

---

## Sprint 3 — Arenas & Events (Week 5–6)

### Backend
- [ ] Arenas module: create, join token (LiveKit)
- [ ] Events module: create, start, end
- [ ] `GET /events/:id/watch-token`
- [ ] WatchSession tracking on join/leave

### Flutter
- [ ] Arena screen (LiveKit Flutter SDK)
- [ ] Event schedule / upcoming screen
- [ ] Join arena flow

---

## Sprint 4 — Taps (Week 7–8)

### Backend
- [ ] Wire `PrismaWalletAdapter` → `CoinGiftingService`
- [ ] `TapsService.sendCoinGift()` — idempotent, hash-chained
- [ ] `POST /taps`
- [ ] Settlement preview: `GET /taps/preview`
- [ ] Seed wallets with coin balances for Supporters

### Flutter
- [ ] Tap bottom sheet (coin gift amounts)
- [ ] Send tap during live Arena
- [ ] Balance display in profile

---

## Sprint 5 — Feed & Notifications (Week 9–10)

### Backend
- [ ] `FeedEngine` wired with `PrismaFeedContentAdapter`
- [ ] `GET /feed` endpoint
- [ ] `POST /feed/engagement`
- [ ] `NotificationService` wired with `PrismaNotificationAdapter`
- [ ] `GET /notifications` endpoint
- [ ] FCM push on tap received

### Flutter
- [ ] For-You feed (home screen)
- [ ] Notification centre

---

## Sprint 6 — AI Creator Tools (Week 11)

### Backend
- [ ] `AiCreatorService.generate()` → Anthropic API
- [ ] `POST /ai-creator/generate` (caption, title, hashtags)
- [ ] Rate limiting: 50 generations / Star / day

### Flutter
- [ ] AI Creator dashboard (Star-only tab)
- [ ] Generate caption → copy to clipboard

---

## Sprint 7 — Polish & QA (Week 12)

- [ ] End-to-end test: register → subscribe → watch arena → send tap
- [ ] Error handling across all endpoints
- [ ] SwaggerUI review
- [ ] Flutter build (iOS + Android)
- [ ] Load test Taps endpoint (idempotency under concurrency)

---

## Team Assignments (placeholder)

| Domain | Backend | Flutter |
|---|---|---|
| Auth / Users | TBD | TBD |
| Stars / Supporters | TBD | TBD |
| Taps / Wallet | TBD | TBD |
| Events / Arenas | TBD | TBD |
| Feed / Notifications | TBD | TBD |
| AI Creator | TBD | TBD |

---

## Definition of Done (MVP)

1. Supporter can register, discover Stars, and watch an Arena live stream.
2. Supporter can send a Coin Gift during a live stream; Star's wallet updates.
3. Star receives an in-app notification on tap received.
4. Star can use AI Creator Tools to generate a caption for a new event.
5. All API endpoints documented in Swagger (`/docs`).
6. `docker compose up` boots the full stack locally.
