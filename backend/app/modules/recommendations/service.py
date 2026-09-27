from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import NotificationType, RecommendationStatus
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.modules.follows.service import FollowRepository
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository
from app.modules.notifications.models import Notification
from app.modules.ratings.models import Rating
from app.modules.recommendations.domain import calculate_recommendation_result
from app.modules.recommendations.models import Recommendation
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import RecommendationStats


class RatingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: UUID, movie_id: UUID) -> Rating | None:
        stmt = select(Rating).where(Rating.user_id == user_id, Rating.movie_id == movie_id)
        return self.db.scalar(stmt)

    def upsert(self, user_id: UUID, movie_id: UUID, score: Decimal) -> Rating:
        existing = self.get(user_id, movie_id)
        if existing is None:
            rating = Rating(user_id=user_id, movie_id=movie_id, score=score)
            self.db.add(rating)
            self.db.flush()
            return rating
        existing.score = score
        self.db.flush()
        return existing

    def average_for_movie(self, movie_id: UUID) -> float | None:
        stmt = select(func.avg(Rating.score)).where(Rating.movie_id == movie_id)
        value = self.db.scalar(stmt)
        return float(value) if value is not None else None


class NotificationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: UUID, type_: NotificationType, payload: dict) -> Notification:
        row = Notification(user_id=user_id, type=type_.value, payload=payload)
        self.db.add(row)
        self.db.flush()
        return row

    def list_for_user(self, user_id: UUID, *, limit: int, offset: int) -> list[Notification]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def get_owned(self, notification_id: UUID, user_id: UUID) -> Notification:
        row = self.db.get(Notification, notification_id)
        if row is None or row.user_id != user_id:
            raise NotFoundError("Notification not found", code="NOTIFICATION_NOT_FOUND")
        return row


class RecommendationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_triple(
        self, sender_id: UUID, recipient_id: UUID, movie_id: UUID
    ) -> Recommendation | None:
        stmt = select(Recommendation).where(
            Recommendation.sender_id == sender_id,
            Recommendation.recipient_id == recipient_id,
            Recommendation.movie_id == movie_id,
        )
        return self.db.scalar(stmt)

    def list_inbox(self, recipient_id: UUID, *, limit: int, offset: int) -> list[Recommendation]:
        stmt = (
            select(Recommendation)
            .where(Recommendation.recipient_id == recipient_id)
            .order_by(Recommendation.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def list_outbox(self, sender_id: UUID, *, limit: int, offset: int) -> list[Recommendation]:
        stmt = (
            select(Recommendation)
            .where(Recommendation.sender_id == sender_id)
            .order_by(Recommendation.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def list_pending_for_recipient_movie(
        self, recipient_id: UUID, movie_id: UUID
    ) -> list[Recommendation]:
        stmt = select(Recommendation).where(
            Recommendation.recipient_id == recipient_id,
            Recommendation.movie_id == movie_id,
            Recommendation.status == RecommendationStatus.PENDING.value,
        )
        return list(self.db.scalars(stmt).all())

    def recommended_by_count(self, movie_id: UUID) -> int:
        stmt = select(func.count(func.distinct(Recommendation.sender_id))).where(
            Recommendation.movie_id == movie_id
        )
        return int(self.db.scalar(stmt) or 0)

    def stats_for_sender(self, sender_id: UUID) -> RecommendationStats:
        stmt = select(Recommendation.status).where(Recommendation.sender_id == sender_id)
        statuses = list(self.db.scalars(stmt).all())
        successful = sum(1 for s in statuses if s == RecommendationStatus.SUCCESS.value)
        unsuccessful = sum(1 for s in statuses if s == RecommendationStatus.UNSUCCESSFUL.value)
        pending = sum(1 for s in statuses if s == RecommendationStatus.PENDING.value)
        completed = successful + unsuccessful
        success_rate = (successful / completed * 100.0) if completed else None
        return RecommendationStats(
            successful=successful,
            unsuccessful=unsuccessful,
            pending=pending,
            completed=completed,
            success_rate=round(success_rate, 1) if success_rate is not None else None,
        )


class RecommendationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.recs = RecommendationRepository(db)
        self.ratings = RatingRepository(db)
        self.follows = FollowRepository(db)
        self.users = UserRepository(db)
        self.movies = MovieRepository(db)
        self.notifications = NotificationRepository(db)

    def create_for_followers(
        self,
        sender: User,
        *,
        movie_id: UUID,
        message: str | None,
    ) -> list[Recommendation]:
        """Fan out one recommendation row per follower. Requires the sender has rated the movie."""
        movie = self.movies.require_by_id(movie_id)
        sender_rating = self.ratings.get(sender.id, movie.id)
        if sender_rating is None:
            raise ForbiddenError(
                "Rate this movie before sharing it with followers",
                code="SENDER_RATING_REQUIRED",
            )

        followers = self.follows.list_followers(sender.id)
        if not followers:
            raise ForbiddenError(
                "You need at least one follower to share a recommendation",
                code="NO_FOLLOWERS",
            )

        created: list[Recommendation] = []
        sender_score = float(sender_rating.score)
        for recipient in followers:
            if self.recs.get_triple(sender.id, recipient.id, movie.id) is not None:
                continue
            created.append(
                self._create_one(
                    sender=sender,
                    recipient=recipient,
                    movie=movie,
                    message=message,
                    sender_score=sender_score,
                    commit=False,
                )
            )

        if not created:
            raise ConflictError(
                "You already shared this movie with all of your followers",
                code="RECOMMENDATION_EXISTS",
            )

        self.db.commit()
        for rec in created:
            self.db.refresh(rec)
        return created

    def _create_one(
        self,
        *,
        sender: User,
        recipient: User,
        movie: Movie,
        message: str | None,
        sender_score: float | None = None,
        commit: bool,
    ) -> Recommendation:
        existing_rating = self.ratings.get(recipient.id, movie.id)
        rating_value = float(existing_rating.score) if existing_rating else None
        status = calculate_recommendation_result(rating_value)

        rec = Recommendation(
            sender_id=sender.id,
            recipient_id=recipient.id,
            movie_id=movie.id,
            message=message,
            status=status.value,
            resolved_at=None if status == RecommendationStatus.PENDING else func_now(self.db),
        )
        self.db.add(rec)
        self.db.flush()

        self.notifications.create(
            recipient.id,
            NotificationType.RECOMMENDATION_RECEIVED,
            {
                "recommendation_id": str(rec.id),
                "sender_id": str(sender.id),
                "sender_username": sender.username,
                "movie_id": str(movie.id),
                "movie_title": movie.title,
                "status": status.value,
                "sender_rating": sender_score,
            },
        )

        if status != RecommendationStatus.PENDING:
            self.notifications.create(
                sender.id,
                NotificationType.RECOMMENDATION_OUTCOME,
                {
                    "recommendation_id": str(rec.id),
                    "recipient_id": str(recipient.id),
                    "recipient_username": recipient.username,
                    "movie_id": str(movie.id),
                    "movie_title": movie.title,
                    "status": status.value,
                    "score": rating_value,
                },
            )

        if commit:
            self.db.commit()
            self.db.refresh(rec)
        return rec

    def create(
        self,
        sender: User,
        *,
        recipient_id: UUID,
        movie_id: UUID,
        message: str | None,
    ) -> Recommendation:
        """Legacy single-recipient create — prefer create_for_followers."""
        if sender.id == recipient_id:
            raise ForbiddenError("Cannot recommend to yourself", code="SELF_RECOMMEND")

        recipient = self.users.get_by_id(recipient_id)
        if recipient is None:
            raise NotFoundError("Recipient not found", code="USER_NOT_FOUND")

        movie = self.movies.require_by_id(movie_id)

        if not self.follows.is_following(recipient.id, sender.id):
            raise ForbiddenError(
                "Recipient must follow you to receive a recommendation",
                code="RECIPIENT_NOT_FOLLOWER",
            )

        if self.recs.get_triple(sender.id, recipient.id, movie.id) is not None:
            raise ConflictError(
                "Recommendation already exists for this movie and recipient",
                code="RECOMMENDATION_EXISTS",
            )

        sender_rating = self.ratings.get(sender.id, movie.id)
        return self._create_one(
            sender=sender,
            recipient=recipient,
            movie=movie,
            message=message,
            sender_score=float(sender_rating.score) if sender_rating else None,
            commit=True,
        )

    def resolve_for_rating(self, recipient: User, movie: Movie, score: Decimal) -> list[Recommendation]:
        """Resolve pending recommendations for this recipient/movie. Idempotent for terminal rows."""
        pending = self.recs.list_pending_for_recipient_movie(recipient.id, movie.id)
        status = calculate_recommendation_result(float(score))
        resolved: list[Recommendation] = []
        for rec in pending:
            if rec.status != RecommendationStatus.PENDING.value:
                continue
            rec.status = status.value
            rec.resolved_at = func_now(self.db)
            self.db.flush()
            sender = self.users.get_by_id(rec.sender_id)
            self.notifications.create(
                rec.sender_id,
                NotificationType.RECOMMENDATION_OUTCOME,
                {
                    "recommendation_id": str(rec.id),
                    "recipient_id": str(recipient.id),
                    "recipient_username": recipient.username,
                    "movie_id": str(movie.id),
                    "movie_title": movie.title,
                    "status": status.value,
                    "score": float(score),
                    "sender_username": sender.username if sender else None,
                },
            )
            resolved.append(rec)
        return resolved


def func_now(db: Session):
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


class RatingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ratings = RatingRepository(db)
        self.movies = MovieRepository(db)
        self.recs = RecommendationService(db)

    def upsert(self, user: User, *, movie_id: UUID, score: Decimal) -> Rating:
        movie = self.movies.require_by_id(movie_id)
        rating = self.ratings.upsert(user.id, movie.id, score)
        self.recs.resolve_for_rating(user, movie, score)
        self.db.commit()
        self.db.refresh(rating)
        return rating
