# backend/jobs

## Purpose

A self-contained background job queue built on Redis. Provides three primitives:

- **`QueueJob`** — immutable job value object (id, type, payload, attempts, maxAttempts, runAtTimestamp). Serialises to/from JSON.
- **`QueueJobRegistry`** — handler registry: maps job type strings to `Future<void> Function(QueueJob)` handlers.
- **`QueueJobProcessor`** — Redis-backed worker loop. Supports delayed execution (sorted-set queue), exponential backoff with jitter, dead-letter queue (`queue:dead`), and pluggable `nowUtc` / `uuid` for testability.

Built-in job types defined in `QueueJobTypes`:
- `process_webhook_event`
- `reconcile_payment`
- `autosave_maturity_sweep`
- `send_otp`
- `analytics_flush`

## Reusable Files

| File | What it provides |
|------|-----------------|
| `job.dart` | `QueueJob`, `QueueJobTypes`, `QueueNames` |
| `job_registry.dart` | `QueueJobRegistry` — type-to-handler map |
| `job_processor.dart` | `QueueJobProcessor` — enqueue, dequeue loop, retry/backoff, dead-letter |

## STARRIA Use Case

STARRIA needs async background processing for: payment webhook reconciliation, OTP delivery, payout settlements, autosave maturity sweeps, and push notification dispatch. This job system is production-ready and already covers four of those five. The processor's Redis sorted-set delayed queue handles scheduled jobs (maturity sweeps, deferred retries) without a separate cron process.

Steps to adopt:
1. Rename `QueueJobTypes` constants to match STARRIA domain names.
2. Add STARRIA-specific types: `dispatch_push_notification`, `process_settlement_transfer`.
3. Wire `QueueJobProcessor` into STARRIA's server startup (already uses dependency injection — just pass `RedisQueueClient`).

## Extraction Difficulty

**Low.** The job system has two external dependencies: `uuid` and the internal `RedisQueueClient`. The `RedisQueueClient` interface is defined in `backend/infra/redis_client.dart` — extract that file alongside jobs. No Flutter dependencies, no platform channels, pure Dart.

## Candidate Package

`starria_backend_jobs` — or inline under `backend/jobs/` in the STARRIA backend monorepo. If STARRIA ever runs multiple backend services, promote to a shared internal package.
