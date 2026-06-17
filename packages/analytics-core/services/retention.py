"""Retention curve computation.

A retention curve shows the fraction of viewers still watching at each
second (or bucket) of a video. Derived from ViewerEvent PLAY/PAUSE/END
records or from WatchSession last_position_seconds distributions.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import WatchSession


@dataclass
class RetentionPoint:
    position_seconds: float
    viewer_fraction: float  # 0.0–1.0


def compute_retention_curve(
    db: Session,
    *,
    content_id: str,
    bucket_size_seconds: float = 10.0,
    content_duration_seconds: float | None = None,
) -> list[RetentionPoint]:
    """Build a retention curve from completed WatchSession records.

    Returns one RetentionPoint per bucket. viewer_fraction is the fraction
    of viewers who watched at least to that position.
    """
    sessions = db.scalars(
        select(WatchSession).where(
            WatchSession.content_id == content_id,
            WatchSession.left_at.isnot(None),
        )
    ).all()

    if not sessions:
        return []

    total = len(sessions)
    duration = content_duration_seconds or max(
        (s.last_position_seconds or 0.0) for s in sessions
    )
    if not duration:
        return []

    bucket_count = int(duration / bucket_size_seconds) + 1
    buckets: list[RetentionPoint] = []

    for i in range(bucket_count):
        position = i * bucket_size_seconds
        viewers_at = sum(
            1
            for s in sessions
            if _last_position(s) >= position
        )
        buckets.append(RetentionPoint(
            position_seconds=position,
            viewer_fraction=viewers_at / total,
        ))

    return buckets


def _last_position(session: WatchSession) -> float:
    if session.last_position_seconds is not None:
        return session.last_position_seconds
    if session.left_at and session.joined_at:
        return max(0.0, (session.left_at - session.joined_at).total_seconds())
    return 0.0
