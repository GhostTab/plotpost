from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.database import get_db
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise UnauthorizedError()
    return token


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    claims = decode_access_token(token, settings)
    user_id = UUID(str(claims["sub"]))
    repo = UserRepository(db)
    user = repo.ensure_from_auth(user_id, claims)
    db.commit()
    db.refresh(user)
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        claims = decode_access_token(token, settings)
        user_id = UUID(str(claims["sub"]))
    except UnauthorizedError:
        return None
    repo = UserRepository(db)
    user = repo.ensure_from_auth(user_id, claims)
    db.commit()
    db.refresh(user)
    return user
