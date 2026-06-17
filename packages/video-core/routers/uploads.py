"""Upload lifecycle endpoints: presign → upload → complete → scan callback → query."""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from hmac import compare_digest
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..models import MediaUpload
from ..schemas import BatchUploadItem, UploadCompleteRequest, UploadUrlRequest
from ..services.upload import UploadService

router = APIRouter(prefix="/media", tags=["media", "uploads"])

# Override these in your app to inject auth and the configured UploadService.
# The stubs below show the required signatures.

MAX_BATCH = 10
SCAN_CALLBACK_HEADER = "X-Media-Scan-Signature"  # was X-VIDZI-MEDIA-SCAN-SIGNATURE in Vidzi


def _scan_signature_ok(secret: str, signature: str | None, body: bytes) -> bool:
    if not signature:
        return False
    sig = signature.removeprefix("sha256=").strip()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return compare_digest(sig, expected)


def serialize_upload_url(upload: MediaUpload, upload_service: UploadService) -> dict[str, Any]:
    return {
        "upload_id": upload.id,
        "media_id": upload.id,
        "upload_url": upload_service.placeholder_signed_url(upload),
        "file_url": upload.file_url,
        "storage_key": upload.storage_key,
        "expires_at": upload.expires_at,
        "status": upload.status,
        "readiness": upload_service.readiness_for(upload),
    }


def serialize_media(upload: MediaUpload, upload_service: UploadService) -> dict[str, Any]:
    scan_raw = upload.status.upper()
    scan_clean = upload.status in {"COMPLETED", "SCAN_CLEAN"}
    scan_status = (
        "CLEAN" if scan_clean
        else scan_raw.removeprefix("SCAN_") if scan_raw.startswith("SCAN_")
        else scan_raw
    )
    return {
        "media_id": upload.id,
        "upload_id": upload.id,
        "purpose": upload.purpose,
        "file_name": upload.file_name,
        "content_type": upload.content_type,
        "file_url": upload.file_url,
        "storage_key": upload.storage_key,
        "status": upload.status,
        "scan_status": scan_status,
        "readiness": upload_service.readiness_for(upload),
        "created_at": upload.created_at,
        "completed_at": upload.completed_at,
        "expires_at": upload.expires_at,
    }


def make_upload_router(
    upload_service: UploadService,
    get_db,           # Callable → Session
    get_current_user,  # Callable → user with .id: str
    media_scan_secret: str | None = None,
    is_dev: bool = False,
) -> APIRouter:
    """Factory that wires an UploadService into a FastAPI router.

    Use this rather than importing the router directly so the service
    and auth dependencies can be injected at application startup.
    """

    r = APIRouter(prefix="/media", tags=["media"])

    @r.post("/upload-url")
    async def create_upload_url(
        payload: UploadUrlRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        upload_service.validate_upload_request(payload.purpose, payload.file_name, payload.content_type)
        upload = upload_service.create_upload_record(
            db,
            user_id=current_user.id,
            purpose=payload.purpose,
            file_name=payload.file_name,
            content_type=payload.content_type,
        )
        db.commit()
        return serialize_upload_url(upload, upload_service)

    @r.post("/complete")
    async def complete_upload(
        payload: UploadCompleteRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        upload = db.get(MediaUpload, payload.upload_id)
        if not upload or upload.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Upload not found")
        upload_service.mark_completed(db, upload)
        db.commit()
        return {"completed": True, "file_url": upload.file_url}

    @r.post("/upload-url/batch")
    async def batch_upload_urls(
        payload: dict[str, Any],
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        raw_items = payload.get("items") or payload.get("uploads") or []
        if not isinstance(raw_items, list) or not raw_items:
            raise HTTPException(status_code=400, detail="Provide one or more upload items")
        if len(raw_items) > MAX_BATCH:
            raise HTTPException(status_code=400, detail=f"Batch limited to {MAX_BATCH} items")

        items: list[BatchUploadItem] = []
        for i, item in enumerate(raw_items):
            if not isinstance(item, dict):
                raise HTTPException(status_code=400, detail=f"Item {i} must be an object")
            try:
                parsed = BatchUploadItem(**{k: item[k] for k in ("purpose", "file_name", "content_type")})
            except (KeyError, ValueError):
                raise HTTPException(status_code=400, detail=f"Item {i} missing purpose/file_name/content_type")
            upload_service.validate_upload_request(parsed.purpose, parsed.file_name, parsed.content_type)
            items.append(parsed)

        uploads: list[MediaUpload] = []
        try:
            for item in items:
                uploads.append(
                    upload_service.create_upload_record(
                        db,
                        user_id=current_user.id,
                        purpose=item.purpose,
                        file_name=item.file_name,
                        content_type=item.content_type,
                    )
                )
        except Exception:
            db.rollback()
            raise
        db.commit()
        return {
            "count": len(uploads),
            "items": [serialize_upload_url(u, upload_service) for u in uploads],
        }

    @r.post("/scan-result")
    async def record_scan_result(
        request: Request,
        payload: dict[str, Any],
        x_scan_sig: str | None = Header(default=None, alias=SCAN_CALLBACK_HEADER),
        db: Session = Depends(get_db),
    ):
        if media_scan_secret:
            body = await request.body()
            if not _scan_signature_ok(media_scan_secret, x_scan_sig, body):
                if not is_dev:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid scan callback signature")

        media_id = payload.get("media_id") or payload.get("upload_id")
        if not media_id:
            raise HTTPException(status_code=400, detail="media_id is required")
        upload = db.get(MediaUpload, str(media_id))
        if not upload:
            raise HTTPException(status_code=404, detail="Media not found")

        scan_status = str(payload.get("scan_status") or payload.get("status") or "PENDING").upper()
        upload_service.apply_scan_result(db, upload, scan_status)
        db.commit()
        return {
            "accepted": True,
            "media_id": upload.id,
            "scan_status": scan_status,
            "action": "allow" if scan_status == "CLEAN" else "review",
            "readiness": upload_service.readiness_for(upload),
        }

    @r.get("/uploads/{media_id}")
    def get_media(
        media_id: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        upload = db.get(MediaUpload, media_id)
        if not upload or upload.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Media not found")
        return serialize_media(upload, upload_service)

    @r.get("/providers")
    def storage_providers():
        status_info = upload_service.provider_status()
        return {
            "active_provider": status_info["provider"],
            "mode": status_info["mode"],
            "ready": status_info["ready"],
            "status": status_info["status"],
            "allowed_purposes": upload_service.allowed_purposes,
            "provider": status_info,
        }

    return r
