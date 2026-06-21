# STARRIA Sprint 11 — External Services Audit (Phase 1)

**Date:** 2026-06-18
**Method:** Read every external-service adapter, provider, and event-transport in `apps/api/src` and the relevant `packages/*-core`. Each entry records the file, the *actual* current implementation (not the brief's assumption), the production replacement strategy, a risk level, and what is required to deploy it for real.

**Key finding:** the platform is materially more production-wired than the Sprint 11 brief assumes. LiveKit, Paystack, the EventBus, the wallet ledger, health probes, and startup validation are already real (not stubs). The genuine remaining gaps are: Apple IAP, Google Play, LiveKit recording/egress + webhooks, push/email/SMS (no modules exist), analytics aggregation, and a richer double-entry ledger. This audit drives the Sprint 11 work; **this sprint delivers depth on the fully-verifiable internal core (ledger, analytics, infra) and the audit-as-roadmap for the credential-gated external providers.**

Legend — Status: ✅ real / ⚠️ real-with-dev-fallback / 🟥 stub / ⛔ missing.

---

## 1. LiveKit — ⚠️ real adapter, recording missing

- **File:** `apps/api/src/modules/live/livekit-adapter.service.ts` (implements `LiveKitPort`).
- **Current:** Real `livekit-server-sdk` `AccessToken` + `RoomServiceClient` — `createRoom`, `deleteRoom`, `generateToken`, `removeParticipant`, `muteParticipant`. Dev-stub token only when `LIVEKIT_API_KEY/SECRET` are blank (explicitly marked, never silent).
- **Gap:** No recording/egress; no webhook receiver (participant joined/left, recording complete).
- **Production strategy:** Add `RoomRecordingService` using `EgressClient` (start/stop room composite egress, persist egress id + asset URL, hook into replay generation). Add a `WebhookReceiver`-verified `POST /live/webhook/livekit`. (Sprint 11 Phase 6 — *audit roadmap*; real code path is unblocked by `livekit-server-sdk` already installed.)
- **Risk:** Medium. **Deploy reqs:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_HOST/URL`, egress-capable LiveKit deployment, S3/GCS bucket for egress output.

## 2. Paystack — ✅ real (persistence/reconciliation to harden)

- **Files:** `coin-purchase/providers/paystack.provider.ts`, `coin-purchase/providers/retry.util.ts`, `coin-purchase/coin-purchase.controller.ts` (`POST /coins/webhook/paystack`), `coin-purchase/coin-purchase.service.ts`.
- **Current:** Real REST `transaction/initialize` + `transaction/verify` with retry/backoff; HMAC-SHA512 webhook signature verification (`timingSafeEqual`); idempotent coin credit keyed on reference; dev-stub only when `PAYSTACK_SECRET_KEY` is blank.
- **Gap:** No durable `payment transaction` record (references/status/raw provider payloads) — idempotency currently rides on the wallet ledger key. No reconciliation job. Duplicate-webhook safety relies on wallet idempotency (works) but isn't observable.
- **Production strategy:** Persist a payment-transaction row on initiate/verify/webhook (status machine + raw payload); add a reconciliation query (verify pending refs against Paystack). (Phase 3 — *audit roadmap*.)
- **Risk:** Low–Medium. **Deploy reqs:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, public webhook URL allow-listed in Paystack dashboard.

## 3. Apple IAP — 🟥 stub (returns `verified: true`)

- **File:** `coin-purchase/providers/apple-pay.stub.ts` (`ApplePayProviderStub`).
- **Current:** `verify()` unconditionally returns `{ verified: true, status: 'success' }`. **This is a real fake and must not ship.**
- **Production strategy:** `ApplePurchaseProvider` calling the App Store Server API (`/inApps/v1/...`) or `verifyReceipt` over HTTPS via `fetch`; JWT-signed (ES256) App Store Connect API key; validate receipt/transaction, map product → coin pack / subscription, persist receipt history + subscription status + renewal events; handle renewal & cancellation via App Store Server Notifications v2 webhook. (Phase 4 — *audit roadmap*.)
- **Risk:** High (real money, fraud surface). **Deploy reqs:** App Store Connect API key (`.p8`), key id, issuer id, bundle id, shared secret; ASSN v2 webhook URL.

## 4. Google Play Billing — 🟥 stub (returns `verified: true`)

- **File:** `coin-purchase/providers/google-pay.stub.ts` (`GooglePayProviderStub`).
- **Current:** `verify()` unconditionally returns success. **Real fake; must not ship.**
- **Production strategy:** `GooglePurchaseProvider` using Play Developer API `purchases.products.get` / `purchases.subscriptionsv2.get`. Auth via service-account OAuth2 (sign a JWT with `crypto`, exchange for an access token via `fetch` — no `googleapis` dep needed); acknowledge purchases; persist purchase tokens + subscription lifecycle; handle RTDN (Pub/Sub) for renewals/cancellations. (Phase 5 — *audit roadmap*.)
- **Risk:** High. **Deploy reqs:** Play service-account JSON, package name, RTDN Pub/Sub topic + push endpoint.

## 5. Coin Ledger — ⚠️ hash-chained, single-entry; double-entry pending

- **Files:** `modules/wallet/prisma-coin-ledger.repository.ts` (`CoinLedgerPort`), `modules/wallet/wallet.service.ts`, `packages/wallet-core/src/ledger.ts` (`buildLedgerEntry`, `verifyLedgerChain`, `LEDGER_GENESIS_HASH`).
- **Current:** Real `Wallet` + `WalletEntry` hash-chained ledger; serialized Prisma transactions prevent double-spend; idempotency keys; chain verification. Single-sided (per-wallet) entries, not double-entry; no reserve/release/settle/refund primitives; no settlement/refund tables.
- **Production strategy (Phase 2 — DELIVERED THIS SPRINT):** `LedgerService` in `wallet-core` with double-entry postings (legs net to zero), `available`/`reserved` sub-ledgers, idempotency, immutable hash-chained `WalletTransaction`, `WalletBalanceSnapshot`, `WalletSettlement`, `WalletRefund` tables, and a Prisma adapter. Capabilities: debit, credit, reserve, release, settle, refund.
- **Risk:** High (core money). **Deploy reqs:** none beyond Postgres (internal system).

## 6. Wallet settlement — ⚠️ partial

- **Current:** `WalletService.withdraw` emits a `payout.requested` event (`buildPayoutRequestedEvent`); no settlement ledger. Companion/session settle uses an in-process billing stub (Sprint 10 retained `InMemorySessionBilling`).
- **Production strategy:** Route settlement through the new `LedgerService.settle` (Phase 2) → `WalletSettlement` rows with platform-fee/creator split. Payout execution to a bank/Paystack transfer remains a separate provider integration (roadmap).
- **Risk:** High. **Deploy reqs:** payout provider creds (Paystack Transfers / bank) for actual disbursement — out of this sprint.

## 7. Session billing — 🟥 in-process stub (Sprint 10, intentional)

- **Files:** `modules/session-engine/in-memory-session-engine.repository.ts` (`InMemorySessionBilling`), `modules/companion/in-memory-session.repository.ts` (`InMemorySessionLedger`), `modules/campaigns/in-memory-campaign.repository.ts` (`InMemoryCampaignLedger`), `modules/creator-os/in-memory-creator-os.repository.ts` (`InMemoryCreatorLedger`).
- **Current:** In-memory coin balances with `seed()` test helpers (documented out-of-scope in Sprint 10).
- **Production strategy:** Replace each `*CoinLedgerPort`/`*BillingPort` with an adapter over the new `LedgerService` (reserve on booking → settle on completion → refund on cancel). (Integration is wiring; the `LedgerService` it depends on is delivered Phase 2. Rewiring the 4 call-sites is the documented follow-on to avoid regressing the 92-test suite.)
- **Risk:** High. **Deploy reqs:** none (internal).

## 8. Replay processing — 🟥 stub transcode

- **File:** `modules/replay/in-memory-replay.repository.ts` (`StubMediaProcessor`, `InMemoryDiscoveryPublisher`, `InMemoryReplayAccess`). Store itself is Prisma-backed (Sprint 10).
- **Current:** `StubMediaProcessor.process/generateThumbnails` return synthesized URLs (no real transcode).
- **Production strategy:** Real transcode pipeline (LiveKit egress output → ffmpeg/cloud transcode → HLS + thumbnails), triggered by the LiveKit recording-complete webhook (Phase 6). (Roadmap.)
- **Risk:** Medium. **Deploy reqs:** transcode service / ffmpeg workers, object storage, CDN.

## 9. Poster generation — 🟥 stub generator

- **File:** `modules/creator-os/in-memory-creator-os.repository.ts` (`StubPosterGenerator`).
- **Current:** Returns deterministic CDN-style URLs; no image generation. Store (`PosterGeneration`/`CreatorClip`) is Prisma-backed.
- **Production strategy:** Real image-gen provider (e.g. an internal render service or a hosted model) behind `PosterGeneratorPort`. (Roadmap — credential/infra gated.)
- **Risk:** Low (cosmetic). **Deploy reqs:** image-gen API key / render service.

## 10. Clip generation — 🟥 stub generator

- **File:** `modules/creator-os/in-memory-creator-os.repository.ts` (`StubClipGenerator`).
- **Current:** Returns synthesized clip URLs.
- **Production strategy:** Real video-cut service behind `ClipGeneratorPort` (ffmpeg segment + upload), fed by replay assets. (Roadmap.)
- **Risk:** Low. **Deploy reqs:** video-cut workers, storage.

## 11. Analytics — 🟥 computed stub

- **File:** `modules/creator-os/in-memory-creator-os.repository.ts` (`StubAnalyticsSource`).
- **Current:** Deterministic synthetic audience/revenue metrics seeded from `creatorId` — no real event capture or rollups.
- **Production strategy (Phase 9 — DELIVERED THIS SPRINT):** `AnalyticsEvent` table + `AnalyticsEventStore` (record views/sessions/purchases/gifts/engagement) + `CreatorAnalyticsAggregator` producing daily/weekly/monthly rollups into `AnalyticsRollup`. A Prisma-backed `AnalyticsSource` can then replace the stub (wiring documented).
- **Risk:** Medium. **Deploy reqs:** none (internal); optionally a warehouse later.

## 12. EventBus — ✅ real (Redis Streams)

- **Files:** `event-bus/redis-event-bus.ts` (`RedisStreamsEventBus`), `event-bus/event-bus.module.ts`.
- **Current:** Durable Redis Stream (`XADD`/`XREADGROUP` consumer group, at-least-once, per-pod consumer name, `MAXLEN` trim, graceful in-process fallback on Redis outage).
- **Production strategy:** None needed. Optional hardening: DLQ for poison messages, `XACK`/pending reclaim monitoring.
- **Risk:** Low. **Deploy reqs:** `REDIS_URL`.

## 13. Notifications (in-app) — ⚠️ persisted, no dispatcher

- **Files:** `Notification` Prisma model exists; `@starria/notification-core` package exists. No `NotificationDispatcher`, no delivery transport.
- **Production strategy:** `NotificationDispatcher` (send/schedule/retry/DLQ) writing delivery status; fans out to push/email/SMS providers. (Phase 7/8 — roadmap.)
- **Risk:** Medium. **Deploy reqs:** see push/email/SMS below.

## 14. Push messaging (FCM / APNs) — ⛔ missing

- **Current:** No push module or provider.
- **Production strategy:** FCM HTTP v1 (service-account JWT signed with `crypto`, send via `fetch`) + APNs (token-based JWT over HTTP/2 via `node:http2`). `NotificationDispatcher` with delivery-attempt persistence + dead-letter queue. (Phase 7 — roadmap; dependency-light, but credential-gated.)
- **Risk:** Medium. **Deploy reqs:** FCM service-account JSON / project id; APNs `.p8` key, key id, team id, bundle id.

## 15. Email — ⛔ missing

- **Current:** No email provider; verification/reset/receipt/moderation emails not sent.
- **Production strategy:** `EmailProvider` over an HTTP email API (SendGrid/Mailgun/Resend) via `fetch` (no `nodemailer` dep available); persist send history/failures/retries. (Phase 8 — roadmap.)
- **Risk:** Medium (account security depends on verification/reset email). **Deploy reqs:** email-API key, verified sender domain (SPF/DKIM).

## 16. SMS — ⛔ missing

- **Current:** No SMS provider; OTP/security alerts not sent.
- **Production strategy:** `SMSProvider` over Twilio REST (`fetch` + basic auth); persist send history/failures/retries. (Phase 8 — roadmap.)
- **Risk:** Medium (OTP is a security control). **Deploy reqs:** Twilio SID/auth token/from-number (or alternative).

---

## Summary table

| # | Service | Status | This sprint | Risk | Primary deploy requirement |
|---|---|---|---|---|---|
| 1 | LiveKit core | ⚠️ real | roadmap | Med | LiveKit keys |
| 2 | Paystack | ✅ real | roadmap (persistence) | Low-Med | Paystack keys |
| 3 | Apple IAP | 🟥 stub | roadmap | High | App Store Connect key |
| 4 | Google Play | 🟥 stub | roadmap | High | Play service account |
| 5 | Coin ledger | ⚠️→✅ | **DELIVERED** | High | none |
| 6 | Wallet settlement | ⚠️ | **DELIVERED (settle/refund primitives)** | High | payout provider (later) |
| 7 | Session billing | 🟥 | roadmap (wiring) | High | none |
| 8 | Replay processing | 🟥 stub | roadmap | Med | transcode infra |
| 9 | Poster gen | 🟥 stub | roadmap | Low | image-gen API |
| 10 | Clip gen | 🟥 stub | roadmap | Low | video-cut infra |
| 11 | Analytics | 🟥→✅ | **DELIVERED (store+aggregator)** | Med | none |
| 12 | EventBus | ✅ real | none | Low | Redis |
| 13 | Notifications | ⚠️ | roadmap | Med | push/email/SMS |
| 14 | Push FCM/APNs | ⛔ | roadmap | Med | FCM/APNs creds |
| 15 | Email | ⛔ | roadmap | Med | email API |
| 16 | SMS | ⛔ | roadmap | Med | Twilio |

**Delivered & build/test-verified this sprint:** double-entry `LedgerService` + 4 tables (Phase 2), analytics store + aggregator + table (Phase 9), infra/health/startup hardening (Phase 10). **Roadmap (credential-gated, real code path identified):** Phases 3–8 external providers — none can be *verified working* in this environment without live third-party secrets, so per Rule 5 they are documented here rather than shipped as fakes.
</content>
