"""Viewer analytics aggregation.

Aggregates session-level data into per-content statistics: total views,
unique viewers, average watch time, peak concurrency, and completion rate.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ..models import WatchSession
from .watch_session import completion_ratio, watch_duration_seconds


@dataclass
class ContentViewerStats:
    content_id: str
    total_sessions: int
    unique_viewers: int
    avg_watch_seconds: float | None
    completion_rate: float | None   # average across completed sessions
    peak_concurrent: int            # max simultaneous active sessions


def get_viewer_stats(db: Session, *, content_id: str) -> ContentViewerStats:
    sessions = db.scalars(
        select(WatchSession).where(WatchSession.content_id == content_id)
    ).all()

    if not sessions:
        return ContentViewerStats(
            content_id=content_id,
            total_sessions=0,
            unique_viewers=0,
            avg_watch_seconds=None,
            completion_rate=None,
            peak_concurrent=0,
        )

    unique = len({s.user_id for s in sessions})
    completed = [s for s in sessions if s.left_at is not None]
    durations = [d for s in completed if (d := watch_duration_seconds(s)) is not None]
    completions = [r for s in completed if (r := completion_ratio(s)) is not None]

    avg_watch = sum(durations) / len(durations) if durations else None
    avg_completion = sum(completions) / len(completions) if completions else None
    peak = _peak_concurrent(sessions)

    return ContentViewerStats(
        content_id=content_id,
        total_sessions=len(sessions),
        unique_viewers=unique,
        avg_watch_seconds=avg_watch,
        completion_rate=avg_completion,
        peak_concurrent=peak,
    )


def _peak_concurrent(sessions: list[WatchSession]) -> int:
    """Count the maximum number of overlapping sessions using a sweep-line."""
    events: list[tuple[float, int]] = []
    for s in sessions:
        join_ts = s.joined_at.timestamp()
        leave_ts = s.left_at.timestamp() if s.left_at else join_ts + 1
        events.append((join_ts, +1))
        events.append((leave_ts, -1))

    events.sort(key=lambda e: (e[0], e[1]))
    peak = current = 0
    for _, delta in events:
        current += delta
        peak = max(peak, current)
    return peak


def list_top_content(
    db: Session,
    *,
    limit: int = 20,
    content_type: str | None = None,
) -> list[dict]:
    """Return the most-viewed content items by session count."""
    stmt = (
        select(
            WatchSession.content_id,
            func.count(WatchSession.id).label("session_count"),
            func.count(distinct(WatchSession.user_id)).label("unique_viewers"),
        )
        .group_by(WatchSession.content_id)
        .order_by(func.count(WatchSession.id).desc())
        .limit(limit)
    )
    if content_type:
        stmt = stmt.where(WatchSession.content_type == content_type)

    rows = db.execute(stmt).all()
    return [
        {"content_id": r.content_id, "session_count": r.session_count, "unique_viewers": r.unique_viewers}
        for r in rows
    ]
