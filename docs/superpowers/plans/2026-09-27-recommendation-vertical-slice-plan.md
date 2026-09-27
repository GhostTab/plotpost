# Implementation Plan: Recommendation Vertical Slice

**Date:** 2026-09-27  
**Origin:** `docs/superpowers/specs/2026-09-27-recommendation-vertical-slice-design.md`  
**Status:** Ready for implementation  

## Goal

Deliver a runnable local stack (no Docker) where two users complete: follow → recommend → rate → auto SUCCESS/UNSUCCESSFUL → stats + in-app notification → movie “Recommended by N”.

## Constraints (do not violate)

- Modular FastAPI monolith; no microservices, no Redis/workers in this slice  
- Frontend never calls TMDB  
- Recommend only to sender’s followers  
- Unique `(sender_id, recipient_id, movie_id)`  
- Success threshold configurable in one place (default ≥ 4.0)  
- Rating alone resolves; already-rated recipients resolve on create  
- Primary nav: Search + Recommendations; other links in profile dropdown  

## Repo layout (create)

```text
backend/
  app/
    main.py
    core/          # config, db, security
    modules/
      users/
      follows/
      movies/
      ratings/
      recommendations/
      notifications/
  alembic/
  tests/
frontend/
  src/
    app/
    pages/
    components/
    lib/           # api client, supabase, auth
  ...
.env.example
README.md
```

---

## Phase A — Backend foundation  
**Owner:** Backend agent

### A1. Scaffold FastAPI + config
- [x] Create `backend/` with FastAPI app, `/api/v1` router mount, health check  
- [x] Settings via env: `DATABASE_URL`, `SUPABASE_JWT_SECRET` (or JWKS URL), `TMDB_API_KEY`, `SUCCESS_THRESHOLD=4.0`  
- [x] SQLAlchemy 2.0 session + Alembic init  
- [x] `.env.example` at repo root documenting required keys  
- [x] README: how to run Postgres locally, migrate, start uvicorn (no Docker)

**Done when:** `uvicorn` serves `/health` and Alembic can generate an empty revision.

### A2. Users + auth middleware
- [x] `users` table migration (id = auth uid, username unique, display_name, bio, avatar_url, timestamps)  
- [x] JWT verification middleware; reject missing/invalid with `401`  
- [x] Auto-provision `users` row on first authenticated request (username from claim or placeholder requiring profile completion — pick one and document in README)  
- [x] `GET /api/v1/users/{username}` returns profile shell (stats can be stubbed `0` until Phase E)

**Tests:** unauthenticated → 401; authenticated first call creates user row.

### A3. Follows module
- [x] `follows` table + UNIQUE + no self-follow CHECK  
- [x] `POST /api/v1/follows/{username}` / `DELETE`  
- [x] `GET /api/v1/users/me/followers` for recipient picker  

**Tests:** self-follow rejected; duplicate follow rejected; follower list correct.

---

## Phase B — Movies (TMDB)  
**Owner:** Backend agent

### B1. Movie persistence + TMDB client
- [x] `movies` table (`tmdb_id` unique + cached fields)  
- [x] TMDB HTTP client in `modules/movies/` only  
- [x] `GET /api/v1/movies/search?q=` — search TMDB, upsert needed rows, return list  
- [x] `GET /api/v1/movies/{id}` — local id; include `recommended_by_count` (0 until recs exist), `average_rating`, `my_rating`  
- [x] Map upstream failures to `502`/`503` without corrupt partial writes  

**Tests:** search with mocked TMDB; detail 404; failed TMDB does not leave bad rows.

---

## Phase C — Ratings + recommendations core  
**Owner:** Backend agent

### C1. Ratings
- [x] `ratings` table UNIQUE `(user_id, movie_id)`; score 0.5–5.0 validation  
- [x] `PUT /api/v1/ratings` upsert  
- [x] After upsert, call recommendations resolve in **same transaction**

### C2. Recommendation domain
- [x] `recommendations` table + status enum + UNIQUE triple + no self-recommend  
- [x] `SUCCESS_THRESHOLD` single constant/settings read  
- [x] `calculate_recommendation_result(rating) -> PENDING | SUCCESS | UNSUCCESSFUL`  
- [x] `POST /api/v1/recommendations`  
  - Require recipient follows sender → else `403 RECIPIENT_NOT_FOLLOWER`  
  - Duplicate → `409 RECOMMENDATION_EXISTS`  
  - If recipient already rated → resolve immediately  
- [x] `GET /api/v1/recommendations/inbox` and `/outbox` (limit/offset)  
- [x] Stats helper: successful, unsuccessful, pending, completed, rate (pending excluded)  
- [x] Embed stats on `GET /users/{username}` (or dedicated stats path from design)  
- [x] `recommended_by_count` = distinct senders for movie  

### C3. Notifications (sync)
- [x] `notifications` table  
- [x] Types: `recommendation_received`, `recommendation_outcome`  
- [x] Create rows in same transaction as recommend/resolve  
- [x] Idempotent resolve: no second outcome notification if already terminal  
- [x] `GET /api/v1/notifications` + `POST /api/v1/notifications/{id}/read`  

**Mandatory tests (Pytest + HTTPX):**
- [x] Follower gate  
- [x] Duplicate 409  
- [x] ≥4.0 SUCCESS, &lt;4.0 UNSUCCESSFUL, null PENDING  
- [x] Already-rated recipient → immediate resolve + notifications  
- [x] Stats exclude pending from denominator  
- [x] Recommended-by N increments on create  
- [x] Re-rate / re-resolve does not duplicate outcome notifications  

**Done when:** API-only two-user script or tests prove the full loop.

---

## Phase D — Frontend shell + auth  
**Owner:** Frontend agent  
**Depends on:** A2 for real auth; can mock API until then

### D1. App scaffold
- [x] Vite + React + TS + Tailwind v4 (or project-default Tailwind) + React Router + TanStack Query  
- [x] Supabase client; login/register pages  
- [x] API client attaches JWT; base URL from env  
- [x] Layout: primary nav **Search | Recommendations**; profile dropdown **My profile | Notifications | Log out**  
- [x] Routes from design §5  

**Tests (Vitest):** nav links + dropdown items present.

### D2. Search + movie page
- [x] `/search` wired to `GET /movies/search`  
- [x] `/movies/:id` shows metadata, “Recommended by N”, rating control, Recommend CTA → `/recommendations?movieId=`  
- [x] TMDB attribution in UI footer/section as required  

### D3. Profile + follow
- [x] `/users/:username` follow/unfollow, stats “X successful out of Y completed” (+ rate when Y&gt;0)  

---

## Phase E — Recommendations hub + notifications UI  
**Owner:** Frontend agent  
**Depends on:** Phase C

### E1. Hub `/recommendations`
- [x] Compose: movie picker (or prefilled), recipient = followers only, optional message  
- [x] Inbox + Outbox with status badges PENDING / SUCCESS / UNSUCCESSFUL  
- [x] Empty states + inline errors (`RECIPIENT_NOT_FOLLOWER`, `RECOMMENDATION_EXISTS`)  

### E2. Notifications
- [x] `/notifications` list; mark read; entry in profile dropdown  
- [x] Refetch on open (no websockets)  

**Tests:** compose validation; status badge mapping; stats formatter.

---

## Phase F — Integration + manual proof  
**Owners:** both agents + Tech Lead check

- [x] Two real Supabase users on local Postgres *(documented manual proof path in README)*  
- [x] B follows A → A recommends → B rates → A sees outcome + notification *(documented)*  
- [x] Movie page N count &gt; 0 *(documented)*  
- [x] README documents env, migrate, run backend, run frontend, TMDB key, Supabase setup  
- [x] All Phase C mandatory tests green  

---

## Agent handoff prompts (copy/paste)

### Backend agent

Implement Phases A→C per `docs/superpowers/plans/2026-09-27-recommendation-vertical-slice-plan.md` and `docs/superpowers/specs/2026-09-27-recommendation-vertical-slice-design.md`. Do not add Docker, Redis, feed, diary, or watchlist. Prefer DB constraints + one `calculate_recommendation_result`. Stop after Phase C tests pass and document how to run the API.

### Frontend agent

Implement Phases D→E against the same docs. Use nav/dropdown exactly as specified. Prefer mocks only until backend endpoints exist; then integrate `/api/v1`. Follow `agents/frontend.mc` for visual quality on marketing-ish surfaces, but this is a product app — keep the hub/movie/profile usable and clear, not a landing-page collage. Stop when the two-user loop works in the browser.

### Sequencing

1. Backend A→C first (or at least A+B+auth stubs)  
2. Frontend D in parallel with mocks  
3. Frontend E + Phase F together  

---

## Out of scope reminder

Diary, watchlist, reviews text, activity feed, email, Redis/workers, Docker, ML, chat.

## Definition of done

Checklist in design §12 + Phase F complete + plan checkboxes for A–E checked in the PR/commit messages as work lands.
