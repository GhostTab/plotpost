from typing import Any
from uuid import UUID

import jwt
from jwt import InvalidTokenError

from app.config import Settings
from app.core.exceptions import UnauthorizedError


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
            options={"require": ["sub", "exp"]},
        )
    except InvalidTokenError as exc:
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN") from exc

    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedError("Token missing subject", code="INVALID_TOKEN")

    try:
        UUID(str(sub))
    except ValueError as exc:
        raise UnauthorizedError("Token subject must be a UUID", code="INVALID_TOKEN") from exc

    return payload


def username_from_claims(payload: dict[str, Any], user_id: UUID) -> str:
    """Derive an initial username from JWT claims.

    Prefer `user_metadata.username`, then email local-part, else a stable placeholder.
    Users can change username later via profile endpoints (out of slice scope).
    """
    metadata = payload.get("user_metadata") or {}
    if isinstance(metadata, dict):
        claimed = metadata.get("username")
        if isinstance(claimed, str) and claimed.strip():
            return _sanitize_username(claimed)

    email = payload.get("email")
    if isinstance(email, str) and "@" in email:
        local = email.split("@", 1)[0]
        candidate = _sanitize_username(local)
        if candidate:
            return candidate

    return f"user_{str(user_id).replace('-', '')[:12]}"


def _sanitize_username(raw: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in raw.strip().lower())
    cleaned = cleaned.strip("_-")
    if len(cleaned) < 3:
        return ""
    return cleaned[:32]
