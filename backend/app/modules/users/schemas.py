from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


class RecommendationStats(BaseModel):
    successful: int
    unsuccessful: int
    pending: int
    completed: int
    success_rate: float | None = None


class UserProfile(UserPublic):
    recommendation_stats: RecommendationStats
    is_following: bool = False
    is_self: bool = False
