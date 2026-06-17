from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from .base import PresignedUpload, StorageProviderStatus


@dataclass
class S3Config:
    bucket: str
    access_key_id: str
    secret_access_key: str
    region: str = "auto"
    endpoint_url: str | None = None
    public_base_url: str | None = None
    upload_url_expires_seconds: int = 900


# Maps upload purpose to an S3 path prefix. Callers may extend this dict.
PURPOSE_PREFIX_MAP: dict[str, str] = {
    "PROFILE_AVATAR": "profiles",
    "PRODUCT_IMAGE": "products",
    "CLASS_MATERIAL": "classes",
    "DISPUTE_EVIDENCE": "disputes",
    "VERIFICATION_DOCUMENT": "verifications",
    "ROOM_MEDIA": "rooms",
    "VIDEO_UPLOAD": "videos",
    "THUMBNAIL": "thumbnails",
}


class S3R2StorageProvider:
    """S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO, etc.)."""

    provider_id = "s3-r2"

    def __init__(self, config: S3Config, purpose_prefix_map: dict[str, str] | None = None):
        self._cfg = config
        self._purpose_prefix_map = {**PURPOSE_PREFIX_MAP, **(purpose_prefix_map or {})}

    def readiness(self) -> StorageProviderStatus:
        cfg = self._cfg
        configured = {
            "bucket": bool(cfg.bucket),
            "access_key": bool(cfg.access_key_id),
            "secret_key": bool(cfg.secret_access_key),
        }
        ready = all(configured.values())
        evidence = [
            f"bucket {'configured' if configured['bucket'] else 'missing'}",
            f"access_key_id {'configured' if configured['access_key'] else 'missing'}",
            f"secret_access_key {'configured' if configured['secret_key'] else 'missing'}",
        ]
        if cfg.endpoint_url:
            evidence.append(f"endpoint_url configured: {cfg.endpoint_url}")
        if cfg.public_base_url:
            evidence.append(f"public_base_url configured: {cfg.public_base_url}")
        return StorageProviderStatus(
            provider=self.provider_id,
            mode="provider-backed",
            ready=ready,
            status="ready" if ready else "configuration_required",
            evidence=evidence,
            capabilities={
                "presigned_upload_urls": ready,
                "batch_upload_urls": ready,
                "scan_callbacks": True,
                "cloud_object_persistence": ready,
                "retention_enforcement": False,
                "rights_clearance": False,
            },
            placeholder=False,
        )

    def _safe_name(self, file_name: str) -> str:
        stem = Path(file_name).stem[:80]
        suffix = Path(file_name).suffix.lower()[:16]
        stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-") or "file"
        return f"{stem}{suffix}"

    async def create_presigned_upload(
        self,
        *,
        purpose: str,
        user_id: str,
        file_name: str,
        content_type: str,
    ) -> PresignedUpload:
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3/R2 storage — pip install boto3") from exc

        prefix = self._purpose_prefix_map.get(purpose, purpose.lower())
        safe_name = self._safe_name(file_name)
        object_key = f"{prefix}/{user_id}/{uuid.uuid4()}-{safe_name}"
        cfg = self._cfg

        client = boto3.client(
            "s3",
            endpoint_url=cfg.endpoint_url,
            region_name=cfg.region,
            aws_access_key_id=cfg.access_key_id,
            aws_secret_access_key=cfg.secret_access_key,
        )

        upload_url: str = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": cfg.bucket, "Key": object_key, "ContentType": content_type},
            ExpiresIn=cfg.upload_url_expires_seconds,
        )

        if cfg.public_base_url:
            file_url = f"{cfg.public_base_url.rstrip('/')}/{object_key}"
        elif cfg.endpoint_url:
            file_url = f"{cfg.endpoint_url.rstrip('/')}/{cfg.bucket}/{object_key}"
        else:
            file_url = f"https://{cfg.bucket}.s3.amazonaws.com/{object_key}"

        return PresignedUpload(
            upload_url=upload_url,
            file_url=file_url,
            object_key=object_key,
            expires_in=cfg.upload_url_expires_seconds,
            headers={"Content-Type": content_type},
        )
