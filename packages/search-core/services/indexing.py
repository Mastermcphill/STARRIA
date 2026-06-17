"""Content indexing service.

Maintains the ContentIndex table so search queries have up-to-date records.
Call `index_content()` when content is created or updated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ContentIndex, uuid_str


@dataclass
class IndexEntry:
    content_type: str
    content_id: str
    title: str
    body: str | None = None
    language_code: str = "en"
    tags: list[str] = field(default_factory=list)
    score: float = 0.0


def index_content(db: Session, entry: IndexEntry) -> ContentIndex:
    """Upsert a content index record."""
    existing = db.scalar(
        select(ContentIndex).where(
            ContentIndex.content_type == entry.content_type,
            ContentIndex.content_id == entry.content_id,
        )
    )
    if existing:
        existing.title = entry.title
        existing.body = entry.body
        existing.language_code = entry.language_code
        existing.tags = entry.tags
        existing.score = entry.score
        existing.updated_at = datetime.now(timezone.utc)
        db.flush()
        return existing

    record = ContentIndex(
        id=uuid_str(),
        content_type=entry.content_type,
        content_id=entry.content_id,
        title=entry.title,
        body=entry.body,
        language_code=entry.language_code,
        tags=entry.tags,
        score=entry.score,
    )
    db.add(record)
    db.flush()
    return record


def remove_content(db: Session, *, content_type: str, content_id: str) -> bool:
    record = db.scalar(
        select(ContentIndex).where(
            ContentIndex.content_type == content_type,
            ContentIndex.content_id == content_id,
        )
    )
    if not record:
        return False
    db.delete(record)
    db.flush()
    return True


def bulk_index(db: Session, entries: list[IndexEntry]) -> list[ContentIndex]:
    return [index_content(db, e) for e in entries]
