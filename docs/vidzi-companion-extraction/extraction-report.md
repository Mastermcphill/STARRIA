# Vidzi → STARRIA Companion Extraction Report
**Sprint 6 · Companion Economy**

---

## Executive Summary

This report documents the extraction of companion-facing functionality from the Vidzi codebase and its re-implementation as STARRIA-native packages (`companion-core`, `session-core`, `age-gate-core`) under the hexagonal architecture established in Sprint 3. All LiveKit integration points are deferred to Sprint 7 and are clearly marked with `TODO Sprint 7` comments throughout the Flutter screens.

---

## 1. What Was Extracted

### 1.1 Session Screens (VideoSessionScreen, AudioSessionScreen)

| Vidzi Pattern | STARRIA Equivalent | File |
|---|---|---|
| `SmartStageView` — primary track fills top 70%, secondary tiles below | `VideoSessionScreen` placeholder; `TODO Sprint 7: replace with LiveKit VideoTrackRenderer` | `video_session_screen.dart` |
| `AudioRoomView` — waveform animation, mic toggle | `AudioSessionScreen` with `AnimationController.repeat(reverse:true)` waveform | `audio_session_screen.dart` |
| `PanicLeaveButton` — immediate exit, server notification | `TextButton.icon` → `context.go('/')` + `POST /sessions/panic-leave` in `SessionTimerScreen` | `session_timer_screen.dart` |
| `SessionTimerRing` — countdown with extension prompt | `CircularProgressIndicator` countdown, 5-min warning triggers extension modal | `session_timer_screen.dart` |
| `LiveKit room init` | Stub — `livekit_client` listed in `pubspec.yaml`, not yet wired | Sprint 7 |

### 1.2 Session Booking Flow

| Vidzi Pattern | STARRIA Equivalent |
|---|---|
| Duration picker (15/30/45/60) | `ChoiceChip` array in `SessionBookingScreen` |
| Session type selector | `ChoiceChip` for AUDIO/VIDEO/GROUP/PRIVATE/SUPPORTER_ONLY |
| Coin cost estimate | `_estimatedCost` getter with switch expression |
| Idempotency on booking | `idempotencyKey: '${userId}-${companionId}-${timestamp}'` sent to `POST /bookings` |
| Escrow debit before confirm | `SessionService.bookSession()` calls `ledger.debitEscrow()` before creating booking |

### 1.3 Companion Discovery Cards

| Vidzi Pattern | STARRIA Equivalent |
|---|---|
| Intro card with photo/video | `_CompanionCard` in `CompanionDiscoveryScreen` — `Image.network` with `introImageUrls.first` |
| Country / languages / height chips | `companion_profile_screen.dart` `_ChipRow` |
| "Available Now" badge | Green `Container` chip on `CompanionProfileScreen` |
| Verified badge | `Icons.verified` (blue) shown when `companion.verificationBadge == true` |
| Rate display | `_RateRow` showing sessionType · duration · coinCost |

### 1.4 Age Gate Surface

Vidzi mixed adult content discovery into the main feed behind a single toggle. STARRIA's redesign:

- **Separate surface**: `/companion/discovery/:userId` — never served from `/discovery`
- **Gate check on every request**: `AgeGateController.getDiscovery()` verifies `status == 'PASSED'` AND `hasConsent(userId, 'COMPANION_DISCOVERY')` before returning results
- **Flutter entry point**: `AgeGateScreen` is the required landing page; on pass, routes to discovery destination
- **No accidental mixing**: `CompanionDiscoveryController` is `@Controller('companion')` not `@Controller('discovery')`

---

## 2. What Was NOT Extracted (Deferred to Sprint 7)

| Feature | Reason | Sprint |
|---|---|---|
| `livekit_client` track wiring | Requires LiveKit server provisioning and token service | 7 |
| `SmartStageView` multi-tile layout | Depends on `RemoteVideoTrackPublication` API | 7 |
| Camera/mic permission handling | Platform-specific; needs `permission_handler` | 7 |
| Screen share | Requires `livekit_client >= 1.x` platform channel | 7 |
| Recording flag enforcement | Needs LiveKit egress integration | 7 |
| Vidzi wallet → STARRIA coin bridge | Separate migration; Vidzi wallet schema differs | 8 |

---

## 3. Package Boundaries

```
packages/
  companion-core/     — CompanionService, LonelinessService, domain types
  session-core/       — SessionService (booking, escrow, payout, participants)
  age-gate-core/      — AgeGateService, checkAgeGate(), CONTENT_WARNINGS

apps/api/src/modules/companion/
  companion.module.ts          — DI wiring for all 6 providers, 5 controllers
  companion.service.ts         — NestJS adapter wrapping core services
  companion.controller.ts      — 5 @Controller classes
  in-memory-companion.repository.ts
  in-memory-session.repository.ts   — includes seed() helper, COIN_BALANCES default 100k
  in-memory-age-gate.repository.ts

apps/mobile/lib/features/companion/
  companion_provider.dart      — Riverpod providers + data classes
  age_gate_screen.dart
  companion_discovery_screen.dart
  companion_profile_screen.dart
  session_booking_screen.dart
  session_timer_screen.dart
  audio_session_screen.dart
  video_session_screen.dart
  companion_dashboard_screen.dart
```

---

## 4. LiveKit Integration Points (Sprint 7 Checklist)

All marked in source with `// TODO Sprint 7`:

- [ ] `video_session_screen.dart:38` — Replace `Container(color: 0xFF0D0D0D)` with `VideoTrackRenderer(track: remoteTrack)`
- [ ] `video_session_screen.dart:59` — Replace self-view `Container` with `VideoTrackRenderer(track: localTrack)` (PiP)
- [ ] `audio_session_screen.dart` — Wire `AnimationController` amplitude to `RemoteAudioTrack.onAudioSample`
- [ ] `video_session_screen.dart:108` — Wire flip-camera button to `LocalVideoTrack.switchCamera()`
- [ ] Add `livekit_client` room lifecycle: `connect()` in `initState`, `disconnect()` in `dispose`
- [ ] Add `RoomOptions(adaptiveStream: true, dynacast: true)` for bandwidth efficiency

---

## 5. Domain Events Emitted (Sprint 6)

| Event | Trigger |
|---|---|
| `COMPANION_PROFILE_CREATED` | `CompanionService.createProfile()` |
| `COMPANION_VERIFIED` | `CompanionService.markVerified()` |
| `COMPANION_BLOCKED` | `CompanionService.blockUser()` |
| `COMPANION_REPORTED` | `CompanionService.reportProfile()` |
| `AGE_GATE_PASSED` | `AgeGateService.submitVerification()` — pass |
| `AGE_GATE_FAILED` | `AgeGateService.submitVerification()` — fail |
| `CONSENT_RECORDED` | `AgeGateService.recordConsent()` |
| `SESSION_BOOKED` | `SessionService.bookSession()` |
| `SESSION_STARTED` | `SessionService.startSession()` |
| `SESSION_EXTENDED` | `SessionService.extendSession()` |
| `SESSION_ENDED` | `SessionService.endSession()` |
| `SESSION_CANCELLED` | `SessionService.cancelBooking()` |
| `SESSION_PAYOUT_SETTLED` | `SessionService._settlePayoutSingle()` |
| `PARTICIPANT_INVITED` | `SessionService.inviteParticipant()` |
| `PANIC_LEAVE_TRIGGERED` | `SessionService.panicLeave()` |
| `SESSION_FLAGGED` | `SessionController.flagSession()` |
| `LONELINESS_PROFILE_UPDATED` | `LonelinessService.updateProfile()` |

---

## 6. Breaking Change Audit

No breaking changes introduced:

- All Sprint 1–5 routes preserved in `app_router.dart`
- No existing `@Controller` or `GoRoute` paths modified
- `AppModule` additions are additive (`CompanionModule` appended)
- `domain-events` package additions are purely additive (new event constants)
- All existing packages untouched
