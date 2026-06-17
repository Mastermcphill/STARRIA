# lib/core

## Purpose

Flutter-side foundational infrastructure. Not business logic — this is the plumbing that every feature depends on. Covers:

- **`api/`** — HTTP client (`ApiClient`) with auto-retry, circuit breaker, token refresh, idempotency key support, and configurable retry policy (`ApiPolicy`). Also includes `MockBackendStore` for local development without a live server.
- **`connectivity/`** — `ConnectivityNotifier`: reactive network state via `connectivity_plus`.
- **`observability/`** — `AppObservability`: wraps Sentry for error/event capture, request logging.
- **`routing/`** — `AppRouter` (GoRouter config, role-based route guards), `RoleRoutes` (path constants and role normalisation).
- **`storage/`** — `TokenStorage`: secure token persistence (wraps `flutter_secure_storage`).
- **`util/`** — `ids.dart` (request ID generation), `polling.dart` (generic async polling helper).

## Reusable Files

| File | Extraction value |
|------|-----------------|
| `api/api_client.dart` | Full-featured HTTP client. Circuit breaker, auto-retry with jitter, token refresh, auth-failure hook, request ID tracking. |
| `api/api_policy.dart` | Retry policy engine — method-aware, status-code-aware, transport-error-aware. |
| `api/api_error.dart` / `api_errors.dart` | Typed error hierarchy (`ApiException`, `ApiErrorKind`). |
| `api/api_paths.dart` | API path constants — swap HAILO paths for STARRIA paths. |
| `connectivity/connectivity_notifier.dart` | Drop-in reactive connectivity state. |
| `routing/role_routes.dart` | Role normalisation utilities (`normalizeRole()`). |
| `storage/token_storage.dart` | Secure token read/write abstraction. |
| `util/polling.dart` | Generic async poller — useful for ride status, payment confirmation. |
| `observability/app_observability.dart` | Sentry integration — replace DSN config for STARRIA. |

## STARRIA Use Case

`ApiClient` is the most valuable extraction: STARRIA's Flutter app needs an HTTP client with the same guarantees (retry, circuit breaker, 401 refresh cycle). Copy `api_client.dart` + `api_policy.dart` + error types directly. Update `api_paths.dart` with STARRIA endpoint paths.

`AppRouter` is HAILO-specific (all routes hardcoded) but `role_routes.dart` + the GoRouter guard pattern are reusable templates. STARRIA should rewrite `AppRouter` using the same guard structure.

`TokenStorage` is fully generic — no HAILO identifiers. Use as-is.

## Extraction Difficulty

**Medium.** `ApiClient` depends on `TokenStorage`, `AppObservability`, and `ApiPaths` — extract all four together. The mock backend store (`mock_backend_store.dart`) has HAILO-specific mocked keys (`rider_next_of_kin_local`) — strip or replace. `AppRouter` is tightly coupled to every HAILO screen import; don't extract it, use it as a structural reference.

## Candidate Package

`starria_core` — internal Flutter package containing the API client, connectivity notifier, token storage, and observability wrappers. Mirrors the HAILO pattern of a `lib/core` peer package that all feature packages import.
