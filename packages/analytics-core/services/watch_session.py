"""Watch session lifecycle: join, leave, duration computation."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import WatchSession, uuid_str


def join_session(
    db: Session,
    *,
    user_id: str,
    content_id: str,
    content_type: str = "LIVE",
) -> WatchSession:
    """Start or resume a watch session for (user, content)."""
    existing = db.scalar(
        select(WatchSession).where(
            WatchSession.user_id == user_id,
            WatchSession.content_id == content_id,
            WatchSession.left_at.is_(None),
        )
    )
    if existing:
        return existing

    session = WatchSession(
        id=uuid_str(),
        user_id=user_id,
        content_id=content_id,
        content_type=content_type,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()
    return session


def leave_session(
    db: Session,
    *,
    user_id: str,
    content_id: str,
    last_position_seconds: float | None = None,
    content_duration_seconds: float | None = None,
) -> WatchSession | None:
    session = db.scalar(
        select(WatchSession).where(
            WatchSession.user_id == user_id,
            WatchSession.content_id == content_id,
            WatchSession.left_at.is_(None),
        )
    )
    if not session:
        return None

    session.left_at = datetime.now(timezone.utc)
    if last_position_seconds is not None:
        session.last_position_seconds = last_position_seconds
    if content_duration_seconds is not None:
        session.content_duration_seconds = content_duration_seconds
    db.flush()
    return session


def watch_duration_seconds(session: WatchSession) -> float | None:
    if not session.left_at:
        return None
    delta = session.left_at - session.joined_at
    return max(0.0, delta.total_seconds())


def completion_ratio(session: WatchSession) -> float | None:
    """Returns 0.0–1.0 completion, or None if data is insufficient."""
    if session.content_duration_seconds and session.last_position_seconds is not None:
        return min(1.0, session.last_position_seconds / session.content_duration_seconds)
    duration = watch_duration_seconds(session)
    if duration is not None and session.content_duration_seconds:
        return min(1.0, duration / session.content_duration_seconds)
    return None
