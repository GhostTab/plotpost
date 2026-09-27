from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import UpstreamError
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import MovieRepository, TMDBClient
from app.modules.ratings.models import Rating
from app.modules.recommendations.service import RatingRepository, RecommendationRepository
from app.modules.schemas_common import CastMember, MovieDetail


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

    def _upsert_all(self, results: list[dict]) -> list[Movie]:
        movies: list[Movie] = []
        for payload in results:
            # Search payloads lack runtime; upsert title fields only. Avoid partial corrupt writes:
            # each upsert is flushed independently; failures raise before commit.
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
                if not person.get("name"):
                    continue
                cast.append(
                    CastMember(
                        name=str(person["name"]),
                        character=person.get("character"),
                        profile_path=person.get("profile_path"),
                    )
                )
        except UpstreamError:
            # Detail page still works from local cache if TMDB enrichment fails.
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
