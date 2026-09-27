from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.modules.follows.service import FollowRepository, FollowService
from app.modules.movies.service import MovieService
from app.modules.movies.tmdb import MovieRepository
from app.modules.notifications.service import NotificationService
from app.modules.recommendations.models import Recommendation
from app.modules.recommendations.service import (
    RatingRepository,
    RatingService,
    RecommendationRepository,
    RecommendationService,
)
from app.modules.schemas_common import (
    MovieDetail,
    MovieSummary,
    NotificationOut,
    PersonDetail,
    RatingOut,
    RatingUpsert,
    RecommendationCreate,
    RecommendationOut,
)
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserProfile, UserPublic

api_router = APIRouter()


def serialize_recommendation(db: Session, rec: Recommendation) -> RecommendationOut:
    users = UserRepository(db)
    movies = MovieRepository(db)
    ratings = RatingRepository(db)
    sender = users.get_by_id(rec.sender_id)
    recipient = users.get_by_id(rec.recipient_id)
    movie = movies.get_by_id(rec.movie_id)
    sender_rating_row = ratings.get(rec.sender_id, rec.movie_id)
    return RecommendationOut(
        id=rec.id,
        sender_id=rec.sender_id,
        recipient_id=rec.recipient_id,
        movie_id=rec.movie_id,
        message=rec.message,
        status=rec.status,
        created_at=rec.created_at,
        resolved_at=rec.resolved_at,
        movie_title=movie.title if movie else None,
        movie_poster_path=movie.poster_path if movie else None,
        movie_overview=movie.overview if movie else None,
        sender_username=sender.username if sender else None,
        recipient_username=recipient.username if recipient else None,
        sender_rating=float(sender_rating_row.score) if sender_rating_row else None,
    )


@api_router.get(
    "/users/me",
    response_model=UserProfile,
    summary="Current authenticated user profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    stats = RecommendationRepository(db).stats_for_sender(current_user.id)
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        bio=current_user.bio,
        avatar_url=current_user.avatar_url,
        recommendation_stats=stats,
        is_following=False,
        is_self=True,
    )


@api_router.get(
    "/users/me/followers",
    response_model=list[UserPublic],
    summary="List followers of the current user (recipient picker)",
)
def list_my_followers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return FollowService(db).my_followers(current_user)


@api_router.get(
    "/users/{username}",
    response_model=UserProfile,
    summary="Public profile with recommendation stats",
)
def get_user_profile(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    user = UserRepository(db).require_by_username(username)
    stats = RecommendationRepository(db).stats_for_sender(user.id)
    is_self = current_user.id == user.id
    is_following = (
        False
        if is_self
        else FollowRepository(db).is_following(current_user.id, user.id)
    )
    return UserProfile(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        recommendation_stats=stats,
        is_following=is_following,
        is_self=is_self,
    )


@api_router.post(
    "/follows/{username}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Follow a user by username",
)
def follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    FollowService(db).follow_username(current_user, username)


@api_router.delete(
    "/follows/{username}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unfollow a user by username",
)
def unfollow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    FollowService(db).unfollow_username(current_user, username)


@api_router.get(
    "/movies/search",
    response_model=list[MovieSummary],
    summary="Search movies via TMDB and upsert local cache (public)",
)
def search_movies(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> list[MovieSummary]:
    movies = MovieService(db).search(q)
    return [MovieSummary.model_validate(m) for m in movies]


@api_router.get(
    "/movies/trending",
    response_model=list[MovieSummary],
    summary="This week's trending movies via TMDB (public; powers the landing page)",
)
def trending_movies(db: Session = Depends(get_db)) -> list[MovieSummary]:
    movies = MovieService(db).trending()
    return [MovieSummary.model_validate(m) for m in movies]


@api_router.get(
    "/movies/tmdb/{tmdb_id}",
    response_model=MovieSummary,
    summary="Resolve a TMDB movie id into a local movie (upsert if needed)",
)
def get_movie_by_tmdb(tmdb_id: int, db: Session = Depends(get_db)) -> MovieSummary:
    movie = MovieService(db).ensure_by_tmdb_id(tmdb_id)
    return MovieSummary.model_validate(movie)


@api_router.get(
    "/people/{person_id}",
    response_model=PersonDetail,
    summary="Person profile and filmography via TMDB (public)",
)
def get_person(person_id: int, db: Session = Depends(get_db)) -> PersonDetail:
    return MovieService(db).get_person(person_id)


@api_router.get(
    "/movies/{movie_id}",
    response_model=MovieDetail,
    summary="Movie detail (public; my_rating when authenticated)",
)
def get_movie(
    movie_id: UUID,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
) -> MovieDetail:
    return MovieService(db).get_detail(movie_id, viewer.id if viewer else None)


@api_router.put(
    "/ratings",
    response_model=RatingOut,
    summary="Upsert a rating and resolve related recommendations",
)
def upsert_rating(
    body: RatingUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingOut:
    rating = RatingService(db).upsert(current_user, movie_id=body.movie_id, score=body.score)
    return RatingOut.model_validate(rating)


@api_router.post(
    "/recommendations",
    response_model=list[RecommendationOut],
    status_code=status.HTTP_201_CREATED,
    summary="Share a rated movie with all followers",
)
def create_recommendation(
    body: RecommendationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecommendationOut]:
    rows = RecommendationService(db).create_for_followers(
        current_user,
        movie_id=body.movie_id,
        message=body.message,
    )
    return [serialize_recommendation(db, r) for r in rows]


@api_router.get(
    "/recommendations/inbox",
    response_model=list[RecommendationOut],
    summary="Recommendations received by the current user",
)
def recommendations_inbox(
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[RecommendationOut]:
    page = min(limit or settings.default_page_size, settings.max_page_size)
    rows = RecommendationRepository(db).list_inbox(current_user.id, limit=page, offset=offset)
    return [serialize_recommendation(db, r) for r in rows]


@api_router.get(
    "/recommendations/outbox",
    response_model=list[RecommendationOut],
    summary="Recommendations sent by the current user",
)
def recommendations_outbox(
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[RecommendationOut]:
    page = min(limit or settings.default_page_size, settings.max_page_size)
    rows = RecommendationRepository(db).list_outbox(current_user.id, limit=page, offset=offset)
    return [serialize_recommendation(db, r) for r in rows]


@api_router.get(
    "/notifications",
    response_model=list[NotificationOut],
    summary="In-app notifications for the current user",
)
def list_notifications(
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[NotificationOut]:
    page = min(limit or settings.default_page_size, settings.max_page_size)
    rows = NotificationService(db).list(current_user, limit=page, offset=offset)
    return [NotificationOut.model_validate(r) for r in rows]


@api_router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark a notification as read",
)
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    row = NotificationService(db).mark_read(current_user, notification_id)
    return NotificationOut.model_validate(row)
