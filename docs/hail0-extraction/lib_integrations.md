# lib/integrations

## Purpose

Third-party service adapters used by the Flutter app. Each subdirectory wraps one external dependency behind a clean interface:

| Subdirectory | Integration |
|-------------|-------------|
| `api/` | HAILO backend HTTP client — typed API config, exception types, and the concrete `HailoBackendApiClient` |
| `google/` | Google Distance Matrix API — distance and duration estimation between two points |
| `location/` | Device GPS via `geolocator` — current position and throttled position stream |
| `mapbox/` | Mapbox GL map widget and offline tile manager |

## Reusable Files

| File | Extraction value |
|------|-----------------|
| `api/api_config.dart` | Base URL + environment config. Replace HAILO URLs with STARRIA URLs. |
| `api/api_exception.dart` | `ApiException` typed error — carries status code + message. |
| `api/hailo_backend_api_client.dart` | Concrete HTTP client wired to the HAILO backend. Use as template for `StarriaBackendApiClient`. |
| `google/google_distance_service.dart` | `GoogleDistanceService` — distance matrix call with stub fallback when key not configured. Fully generic. |
| `location/location_service.dart` | `LocationService` — `getCurrentPosition()` + `positionStream()` with permission handling and throttling. Fully generic. |
| `mapbox/mapbox_map_widget.dart` | Mapbox map widget — generic if STARRIA uses Mapbox. |
| `mapbox/offline_mapbox_manager.dart` | Offline tile download/management — valuable for low-connectivity markets. |

## STARRIA Use Case

- **`GoogleDistanceService`**: drop in for STARRIA ride fare estimation (distance × rate). The `isConfigured` guard and `_stubEstimate()` fallback mean it degrades gracefully in dev without an API key.
- **`LocationService`**: exact extraction — STARRIA's driver and rider apps need the same GPS permission-checking + throttled stream pattern.
- **`mapbox/`**: if STARRIA uses Mapbox, extract both files. The offline manager is particularly valuable for markets with poor data connectivity.
- **`api/`**: use `api_exception.dart` verbatim; use `api_config.dart` as a template with STARRIA endpoint values.

## Extraction Difficulty

**Low.** Every file in this folder is already a thin adapter over a third-party package — minimal HAILO-specific logic. The only HAILO identifier is the class name `HailoBackendApiClient`; rename to `StarriaBackendApiClient`. `GoogleDistanceService` and `LocationService` have zero HAILO references and can be copied verbatim.

## Candidate Package

`starria_integrations` — Flutter package wrapping location, maps, distance, and the backend API client. Keeps third-party dependency churn isolated from feature packages.
