from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.modules.diary.service import DiaryService
from app.modules.follows.service import FollowRepository, FollowService
from app.modules.likes.service import LikeRepository, LikeService
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
    DiaryCreate,
    DiaryOut,
    DiaryUpdate,
    LikedMovieOut,
    MovieDetail,
    MovieSummary,
    NotificationOut,
    PersonDetail,
    RatingOut,
    RatingUpsert,
    RecommendationCreate,
    RecommendationOut,
    UserRatingItem,
    WatchlistCreate,
    WatchlistItemOut,
)
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserProfile, UserProfileUpdate, UserPublic
from app.modules.watchlist.service import WatchlistService

api_router = APIRouter()


def _page(limit: int | None, settings: Settings) -> int:
    return min(limit or settings.default_page_size, settings.max_page_size)


def build_user_profile(
    db: Session,
    user: User,
    *,
    viewer: User | None,
) -> UserProfile:
    stats = RecommendationRepository(db).stats_for_sender(user.id)
    ratings_count = RatingRepository(db).count_for_user(user.id)
    is_self = viewer is not None and viewer.id == user.id
    is_following = False
    if viewer is not None and not is_self:
        is_following = FollowRepository(db).is_following(viewer.id, user.id)
    return UserProfile(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        cover_url=user.cover_url,
        recommendation_stats=stats,
        ratings_count=ratings_count,
        is_following=is_following,
        is_self=is_self,
    )


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


def serialize_diary(
    db: Session,
    entry,
    *,
    viewer_id: UUID | None,
) -> DiaryOut:
    movie = MovieRepository(db).get_by_id(entry.movie_id)
    likes = LikeRepository(db)
    return DiaryOut(
        id=entry.id,
        movie_id=entry.movie_id,
        watched_at=entry.watched_at,
        score=entry.score,
        review=entry.review,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        movie=MovieSummary.model_validate(movie) if movie else None,
        like_count=likes.diary_like_count(entry.id),
        liked_by_me=likes.diary_liked(viewer_id, entry.id) if viewer_id else False,
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
    return build_user_profile(db, current_user, viewer=current_user)


@api_router.patch(
    "/users/me",
    response_model=UserProfile,
    summary="Update current user profile (display name, bio, avatar, cover URLs)",
)
def patch_me(
    body: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    fields = body.model_fields_set
    UserRepository(db).update_profile(
        current_user,
        display_name=body.display_name,
        bio=body.bio,
        avatar_url=body.avatar_url,
        cover_url=body.cover_url,
        set_display_name="display_name" in fields,
        set_bio="bio" in fields,
        set_avatar_url="avatar_url" in fields,
        set_cover_url="cover_url" in fields,
    )
    db.commit()
    db.refresh(current_user)
    return build_user_profile(db, current_user, viewer=current_user)


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
    return build_user_profile(db, user, viewer=current_user)


@api_router.get(
    "/users/{username}/ratings",
    response_model=list[UserRatingItem],
    summary="Paginated rated films for a user",
)
def list_user_ratings(
    username: str,
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[UserRatingItem]:
    rows = RatingService(db).list_for_username(
        username, limit=_page(limit, settings), offset=offset
    )
    return [
        UserRatingItem(
            movie=MovieSummary.model_validate(movie),
            score=rating.score,
            updated_at=rating.updated_at,
        )
        for rating, movie in rows
    ]


@api_router.get(
    "/users/{username}/watchlist",
    response_model=list[WatchlistItemOut],
    summary="Public watchlist for a user",
)
def list_user_watchlist(
    username: str,
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[WatchlistItemOut]:
    rows = WatchlistService(db).list_for_username(
        username, limit=_page(limit, settings), offset=offset
    )
    return [
        WatchlistItemOut(movie=MovieSummary.model_validate(movie), created_at=item.created_at)
        for item, movie in rows
    ]


@api_router.get(
    "/users/{username}/diary",
    response_model=list[DiaryOut],
    summary="Paginated diary / watched log for a user",
)
def list_user_diary(
    username: str,
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[DiaryOut]:
    _user, entries = DiaryService(db).list_for_username(
        username, limit=_page(limit, settings), offset=offset
    )
    return [serialize_diary(db, e, viewer_id=current_user.id) for e in entries]


@api_router.get(
    "/users/{username}/likes",
    response_model=list[LikedMovieOut],
    summary="Movies liked by a user",
)
def list_user_likes(
    username: str,
    offset: int = Query(0, ge=0),
    limit: int | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[LikedMovieOut]:
    rows = LikeService(db).list_for_username(
        username, limit=_page(limit, settings), offset=offset
    )
    return [
        LikedMovieOut(movie=MovieSummary.model_validate(movie), created_at=like.created_at)
        for like, movie in rows
    ]


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


@api_router.post(
    "/movies/{movie_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Like a movie",
)
def like_movie(
    movie_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    LikeService(db).like_movie(current_user, movie_id)


@api_router.delete(
    "/movies/{movie_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unlike a movie",
)
def unlike_movie(
    movie_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    LikeService(db).unlike_movie(current_user, movie_id)


@api_router.put(
    "/ratings",
    response_model=RatingOut,
    summary="Upsert a rating, resolve recommendations, auto-log diary for today",
)
def upsert_rating(
    body: RatingUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingOut:
    rating = RatingService(db).upsert(current_user, movie_id=body.movie_id, score=body.score)
    return RatingOut.model_validate(rating)


@api_router.post(
    "/watchlist",
    response_model=WatchlistItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a movie to the current user's watchlist",
)
def add_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistItemOut:
    item = WatchlistService(db).add(current_user, body.movie_id)
    movie = MovieRepository(db).require_by_id(item.movie_id)
    return WatchlistItemOut(movie=MovieSummary.model_validate(movie), created_at=item.created_at)


@api_router.delete(
    "/watchlist/{movie_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a movie from the current user's watchlist",
)
def remove_watchlist(
    movie_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    WatchlistService(db).remove(current_user, movie_id)


@api_router.post(
    "/diary",
    response_model=DiaryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log a watched / diary entry",
)
def create_diary(
    body: DiaryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryOut:
    entry = DiaryService(db).create(
        current_user,
        movie_id=body.movie_id,
        watched_at=body.watched_at,
        score=body.score,
        review=body.review,
    )
    return serialize_diary(db, entry, viewer_id=current_user.id)


@api_router.patch(
    "/diary/{entry_id}",
    response_model=DiaryOut,
    summary="Update own diary entry",
)
def patch_diary(
    entry_id: UUID,
    body: DiaryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryOut:
    entry = DiaryService(db).update(
        current_user,
        entry_id,
        watched_at=body.watched_at,
        score=body.score,
        review=body.review if "review" in body.model_fields_set else None,
        clear_score=body.clear_score,
    )
    # Only pass review when set; DiaryService treats None as "leave unchanged" for review
    # Fix: if review explicitly set to null we need different handling — for G, optional string is fine.
    return serialize_diary(db, entry, viewer_id=current_user.id)


@api_router.delete(
    "/diary/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete own diary entry",
)
def delete_diary(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    DiaryService(db).delete(current_user, entry_id)


@api_router.post(
    "/diary/{entry_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Like a diary entry",
)
def like_diary(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    LikeService(db).like_diary(current_user, entry_id)


@api_router.delete(
    "/diary/{entry_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unlike a diary entry",
)
def unlike_diary(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    LikeService(db).unlike_diary(current_user, entry_id)


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
    rows = RecommendationRepository(db).list_inbox(
        current_user.id, limit=_page(limit, settings), offset=offset
    )
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
    rows = RecommendationRepository(db).list_outbox(
        current_user.id, limit=_page(limit, settings), offset=offset
    )
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
    rows = NotificationService(db).list(
        current_user, limit=_page(limit, settings), offset=offset
    )
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
