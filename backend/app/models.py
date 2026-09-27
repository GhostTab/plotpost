"""Import all models so Alembic and metadata see every table."""

from app.modules.follows.models import Follow
from app.modules.movies.models import Movie
from app.modules.notifications.models import Notification
from app.modules.ratings.models import Rating
from app.modules.recommendations.models import Recommendation
from app.modules.users.models import User

__all__ = [
    "User",
    "Follow",
    "Movie",
    "Rating",
    "Recommendation",
    "Notification",
]
