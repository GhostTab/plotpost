from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.modules.follows.models import Follow
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


class FollowRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def is_following(self, follower_id: UUID, following_id: UUID) -> bool:
        stmt = select(Follow).where(
            Follow.follower_id == follower_id,
            Follow.following_id == following_id,
        )
        return self.db.scalar(stmt) is not None

    def follow(self, follower: User, target: User) -> Follow:
        if follower.id == target.id:
            raise ForbiddenError("Cannot follow yourself", code="SELF_FOLLOW")
        if self.is_following(follower.id, target.id):
            raise ConflictError("Already following this user", code="FOLLOW_EXISTS")
        row = Follow(follower_id=follower.id, following_id=target.id)
        self.db.add(row)
        try:
            self.db.flush()
        except IntegrityError as exc:
            raise ConflictError("Already following this user", code="FOLLOW_EXISTS") from exc
        return row

    def unfollow(self, follower_id: UUID, following_id: UUID) -> None:
        stmt = select(Follow).where(
            Follow.follower_id == follower_id,
            Follow.following_id == following_id,
        )
        row = self.db.scalar(stmt)
        if row is None:
            raise NotFoundError("Follow relationship not found", code="FOLLOW_NOT_FOUND")
        self.db.delete(row)
        self.db.flush()

    def list_followers(self, user_id: UUID) -> list[User]:
        stmt = (
            select(User)
            .join(Follow, Follow.follower_id == User.id)
            .where(Follow.following_id == user_id)
            .order_by(Follow.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())


class FollowService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.follows = FollowRepository(db)
        self.users = UserRepository(db)

    def follow_username(self, current_user: User, username: str) -> None:
        target = self.users.require_by_username(username)
        self.follows.follow(current_user, target)
        self.db.commit()

    def unfollow_username(self, current_user: User, username: str) -> None:
        target = self.users.require_by_username(username)
        self.follows.unfollow(current_user.id, target.id)
        self.db.commit()

    def my_followers(self, current_user: User) -> list[User]:
        return self.follows.list_followers(current_user.id)
