"""Search and recommendation models.

Generalizes Vidzi's discovery router patterns (SQL-backed search over profiles,
organizations, workers, classes) into a type-generic content index.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uuid_str() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class ContentIndex(Base):
    """Flat search index entry for any content type.

    Replace with an Elasticsearch/Typesense sync when ready for full-text search.
    Until then, SQL ILIKE queries against this table are sufficient for MVP scale.
    """

    __tablename__ = "content_index"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    # e.g. "video", "room", "user", "class", "product"
    content_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # FK to the originating table — opaque string, no FK constraint so this table
    # can index content from any service without coupling to its schema.
    content_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Language of the content (ISO 639-1)
    language_code: Mapped[str] = mapped_column(String, nullable=False, default="en")
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Popularity signal — higher = ranked earlier in results
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    indexed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RecommendationFeedback(Base):
    """User feedback on a recommendation card (seen, clicked, dismissed, reported).

    Directly extracted from Vidzi's discovery.RecommendationFeedbackRequest pattern
    and stored in UserSettings.metadata_json — now a proper table.
    """

    __tablename__ = "recommendation_feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    recommendation_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # seen | clicked | dismissed | reported
    action: Mapped[str] = mapped_column(String, nullable=False, default="seen")
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
