from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import UpstreamError
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository, TMDBClient
from app.modules.ratings.models import Rating
from app.modules.recommendations.service import RatingRepository, RecommendationRepository
from app.modules.schemas_common import CastMember, MovieDetail, PersonCredit, PersonDetail


class MovieService:
    def __init__(self, db: Session, tmdb: TMDBClient | None = None) -> None:
        self.db = db
        self.movies = MovieRepository(db)
        self.tmdb = tmdb or TMDBClient()
        self.ratings = RatingRepository(db)
        self.recs = RecommendationRepository(db)

    def search(self, query: str) -> list[Movie]:
        return self._upsert_all(self.tmdb.search(query))

    def trending(self) -> list[Movie]:
        return self._upsert_all(self.tmdb.trending_week())

    def ensure_by_tmdb_id(self, tmdb_id: int) -> Movie:
        existing = self.movies.get_by_tmdb_id(tmdb_id)
        if existing is not None:
            return existing
        payload = self.tmdb.get_movie(tmdb_id)
        movie = self.movies.upsert_from_tmdb(payload)
        self.db.commit()
        self.db.refresh(movie)
        return movie

    def get_person(self, person_id: int) -> PersonDetail:
        payload = self.tmdb.get_person(person_id)
        credits_block = payload.get("movie_credits") or {}
        cast_credits = credits_block.get("cast") or []
        crew_credits = credits_block.get("crew") or []

        filmography: list[PersonCredit] = []
        seen: set[int] = set()

        def add_credit(item: dict, *, character: str | None = None, job: str | None = None) -> None:
            raw_id = item.get("id")
            if raw_id is None:
                return
            tmdb_id = int(raw_id)
            if tmdb_id in seen:
                return
            seen.add(tmdb_id)
            filmography.append(
                PersonCredit(
                    tmdb_id=tmdb_id,
                    title=str(item.get("title") or item.get("name") or "Untitled"),
                    character=character,
                    job=job,
                    release_date=_parse_optional_date(item.get("release_date")),
                    poster_path=item.get("poster_path"),
                )
            )

        for item in cast_credits:
            if not isinstance(item, dict):
                continue
            add_credit(item, character=item.get("character"))

        for item in crew_credits:
            if not isinstance(item, dict):
                continue
            if item.get("job") not in ("Director", "Writer", "Screenplay"):
                continue
            add_credit(item, job=item.get("job"))

        filmography.sort(
            key=lambda c: c.release_date.isoformat() if c.release_date else "",
            reverse=True,
        )

        biography = payload.get("biography")
        return PersonDetail(
            id=int(payload["id"]),
            name=str(payload.get("name") or "Unknown"),
            biography=(str(biography).strip() or None) if biography else None,
            birthday=_parse_optional_date(payload.get("birthday")),
            place_of_birth=payload.get("place_of_birth"),
            profile_path=payload.get("profile_path"),
            known_for_department=payload.get("known_for_department"),
            filmography=filmography[:80],
        )

    def _upsert_all(self, results: list[dict]) -> list[Movie]:
        movies: list[Movie] = []
        for payload in results:
            movies.append(self.movies.upsert_from_tmdb(payload))
        self.db.commit()
        for movie in movies:
            self.db.refresh(movie)
        return movies

    def get_detail(self, movie_id: UUID, viewer_id: UUID | None = None) -> MovieDetail:
        movie = self.movies.require_by_id(movie_id)
        my_rating_row: Rating | None = (
            self.ratings.get(viewer_id, movie.id) if viewer_id is not None else None
        )

        tagline: str | None = None
        genres: list[str] = []
        director: str | None = None
        cast: list[CastMember] = []

        try:
            payload = self.tmdb.get_movie(movie.tmdb_id, append_credits=True)
            tagline = (payload.get("tagline") or None) or None
            if isinstance(tagline, str):
                tagline = tagline.strip() or None
            genres = [
                str(g.get("name"))
                for g in (payload.get("genres") or [])
                if isinstance(g, dict) and g.get("name")
            ]
            if payload.get("runtime") is not None and movie.runtime is None:
                movie.runtime = payload.get("runtime")
                self.db.commit()
                self.db.refresh(movie)
            credits = payload.get("credits") or {}
            for person in credits.get("crew") or []:
                if person.get("job") == "Director":
                    director = person.get("name")
                    break
            for person in (credits.get("cast") or [])[:12]:
                if not person.get("name") or person.get("id") is None:
                    continue
                cast.append(
                    CastMember(
                        id=int(person["id"]),
                        name=str(person["name"]),
                        character=person.get("character"),
                        profile_path=person.get("profile_path"),
                    )
                )
        except UpstreamError:
            pass

        return MovieDetail(
            id=movie.id,
            tmdb_id=movie.tmdb_id,
            title=movie.title,
            overview=movie.overview,
            release_date=movie.release_date,
            poster_path=movie.poster_path,
            backdrop_path=movie.backdrop_path,
            runtime=movie.runtime,
            recommended_by_count=self.recs.recommended_by_count(movie.id),
            average_rating=self.ratings.average_for_movie(movie.id),
            my_rating=float(my_rating_row.score) if my_rating_row else None,
            tagline=tagline,
            genres=genres,
            director=director,
            cast=cast,
        )


def _parse_optional_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None
