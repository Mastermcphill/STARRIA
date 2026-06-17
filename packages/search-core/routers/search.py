"""Search, indexing, and recommendation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..schemas import IndexEntryRequest, RecommendationFeedbackRequest, SearchRequest
from ..services.indexing import IndexEntry, index_content, remove_content
from ..services.recommendations import get_recommendations, record_feedback
from ..services.search import SearchQuery, search


def make_search_router(
    get_db,
    get_current_user,
    get_admin_user=None,  # Optional: restrict /index endpoints to admins
) -> APIRouter:
    r = APIRouter(prefix="/search", tags=["search", "discovery"])

    @r.get("/")
    async def search_content(
        q: str = Query(..., min_length=1, max_length=200),
        content_types: str | None = Query(default=None, description="Comma-separated content types"),
        language_code: str | None = Query(default=None, max_length=10),
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        types = [t.strip() for t in content_types.split(",")] if content_types else None
        results = search(db, SearchQuery(
            q=q,
            content_types=types,
            language_code=language_code,
            limit=limit,
            offset=offset,
        ))
        return {
            "query": q,
            "total": len(results),
            "results": [
                {
                    "content_type": r.content_type,
                    "content_id": r.content_id,
                    "title": r.title,
                    "body": r.body,
                    "language_code": r.language_code,
                    "tags": r.tags,
                    "score": r.score,
                }
                for r in results
            ],
        }

    @r.get("/recommendations")
    async def recommendations(
        content_types: str | None = Query(default=None),
        language_code: str | None = Query(default=None),
        limit: int = Query(default=20, ge=1, le=50),
        exclude_seen: bool = Query(default=True),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        types = [t.strip() for t in content_types.split(",")] if content_types else None
        cards = get_recommendations(
            db,
            user_id=current_user.id,
            content_types=types,
            language_code=language_code,
            limit=limit,
            exclude_seen=exclude_seen,
        )
        return {
            "total": len(cards),
            "recommendations": [
                {
                    "id": c.id,
                    "content_type": c.content_type,
                    "content_id": c.content_id,
                    "title": c.title,
                    "subtitle": c.subtitle,
                    "route": c.route,
                    "reason": c.reason,
                    "score": c.score,
                }
                for c in cards
            ],
        }

    @r.post("/recommendations/{recommendation_id}/feedback")
    async def recommendation_feedback(
        recommendation_id: str,
        payload: RecommendationFeedbackRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        fb = record_feedback(
            db,
            user_id=current_user.id,
            recommendation_id=recommendation_id,
            action=payload.action,
            reason=payload.reason,
            context=payload.context,
        )
        db.commit()
        return {
            "accepted": True,
            "feedback": {
                "id": fb.id,
                "recommendation_id": fb.recommendation_id,
                "action": fb.action,
                "created_at": fb.created_at,
            },
        }

    @r.post("/index")
    async def index_entry(
        payload: IndexEntryRequest,
        current_user=Depends(get_admin_user if get_admin_user else get_current_user),
        db: Session = Depends(get_db),
    ):
        record = index_content(
            db,
            IndexEntry(
                content_type=payload.content_type,
                content_id=payload.content_id,
                title=payload.title,
                body=payload.body,
                language_code=payload.language_code,
                tags=payload.tags,
                score=payload.score,
            ),
        )
        db.commit()
        return {
            "indexed": True,
            "id": record.id,
            "content_type": record.content_type,
            "content_id": record.content_id,
        }

    @r.delete("/index/{content_type}/{content_id}")
    async def deindex_entry(
        content_type: str,
        content_id: str,
        current_user=Depends(get_admin_user if get_admin_user else get_current_user),
        db: Session = Depends(get_db),
    ):
        removed = remove_content(db, content_type=content_type, content_id=content_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Index entry not found")
        db.commit()
        return {"removed": True, "content_type": content_type, "content_id": content_id}

    return r
