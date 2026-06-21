# STARRIA Flutter Report
**Audit Date:** 2026-06-18

---

## Screen & File Inventory

| Feature Folder    | Files | Screens | Providers | Repositories | Models |
|-------------------|-------|---------|-----------|--------------|--------|
| arenas            | 9     | 7       | 1         | 1 (legacy)   | 1      |
| companion         | 9     | 7       | 1         | 0            | 0      |
| creator_os        | 5     | 5       | 0         | 0            | 0      |
| events            | 7     | 3       | 1         | 1            | 1      |
| discovery         | 5     | 2       | 1         | 1            | 1      |
| live              | 3     | 3       | 0         | 0            | 0      |
| livekit           | 6     | 0       | 0         | 0            | 0 (widgets) |
| messaging         | 4     | 3       | 1         | 0            | 0      |
| patron            | 2     | 1       | 1         | 0            | 0      |
| poster            | 1     | 1       | 0         | 0            | 0      |
| presence          | 1     | 1       | 0         | 0            | 0      |
| prestige          | 3     | 2       | 1         | 0            | 0      |
| replay            | 1     | 1       | 0         | 0            | 0      |
| trust             | 1     | 1       | 0         | 0            | 0      |
| ai_creator        | 1     | 0       | 0         | 1 (legacy)   | 0      |
| creator           | 1     | 1       | 0         | 0            | 0      |
| feed              | 1     | 0       | 0         | 1 (legacy)   | 0      |

**Total: ~70 Dart files, ~44 screens, ~8 providers, ~5 repositories, ~3 model files.**

---

## Router Coverage

All routes in `app_router.dart` have confirmed matching screen imports:

| Route                                    | Screen                        | Status |
|------------------------------------------|-------------------------------|--------|
| `/`                                      | DiscoveryFeedScreen           | ✓      |
| `/video/:id`                             | VideoPlayerScreen             | ✓      |
| `/live/:id`                              | LiveRoomScreen                | ✓      |
| `/live/:id/v2`                           | LiveRoomScreenV2              | ✓      |
| `/replay/:id`                            | ReplayViewerScreen            | ✓      |
| `/creator/:id`                           | CreatorProfileScreen          | ✓      |
| `/events`                                | EventFeedScreen               | ✓      |
| `/events/:id`                            | EventDetailScreen             | ✓      |
| `/events/tickets`                        | MyTicketsScreen               | ✓      |
| `/events/:id/purchase`                   | TicketPurchaseScreen          | ✓      |
| `/prestige`                              | PrestigeScreen                | ✓      |
| `/patron/:starId`                        | PatronDashboardScreen         | ✓      |
| `/messaging`                             | InboxScreen                   | ✓      |
| `/messaging/:id`                         | ConversationScreen            | ✓      |
| `/messaging/requests`                    | MessageRequestScreen          | ✓      |
| `/companion`                             | CompanionDiscoveryScreen      | ✓      |
| `/companion/:id`                         | CompanionProfileScreen        | ✓      |
| `/companion/:id/book`                    | SessionBookingScreen          | ✓      |
| `/companion/session/:id`                 | SessionTimerScreen            | ✓      |
| `/companion/session/:id/audio`           | AudioSessionScreen            | ✓      |
| `/companion/session/:id/video`           | VideoSessionScreen            | ✓      |
| `/companion/dashboard`                   | CompanionDashboardScreen      | ✓      |
| `/age-gate`                              | AgeGateScreen                 | ✓      |
| `/creator-os`                            | CreatorOsDashboard            | ✓      |
| `/creator-os/show-planner`               | ShowPlannerScreen             | ✓      |
| `/creator-os/recording`                  | RecordingManagerScreen        | ✓      |
| `/creator-os/revenue`                    | RevenueAnalyticsScreen        | ✓      |
| `/creator-os/poster`                     | PosterStudioScreen (creator-os) | ✓    |
| `/arenas`                                | ArenaLobbyScreen              | ✓      |
| `/arenas/leaderboard`                    | LeaderboardScreenV2           | ✓      |
| `/arenas/history`                        | ArenaHistoryScreen            | ✓      |
| `/arenas/houses/:id`                     | HouseProfileScreen            | ✓      |
| `/arenas/battle/:id`                     | BattleRoomScreen              | ✓      |
| `/arenas/battle/:id/vote`                | VotingScreen                  | ✓      |
| `/arenas/battle/:id/prize-pool`          | PrizePoolScreen               | ✓      |

**All 35 declared routes resolve to existing files.** ✓

---

## P0 — Build Blockers

### `http` Package Missing from pubspec.yaml

The `http` package (`package:http/http.dart`) is imported by **22 Dart files** across
6 feature folders:

```
arenas/arenas_provider.dart
arenas/battle_room_screen.dart
arenas/house_profile_screen.dart
arenas/prize_pool_screen.dart
arenas/voting_screen.dart
companion/age_gate_screen.dart
companion/companion_dashboard_screen.dart
companion/companion_provider.dart
companion/session_booking_screen.dart
companion/session_timer_screen.dart
creator_os/poster_studio_screen.dart
creator_os/recording_manager_screen.dart
creator_os/revenue_analytics_screen.dart
creator_os/show_planner_screen.dart
livekit/livekit_room_controller.dart
messaging/conversation_screen.dart
messaging/message_request_screen.dart
messaging/messaging_provider.dart
patron/patron_provider.dart
presence/presence_settings_screen.dart
replay/replay_screen.dart
trust/trust_profile_screen.dart
```

`pubspec.yaml` declares `dio: ^5.4.0` and `retrofit: ^4.1.0` for networking but 
does NOT declare `http`. Flutter build will fail:

```
Target of URI doesn't exist: 'package:http/http.dart'.
```

**Resolution:** Add `http: ^1.2.0` to `pubspec.yaml` dependencies (or migrate all 
`package:http` imports to `dio` — the latter is already declared).

**Note:** Both `dio` and `http` are present as dual-networking strategies. Sprint 5–8 
screens use `http`; Sprint 1–4 screens use `dio`/`retrofit`. Consolidation to `dio` 
only is preferable but is a Sprint 9 refactor task.

---

## P1 — Critical Issues

### LiveKit VideoTrackRenderer Is a Stub

`livekit/widgets/video_grid_view.dart` references `VideoTrackRenderer` from 
`livekit_client` (which IS declared in `pubspec.yaml`). However, the 
`livekit_room_controller.dart` connects to a token endpoint that returns a stub 
token from `LiveKitAdapterService` on the API side — the actual LiveKit room will 
never be joined in the current implementation.

**Severity:** Functional blocker for live video, but not a compile blocker.

---

## P2 — Important Issues

### Hardcoded User IDs in Battle Screens

`battle_room_screen.dart` and `voting_screen.dart` pass `'current-user-id'` as the
voter ID in API requests:

```dart
// voting_screen.dart
body: jsonEncode({'voterId': 'current-user-id', 'candidateId': candidateId}),
```

No auth token is read from `flutter_secure_storage`. These calls will either be
rejected by the API (if guards are added) or silently succeed with invalid IDs.

**Affected files:** `arenas/voting_screen.dart`, `arenas/battle_room_screen.dart`

### Legacy Sprint 1 Repositories Not Removed

`arenas/arenas_repository.dart` is a Sprint 1 placeholder that is completely 
superseded by `arenas/arenas_provider.dart` (Sprint 8). It is not imported 
anywhere in `app_router.dart` or any screen — dead code.

Similarly, `ai_creator/ai_creator_repository.dart` and `feed/feed_repository.dart`
are unreferenced stubs from Sprint 1.

### Missing Swagger / @ApiTags on 5 Controllers

See api-report.md — companion, messaging, patrons, presence, trust controllers 
missing `@ApiTags`.

---

## P3 — Future Improvements

### Asset Directories Don't Exist

`pubspec.yaml` declares:
```yaml
assets:
  - assets/images/
  - assets/icons/
```

Neither `apps/mobile/assets/images/` nor `apps/mobile/assets/icons/` exists in 
the repository. Flutter build will emit a warning:

```
No file or variants found for asset: assets/images/
```

This is a warning, not an error — build will still succeed.

**Resolution:** Either create the directories with a placeholder file 
(`.gitkeep`), or remove the asset declarations until needed.

### No Widget Tests

No `test/` directory exists under `apps/mobile/`. No Flutter widget or integration
tests were written across Sprints 1–8. Test coverage is zero.

### `retrofit_generator` / `freezed` Build Targets Unused

`dev_dependencies` include `retrofit_generator`, `freezed`, and `json_serializable`,
but no `.freezed.dart` or `.g.dart` generated files are committed. The `build_runner`
step would need to be run before any generated code is available. No screens 
depend on generated code directly — they use manual `fromJson` factories — so 
this is cosmetic for now.

---

## Dependency Completeness Matrix

| Package              | Declared | Used by        | Status |
|----------------------|----------|----------------|--------|
| go_router            | ✓        | app_router     | OK     |
| flutter_riverpod     | ✓        | all providers  | OK     |
| dio                  | ✓        | Sprint 1–4     | OK     |
| retrofit             | ✓        | repositories   | OK     |
| **http**             | **NO**   | Sprint 5–8 (22 files) | **P0** |
| livekit_client       | ✓        | livekit widget | OK (stub) |
| flutter_webrtc       | ✓        | video_grid_view | OK (stub) |
| firebase_core        | ✓        | —              | OK (blank key) |
| firebase_messaging   | ✓        | —              | OK (blank key) |
| flutter_secure_storage | ✓      | —              | OK (unused) |
| shared_preferences   | ✓        | —              | OK     |
| cached_network_image | ✓        | screens        | OK     |
| intl                 | ✓        | screens        | OK     |
| uuid                 | ✓        | providers      | OK     |
| equatable            | ✓        | models         | OK     |
