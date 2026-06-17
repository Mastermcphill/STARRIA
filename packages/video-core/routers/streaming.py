"""Streaming session router: video token issuance for rooms."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..services.streaming import UnsupportedVideoProvider, create_video_token


def make_streaming_router(
    get_db,
    get_current_user,
    *,
    get_room,         # Callable(room_id: str, db: Session) → Room-like or None
    ensure_participant,  # Callable(db, room_id, user_id) → raises 403 if not active
    video_provider: str | None = None,
    dev_secret: str = "dev-secret",
    livekit_api_key: str | None = None,
    livekit_api_secret: str | None = None,
    livekit_ws_url: str | None = None,
) -> APIRouter:
    """Factory that returns a /rooms router with video token endpoint.

    Inject your Room model accessors and auth dependencies at startup.
    """
    r = APIRouter(prefix="/rooms", tags=["streaming"])

    @r.post("/{room_id}/video-token")
    async def issue_video_token(
        room_id: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        room = get_room(room_id, db)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        ensure_participant(db, room_id, current_user.id)

        provider = getattr(room, "video_provider", None) or video_provider
        room_name = getattr(room, "video_room_name", None) or room_id

        try:
            return create_video_token(
                provider=provider,
                room_name=room_name,
                room_id=room_id,
                user_id=current_user.id,
                dev_secret=dev_secret,
                livekit_api_key=livekit_api_key,
                livekit_api_secret=livekit_api_secret,
                livekit_ws_url=livekit_ws_url,
            )
        except UnsupportedVideoProvider as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    return r
