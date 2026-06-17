"""Analytics data models.

Derived from Vidzi's RoomParticipant.joined_at / left_at pattern, generalized
to track any watch session across content types (live rooms, VOD, classes).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uuid_str() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class WatchSession(Base):
    """One viewer's engagement with one piece of content."""

    __tablename__ = "watch_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    # Generic identifiers — no Vidzi-specific FK references
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    content_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # LIVE | VOD | CLASS | REPLAY
    content_type: Mapped[str] = mapped_column(String, nullable=False, default="LIVE")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Seconds into the content when the session ended (VOD/replay only)
    last_position_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Total content duration at time of viewing (null for live)
    content_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)


class ViewerEvent(Base):
    """Granular playback events emitted by the client (play, pause, seek, buffer, quality-change)."""

    __tablename__ = "viewer_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    session_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    content_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # PLAY | PAUSE | SEEK | BUFFER | QUALITY_CHANGE | END
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    position_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ContentAnalyticsSnapshot(Base):
    """Materialized analytics per content item, updated periodically."""

    __tablename__ = "content_analytics_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    content_id: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    total_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unique_viewers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_watch_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_concurrent_viewers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
