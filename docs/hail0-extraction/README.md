# HAIL-0 → STARRIA Extraction Analysis

**Source repo:** `HAILO_CORE` (Flutter/Dart monorepo — mobile + Dart backend)  
**Analysis date:** 2026-06-16  
**Purpose:** Map reusable HAIL-0 modules to STARRIA packages and assess extraction cost.

---

## Folder Index

| # | Folder | Doc |
|---|--------|-----|
| 1 | `packages/hailo_shared` | [hailo_shared.md](./hailo_shared.md) |
| 2 | `backend/jobs` | [backend_jobs.md](./backend_jobs.md) |
| 3 | `backend/modules` | [backend_modules.md](./backend_modules.md) |
| 4 | `lib/core` | [lib_core.md](./lib_core.md) |
| 5 | `lib/services` | [lib_services.md](./lib_services.md) |
| 6 | `lib/integrations` | [lib_integrations.md](./lib_integrations.md) |
| 7 | `lib/features/auth` | [features_auth.md](./features_auth.md) |
| 8 | `lib/features/marketplace` | [features_marketplace.md](./features_marketplace.md) |
| 9 | `lib/features/shared` | [features_shared.md](./features_shared.md) |
| 10 | `ops` | [ops.md](./ops.md) |

---

## Extraction Priority Summary

| Folder | Difficulty | Priority |
|--------|-----------|----------|
| `packages/hailo_shared` | Low | P0 — extract first |
| `backend/jobs` | Low | P0 — extract first |
| `lib/core` | Medium | P1 |
| `lib/features/auth` | Medium | P1 |
| `lib/features/marketplace` | Medium | P1 |
| `lib/services` | Medium | P2 |
| `backend/modules` | Medium-High | P2 |
| `lib/integrations` | Low | P2 |
| `lib/features/shared` | Low | P3 |
| `ops` | Low | P3 |
