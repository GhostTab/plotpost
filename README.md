# Plotpost

Social movie recommendations with measurable outcomes.

Vertical slice: FastAPI + PostgreSQL + Supabase Auth + TMDB (backend only) + React frontend.

## Docs

- Product update (UI, profile, cast filmography, deploy): [`docs/2026-09-28-plotpost-product-update.md`](docs/2026-09-28-plotpost-product-update.md)
- Design spec: [`docs/superpowers/specs/2026-09-27-recommendation-vertical-slice-design.md`](docs/superpowers/specs/2026-09-27-recommendation-vertical-slice-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-09-27-recommendation-vertical-slice-plan.md`](docs/superpowers/plans/2026-09-27-recommendation-vertical-slice-plan.md)

## Prerequisites

- Python 3.12+
- Node.js 20+
- A Supabase project (Auth + **Postgres**; local Postgres optional)
- A [TMDB API key](https://www.themoviedb.org/settings/api)

## Environment

```bash
cp .env.example .env
# DATABASE_URL = Supabase Database connection URI (see below)
# SUPABASE_JWT_SECRET = Project Settings → API → JWT Secret
# TMDB_API_KEY = ...

cp frontend/.env.example frontend/.env
# edit VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# VITE_API_BASE_URL defaults to http://127.0.0.1:8000/api/v1
```

### Supabase Postgres `DATABASE_URL`

You do **not** need a local Postgres install if you use Supabase’s database.

1. Supabase Dashboard → **Project Settings → Database**
2. Copy **Connection string → URI** (use the database password you set at project creation)
3. Change `postgresql://` → `postgresql+psycopg://` and ensure `?sslmode=require` is present

Example shape for this project:

```text
postgresql+psycopg://postgres:[DB_PASSWORD]@db.uuxlkxyezhpzxdgbtcqi.supabase.co:5432/postgres?sslmode=require
```

Put that value in the root `.env` as `DATABASE_URL`.

`SUPABASE_JWT_SECRET` must match Project Settings → API → JWT Secret (legacy HS256).  
Also set **`SUPABASE_URL`** (same as `VITE_SUPABASE_URL`) so the API can verify modern **ES256** user tokens via JWKS (`/auth/v1/.well-known/jwks.json`). Frontend uses the anon key only.

## Backend setup

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -e ".[dev]"
```

With Supabase Postgres you do **not** need `CREATE DATABASE` — use the existing `postgres` database in the connection URI.

Migrate and run (venv must be activated, or use `python -m`):

```bash
cd backend
.\.venv\Scripts\activate.bat
alembic upgrade head
uvicorn app.main:app --reload

# If activate is skipped (CMD without venv on PATH):
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Alembic will create the app tables (`users`, `follows`, `movies`, …) in your Supabase project.
- Health: `GET http://127.0.0.1:8000/health`
- OpenAPI: `http://127.0.0.1:8000/docs`
- API prefix: `/api/v1`

### Auth provisioning

Every authenticated request verifies the Supabase JWT and auto-provisions a row in **`public.users`** (not `auth.users`) if missing.

- **Authentication** tab in Supabase = Auth identities only.  
- **Table Editor → `users`** = app profiles (created when the API accepts a valid session).

Register/sign-in now call `GET /api/v1/users/me` immediately so the profile row is created right away.

Username selection:

1. `user_metadata.username` from the JWT (set on register), else
2. email local-part, else
3. `user_{uid_prefix}`

If profiles never appear in `users`: confirm email is off (or confirmed), Railway has `SUPABASE_URL` + working JWT verify, and `DATABASE_URL` points at the same Supabase Postgres you’re inspecting.

### Recommendation threshold

`SUCCESS_THRESHOLD` (default `4.0`) is read only via settings / `calculate_recommendation_result`.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

Primary nav: **Search** | **Recommendations**. Profile dropdown: **My profile** | **Notifications** | **Log out**.

```bash
npm test
```

## Manual two-user proof (Phase F)

1. Create two users in Supabase Auth (or via `/register`), e.g. `alice` and `bravo`, with `user_metadata.username` set.
2. Start Postgres, migrate, start API + Vite.
3. As **bravo**, open `/users/alice` and Follow.
4. As **alice**, search a movie → Recommend → pick bravo (must appear in followers picker).
5. As **bravo**, open Notifications / Recommendations inbox → open movie → rate ≥ 4.0.
6. As **alice**, confirm outbox status SUCCESS, notification outcome, and profile stats update.
7. Movie page “Recommended by N” should be ≥ 1.

## Backend tests

```bash
cd backend
pytest
```

Tests use in-memory SQLite and do not require Postgres or live TMDB.

## Out of scope

Docker, Redis/workers, diary, watchlist, activity feed, email, ML.
