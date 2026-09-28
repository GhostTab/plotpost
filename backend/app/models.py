"""Import all models so Alembic and metadata see every table."""

from app.modules.diary.models import DiaryEntry
from app.modules.follows.models import Follow
from app.modules.likes.models import DiaryLike, MovieLike
from app.modules.movies.models import Movie
from app.modules.notifications.models import Notification
from app.modules.ratings.models import Rating
from app.modules.recommendations.models import Recommendation
from app.modules.users.models import User
from app.modules.watchlist.models import WatchlistItem

__all__ = [
    "User",
    "Follow",
    "Movie",
    "Rating",
    "Recommendation",
    "Notification",
    "WatchlistItem",
    "DiaryEntry",
    "MovieLike",
    "DiaryLike",
]
