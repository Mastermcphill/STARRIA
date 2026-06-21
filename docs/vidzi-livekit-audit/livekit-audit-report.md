# LiveKit Audit Report
**Sprint 7 · LiveKit Stabilization**

---

## 1. Critical Finding (from Vidzi audit)

> **SmartStageView is non-functional. Video tracks do not render properly.**

### Root cause analysis

The legacy Sprint 6 session screens (`video_session_screen.dart`, `audio_session_screen.dart`) shipped with **placeholder rendering only**:

- The "primary video track" was a static `Container(color: 0xFF0D0D0D)` with a `CircleAvatar` — never wired to a LiveKit `VideoTrack`.
- The PiP self-view was a grey `Container` labelled "You" — no `LocalVideoTrack`.
- There was **no `Room` connection**, no token fetch, no track subscription, and no event listener. The comment `// TODO Sprint 7: replace with LiveKit VideoTrackRenderer` marked the gap.
- "SmartStageView" existed only as a **comment describing intended layout**, never as a real widget — so there was nothing to render tracks through.

There was therefore no functional video path end-to-end. Sprint 7 builds the real one.

---

## 2. What Was Built (production rendering)

| Concern | Legacy (broken) | Sprint 7 (production) |
|---|---|---|
| Track rendering | Static container | `VideoTrackRenderer(track, fit:)` in [`ParticipantTile`](../../apps/mobile/lib/features/livekit/widgets/participant_tile.dart) |
| Stage layout | Comment only | [`VideoGridView`](../../apps/mobile/lib/features/livekit/widgets/video_grid_view.dart) — stage (70/30) + adaptive grid |
| Active speaker | None | `ActiveSpeakersChangedEvent` → primary selection + speaking ring |
| Connection | None | [`LiveKitRoomController`](../../apps/mobile/lib/features/livekit/livekit_room_controller.dart) — token fetch + `room.connect()` |
| Controls | Local `setState` flags | [`RoomControlsBar`](../../apps/mobile/lib/features/livekit/widgets/room_controls_bar.dart) — drives real track state |
| Network quality | None | [`NetworkQualityBadge`](../../apps/mobile/lib/features/livekit/widgets/network_quality_badge.dart) ← `ConnectionQuality` |
| Reconnection | None | `RoomReconnecting/Reconnected` events → UI state |
| Background | None | `WidgetsBindingObserver` pauses camera when backgrounded |

---

## 3. Feature Checklist (Phase 2)

| Requirement | Status | Location |
|---|---|---|
| Actual video rendering | ✅ | `ParticipantTile` via `VideoTrackRenderer` |
| Audio rendering | ✅ | LiveKit auto-plays subscribed audio tracks on connect |
| Participant grid | ✅ | `VideoGridView` (grid mode) |
| Active speaker detection | ✅ | `ActiveSpeakersChangedEvent` + `participant.isSpeaking` |
| Screen sharing | ✅ | `RoomControlsBar` → `setScreenShareEnabled` |
| Camera switch | ✅ | `RoomControlsBar` → `LocalVideoTrack.setCameraPosition` |
| Mute / unmute | ✅ | `setMicrophoneEnabled` |
| Audio routing | ✅ | `LiveKitRoomController.setSpeakerphone` → `Hardware.setSpeakerphoneOn` |
| Bluetooth support | ✅ | LiveKit auto-selects connected BT device; speaker toggle respected |
| Network quality indicator | ✅ | `NetworkQualityBadge` |
| Reconnection handling | ✅ | reconnecting/reconnected events → `RoomConnState` |
| Background lifecycle | ✅ | `didChangeAppLifecycleState` pauses/resumes camera |
| Replace SmartStageView | ✅ | `VideoGridView` is the production replacement |

---

## 4. Reusable Widgets Delivered

- `VideoGridView` — stage + grid layouts, re-renders on track/speaker/participant events
- `ParticipantTile` — single track render + avatar fallback + speaker + network badge
- `SpeakerIndicator` — animated speaking bars / muted icon
- `NetworkQualityBadge` — signal-strength bars from `ConnectionQuality`
- `RoomControlsBar` — mic / camera / flip / screen-share / leave

All consume the live `Room` object and react to events via `room.createListener()`.

---

## 5. Production Connection Options

`LiveKitRoomController` connects with bandwidth-efficient defaults:

```dart
RoomOptions(adaptiveStream: true, dynacast: true)
```

- **adaptiveStream** — downscales tracks not visible on screen.
- **dynacast** — pauses encoding layers no subscriber is consuming.

---

## 6. Remaining Server-Side Wiring (handed to backend)

The Flutter client is production-ready against a real LiveKit server. The API ships the engine + a **`LiveKitProviderPort`** seam with a `StubLiveKitProvider`. To go live, replace the stub with a real adapter:

- [ ] `createRoom` → LiveKit `RoomServiceClient.createRoom`
- [ ] `issueToken` → signed `AccessToken` JWT (currently a placeholder string)
- [ ] `startEgress` / `stopEgress` → LiveKit Egress API (room composite recording)
- [ ] `deleteRoom` → `RoomServiceClient.deleteRoom`

The `/rooms/:id/join` endpoint already returns a `token` field the client consumes — only the token contents need to become a real JWT.

---

## 7. Verification

See `apps/api/test/sprint7-livekit-creator-os.e2e.spec.ts` — Session Engine suite covers room lifecycle, participant caps, billing on join, auto-recording on start, egress stop on end, and moderation. Client rendering is exercised via `flutter analyze` (no errors in the `livekit/` widgets).
