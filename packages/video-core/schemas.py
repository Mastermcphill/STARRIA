from __future__ import annotations

from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    purpose: str = Field(..., max_length=64)
    file_name: str = Field(..., max_length=255)
    content_type: str = Field(..., max_length=128)


class UploadCompleteRequest(BaseModel):
    upload_id: str


class BatchUploadItem(BaseModel):
    purpose: str = Field(..., max_length=64)
    file_name: str = Field(..., max_length=255)
    content_type: str = Field(..., max_length=128)


class BatchUploadUrlRequest(BaseModel):
    items: list[BatchUploadItem] = Field(..., min_length=1, max_length=10)


class MediaScanResultRequest(BaseModel):
    media_id: str | None = None
    upload_id: str | None = None
    # CLEAN | FLAGGED | REJECTED | QUARANTINED | PENDING
    scan_status: str = Field(default="PENDING", max_length=32)


class VideoTokenRequest(BaseModel):
    room_id: str
    user_id: str


class VideoTokenResponse(BaseModel):
    provider: str
    room_name: str
    token: str
    uid: str
    expires_at: str
    server_url: str | None = None
