# lib/features/shared

## Purpose

A small collection of cross-feature Flutter widgets that multiple feature screens share. Not a full package — just shared UI primitives that didn't belong to any single feature.

| File | What it provides |
|------|-----------------|
| `json_view.dart` | Debug widget: renders arbitrary JSON as a formatted, expandable tree. Used in dev/admin screens. |
| `ride_snapshot_card.dart` | A card widget displaying a compressed summary of a ride (route, fare, status, timestamps). Used in ride history lists. |
| `ride_timeline_widget.dart` | Visual timeline widget for a ride's lifecycle events (requested → matched → in-progress → completed/cancelled). |

## STARRIA Use Case

- **`ride_snapshot_card.dart`**: extract for STARRIA's ride history / trip list screens. The data binding is to HAILO's `RideTrip` model — adapt to STARRIA's equivalent trip model.
- **`ride_timeline_widget.dart`**: extract for STARRIA's trip detail screen. The timeline UI pattern (ordered events with icons and timestamps) is generic enough to apply to any lifecycle (payment, settlement, dispatch).
- **`json_view.dart`**: extract verbatim for STARRIA's admin/debug panel. Zero HAILO dependencies.

## Extraction Difficulty

**Low.** Three files, all Flutter widgets. No business logic. The two ride widgets are coupled to HAILO domain models (`RideTrip`, lifecycle event types) — plan one data-binding pass to map to STARRIA models. `json_view.dart` has zero coupling.

## Candidate Package

Inline under `starria/lib/features/shared/` or promoted to `starria_ui` if STARRIA accumulates a broader widget library. Don't create a standalone package for three files — add to an existing shared UI package when one exists.
