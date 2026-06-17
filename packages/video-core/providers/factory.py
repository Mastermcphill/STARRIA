from __future__ import annotations

from .base import StorageProvider
from .local import LocalPlaceholderStorageProvider
from .s3_r2 import S3Config, S3R2StorageProvider


def get_storage_provider(
    provider_name: str,
    *,
    s3_config: S3Config | None = None,
    public_base_url: str = "http://localhost:8000/media",
    upload_url_expires_seconds: int = 900,
) -> StorageProvider:
    """Return the appropriate StorageProvider for the given name.

    provider_name: one of "s3", "r2", "s3-r2", "local", or "placeholder"
    s3_config: required when provider_name is an S3-compatible variant
    """
    normalized = provider_name.strip().lower()
    if normalized in {"s3", "r2", "s3-r2", "s3_r2"}:
        if not s3_config:
            raise ValueError("s3_config is required for S3/R2 storage provider")
        return S3R2StorageProvider(s3_config)
    return LocalPlaceholderStorageProvider(
        public_base_url=public_base_url,
        upload_url_expires_seconds=upload_url_expires_seconds,
    )
