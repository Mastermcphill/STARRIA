from __future__ import annotations

from pydantic import BaseModel


class WatchSessionOut(BaseModel):
    session_id: str
    content_id: str
    user_id: str
    content_type: str
    joined_at: str
    left_at: str | None = None
    last_position_seconds: float | None = None
    completion_rate: float | None = None


class RetentionPoint(BaseModel):
    position_seconds: float
    viewer_fraction: float


class RetentionCurveOut(BaseModel):
    content_id: str
    bucket_size_seconds: float
    data_points: int
    curve: list[RetentionPoint]


class ContentStatsOut(BaseModel):
    content_id: str
    total_sessions: int
    unique_viewers: int
    avg_watch_seconds: float | None
    completion_rate: float | None
    peak_concurrent: int
