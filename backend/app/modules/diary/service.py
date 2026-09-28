from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.diary.models import DiaryEntry
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository
from app.modules.ratings.models import Rating
from app.modules.recommendations.service import RatingRepository, RecommendationService
from app.modules.users.models import User


class DiaryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, entry_id: UUID) -> DiaryEntry | None:
        return self.db.get(DiaryEntry, entry_id)

    def require_owned(self, entry_id: UUID, user_id: UUID) -> DiaryEntry:
        entry = self.get(entry_id)
        if entry is None or entry.user_id != user_id:
            raise NotFoundError("Diary entry not found", code="DIARY_NOT_FOUND")
        return entry

    def get_for_user_movie_day(
        self, user_id: UUID, movie_id: UUID, watched_at: date
    ) -> DiaryEntry | None:
        stmt = select(DiaryEntry).where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.movie_id == movie_id,
            DiaryEntry.watched_at == watched_at,
        )
        return self.db.scalar(stmt)

    def list_for_user(self, user_id: UUID, *, limit: int, offset: int) -> list[DiaryEntry]:
        stmt = (
            select(DiaryEntry)
            .where(DiaryEntry.user_id == user_id)
            .order_by(DiaryEntry.watched_at.desc(), DiaryEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def has_any_for_movie(self, user_id: UUID, movie_id: UUID) -> bool:
        stmt = select(DiaryEntry.id).where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.movie_id == movie_id,
        ).limit(1)
        return self.db.scalar(stmt) is not None

    def latest_watched_at(self, user_id: UUID, movie_id: UUID) -> date | None:
        stmt = (
            select(DiaryEntry.watched_at)
            .where(DiaryEntry.user_id == user_id, DiaryEntry.movie_id == movie_id)
            .order_by(DiaryEntry.watched_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def upsert_for_rating_day(
        self, user_id: UUID, movie_id: UUID, score: Decimal, watched_at: date
    ) -> DiaryEntry:
        existing = self.get_for_user_movie_day(user_id, movie_id, watched_at)
        if existing is None:
            entry = DiaryEntry(
                user_id=user_id,
                movie_id=movie_id,
                watched_at=watched_at,
                score=score,
            )
            self.db.add(entry)
            self.db.flush()
            return entry
        existing.score = score
        self.db.flush()
        return existing


class DiaryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.diary = DiaryRepository(db)
        self.movies = MovieRepository(db)
        self.ratings = RatingRepository(db)
        self.recs = RecommendationService(db)

    def create(
        self,
        user: User,
        *,
        movie_id: UUID,
        watched_at: date | None,
        score: Decimal | None,
        review: str | None,
    ) -> DiaryEntry:
        movie = self.movies.require_by_id(movie_id)
        day = watched_at or date.today()
        existing = self.diary.get_for_user_movie_day(user.id, movie.id, day)
        if existing is not None:
            raise ConflictError(
                "Diary entry already exists for this movie on that date",
                code="DIARY_EXISTS",
            )
        entry = DiaryEntry(
            user_id=user.id,
            movie_id=movie.id,
            watched_at=day,
            score=score,
            review=review,
        )
        self.db.add(entry)
        self.db.flush()
        if score is not None:
            self._apply_score(user, movie, score)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def update(
        self,
        user: User,
        entry_id: UUID,
        *,
        watched_at: date | None,
        score: Decimal | None,
        review: str | None,
        clear_score: bool = False,
    ) -> DiaryEntry:
        entry = self.diary.require_owned(entry_id, user.id)
        movie = self.movies.require_by_id(entry.movie_id)
        if watched_at is not None:
            clash = self.diary.get_for_user_movie_day(user.id, entry.movie_id, watched_at)
            if clash is not None and clash.id != entry.id:
                raise ConflictError(
                    "Diary entry already exists for this movie on that date",
                    code="DIARY_EXISTS",
                )
            entry.watched_at = watched_at
        if clear_score:
            entry.score = None
        elif score is not None:
            entry.score = score
            self._apply_score(user, movie, score)
        if review is not None:
            entry.review = review
        self.db.flush()
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete(self, user: User, entry_id: UUID) -> None:
        entry = self.diary.require_owned(entry_id, user.id)
        self.db.delete(entry)
        self.db.commit()

    def list_for_username(
        self, username: str, *, limit: int, offset: int
    ) -> tuple[User, list[DiaryEntry]]:
        from app.modules.users.repository import UserRepository

        user = UserRepository(self.db).require_by_username(username)
        return user, self.diary.list_for_user(user.id, limit=limit, offset=offset)

    def _apply_score(self, user: User, movie: Movie, score: Decimal) -> Rating:
        rating = self.ratings.upsert(user.id, movie.id, score)
        self.recs.resolve_for_rating(user, movie, score)
        return rating
