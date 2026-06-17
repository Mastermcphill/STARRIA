"""Transcoding and HLS packaging service interface.

Vidzi delegates transcoding to LiveKit for live streams and does not implement
VOD transcoding. This module defines the contract STARRIA should implement when
wiring FFmpeg, AWS MediaConvert, or a similar pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class TranscodeStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class HLSOutput:
    master_playlist_url: str
    segment_base_url: str
    renditions: list[dict]  # [{resolution, bitrate, playlist_url}]


@dataclass
class TranscodeJob:
    job_id: str
    status: TranscodeStatus
    source_url: str
    hls_output: HLSOutput | None = None
    error: str | None = None


class TranscodingProvider(Protocol):
    async def submit(self, *, source_url: str, output_prefix: str) -> TranscodeJob: ...

    async def status(self, job_id: str) -> TranscodeJob: ...


class PlaceholderTranscodingProvider:
    """Returns stub jobs — replace with MediaConvert, Mux, or FFmpeg pipeline."""

    async def submit(self, *, source_url: str, output_prefix: str) -> TranscodeJob:
        return TranscodeJob(
            job_id="placeholder",
            status=TranscodeStatus.PENDING,
            source_url=source_url,
        )

    async def status(self, job_id: str) -> TranscodeJob:
        return TranscodeJob(
            job_id=job_id,
            status=TranscodeStatus.PENDING,
            source_url="",
        )
