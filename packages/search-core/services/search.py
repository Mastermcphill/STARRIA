"""Video / content search service.

SQL-backed full-text search over ContentIndex. Designed so the query layer
can be swapped for Elasticsearch, Typesense, or Meilisearch without changing
the router or application code.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import ContentIndex


@dataclass
class SearchResult:
    content_type: str
    content_id: str
    title: str
    body: str | None
    language_code: str
    tags: list
    score: float


@dataclass
class SearchQuery:
    q: str
    content_types: list[str] | None = None
    language_code: str | None = None
    limit: int = 20
    offset: int = 0


def search(db: Session, query: SearchQuery) -> list[SearchResult]:
    """Case-insensitive title + body search with optional filters."""
    term = f"%{query.q.strip()}%"
    stmt = (
        select(ContentIndex)
        .where(
            or_(
                ContentIndex.title.ilike(term),
                ContentIndex.body.ilike(term),
            )
        )
        .order_by(ContentIndex.score.desc(), ContentIndex.indexed_at.desc())
        .offset(query.offset)
        .limit(min(query.limit, 100))
    )
    if query.content_types:
        stmt = stmt.where(ContentIndex.content_type.in_(query.content_types))
    if query.language_code:
        stmt = stmt.where(ContentIndex.language_code == query.language_code)

    rows = db.scalars(stmt).all()
    return [
        SearchResult(
            content_type=r.content_type,
            content_id=r.content_id,
            title=r.title,
            body=r.body,
            language_code=r.language_code,
            tags=r.tags or [],
            score=r.score,
        )
        for r in rows
    ]
