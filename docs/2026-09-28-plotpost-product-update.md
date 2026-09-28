# Plotpost product update

**Date:** 2026-09-28  
**Product:** Plotpost (formerly MOVIESITE)  
**Stack:** Vite/React frontend (Vercel) · FastAPI backend (Railway) · Supabase Auth/Postgres · TMDB (backend only)

This document records UI, product, and API work shipped after the recommendation vertical slice.

---

## Summary

Plotpost is a social film recommendation app: share rated picks with followers, see whether they land, browse TMDB-backed movies, and open cast filmography.

---

## Features shipped

### Account & navigation

- Shared **AccountMenu** (gold avatar) on landing nav and app shell when signed in.
- Menu: My profile · Recommendations (mobile) · Notifications · Log out.
- **My profile** resolves username from `/users/me` or Supabase `user_metadata`, with `/profile` redirect fallback (avoids bounce to login → home when profile is still loading).

### Profile

- Page at `/users/:username`: avatar, display name, bio, follow / unfollow (or share/feed CTAs for self).
- Recommendation record: hits, misses, pending, hit rate.

### Landing

- Hero + rotating posters + film-strip reel.
- **Trending now** poster grid under the reel (**4 columns on mobile**).
- Mobile: hide hero Sign in / Get started; keep them in the nav.
- TMDB footer attribution removed from landing and shell.

### Auth

- Redesigned login (`/login`) and signup (`/register`) via shared `AuthShell` (brand, atmosphere, motion).
- Signup username field with `@` prefix.

### Branding

- Tab title: **Plotpost**.
- Favicon: `frontend/public/favicon.svg`, `favicon.png`, `apple-touch-icon.png` (linked from `frontend/index.html`).

### Cast filmography

- Movie cast members link to `/people/:id`.
- Person page: photo, bio, filmography grid; opening a credit upserts the TMDB movie locally and navigates to `/movies/:uuid`.
- Cast links only render when the API returns a numeric person `id` (guards against stale backends).

---

## Routes (frontend)

| Path | Auth | Purpose |
|------|------|---------|
| `/` | Public | Landing |
| `/login`, `/register` | Public | Auth |
| `/search` | Public | Search / trending browse |
| `/movies/:id` | Public | Movie detail, rate, recommend |
| `/people/:id` | Public | Person + filmography |
| `/profile` | Required | Redirect to own `/users/:username` |
| `/users/:username` | Required | User profile |
| `/recommendations` | Required | Feed (inbox / outbox) |
| `/recommendations/new` | Required | Share with all followers |
| `/notifications` | Required | In-app notifications |

---

## API additions

Base: `/api/v1`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/people/{person_id}` | TMDB person + movie credits (filmography) |
| `GET` | `/movies/tmdb/{tmdb_id}` | Upsert by TMDB id → local `MovieSummary` |
| `GET` | `/movies/{id}` (cast) | Cast members include TMDB `id` |

Health check: `GET /health` → `{ "status": "ok", "version": "0.2.0" }` when the filmography backend is live.

---

## Deploy

| Layer | Host | Notes |
|-------|------|--------|
| Frontend | Vercel | Root or `frontend/` project; rewrite `/api/:path*` → Railway |
| Backend | Railway | `backend/` (Railpack); env: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `TMDB_API_KEY`, CORS |

Production API base for the SPA is typically same-origin `/api/v1` (Vercel rewrite) or `VITE_API_BASE_URL`.

### Verify filmography backend

```text
GET https://<railway-host>/health
→ {"status":"ok","version":"0.2.0"}

GET https://<railway-host>/api/v1/people/287
→ person + filmography JSON
```

If cast clicks fail or health has no `version`, redeploy Railway so it picks up commits that add `/people` and cast `id`.

---

## Key frontend files

```text
frontend/src/components/AccountMenu.tsx
frontend/src/components/AuthShell.tsx
frontend/src/components/Layout.tsx
frontend/src/pages/LandingPage.tsx
frontend/src/pages/LoginPage.tsx
frontend/src/pages/RegisterPage.tsx
frontend/src/pages/ProfilePage.tsx
frontend/src/pages/ProfileRedirectPage.tsx
frontend/src/pages/PersonPage.tsx
frontend/src/pages/MoviePage.tsx
frontend/public/favicon.svg
```

## Key backend files

```text
backend/app/main.py
backend/app/api.py
backend/app/modules/movies/tmdb.py
backend/app/modules/movies/service.py
backend/app/modules/schemas_common.py
```

---

## Related docs

- Design: `docs/superpowers/specs/2026-09-27-recommendation-vertical-slice-design.md`
- Plan: `docs/superpowers/plans/2026-09-27-recommendation-vertical-slice-plan.md`
- Setup: `README.md`
