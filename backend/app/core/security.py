from functools import lru_cache
from typing import Any
from uuid import UUID

import jwt
from jwt import InvalidTokenError, PyJWKClient

from app.config import Settings
from app.core.exceptions import UnauthorizedError


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    # Cache JWKS fetches; PyJWKClient also caches keys internally.
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=600)


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN") from exc

    alg = str(header.get("alg") or "")
    payload: dict[str, Any]

    try:
        if alg in {"ES256", "RS256", "EdDSA"} and settings.supabase_jwks_url:
            payload = _decode_asymmetric(token, settings, algorithms=[alg])
        elif alg == "HS256":
            payload = _decode_hs256(token, settings)
        elif settings.supabase_jwks_url:
            # Unknown/missing alg — try JWKS first (new Supabase signing keys).
            payload = _decode_asymmetric(token, settings, algorithms=["ES256", "RS256", "EdDSA"])
        else:
            payload = _decode_hs256(token, settings)
    except UnauthorizedError:
        raise
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


def _decode_hs256(token: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience=settings.supabase_jwt_audience,
        options={"require": ["sub", "exp"]},
    )


def _decode_asymmetric(token: str, settings: Settings, *, algorithms: list[str]) -> dict[str, Any]:
    jwks_url = settings.supabase_jwks_url
    if not jwks_url:
        raise UnauthorizedError(
            "Server missing SUPABASE_URL for ES256/RS256 token verification",
            code="JWT_CONFIG",
        )
    try:
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
    except Exception as exc:  # noqa: BLE001 — map JWKS/network errors to 401
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN") from exc

    decode_kwargs: dict[str, Any] = {
        "algorithms": algorithms,
        "audience": settings.supabase_jwt_audience,
        "options": {"require": ["sub", "exp"]},
    }
    # Issuer check is optional — some tokens omit or vary `iss`.
    return jwt.decode(token, signing_key.key, **decode_kwargs)


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
