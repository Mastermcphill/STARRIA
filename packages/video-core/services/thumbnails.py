"""Thumbnail generation service stub.

Vidzi does not implement server-side thumbnail generation — avatars and product
images are uploaded directly by the client. This module provides the interface
that STARRIA should implement when adding FFmpeg-based or cloud-based thumbnail
extraction for uploaded videos.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ThumbnailResult:
    url: str
    width: int
    height: int
    timestamp_seconds: float


class ThumbnailProvider(Protocol):
    async def generate(
        self,
        *,
        video_url: str,
        timestamps_seconds: list[float],
        width: int = 320,
    ) -> list[ThumbnailResult]: ...


class PlaceholderThumbnailProvider:
    """Returns empty results — replace with FFmpeg or cloud provider."""

    async def generate(
        self,
        *,
        video_url: str,
        timestamps_seconds: list[float],
        width: int = 320,
    ) -> list[ThumbnailResult]:
        return []
