from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StorageProviderStatus:
    provider: str
    mode: str
    ready: bool
    status: str
    evidence: list[str]
    capabilities: dict[str, bool]
    placeholder: bool


@dataclass
class PresignedUpload:
    upload_url: str
    file_url: str
    object_key: str
    expires_in: int
    headers: dict[str, str]


class StorageProvider(Protocol):
    provider_id: str

    def readiness(self) -> StorageProviderStatus: ...

    async def create_presigned_upload(
        self,
        *,
        purpose: str,
        user_id: str,
        file_name: str,
        content_type: str,
    ) -> PresignedUpload: ...
