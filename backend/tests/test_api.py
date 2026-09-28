from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.core.constants import NotificationType, RecommendationStatus
from app.database import Base, get_db
from app.main import create_app
import app.models  # noqa: F401 — register all tables on Base.metadata
from app.modules.movies.models import Movie
from app.modules.movies.tmdb import TMDBClient
from sqlalchemy import func, select

from app.modules.recommendations.domain import calculate_recommendation_result
from app.modules.users.models import User
from app.modules.diary.models import DiaryEntry
from app.modules.ratings.models import Rating
from app.modules.watchlist.models import WatchlistItem
from app.modules.likes.models import MovieLike


TEST_SECRET = "test-jwt-secret-at-least-32-bytes-long"


@pytest.fixture()
def settings(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("SUCCESS_THRESHOLD", "4.0")
    monkeypatch.setenv("TMDB_API_KEY", "test-key")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture()
def db_session(settings):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session, settings, monkeypatch):
    app = create_app()

    def _override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_db

    # Default TMDB client unused unless patched per-test
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_token(user_id: UUID, *, username: str | None = None, email: str | None = None) -> str:
    payload = {
        "sub": str(user_id),
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "email": email or f"{user_id.hex[:8]}@example.com",
        "user_metadata": {},
    }
    if username:
        payload["user_metadata"] = {"username": username}
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


def auth_header(user_id: UUID, **kwargs) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(user_id, **kwargs)}"}


def seed_user(db: Session, *, username: str, user_id: UUID | None = None) -> User:
    user = User(id=user_id or uuid4(), username=username, display_name=username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_movie(db: Session, *, tmdb_id: int = 100, title: str = "Test Movie") -> Movie:
    movie = Movie(id=uuid4(), tmdb_id=tmdb_id, title=title, overview="An overview")
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unauthenticated_is_401(client):
    response = client.get("/api/v1/users/someone")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_first_authenticated_request_provisions_user(client, db_session):
    user_id = uuid4()
    response = client.get(
        f"/api/v1/users/alice",
        headers=auth_header(user_id, username="alice"),
    )
    # alice profile may 404 until provisioned via any authed call — provision on this call first
    # The dependency provisions the caller (alice), then looks up path username.
    # Same username: should 200 after provision.
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["id"] == str(user_id)
    assert db_session.get(User, user_id) is not None


def test_self_follow_rejected(client, db_session):
    user = seed_user(db_session, username="solo")
    response = client.post("/api/v1/follows/solo", headers=auth_header(user.id, username="solo"))
    assert response.status_code == 403
    assert response.json()["code"] == "SELF_FOLLOW"


def test_duplicate_follow_rejected(client, db_session):
    a = seed_user(db_session, username="alpha")
    b = seed_user(db_session, username="bravo")
    headers = auth_header(a.id, username="alpha")
    first = client.post("/api/v1/follows/bravo", headers=headers)
    assert first.status_code == 204
    second = client.post("/api/v1/follows/bravo", headers=headers)
    assert second.status_code == 409
    assert second.json()["code"] == "FOLLOW_EXISTS"


def test_follower_list(client, db_session):
    a = seed_user(db_session, username="alpha")
    b = seed_user(db_session, username="bravo")
    client.post("/api/v1/follows/alpha", headers=auth_header(b.id, username="bravo"))
    response = client.get("/api/v1/users/me/followers", headers=auth_header(a.id, username="alpha"))
    assert response.status_code == 200
    usernames = {row["username"] for row in response.json()}
    assert usernames == {"bravo"}


def test_calculate_recommendation_result(settings):
    assert calculate_recommendation_result(None) == RecommendationStatus.PENDING
    assert calculate_recommendation_result(4.0) == RecommendationStatus.SUCCESS
    assert calculate_recommendation_result(3.5) == RecommendationStatus.UNSUCCESSFUL
    assert calculate_recommendation_result(5.0) == RecommendationStatus.SUCCESS


def _rate(client, user, username: str, movie_id, score: float = 4.5):
    return client.put(
        "/api/v1/ratings",
        headers=auth_header(user.id, username=username),
        json={"movie_id": str(movie_id), "score": score},
    )


def _share(client, sender, username: str, movie_id, message: str | None = None):
    payload = {"movie_id": str(movie_id)}
    if message is not None:
        payload["message"] = message
    return client.post(
        "/api/v1/recommendations",
        headers=auth_header(sender.id, username=username),
        json=payload,
    )


def test_no_followers_blocks_share(client, db_session):
    sender = seed_user(db_session, username="sender")
    movie = seed_movie(db_session)
    _rate(client, sender, "sender", movie.id)
    response = _share(client, sender, "sender", movie.id)
    assert response.status_code == 403
    assert response.json()["code"] == "NO_FOLLOWERS"


def test_sender_must_rate_before_share(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    response = _share(client, sender, "sender", movie.id)
    assert response.status_code == 403
    assert response.json()["code"] == "SENDER_RATING_REQUIRED"


def test_duplicate_recommendation_409(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    _rate(client, sender, "sender", movie.id)
    first = _share(client, sender, "sender", movie.id, message="watch this")
    assert first.status_code == 201
    assert isinstance(first.json(), list)
    assert len(first.json()) == 1
    assert first.json()[0]["sender_rating"] == 4.5
    second = _share(client, sender, "sender", movie.id, message="watch this")
    assert second.status_code == 409
    assert second.json()["code"] == "RECOMMENDATION_EXISTS"


def test_share_fans_out_to_all_followers(client, db_session):
    sender = seed_user(db_session, username="sender")
    a = seed_user(db_session, username="follower_a")
    b = seed_user(db_session, username="follower_b")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(a.id, username="follower_a"))
    client.post("/api/v1/follows/sender", headers=auth_header(b.id, username="follower_b"))
    _rate(client, sender, "sender", movie.id, score=5.0)
    response = _share(client, sender, "sender", movie.id)
    assert response.status_code == 201
    body = response.json()
    assert len(body) == 2
    recipients = {row["recipient_username"] for row in body}
    assert recipients == {"follower_a", "follower_b"}


def test_rate_resolves_success_and_unsuccessful(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    good = seed_movie(db_session, tmdb_id=1, title="Good")
    bad = seed_movie(db_session, tmdb_id=2, title="Bad")
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    _rate(client, sender, "sender", good.id)
    _rate(client, sender, "sender", bad.id)
    _share(client, sender, "sender", good.id)
    _share(client, sender, "sender", bad.id)

    ok = client.put(
        "/api/v1/ratings",
        headers=auth_header(recipient.id, username="recipient"),
        json={"movie_id": str(good.id), "score": 4.5},
    )
    assert ok.status_code == 200

    no = client.put(
        "/api/v1/ratings",
        headers=auth_header(recipient.id, username="recipient"),
        json={"movie_id": str(bad.id), "score": 2.0},
    )
    assert no.status_code == 200

    outbox = client.get(
        "/api/v1/recommendations/outbox",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    by_movie = {row["movie_id"]: row["status"] for row in outbox}
    assert by_movie[str(good.id)] == "SUCCESS"
    assert by_movie[str(bad.id)] == "UNSUCCESSFUL"

    profile = client.get(
        "/api/v1/users/sender",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    stats = profile["recommendation_stats"]
    assert stats["successful"] == 1
    assert stats["unsuccessful"] == 1
    assert stats["pending"] == 0
    assert stats["completed"] == 2
    assert stats["success_rate"] == 50.0


def test_already_rated_recipient_resolves_immediately(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    client.put(
        "/api/v1/ratings",
        headers=auth_header(recipient.id, username="recipient"),
        json={"movie_id": str(movie.id), "score": 4.0},
    )
    _rate(client, sender, "sender", movie.id, score=4.5)
    response = _share(client, sender, "sender", movie.id)
    assert response.status_code == 201
    assert response.json()[0]["status"] == "SUCCESS"
    assert response.json()[0]["sender_rating"] == 4.5

    recipient_notes = client.get(
        "/api/v1/notifications",
        headers=auth_header(recipient.id, username="recipient"),
    ).json()
    sender_notes = client.get(
        "/api/v1/notifications",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    assert any(n["type"] == NotificationType.RECOMMENDATION_RECEIVED.value for n in recipient_notes)
    assert any(n["type"] == NotificationType.RECOMMENDATION_OUTCOME.value for n in sender_notes)


def test_stats_exclude_pending_from_denominator(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    pending_movie = seed_movie(db_session, tmdb_id=10, title="Pending")
    done_movie = seed_movie(db_session, tmdb_id=11, title="Done")
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    _rate(client, sender, "sender", pending_movie.id)
    _rate(client, sender, "sender", done_movie.id)
    _share(client, sender, "sender", pending_movie.id)
    _share(client, sender, "sender", done_movie.id)
    client.put(
        "/api/v1/ratings",
        headers=auth_header(recipient.id, username="recipient"),
        json={"movie_id": str(done_movie.id), "score": 5.0},
    )
    stats = client.get(
        "/api/v1/users/sender",
        headers=auth_header(sender.id, username="sender"),
    ).json()["recommendation_stats"]
    assert stats["pending"] == 1
    assert stats["successful"] == 1
    assert stats["completed"] == 1
    assert stats["success_rate"] == 100.0


def test_recommended_by_count_increments(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    before = client.get(
        f"/api/v1/movies/{movie.id}",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    assert before["recommended_by_count"] == 0
    _rate(client, sender, "sender", movie.id)
    _share(client, sender, "sender", movie.id)
    after = client.get(
        f"/api/v1/movies/{movie.id}",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    assert after["recommended_by_count"] == 1


def test_rerate_does_not_duplicate_outcome_notifications(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    _rate(client, sender, "sender", movie.id)
    _share(client, sender, "sender", movie.id)
    headers = auth_header(recipient.id, username="recipient")
    client.put("/api/v1/ratings", headers=headers, json={"movie_id": str(movie.id), "score": 4.0})
    client.put("/api/v1/ratings", headers=headers, json={"movie_id": str(movie.id), "score": 5.0})

    sender_notes = client.get(
        "/api/v1/notifications",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    outcomes = [n for n in sender_notes if n["type"] == NotificationType.RECOMMENDATION_OUTCOME.value]
    assert len(outcomes) == 1


def test_movie_search_mocked_tmdb(client, db_session, monkeypatch):
    def fake_search(self, query: str):
        assert query == "inception"
        return [
            {
                "id": 27205,
                "title": "Inception",
                "overview": "Dreams",
                "release_date": "2010-07-16",
                "poster_path": "/x.jpg",
                "backdrop_path": "/y.jpg",
            }
        ]

    monkeypatch.setattr(TMDBClient, "search", fake_search)
    response = client.get("/api/v1/movies/search", params={"q": "inception"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["title"] == "Inception"
    assert body[0]["tmdb_id"] == 27205


def test_trending_upserts_and_returns_movies(client, db_session, monkeypatch):
    def fake_trending(self):
        return [
            {"id": 603, "title": "The Matrix", "overview": "Wake up.", "release_date": "1999-03-31"},
            {"id": 27205, "title": "Inception", "overview": "Dreams.", "release_date": "2010-07-16"},
        ]

    monkeypatch.setattr(TMDBClient, "trending_week", fake_trending)
    response = client.get("/api/v1/movies/trending")
    assert response.status_code == 200
    assert [m["title"] for m in response.json()] == ["The Matrix", "Inception"]
    assert db_session.scalar(select(func.count()).select_from(Movie)) == 2


def test_movie_detail_public(client, db_session):
    movie = seed_movie(db_session, title="Public Film")
    response = client.get(f"/api/v1/movies/{movie.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Public Film"
    assert body["my_rating"] is None
    assert body["recommended_by_count"] == 0


def test_movie_detail_404(client, db_session):
    missing = uuid4()
    response = client.get(f"/api/v1/movies/{missing}")
    assert response.status_code == 404
    assert response.json()["code"] == "MOVIE_NOT_FOUND"


def test_failed_tmdb_does_not_leave_bad_rows(client, db_session, monkeypatch):
    from app.core.exceptions import UpstreamError

    def boom(self, query: str):
        raise UpstreamError("TMDB request failed", code="TMDB_UNAVAILABLE", status_code=503)

    monkeypatch.setattr(TMDBClient, "search", boom)
    response = client.get("/api/v1/movies/search", params={"q": "x"})
    assert response.status_code == 503
    assert db_session.scalar(select(func.count()).select_from(Movie)) == 0


# --- Phase G ---


def test_patch_profile_updates_cover_and_bio(client, db_session):
    user = seed_user(db_session, username="editor")
    response = client.patch(
        "/api/v1/users/me",
        headers=auth_header(user.id, username="editor"),
        json={
            "display_name": "Editor Name",
            "bio": "Hello",
            "avatar_url": "https://cdn.example/a.jpg",
            "cover_url": "https://cdn.example/c.jpg",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Editor Name"
    assert body["bio"] == "Hello"
    assert body["avatar_url"] == "https://cdn.example/a.jpg"
    assert body["cover_url"] == "https://cdn.example/c.jpg"
    assert body["ratings_count"] == 0


def test_rate_auto_creates_diary_and_second_rate_updates_same_day(client, db_session):
    user = seed_user(db_session, username="rater")
    movie = seed_movie(db_session)
    headers = auth_header(user.id, username="rater")
    first = client.put(
        "/api/v1/ratings",
        headers=headers,
        json={"movie_id": str(movie.id), "score": 4.0},
    )
    assert first.status_code == 200
    assert db_session.scalar(select(func.count()).select_from(Rating)) == 1
    assert db_session.scalar(select(func.count()).select_from(DiaryEntry)) == 1
    entry = db_session.scalar(select(DiaryEntry))
    assert float(entry.score) == 4.0

    second = client.put(
        "/api/v1/ratings",
        headers=headers,
        json={"movie_id": str(movie.id), "score": 5.0},
    )
    assert second.status_code == 200
    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(DiaryEntry)) == 1
    entry = db_session.scalar(select(DiaryEntry))
    assert float(entry.score) == 5.0

    listed = client.get("/api/v1/users/rater/ratings", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["score"] == "5.0"
    profile = client.get("/api/v1/users/rater", headers=headers).json()
    assert profile["ratings_count"] == 1


def test_diary_with_score_upserts_rating_and_resolves_rec(client, db_session):
    sender = seed_user(db_session, username="sender")
    recipient = seed_user(db_session, username="recipient")
    movie = seed_movie(db_session)
    client.post("/api/v1/follows/sender", headers=auth_header(recipient.id, username="recipient"))
    _rate(client, sender, "sender", movie.id)
    _share(client, sender, "sender", movie.id)

    response = client.post(
        "/api/v1/diary",
        headers=auth_header(recipient.id, username="recipient"),
        json={"movie_id": str(movie.id), "score": 4.5, "review": "great"},
    )
    assert response.status_code == 201
    assert float(response.json()["score"]) == 4.5
    rating = db_session.scalar(select(Rating).where(Rating.user_id == recipient.id))
    assert float(rating.score) == 4.5
    outbox = client.get(
        "/api/v1/recommendations/outbox",
        headers=auth_header(sender.id, username="sender"),
    ).json()
    assert outbox[0]["status"] == "SUCCESS"


def test_watchlist_unique_and_delete(client, db_session):
    user = seed_user(db_session, username="saver")
    movie = seed_movie(db_session)
    headers = auth_header(user.id, username="saver")
    first = client.post("/api/v1/watchlist", headers=headers, json={"movie_id": str(movie.id)})
    assert first.status_code == 201
    dup = client.post("/api/v1/watchlist", headers=headers, json={"movie_id": str(movie.id)})
    assert dup.status_code == 409
    assert dup.json()["code"] == "WATCHLIST_EXISTS"
    detail = client.get(f"/api/v1/movies/{movie.id}", headers=headers).json()
    assert detail["on_watchlist"] is True
    listed = client.get("/api/v1/users/saver/watchlist", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    removed = client.delete(f"/api/v1/watchlist/{movie.id}", headers=headers)
    assert removed.status_code == 204
    missing = client.delete(f"/api/v1/watchlist/{movie.id}", headers=headers)
    assert missing.status_code == 404
    assert db_session.scalar(select(func.count()).select_from(WatchlistItem)) == 0


def test_movie_like_unlike_and_profile_likes(client, db_session):
    user = seed_user(db_session, username="fan")
    movie = seed_movie(db_session)
    headers = auth_header(user.id, username="fan")
    liked = client.post(f"/api/v1/movies/{movie.id}/like", headers=headers)
    assert liked.status_code == 204
    dup = client.post(f"/api/v1/movies/{movie.id}/like", headers=headers)
    assert dup.status_code == 409
    detail = client.get(f"/api/v1/movies/{movie.id}", headers=headers).json()
    assert detail["liked_by_me"] is True
    assert detail["like_count"] == 1
    listed = client.get("/api/v1/users/fan/likes", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    unliked = client.delete(f"/api/v1/movies/{movie.id}/like", headers=headers)
    assert unliked.status_code == 204
    assert db_session.scalar(select(func.count()).select_from(MovieLike)) == 0
