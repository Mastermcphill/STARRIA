"""Video metadata extraction service.

Extracts duration, resolution, codec, bitrate, and frame-rate from uploaded
video files. Vidzi stores only MIME type and file name; STARRIA extends this
with rich video metadata on completion.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class VideoMetadata:
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    video_codec: str | None = None
    audio_codec: str | None = None
    bitrate_kbps: int | None = None
    size_bytes: int | None = None
    extra: dict = field(default_factory=dict)


class MetadataExtractor(Protocol):
    async def extract(self, *, file_url: str) -> VideoMetadata: ...


class PlaceholderMetadataExtractor:
    """Returns empty metadata — replace with ffprobe or MediaInfo."""

    async def extract(self, *, file_url: str) -> VideoMetadata:
        return VideoMetadata()
