from datetime import date
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.exceptions import NotFoundError, UpstreamError
from app.modules.movies.models import Movie


class TMDBClient:
    def __init__(self, settings: Settings | None = None, client: httpx.Client | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = client
        self._owns_client = client is None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.settings.tmdb_base_url,
                timeout=10.0,
                params={"api_key": self.settings.tmdb_api_key},
            )
        return self._client

    def close(self) -> None:
        if self._owns_client and self._client is not None:
            self._client.close()
            self._client = None

    def search(self, query: str) -> list[dict[str, Any]]:
        return self._get_results("/search/movie", params={"query": query})

    def trending_week(self) -> list[dict[str, Any]]:
        return self._get_results("/trending/movie/week")

    def _get_results(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        if not (self.settings.tmdb_api_key or "").strip():
            raise UpstreamError(
                "TMDB_API_KEY is not set on the server",
                code="TMDB_KEY_MISSING",
                status_code=502,
            )
        try:
            response = self._http().get(path, params=params)
        except httpx.HTTPError as exc:
            raise UpstreamError("TMDB request failed", code="TMDB_UNAVAILABLE", status_code=503) from exc

        if response.status_code >= 500:
            raise UpstreamError("TMDB server error", code="TMDB_ERROR", status_code=502)
        if response.status_code in (401, 403):
            raise UpstreamError(
                "TMDB rejected the API key (check TMDB_API_KEY on Railway)",
                code="TMDB_INVALID_KEY",
                status_code=502,
            )
        if response.status_code >= 400:
            raise UpstreamError("TMDB rejected the request", code="TMDB_CLIENT_ERROR", status_code=502)

        data = response.json()
        return list(data.get("results") or [])

    def get_movie(self, tmdb_id: int, *, append_credits: bool = False) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if append_credits:
            params["append_to_response"] = "credits"
        try:
            response = self._http().get(f"/movie/{tmdb_id}", params=params)
        except httpx.HTTPError as exc:
            raise UpstreamError("TMDB request failed", code="TMDB_UNAVAILABLE", status_code=503) from exc

        if response.status_code == 404:
            raise NotFoundError("Movie not found on TMDB", code="TMDB_MOVIE_NOT_FOUND")
        if response.status_code >= 500:
            raise UpstreamError("TMDB server error", code="TMDB_ERROR", status_code=502)
        if response.status_code >= 400:
            raise UpstreamError("TMDB rejected the request", code="TMDB_CLIENT_ERROR", status_code=502)
        return response.json()

    def get_person(self, person_id: int) -> dict[str, Any]:
        try:
            response = self._http().get(
                f"/person/{person_id}",
                params={"append_to_response": "movie_credits"},
            )
        except httpx.HTTPError as exc:
            raise UpstreamError("TMDB request failed", code="TMDB_UNAVAILABLE", status_code=503) from exc

        if response.status_code == 404:
            raise NotFoundError("Person not found on TMDB", code="TMDB_PERSON_NOT_FOUND")
        if response.status_code >= 500:
            raise UpstreamError("TMDB server error", code="TMDB_ERROR", status_code=502)
        if response.status_code >= 400:
            raise UpstreamError("TMDB rejected the request", code="TMDB_CLIENT_ERROR", status_code=502)
        return response.json()


def _parse_release_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def movie_from_tmdb_payload(payload: dict[str, Any]) -> Movie:
    return Movie(
        id=uuid4(),
        tmdb_id=int(payload["id"]),
        title=str(payload.get("title") or payload.get("name") or "Untitled"),
        overview=payload.get("overview"),
        release_date=_parse_release_date(payload.get("release_date")),
        poster_path=payload.get("poster_path"),
        backdrop_path=payload.get("backdrop_path"),
        runtime=payload.get("runtime"),
    )


class MovieRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, movie_id: UUID) -> Movie | None:
        return self.db.get(Movie, movie_id)

    def require_by_id(self, movie_id: UUID) -> Movie:
        movie = self.get_by_id(movie_id)
        if movie is None:
            raise NotFoundError("Movie not found", code="MOVIE_NOT_FOUND")
        return movie

    def get_by_tmdb_id(self, tmdb_id: int) -> Movie | None:
        stmt = select(Movie).where(Movie.tmdb_id == tmdb_id)
        return self.db.scalar(stmt)

    def upsert_from_tmdb(self, payload: dict[str, Any]) -> Movie:
        tmdb_id = int(payload["id"])
        existing = self.get_by_tmdb_id(tmdb_id)
        if existing is None:
            movie = movie_from_tmdb_payload(payload)
            self.db.add(movie)
            self.db.flush()
            return movie

        existing.title = str(payload.get("title") or payload.get("name") or existing.title)
        existing.overview = payload.get("overview", existing.overview)
        existing.release_date = _parse_release_date(payload.get("release_date")) or existing.release_date
        existing.poster_path = payload.get("poster_path", existing.poster_path)
        existing.backdrop_path = payload.get("backdrop_path", existing.backdrop_path)
        if payload.get("runtime") is not None:
            existing.runtime = payload.get("runtime")
        self.db.flush()
        return existing
