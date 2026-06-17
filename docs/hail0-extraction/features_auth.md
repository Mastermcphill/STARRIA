# lib/features/auth

## Purpose

Full authentication feature slice for the Flutter app — data, session state, storage, and screens. Covers email/password login, OTP (phone) login, registration, role-based boot sequence, and admin login.

| Subdirectory | Contents |
|-------------|----------|
| `data/` | `AuthApi` — typed API calls for login, register, OTP request/verify, token refresh |
| `session/` | `AuthSession` (ChangeNotifier) — startup sequence, token management, role detection, startup failure reporting; `AuthStorage` — secure credential persistence |
| `presentation/` | `LandingScreen`, `SignupScreen`, `BootScreen`, `AdminLoginScreen` |
| Root | `LoginScreen` |

## Reusable Files

| File | Extraction value |
|------|-----------------|
| `data/auth_api.dart` | `AuthApi` — typed wrappers for all auth endpoints (login, register, OTP, refresh, logout). Generic, just swap endpoint paths. |
| `session/auth_session.dart` | `AuthSession` — robust startup state machine with timeout handling, role detection, startup failure banners. High value. |
| `session/auth_storage.dart` | `AuthStorage` abstract + `SecureAuthStorage` — token/role persistence via secure storage. Generic. |
| `presentation/boot_screen.dart` | Boot/splash screen with startup stage display and failure recovery UI. |
| `presentation/landing_screen.dart` | Role-selector landing screen — reuse layout, swap STARRIA roles. |
| `presentation/signup_screen.dart` | Registration screen — adapt for STARRIA user roles. |
| `login_screen.dart` | Email+password login with OTP path — directly reusable. |

## STARRIA Use Case

`AuthSession` is the most valuable extraction. It implements a startup state machine that:
1. Loads stored token
2. Validates token against the server (with timeout)
3. Detects role from token
4. Reports staged startup failures with dismissable banners

This is exactly what STARRIA needs for its multi-role app (rider, driver, fleet owner, admin). Extract `AuthSession` + `AuthStorage` + `AuthApi` as the `starria_auth` feature.

Screens are HAILO-branded but their state management pattern (ChangeNotifier + Provider, GoRouter redirects) is the correct Flutter architecture. Recreate STARRIA-branded screens using the same state wiring.

OTP flow (`requestOtp` / `verifyOtp` in `AuthApi`, `AdminLoginScreen` pattern) is ready for phone-number-based STARRIA auth.

## Extraction Difficulty

**Medium.** `AuthSession` depends on `ApiClient`, `TokenStorage`, `AuthApi`, `AuthStorage`, and `AppObservability` — all of which are in `lib/core` (also planned for extraction). The session + API + storage layer is clean; screens carry Flutter widget dependencies but no non-standard packages beyond `provider` and `go_router`.

The startup timeout logic (`startupStepTimeout`, `startupNetworkTimeout`) is non-obvious and worth preserving exactly — it prevents infinite loading on server cold-start.

## Candidate Package

`starria_auth` — Flutter feature package. Exports `AuthSession`, `AuthStorage`, `AuthApi`, and the boot/landing/login screens. All other STARRIA features declare a dependency on this package for auth state.
