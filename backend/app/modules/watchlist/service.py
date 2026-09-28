from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.watchlist.models import WatchlistItem


class WatchlistRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: UUID, movie_id: UUID) -> WatchlistItem | None:
        stmt = select(WatchlistItem).where(
            WatchlistItem.user_id == user_id,
            WatchlistItem.movie_id == movie_id,
        )
        return self.db.scalar(stmt)

    def is_on_watchlist(self, user_id: UUID, movie_id: UUID) -> bool:
        return self.get(user_id, movie_id) is not None

    def list_for_user(self, user_id: UUID, *, limit: int, offset: int) -> list[tuple[WatchlistItem, Movie]]:
        stmt = (
            select(WatchlistItem, Movie)
            .join(Movie, Movie.id == WatchlistItem.movie_id)
            .where(WatchlistItem.user_id == user_id)
            .order_by(WatchlistItem.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.execute(stmt).all())


class WatchlistService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.watchlist = WatchlistRepository(db)
        self.movies = MovieRepository(db)
        self.users = UserRepository(db)

    def add(self, user: User, movie_id: UUID) -> WatchlistItem:
        movie = self.movies.require_by_id(movie_id)
        if self.watchlist.get(user.id, movie.id) is not None:
            raise ConflictError("Movie already on watchlist", code="WATCHLIST_EXISTS")
        row = WatchlistItem(user_id=user.id, movie_id=movie.id)
        self.db.add(row)
        try:
            self.db.flush()
        except IntegrityError as exc:
            raise ConflictError("Movie already on watchlist", code="WATCHLIST_EXISTS") from exc
        self.db.commit()
        self.db.refresh(row)
        return row

    def remove(self, user: User, movie_id: UUID) -> None:
        row = self.watchlist.get(user.id, movie_id)
        if row is None:
            raise NotFoundError("Watchlist item not found", code="WATCHLIST_NOT_FOUND")
        self.db.delete(row)
        self.db.commit()

    def list_for_username(
        self, username: str, *, limit: int, offset: int
    ) -> list[tuple[WatchlistItem, Movie]]:
        user = self.users.require_by_username(username)
        return self.watchlist.list_for_user(user.id, limit=limit, offset=offset)
