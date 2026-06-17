# Vidzi → STARRIA Extraction: Overview

## What Was Extracted

Three reusable packages were distilled from the Vidzi FastAPI monolith:

| Package | Source location in Vidzi | Purpose |
|---|---|---|
| `video-core` | `app/services/video.py`, `app/services/storage.py`, `app/integrations/storage/`, `app/routers/storage.py`, `app/routers/rooms.py` | Upload lifecycle, video session tokens, transcoding/HLS/thumbnail stubs |
| `analytics-core` | `app/models.py` (`RoomParticipant`), `app/routers/rooms.py` (join/leave) | Watch session tracking, retention curves, viewer aggregations |
| `search-core` | `app/routers/discovery.py`, `RecommendationFeedbackRequest` | Content indexing, text search, recommendation engine with feedback loop |

## What Was Removed (Vidzi-Specific Business Rules)

- **Auth tokens, idempotency keys, ledger entries** — Vidzi payment/escrow system. Not included.
- **GlobalDesk, DeskAgent, Organization, WorkerProfile** — Vidzi country-desk marketplace. Removed from search/discovery.
- **DISCOVERY_CATEGORIES** (`commerce`, `debate`, `learn`, `work`) — hard-coded to Vidzi routes. Categories are now configurable in the application layer.
- **`X-VIDZI-MEDIA-SCAN-SIGNATURE` header** — renamed to `X-Media-Scan-Signature` (generic).
- **`fallback_country_desks()`** — Vidzi brand-specific placeholder. Removed.
- **`VIDZI` brand strings** in retention/moderation evidence fields.
- **`ShopLiveSession`, `EntertainmentRightsGrant`** — commerce/entertainment models not in scope.

## What Was Preserved

- **API contracts**: presigned upload URL → complete → scan-callback flow is identical.
- **StorageProvider protocol** (`readiness()` + `create_presigned_upload()`) — unchanged interface.
- **Video token response shape** (`provider`, `room_name`, `token`, `uid`, `expires_at`, `server_url`).
- **Recommendation feedback structure** (`action`, `reason`, `context`) — now stored in a proper table rather than JSON in UserSettings.
- **Scan status machine**: `PENDING → COMPLETED | SCAN_CLEAN | FLAGGED | REJECTED | QUARANTINED`.

## Architecture Pattern

Each package follows the same factory pattern to avoid hard-coding dependencies:

```python
# At application startup, wire your auth and DB into each router:
app.include_router(
    make_upload_router(upload_service, get_db, get_current_user)
)
app.include_router(
    make_analytics_router(get_db, get_current_user)
)
app.include_router(
    make_search_router(get_db, get_current_user, get_admin_user)
)
```

This means the packages are framework-aware (FastAPI + SQLAlchemy) but
application-agnostic — they do not import from your app's `models.py`,
`config.py`, or `dependencies.py`.
