# STARRIA Dependency Report
**Audit Date:** 2026-06-18

---

## 1. Workspace Package Inventory

| Package                      | tsconfig | index.ts | Status     |
|------------------------------|----------|----------|------------|
| @starria/age-gate-core       | ✓        | ✓        | OK         |
| @starria/analytics-core      | ✓        | ✓        | OK         |
| @starria/arena-core          | ✓        | ✓        | OK         |
| @starria/campaign-core       | ✗        | ✓        | **P1 — missing tsconfig** |
| @starria/companion-core      | ✓        | ✓        | OK         |
| @starria/creator-os-core     | ✓        | ✓        | OK         |
| @starria/discovery-core      | ✓        | ✓        | OK         |
| @starria/domain-events       | ✓        | ✓        | OK         |
| @starria/event-core          | ✓        | ✓        | OK         |
| @starria/feed-core           | ✓        | ✓        | OK         |
| @starria/geo-core            | ✓        | ✓        | OK         |
| @starria/gifting-core        | ✓        | ✓        | OK         |
| @starria/live-core           | ✓        | ✓        | OK         |
| @starria/messaging-core      | ✓        | ✓        | OK         |
| @starria/moderation-core     | ✓        | ✓        | OK         |
| @starria/notification-core   | ✓        | ✓        | OK         |
| @starria/patron-core         | ✓        | ✓        | OK         |
| @starria/ranking-core        | ✓        | ✓        | OK         |
| @starria/replay-core         | ✓        | ✓        | OK         |
| @starria/search-core         | ✓        | ✓        | OK         |
| @starria/session-core        | ✓        | ✓        | OK         |
| @starria/session-engine-core | ✓        | ✓        | OK         |
| @starria/star-core           | ✓        | ✓        | OK         |
| @starria/support-core        | ✓        | ✓        | OK         |
| @starria/tap-core            | ✓        | ✓        | OK         |
| @starria/ticketing-core      | ✓        | ✓        | OK         |
| @starria/trust-core          | ✓        | ✓        | OK         |
| @starria/video-core          | ✓        | ✓        | OK         |
| @starria/voting-core         | ✓        | ✓        | OK         |
| @starria/wallet-core         | ✓        | ✓        | OK         |

**29 packages total. 1 missing tsconfig (`campaign-core` — P1).**

---

## 2. Inter-Package Dependency Graph

```
domain-events (no deps — ROOT)
  ↑ imported by all 28 other packages

wallet-core    → domain-events
gifting-core   → domain-events
live-core      → domain-events, gifting-core
tap-core       → domain-events
messaging-core → domain-events, patron-core
arena-core     → domain-events
voting-core    → domain-events
ranking-core   → (none — pure TS)
campaign-core  → domain-events, wallet-core
```

---

## 3. Circular Dependency Analysis

**Result: NO circular dependencies detected.**

Full dependency graph forms a strict DAG:
- `domain-events` is the single root — no deps
- `ranking-core` is fully standalone — no @starria deps
- `messaging-core → patron-core → domain-events` — not circular
- `live-core → gifting-core → domain-events` — not circular
- `campaign-core → wallet-core → domain-events` — not circular

✅ Zero cycles across all 29 packages.

---

## 4. API Dependency Declarations vs Workspace Packages

### Declared in `apps/api/package.json`
| Package                      | Declared | Used by modules |
|------------------------------|----------|-----------------|
| @starria/wallet-core         | ✓        | wallet           |
| @starria/gifting-core        | ✓        | gifting          |
| @starria/feed-core           | ✓        | discovery        |
| @starria/notification-core   | ✓        | multiple         |
| @starria/moderation-core     | ✓        | moderation       |
| @starria/analytics-core      | ✓        | watch            |
| @starria/video-core          | ✓        | video            |
| @starria/search-core         | ✓        | search           |
| @starria/discovery-core      | ✓        | discovery        |
| @starria/geo-core            | ✓        | discovery        |
| @starria/domain-events       | ✓        | event-bus        |
| @starria/support-core        | ✓        | supporters       |
| @starria/session-engine-core | ✓        | session-engine   |
| @starria/replay-core         | ✓        | replay           |
| @starria/creator-os-core     | ✓        | creator-os       |
| @starria/arena-core          | ✓        | arenas           |
| @starria/voting-core         | ✓        | arenas           |
| @starria/ranking-core        | ✓        | arenas           |

### NOT declared in `apps/api/package.json` (used implicitly or not at all)
| Package                      | Used in modules          | Issue                    |
|------------------------------|--------------------------|--------------------------|
| @starria/companion-core      | companion module imports  | Not in api/package.json  |
| @starria/messaging-core      | messaging module imports  | Not in api/package.json  |
| @starria/patron-core         | patrons module imports    | Not in api/package.json  |
| @starria/trust-core          | trust module imports      | Not in api/package.json  |
| @starria/ticketing-core      | ticketing module imports  | Not in api/package.json  |
| @starria/live-core           | live module imports       | Not in api/package.json  |
| @starria/age-gate-core       | companion imports         | Not in api/package.json  |
| @starria/campaign-core       | campaigns module imports  | Not in api/package.json  |
| @starria/star-core           | prestige module imports   | Not in api/package.json  |

> **Note:** pnpm workspace hoisting may resolve these at dev time but they will
> be missing in strict / isolated environments and in the Docker image (P1).

---

## 5. Flutter Dependency Audit

### `pubspec.yaml` — Critical Missing Package

| Package   | Required by                              | In pubspec | Severity |
|-----------|------------------------------------------|------------|----------|
| `http`    | 22 dart files across 6 feature folders  | **NO**     | **P0**   |

The `http` package is used in Sprint 5–8 screens (companion, messaging, patron,
arenas, replay, creator-os) but is absent from `pubspec.yaml`. Flutter build
will fail with `Target of URI doesn't exist: 'package:http/http.dart'`.

### Declared but verify-needed
| Package              | Version  | Note                                     |
|----------------------|----------|------------------------------------------|
| livekit_client       | ^2.1.0   | SDK present — token integration stub     |
| flutter_webrtc       | ^0.14.0  | Present — VideoTrackRenderer stub        |
| firebase_core        | ^3.0.0   | FCM_SERVER_KEY blank in .env             |
| firebase_messaging   | ^15.0.0  | Requires google-services.json            |

---

## 6. pnpm Lockfile

- File: `pnpm-lock.yaml` (5,906 lines, lockfileVersion 9.0)
- Dockerfile uses `--frozen-lockfile` — **will fail** if any new `workspace:*` dep 
  was added after last `pnpm install` (ranking-core, voting-core were added to 
  api/package.json — lockfile must be regenerated before Docker build)
- **Severity: P0-03 contributor**
