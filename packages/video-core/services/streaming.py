"""Video provider token generation (LiveKit, dev placeholder, extensible)."""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from jose import jwt

DEV_PROVIDERS = {"placeholder", "dev", "mock"}
SUPPORTED_PROVIDERS = {"livekit"}
UNIMPLEMENTED_PROVIDERS = {"agora", "daily"}


class UnsupportedVideoProvider(RuntimeError):
    pass


def _normalize_provider(provider: str | None) -> str:
    return (provider or "placeholder").strip().lower()


def create_placeholder_token(
    room_id: str,
    user_id: str,
    *,
    secret: str,
    provider: str = "placeholder",
    ttl_minutes: int = 30,
) -> dict:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    raw = f"{room_id}:{user_id}:{int(expires_at.timestamp())}".encode()
    token = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return {
        "provider": provider,
        "room_name": room_id,
        "token": token,
        "uid": user_id,
        "expires_at": expires_at.isoformat(),
        "server_url": None,
    }


def create_livekit_token(
    *,
    room_name: str,
    user_id: str,
    api_key: str,
    api_secret: str,
    ws_url: str,
    ttl_minutes: int = 30,
    can_publish: bool = True,
    can_subscribe: bool = True,
    can_publish_data: bool = True,
) -> dict:
    if not api_key or not api_secret or not ws_url:
        raise UnsupportedVideoProvider(
            "LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_WS_URL must be configured."
        )
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=ttl_minutes)
    claims = {
        "iss": api_key,
        "sub": user_id,
        "nbf": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": can_publish,
            "canPublishData": can_publish_data,
            "canSubscribe": can_subscribe,
        },
    }
    return {
        "provider": "livekit",
        "room_name": room_name,
        "token": jwt.encode(claims, api_secret, algorithm="HS256"),
        "uid": user_id,
        "expires_at": expires_at.isoformat(),
        "server_url": ws_url,
    }


def create_video_token(
    *,
    provider: str | None,
    room_name: str,
    room_id: str,
    user_id: str,
    dev_secret: str,
    livekit_api_key: str | None = None,
    livekit_api_secret: str | None = None,
    livekit_ws_url: str | None = None,
    ttl_minutes: int = 30,
) -> dict:
    """Dispatch to the appropriate provider token implementation.

    Falls back to the placeholder implementation when provider is None,
    "placeholder", "dev", or "mock".
    """
    normalized = _normalize_provider(provider)
    video_room_name = (room_name or room_id).strip() or room_id

    if normalized in DEV_PROVIDERS:
        return create_placeholder_token(
            video_room_name, user_id, secret=dev_secret, provider=normalized, ttl_minutes=ttl_minutes
        )

    if normalized == "livekit":
        return create_livekit_token(
            room_name=video_room_name,
            user_id=user_id,
            api_key=livekit_api_key or "",
            api_secret=livekit_api_secret or "",
            ws_url=livekit_ws_url or "",
            ttl_minutes=ttl_minutes,
        )

    if normalized in UNIMPLEMENTED_PROVIDERS:
        raise UnsupportedVideoProvider(
            f"Provider {normalized!r} requires a production adapter before token issuance."
        )

    raise UnsupportedVideoProvider(f"Provider {normalized!r} is not supported.")
