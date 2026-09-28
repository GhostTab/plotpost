from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None


class RecommendationStats(BaseModel):
    successful: int
    unsuccessful: int
    pending: int
    completed: int
    success_rate: float | None = None


class UserProfile(UserPublic):
    recommendation_stats: RecommendationStats
    ratings_count: int = 0
    is_following: bool = False
    is_self: bool = False


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = Field(default=None, max_length=2048)
    cover_url: str | None = Field(default=None, max_length=2048)
