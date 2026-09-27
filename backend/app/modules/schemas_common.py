from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MovieSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tmdb_id: int
    title: str
    overview: str | None = None
    release_date: date | None = None
    poster_path: str | None = None
    backdrop_path: str | None = None
    runtime: int | None = None


class CastMember(BaseModel):
    id: int
    name: str
    character: str | None = None
    profile_path: str | None = None


class PersonCredit(BaseModel):
    tmdb_id: int
    title: str
    character: str | None = None
    job: str | None = None
    release_date: date | None = None
    poster_path: str | None = None


class PersonDetail(BaseModel):
    id: int
    name: str
    biography: str | None = None
    birthday: date | None = None
    place_of_birth: str | None = None
    profile_path: str | None = None
    known_for_department: str | None = None
    filmography: list[PersonCredit] = []


class MovieDetail(MovieSummary):
    recommended_by_count: int = 0
    average_rating: float | None = None
    my_rating: float | None = None
    tagline: str | None = None
    genres: list[str] = []
    director: str | None = None
    cast: list[CastMember] = []


class RatingUpsert(BaseModel):
    movie_id: UUID
    score: Decimal = Field(..., ge=Decimal("0.5"), le=Decimal("5.0"))

    @field_validator("score")
    @classmethod
    def half_star_steps(cls, value: Decimal) -> Decimal:
        scaled = value * 2
        if scaled != scaled.to_integral_value():
            raise ValueError("score must be in half-star steps (0.5 increments)")
        return value.quantize(Decimal("0.1"))


class RatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    movie_id: UUID
    score: Decimal
    created_at: datetime
    updated_at: datetime


class RecommendationCreate(BaseModel):
    movie_id: UUID
    message: str | None = Field(default=None, max_length=1000)


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sender_id: UUID
    recipient_id: UUID
    movie_id: UUID
    message: str | None
    status: str
    created_at: datetime
    resolved_at: datetime | None
    movie_title: str | None = None
    movie_poster_path: str | None = None
    movie_overview: str | None = None
    sender_username: str | None = None
    recipient_username: str | None = None
    sender_rating: float | None = None


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    payload: dict
    read_at: datetime | None
    created_at: datetime
