# packages/hailo_shared

## Purpose

A thin shared Dart package that wraps SQLite for use across both the Flutter frontend and the Dart backend. It re-exports `sqflite_common` and `sqflite_common_ffi`, providing a single unified `openDatabase` / `getDatabasesPath` / `deleteDatabase` API regardless of whether the caller is Flutter (mobile/desktop) or a headless Dart server.

The package exists so that `lib/services` (wallet, autosave, moneybox) and the backend server share one database abstraction without each importing platform-specific sqlite packages directly.

## Reusable Files

| File | What it provides |
|------|-----------------|
| `lib/hailo_shared.dart` | Barrel export — re-exports `sqlite_api.dart` |
| `lib/sqlite_api.dart` | `openDatabase()`, `getDatabasesPath()`, `deleteDatabase()`, `inMemoryDatabasePath` constant; wraps `databaseFactoryFfi` |

## STARRIA Use Case

STARRIA will need SQLite for any local-first or offline-capable features (driver state, ride caching, wallet ledger). This package provides the cross-platform sqlite abstraction out of the box. Extract it verbatim as `starria_shared` and add any STARRIA-specific extensions (e.g. encryption key support via SQLCipher) on top.

## Extraction Difficulty

**Low.** Zero business logic. Two files, two transitive pub dependencies (`sqflite_common`, `sqflite_common_ffi`, `path`). No HAILO-specific identifiers. Can be copied and republished as a standalone package in under an hour.

## Candidate Package

`starria_shared` — a platform-agnostic sqlite wrapper for the STARRIA monorepo. Long-term, this could be published to pub.dev as `starria_sqlite` if STARRIA open-sources infrastructure packages.
