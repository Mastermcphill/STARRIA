# Vidzi → STARRIA Extraction

This directory documents the extraction of reusable video infrastructure
from the Vidzi monolith into STARRIA shared packages.

## Packages

| Package | Path | Guide |
|---|---|---|
| `video-core` | `packages/video-core/` | [video-core.md](./video-core.md) |
| `analytics-core` | `packages/analytics-core/` | [analytics-core.md](./analytics-core.md) |
| `search-core` | `packages/search-core/` | [search-core.md](./search-core.md) |

## Full overview

See [overview.md](./overview.md) for what was extracted, what was removed,
and the shared architectural pattern.

## Quick start

```python
from video_core.providers import get_storage_provider, S3Config
from video_core.services.upload import UploadService
from video_core.routers import make_upload_router, make_streaming_router
from analytics_core.routers import make_analytics_router
from search_core.routers import make_search_router

# 1. Configure storage
provider = get_storage_provider("s3-r2", s3_config=S3Config(...))
upload_service = UploadService(provider, public_base_url="https://cdn.example.com")

# 2. Mount routers
app.include_router(make_upload_router(upload_service, get_db, get_current_user))
app.include_router(make_streaming_router(get_db, get_current_user, get_room=..., ensure_participant=...))
app.include_router(make_analytics_router(get_db, get_current_user))
app.include_router(make_search_router(get_db, get_current_user))

# 3. Index content when it is created
from search_core.services import index_content, IndexEntry
index_content(db, IndexEntry(content_type="video", content_id=video.id, title=video.title))

# 4. Track watch sessions
from analytics_core.services import join_session, leave_session
join_session(db, user_id=user.id, content_id=video.id, content_type="VOD")
```
