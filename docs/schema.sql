-- Plotpost / MOVIESITE — full paste-ready schema (v2)
-- Paste into Supabase SQL Editor.
-- Includes recommendation slice + profile cover, watchlist, watched/diary, likes.
--
-- If you already ran the v1 slice schema, skip to the "ADDITIVE (v1 → v2)" section at the bottom
-- OR drop app tables and run this whole file once.

-- =============================================================================
-- CORE
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,          -- profile picture URL (e.g. Supabase Storage)
  cover_url TEXT,           -- profile cover / banner URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_username_key UNIQUE (username)
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  title VARCHAR(512) NOT NULL,
  overview TEXT,
  release_date DATE,
  poster_path VARCHAR(512),
  backdrop_path VARCHAR(512),
  runtime INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_movies_tmdb_id UNIQUE (tmdb_id)
);
CREATE INDEX IF NOT EXISTS ix_movies_tmdb_id ON movies (tmdb_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT uq_follows_pair UNIQUE (follower_id, following_id),
  CONSTRAINT ck_follows_no_self CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  score NUMERIC(2, 1) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ratings_user_movie UNIQUE (user_id, movie_id),
  CONSTRAINT ck_ratings_score_range CHECK (score >= 0.5 AND score <= 5.0)
);
CREATE INDEX IF NOT EXISTS ix_ratings_user_id ON ratings (user_id);
CREATE INDEX IF NOT EXISTS ix_ratings_movie_id ON ratings (movie_id);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT ck_recommendations_no_self CHECK (sender_id <> recipient_id),
  CONSTRAINT uq_recommendations_triple UNIQUE (sender_id, recipient_id, movie_id),
  CONSTRAINT ck_recommendations_status CHECK (
    status IN ('PENDING', 'SUCCESS', 'UNSUCCESSFUL')
  )
);
CREATE INDEX IF NOT EXISTS ix_recommendations_sender_id ON recommendations (sender_id);
CREATE INDEX IF NOT EXISTS ix_recommendations_recipient_id ON recommendations (recipient_id);
CREATE INDEX IF NOT EXISTS ix_recommendations_movie_id ON recommendations (movie_id);
CREATE INDEX IF NOT EXISTS ix_recommendations_status ON recommendations (status);
CREATE INDEX IF NOT EXISTS ix_recommendations_created_at ON recommendations (created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications (created_at);

-- =============================================================================
-- LIBRARY: save (watchlist) + watched (diary)
-- =============================================================================

-- Save for later (watchlist). One row per user/movie.
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_watchlist_user_movie UNIQUE (user_id, movie_id)
);
CREATE INDEX IF NOT EXISTS ix_watchlist_user_id ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS ix_watchlist_movie_id ON watchlist (movie_id);

-- Watched / diary log. Multiple entries allowed (rewatches).
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  watched_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  score NUMERIC(2, 1),                 -- optional; can mirror ratings
  review TEXT,                         -- optional short review
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_diary_score_range CHECK (
    score IS NULL OR (score >= 0.5 AND score <= 5.0)
  )
);
CREATE INDEX IF NOT EXISTS ix_diary_entries_user_id ON diary_entries (user_id);
CREATE INDEX IF NOT EXISTS ix_diary_entries_movie_id ON diary_entries (movie_id);
CREATE INDEX IF NOT EXISTS ix_diary_entries_watched_at ON diary_entries (watched_at DESC);
CREATE INDEX IF NOT EXISTS ix_diary_entries_user_watched ON diary_entries (user_id, watched_at DESC);

-- =============================================================================
-- SOCIAL: likes
-- =============================================================================

-- Like a movie (heart / like on a title).
CREATE TABLE IF NOT EXISTS movie_likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT movie_likes_pkey PRIMARY KEY (user_id, movie_id)
);
CREATE INDEX IF NOT EXISTS ix_movie_likes_movie_id ON movie_likes (movie_id);

-- Like a diary entry / review.
CREATE TABLE IF NOT EXISTS diary_likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT diary_likes_pkey PRIMARY KEY (user_id, diary_entry_id)
);
CREATE INDEX IF NOT EXISTS ix_diary_likes_diary_entry_id ON diary_likes (diary_entry_id);

-- =============================================================================
-- RLS (FastAPI uses DB role; lock down PostgREST / anon key)
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_likes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Alembic stamp (optional)
-- =============================================================================

CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO alembic_version (version_num)
SELECT '0001_initial'
WHERE NOT EXISTS (SELECT 1 FROM alembic_version);

-- =============================================================================
-- ADDITIVE (v1 → v2) — run ONLY if you already created the v1 tables
-- =============================================================================
-- Uncomment and run if users/movies/... already exist from the first schema.sql:

/*
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE users
  ALTER COLUMN avatar_url TYPE TEXT;

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_watchlist_user_movie UNIQUE (user_id, movie_id)
);
CREATE INDEX IF NOT EXISTS ix_watchlist_user_id ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS ix_watchlist_movie_id ON watchlist (movie_id);

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  watched_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  score NUMERIC(2, 1),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_diary_score_range CHECK (
    score IS NULL OR (score >= 0.5 AND score <= 5.0)
  )
);
CREATE INDEX IF NOT EXISTS ix_diary_entries_user_id ON diary_entries (user_id);
CREATE INDEX IF NOT EXISTS ix_diary_entries_movie_id ON diary_entries (movie_id);
CREATE INDEX IF NOT EXISTS ix_diary_entries_watched_at ON diary_entries (watched_at DESC);
CREATE INDEX IF NOT EXISTS ix_diary_entries_user_watched ON diary_entries (user_id, watched_at DESC);

CREATE TABLE IF NOT EXISTS movie_likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT movie_likes_pkey PRIMARY KEY (user_id, movie_id)
);
CREATE INDEX IF NOT EXISTS ix_movie_likes_movie_id ON movie_likes (movie_id);

CREATE TABLE IF NOT EXISTS diary_likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT diary_likes_pkey PRIMARY KEY (user_id, diary_entry_id)
);
CREATE INDEX IF NOT EXISTS ix_diary_likes_diary_entry_id ON diary_likes (diary_entry_id);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_likes ENABLE ROW LEVEL SECURITY;
*/
