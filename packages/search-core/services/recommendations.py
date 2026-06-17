"""Recommendation engine.

Generalizes Vidzi's discovery.recommendations endpoint which fetches
organizations, available workers, and live classes weighted by trust_score
and availability. STARRIA's version operates over ContentIndex with
pluggable scoring and feedback-aware filtering.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ContentIndex, RecommendationFeedback, uuid_str


@dataclass
class RecommendationCard:
    id: str
    content_type: str
    content_id: str
    title: str
    subtitle: str | None
    route: str | None
    reason: str
    score: float
    source: str = "database"


def get_recommendations(
    db: Session,
    *,
    user_id: str,
    content_types: list[str] | None = None,
    language_code: str | None = None,
    limit: int = 20,
    exclude_seen: bool = True,
) -> list[RecommendationCard]:
    """Return ranked recommendation cards, excluding content the user has already acted on."""
    seen_ids: set[str] = set()
    if exclude_seen:
        feedback_rows = db.scalars(
            select(RecommendationFeedback).where(
                RecommendationFeedback.user_id == user_id,
                RecommendationFeedback.action.in_({"clicked", "dismissed"}),
            )
        ).all()
        seen_ids = {f.recommendation_id for f in feedback_rows}

    stmt = (
        select(ContentIndex)
        .order_by(ContentIndex.score.desc(), ContentIndex.indexed_at.desc())
        .limit(min(limit * 3, 300))  # fetch extra to compensate for seen filtering
    )
    if content_types:
        stmt = stmt.where(ContentIndex.content_type.in_(content_types))
    if language_code:
        stmt = stmt.where(ContentIndex.language_code == language_code)

    rows = db.scalars(stmt).all()
    cards: list[RecommendationCard] = []
    for row in rows:
        rec_id = f"{row.content_type}-{row.content_id}"
        if rec_id in seen_ids:
            continue
        cards.append(
            RecommendationCard(
                id=rec_id,
                content_type=row.content_type,
                content_id=row.content_id,
                title=row.title,
                subtitle=row.body[:120] if row.body else None,
                route=None,
                reason="Trending" if row.score >= 1.0 else "Recommended for you",
                score=row.score,
            )
        )
        if len(cards) >= limit:
            break

    return cards


def record_feedback(
    db: Session,
    *,
    user_id: str,
    recommendation_id: str,
    action: str,
    reason: str | None = None,
    context: dict | None = None,
) -> RecommendationFeedback:
    feedback = RecommendationFeedback(
        id=uuid_str(),
        user_id=user_id,
        recommendation_id=recommendation_id,
        action=action,
        reason=reason,
        context=context or {},
    )
    db.add(feedback)
    db.flush()
    return feedback
