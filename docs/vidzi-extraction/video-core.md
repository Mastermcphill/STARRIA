# video-core Migration Guide

## Source files in Vidzi

| STARRIA file | Vidzi source |
|---|---|
| `providers/base.py` | `app/integrations/storage/base.py` |
| `providers/local.py` | `app/integrations/storage/local.py` |
| `providers/s3_r2.py` | `app/integrations/storage/s3_r2.py` |
| `providers/factory.py` | `app/integrations/storage/service.py` |
| `services/upload.py` | `app/services/storage.py` |
| `services/streaming.py` | `app/services/video.py` |
| `routers/uploads.py` | `app/routers/storage.py` |
| `routers/streaming.py` | `app/routers/rooms.py` (video-token endpoint only) |
| `services/transcoding.py` | New stub (no Vidzi source — LiveKit handles live transcoding) |
| `services/thumbnails.py` | New stub (no Vidzi source — client uploads images directly) |
| `services/metadata.py` | New stub (no Vidzi source — only MIME type was stored) |
| `models.py` | `app/models.py` (`StorageUpload` table) |

## Breaking changes from Vidzi

### 1. Scan callback header renamed
```
# Vidzi
X-VIDZI-MEDIA-SCAN-SIGNATURE

# STARRIA
X-Media-Scan-Signature
```
Update any scanner webhook configurations to send the new header name.

### 2. `StorageService` is now `UploadService`, instantiated not imported
```python
# Vidzi — called as a static class
StorageService.create_upload_url(db, user=user, ...)

# STARRIA — instantiate with provider + config
upload_service = UploadService(provider, public_base_url="https://cdn.example.com")
upload_service.create_upload_record(db, user_id=user.id, ...)
```

### 3. `ALLOWED_PURPOSES` is now configurable
```python
# Vidzi — hardcoded in services/storage.py
ALLOWED_PURPOSES = {"PROFILE_AVATAR": {"image/jpeg", ...}, ...}

# STARRIA — pass custom purposes at startup
upload_service = UploadService(
    provider,
    public_base_url="...",
    allowed_purposes={"VIDEO_UPLOAD": {"video/mp4", "video/webm"}},
)
```

### 4. Storage provider factory takes explicit config
```python
# Vidzi — reads from global settings object
def get_storage_provider() -> StorageProvider:
    selected = get_settings().storage_provider.lower()
    ...

# STARRIA — pass config explicitly
from video_core.providers import get_storage_provider, S3Config

provider = get_storage_provider(
    "s3-r2",
    s3_config=S3Config(
        bucket="my-bucket",
        access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        endpoint_url="https://my-account.r2.cloudflarestorage.com",
    ),
)
```

### 5. Router factory pattern replaces direct router import
```python
# Vidzi — router was imported and mounted directly
from app.routers.storage import router
app.include_router(router, prefix="/storage")

# STARRIA — construct router with injected dependencies
from video_core.routers import make_upload_router

app.include_router(
    make_upload_router(
        upload_service=upload_service,
        get_db=get_db,
        get_current_user=get_current_user,
        media_scan_secret=os.environ.get("MEDIA_SCAN_SECRET"),
        is_dev=os.environ.get("ENV") == "dev",
    )
)
```

## Database migration

The `media_uploads` table corresponds to Vidzi's `storage_uploads` table.
Column mapping:

| Vidzi (`storage_uploads`) | STARRIA (`media_uploads`) |
|---|---|
| `id` | `id` |
| `user_id` | `user_id` |
| `purpose` | `purpose` |
| `file_name` | `file_name` |
| `content_type` | `content_type` |
| `storage_key` | `storage_key` |
| `file_url` | `file_url` |
| `status` | `status` |
| `created_at` | `created_at` |
| `expires_at` | `expires_at` |
| `completed_at` | `completed_at` |

Migration SQL:
```sql
INSERT INTO media_uploads
  SELECT id, user_id, purpose, file_name, content_type,
         storage_key, file_url, status, created_at, expires_at, completed_at
  FROM storage_uploads;
```

## Transcoding / HLS / Thumbnails

These are **stub interfaces** — Vidzi does not implement server-side
transcoding or thumbnail generation. The stubs define the expected contract:

- `TranscodingProvider.submit(source_url, output_prefix) → TranscodeJob`
- `TranscodingProvider.status(job_id) → TranscodeJob`
- `ThumbnailProvider.generate(video_url, timestamps_seconds, width) → list[ThumbnailResult]`
- `MetadataExtractor.extract(file_url) → VideoMetadata`

Wire production implementations (FFmpeg, AWS MediaConvert, Mux) by replacing
`PlaceholderTranscodingProvider` at app startup.
