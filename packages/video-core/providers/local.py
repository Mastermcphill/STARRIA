from __future__ import annotations

import re
from datetime import datetime, timezone

from .base import PresignedUpload, StorageProviderStatus


class LocalPlaceholderStorageProvider:
    """Dev-only provider that issues deterministic local upload URLs without cloud persistence."""

    provider_id = "local-placeholder"

    def __init__(self, *, public_base_url: str = "http://localhost:8000/media", upload_url_expires_seconds: int = 900):
        self._public_base_url = public_base_url
        self._expires = upload_url_expires_seconds

    def readiness(self) -> StorageProviderStatus:
        return StorageProviderStatus(
            provider=self.provider_id,
            mode="local-placeholder",
            ready=True,
            status="placeholder",
            evidence=[
                "issues deterministic local upload URLs only",
                "does not confirm object persistence",
                "media scan callbacks accepted but scanner execution is external",
            ],
            capabilities={
                "presigned_upload_urls": True,
                "batch_upload_urls": True,
                "scan_callbacks": True,
                "cloud_object_persistence": False,
                "retention_enforcement": False,
                "rights_clearance": False,
            },
            placeholder=True,
        )

    async def create_presigned_upload(
        self,
        *,
        purpose: str,
        user_id: str,
        file_name: str,
        content_type: str,
    ) -> PresignedUpload:
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", file_name)[:180]
        timestamp = int(datetime.now(timezone.utc).timestamp())
        object_key = f"{purpose.lower()}/{user_id}/local-{timestamp}-{safe_name}"
        return PresignedUpload(
            upload_url=f"https://upload.local/put?key={object_key}",
            file_url=f"{self._public_base_url.rstrip('/')}/{object_key}",
            object_key=object_key,
            expires_in=self._expires,
            headers={"Content-Type": content_type},
        )
