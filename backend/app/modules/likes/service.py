from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.diary.models import DiaryEntry
from app.modules.likes.models import DiaryLike, MovieLike
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


class LikeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def movie_liked(self, user_id: UUID, movie_id: UUID) -> bool:
        stmt = select(MovieLike).where(
            MovieLike.user_id == user_id,
            MovieLike.movie_id == movie_id,
        )
        return self.db.scalar(stmt) is not None

    def movie_like_count(self, movie_id: UUID) -> int:
        stmt = select(func.count()).select_from(MovieLike).where(MovieLike.movie_id == movie_id)
        return int(self.db.scalar(stmt) or 0)

    def diary_like_count(self, diary_entry_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(DiaryLike)
            .where(DiaryLike.diary_entry_id == diary_entry_id)
        )
        return int(self.db.scalar(stmt) or 0)

    def diary_liked(self, user_id: UUID, diary_entry_id: UUID) -> bool:
        stmt = select(DiaryLike).where(
            DiaryLike.user_id == user_id,
            DiaryLike.diary_entry_id == diary_entry_id,
        )
        return self.db.scalar(stmt) is not None

    def list_liked_movies(
        self, user_id: UUID, *, limit: int, offset: int
    ) -> list[tuple[MovieLike, Movie]]:
        stmt = (
            select(MovieLike, Movie)
            .join(Movie, Movie.id == MovieLike.movie_id)
            .where(MovieLike.user_id == user_id)
            .order_by(MovieLike.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.execute(stmt).all())


class LikeService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.likes = LikeRepository(db)
        self.movies = MovieRepository(db)
        self.users = UserRepository(db)

    def like_movie(self, user: User, movie_id: UUID) -> None:
        movie = self.movies.require_by_id(movie_id)
        if self.likes.movie_liked(user.id, movie.id):
            raise ConflictError("Movie already liked", code="LIKE_EXISTS")
        self.db.add(MovieLike(user_id=user.id, movie_id=movie.id))
        try:
            self.db.flush()
        except IntegrityError as exc:
            raise ConflictError("Movie already liked", code="LIKE_EXISTS") from exc
        self.db.commit()

    def unlike_movie(self, user: User, movie_id: UUID) -> None:
        stmt = select(MovieLike).where(
            MovieLike.user_id == user.id,
            MovieLike.movie_id == movie_id,
        )
        row = self.db.scalar(stmt)
        if row is None:
            raise NotFoundError("Like not found", code="LIKE_NOT_FOUND")
        self.db.delete(row)
        self.db.commit()

    def like_diary(self, user: User, diary_entry_id: UUID) -> None:
        entry = self.db.get(DiaryEntry, diary_entry_id)
        if entry is None:
            raise NotFoundError("Diary entry not found", code="DIARY_NOT_FOUND")
        if self.likes.diary_liked(user.id, diary_entry_id):
            raise ConflictError("Diary entry already liked", code="DIARY_LIKE_EXISTS")
        self.db.add(DiaryLike(user_id=user.id, diary_entry_id=diary_entry_id))
        try:
            self.db.flush()
        except IntegrityError as exc:
            raise ConflictError("Diary entry already liked", code="DIARY_LIKE_EXISTS") from exc
        self.db.commit()

    def unlike_diary(self, user: User, diary_entry_id: UUID) -> None:
        stmt = select(DiaryLike).where(
            DiaryLike.user_id == user.id,
            DiaryLike.diary_entry_id == diary_entry_id,
        )
        row = self.db.scalar(stmt)
        if row is None:
            raise NotFoundError("Diary like not found", code="DIARY_LIKE_NOT_FOUND")
        self.db.delete(row)
        self.db.commit()

    def list_for_username(
        self, username: str, *, limit: int, offset: int
    ) -> list[tuple[MovieLike, Movie]]:
        user = self.users.require_by_username(username)
        return self.likes.list_liked_movies(user.id, limit=limit, offset=offset)
