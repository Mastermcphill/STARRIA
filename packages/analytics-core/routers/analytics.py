"""Analytics REST endpoints: session tracking, retention, viewer stats."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..services.retention import compute_retention_curve
from ..services.viewer import get_viewer_stats, list_top_content
from ..services.watch_session import join_session, leave_session


class JoinSessionRequest(BaseModel):
    content_id: str
    content_type: str = "LIVE"


class LeaveSessionRequest(BaseModel):
    content_id: str
    last_position_seconds: float | None = None
    content_duration_seconds: float | None = None


def make_analytics_router(
    get_db,
    get_current_user,
) -> APIRouter:
    r = APIRouter(prefix="/analytics", tags=["analytics"])

    @r.post("/sessions/join")
    async def session_join(
        payload: JoinSessionRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        session = join_session(
            db,
            user_id=current_user.id,
            content_id=payload.content_id,
            content_type=payload.content_type,
        )
        db.commit()
        return {
            "session_id": session.id,
            "content_id": session.content_id,
            "joined_at": session.joined_at,
        }

    @r.post("/sessions/leave")
    async def session_leave(
        payload: LeaveSessionRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        session = leave_session(
            db,
            user_id=current_user.id,
            content_id=payload.content_id,
            last_position_seconds=payload.last_position_seconds,
            content_duration_seconds=payload.content_duration_seconds,
        )
        if not session:
            raise HTTPException(status_code=404, detail="Active session not found")
        db.commit()
        return {
            "session_id": session.id,
            "content_id": session.content_id,
            "left_at": session.left_at,
        }

    @r.get("/content/{content_id}/stats")
    def content_stats(
        content_id: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        stats = get_viewer_stats(db, content_id=content_id)
        return {
            "content_id": stats.content_id,
            "total_sessions": stats.total_sessions,
            "unique_viewers": stats.unique_viewers,
            "avg_watch_seconds": stats.avg_watch_seconds,
            "completion_rate": stats.completion_rate,
            "peak_concurrent": stats.peak_concurrent,
        }

    @r.get("/content/{content_id}/retention")
    def retention_curve(
        content_id: str,
        bucket_size_seconds: float = Query(default=10.0, ge=1.0, le=60.0),
        content_duration_seconds: float | None = Query(default=None),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        curve = compute_retention_curve(
            db,
            content_id=content_id,
            bucket_size_seconds=bucket_size_seconds,
            content_duration_seconds=content_duration_seconds,
        )
        return {
            "content_id": content_id,
            "bucket_size_seconds": bucket_size_seconds,
            "data_points": len(curve),
            "curve": [{"position_seconds": p.position_seconds, "viewer_fraction": p.viewer_fraction} for p in curve],
        }

    @r.get("/top-content")
    def top_content(
        limit: int = Query(default=20, ge=1, le=100),
        content_type: str | None = Query(default=None),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        return {"items": list_top_content(db, limit=limit, content_type=content_type)}

    return r
