# backend/modules

## Purpose

HTTP route modules for the Dart backend server (using `shelf` + `shelf_router`). Each subdirectory is a vertical slice — controller, data store abstractions, and provider implementations — for one business domain:

| Module | Domain |
|--------|--------|
| `auth/` | Email/password login, OTP (Termii), JWT token issue, rate limiting |
| `marketplace/` | Subscription offers, purchases, entitlements, billing ledger, org RBAC |
| `payments/` | Payment intents, Paystack & Stripe providers, webhook ingestion |
| `rides/` | Ride request metadata, operational records |
| `dispatch/` | Trip dispatch controller |
| `disputes/` | Dispute filing |
| `drivers/` | Driver management |
| `settlement/` | Payout settlement transfers |
| `me/` | Current-user profile |
| `admin/` | Admin and admin-user management |
| `routes/` | Routing/path management |

## Reusable Files

**Auth module** (highest reuse potential):
- `auth_controller.dart` — shelf router, OTP rate limiter (in-memory + Redis-backed buckets, configurable window/limits), login/register/OTP endpoints
- `auth_credentials_store.dart` — abstract credentials store
- `phone_auth_service.dart` — OTP request/verify service abstraction
- `postgres_auth_credentials_store.dart` / `sqlite_auth_credentials_store.dart` — dual-DB implementations
- `otp_provider.dart` / `termii_otp_provider.dart` — abstract OTP provider + Termii implementation

**Marketplace module** (reuse with modification):
- `marketplace_entitlement_service.dart` — entitlement record CRUD + status management
- `marketplace_revenue_service.dart` — revenue calculation
- `marketplace_reconciliation_service.dart` — payment-to-purchase reconciliation
- `marketplace_timeline_service.dart` — purchase lifecycle events
- `org_repository.dart` / `org_rbac.dart` — multi-org support with RBAC
- `billing_ledger_repository.dart` — billing ledger

**Payments module** (reuse as-is with provider swap):
- `payment_provider.dart` — abstract `PaymentProvider` interface
- `paystack_payment_provider.dart` — Paystack implementation
- `stripe_payment_provider.dart` — Stripe implementation
- `payment_service.dart` — intent creation, webhook validation, status reconciliation
- `payment_intent_repository.dart` / `payment_webhook_event_repository.dart`

## STARRIA Use Case

- **Auth module**: drop in STARRIA's auth backend. OTP rate limiter is production-quality (dual Redis+in-memory, configurable). Swap Termii for any SMS provider via the `OtpProvider` interface.
- **Marketplace module**: STARRIA's subscription/plan system maps directly. `org_rbac.dart` supports STARRIA's multi-org (fleet owner + team) model. Entitlement service handles feature gating.
- **Payments module**: Paystack is already integrated (Nigeria market). Add a Flutterwave provider by implementing `PaymentProvider`. Webhook handling pattern is robust — idempotency-keyed, stored before processing.

## Extraction Difficulty

**Medium-High.** Modules are coupled to:
- `backend/infra/` (Postgres provider, Redis client, token service, audit logger, analytics event store)
- `lib/domain/` (models like `User`, `UserRole`, auth service)
- `backend/server/` (HTTP utils, `RequestContext`, client IP)

Must extract the infra layer alongside modules. The dual Postgres/SQLite store pattern means each domain has 2–3 concrete implementations — plan for which database STARRIA will use before extracting to avoid carrying dead implementations.

## Candidate Package

Inline under `starria_backend/modules/` — not a separate package. The infra coupling makes standalone packaging impractical until STARRIA stabilises its infra layer.
