# ops

## Purpose

Developer operations scripts for running the test suite across platforms. Currently contains two PowerShell scripts for Windows CI / local development.

| File | What it does |
|------|-------------|
| `test_all.ps1` | Runs the full test suite: Flutter tests (`flutter test`) + Dart backend tests (`dart test`) in sequence. Handles SQLite DLL detection on Windows (checks PATH and known locations before warning). Exits with the first non-zero exit code. |
| `test_windows.ps1` | Flutter-only subset of `test_all.ps1`. Runs `flutter test` with SQLite DLL detection, no backend tests. Used in Windows-specific CI jobs. |

**Shared pattern in both scripts:**
- SQLite DLL probe: scans `PATH` segments, `repo_root/sqlite3.dll`, and `backend/sqlite3.dll` before warning — handles the common Windows gotcha where `sqflite_common_ffi` needs `sqlite3.dll` on PATH.
- `Push-Location` / `Pop-Location` with `try/finally` — correct working-directory management for multi-root test runs.
- `-r expanded` flag on test runners for readable CI output.

## STARRIA Use Case

Copy both scripts directly into `STARRIA/ops/`. The SQLite DLL detection logic is valuable for any Windows developer on STARRIA — the same `sqflite_common_ffi` dependency will require the same DLL. Update the `$backendRoot` path variable to point at STARRIA's backend directory.

If STARRIA adds more test targets (e.g. a separate packages directory), extend `test_all.ps1` with additional `Push-Location` / `dart test` blocks following the same pattern.

## Extraction Difficulty

**Low.** Two PowerShell scripts. Only change needed: update the directory variable (`$backendRoot`) and script header comments. The SQLite probe logic and test runner flags are generic.

## Candidate Package

Not a package — scripts. Place in `STARRIA/ops/` and add to the CI pipeline (`test_all.ps1` as the Windows CI entry point). Consider adding a `test_all.sh` counterpart for Linux/macOS CI agents.
