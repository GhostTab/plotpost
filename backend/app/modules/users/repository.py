from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import username_from_claims
from app.modules.users.models import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)

    def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return self.db.scalar(stmt)

    def require_by_username(self, username: str) -> User:
        user = self.get_by_username(username)
        if user is None:
            raise NotFoundError("User not found", code="USER_NOT_FOUND")
        return user

    def ensure_from_auth(self, user_id: UUID, claims: dict) -> User:
        existing = self.get_by_id(user_id)
        if existing is not None:
            return existing

        base_username = username_from_claims(claims, user_id)
        username = self._unique_username(base_username)
        user = User(
            id=user_id,
            username=username,
            display_name=username,
        )
        try:
            with self.db.begin_nested():
                self.db.add(user)
                self.db.flush()
        except IntegrityError as exc:
            # Race: another request created the same user.
            raced = self.get_by_id(user_id)
            if raced is not None:
                return raced
            raise ConflictError("Could not provision user", code="USER_PROVISION_FAILED") from exc
        return user

    def update_profile(
        self,
        user: User,
        *,
        display_name: str | None = None,
        bio: str | None = None,
        avatar_url: str | None = None,
        cover_url: str | None = None,
        set_display_name: bool = False,
        set_bio: bool = False,
        set_avatar_url: bool = False,
        set_cover_url: bool = False,
    ) -> User:
        if set_display_name:
            user.display_name = display_name
        if set_bio:
            user.bio = bio
        if set_avatar_url:
            user.avatar_url = avatar_url
        if set_cover_url:
            user.cover_url = cover_url
        self.db.add(user)
        self.db.flush()
        return user

    def _unique_username(self, base: str) -> str:
        candidate = base
        suffix = 0
        while self.get_by_username(candidate) is not None:
            suffix += 1
            trimmed = base[: max(1, 32 - len(str(suffix)) - 1)]
            candidate = f"{trimmed}_{suffix}"
        return candidate
