from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import MediaUpload, uuid_str
from ..providers.base import StorageProvider, StorageProviderStatus

# Default purpose → allowed MIME types map. Callers extend this at app startup.
DEFAULT_ALLOWED_PURPOSES: dict[str, set[str]] = {
    "PROFILE_AVATAR": {"image/jpeg", "image/png", "image/webp"},
    "PRODUCT_IMAGE": {"image/jpeg", "image/png", "image/webp"},
    "CLASS_MATERIAL": {"application/pdf", "image/jpeg", "image/png", "text/plain"},
    "DISPUTE_EVIDENCE": {"image/jpeg", "image/png", "application/pdf", "video/mp4"},
    "VERIFICATION_DOCUMENT": {"image/jpeg", "image/png", "application/pdf"},
    "ROOM_MEDIA": {"image/jpeg", "image/png", "image/webp", "video/mp4"},
    "VIDEO_UPLOAD": {"video/mp4", "video/webm", "video/quicktime"},
    "THUMBNAIL": {"image/jpeg", "image/png", "image/webp"},
}

UPLOAD_EXPIRY_MINUTES = 15
SCAN_ALLOWED_STATUSES = {"CLEAN", "FLAGGED", "REJECTED", "QUARANTINED", "PENDING"}


def _safe_file_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name)[:180]


class UploadService:
    def __init__(
        self,
        provider: StorageProvider,
        public_base_url: str,
        allowed_purposes: dict[str, set[str]] | None = None,
    ):
        self._provider = provider
        self._public_base_url = public_base_url
        self._allowed = {**DEFAULT_ALLOWED_PURPOSES, **(allowed_purposes or {})}

    def provider_status(self) -> dict:
        s: StorageProviderStatus = self._provider.readiness()
        return {
            "provider": s.provider,
            "mode": s.mode,
            "ready": s.ready,
            "status": s.status,
            "evidence": s.evidence,
            "capabilities": s.capabilities,
            "placeholder": s.placeholder,
        }

    def validate_upload_request(self, purpose: str, file_name: str, content_type: str) -> None:
        allowed = self._allowed.get(purpose)
        if not allowed:
            raise HTTPException(status_code=400, detail=f"Unsupported upload purpose: {purpose}")
        if content_type not in allowed:
            raise HTTPException(status_code=400, detail=f"Content-type {content_type!r} not allowed for {purpose}")
        if not file_name:
            raise HTTPException(status_code=400, detail="file_name is required")

    def create_upload_record(
        self,
        db: Session,
        *,
        user_id: str,
        purpose: str,
        file_name: str,
        content_type: str,
    ) -> MediaUpload:
        upload_id = uuid_str()
        storage_key = f"{purpose.lower()}/{user_id}/{upload_id}-{_safe_file_name(file_name)}"
        file_url = f"{self._public_base_url.rstrip('/')}/{storage_key}"
        upload = MediaUpload(
            id=upload_id,
            user_id=user_id,
            purpose=purpose,
            file_name=file_name,
            content_type=content_type,
            storage_key=storage_key,
            file_url=file_url,
            status="PENDING",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=UPLOAD_EXPIRY_MINUTES),
        )
        db.add(upload)
        db.flush()
        return upload

    def placeholder_signed_url(self, upload: MediaUpload) -> str:
        return f"https://upload.local/put/{upload.id}?key={upload.storage_key}"

    def readiness_for(self, upload: MediaUpload) -> dict:
        provider = self.provider_status()
        scan_status = upload.status.upper()
        clean = upload.status == "COMPLETED" or scan_status == "SCAN_CLEAN"
        return {
            "provider": provider["provider"],
            "provider_ready": provider["ready"],
            "provider_mode": provider["mode"],
            "upload_url_issued": True,
            "object_key_reserved": bool(upload.storage_key),
            "completion_callback_recorded": bool(upload.completed_at),
            "cloud_upload_confirmed": not provider["placeholder"],
            "scan_clean": clean,
            "placeholder": provider["placeholder"],
        }

    def mark_completed(self, db: Session, upload: MediaUpload) -> None:
        upload.status = "COMPLETED"
        upload.completed_at = datetime.now(timezone.utc)

    def apply_scan_result(self, db: Session, upload: MediaUpload, scan_status: str) -> None:
        if scan_status not in SCAN_ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unsupported scan status: {scan_status}")
        if scan_status == "CLEAN":
            upload.status = "COMPLETED" if upload.completed_at else "SCAN_CLEAN"
        elif scan_status == "PENDING":
            upload.status = "SCAN_PENDING"
        else:
            upload.status = scan_status

    @property
    def allowed_purposes(self) -> dict[str, list[str]]:
        return {p: sorted(ct) for p, ct in sorted(self._allowed.items())}
