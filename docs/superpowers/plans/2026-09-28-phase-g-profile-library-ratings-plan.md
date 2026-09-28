# Implementation Plan: Phase G — Profile, Library & Ratings

**Date:** 2026-09-28  
**Product:** Plotpost  
**Depends on:** Vertical slice (A–F) complete; paste `docs/schema.sql` v2 first  
**Status:** Ready for implementation  

## Goal

Ship profile media + personal library (watchlist, watched/diary, likes) and deepen **ratings** so they show on profiles, sync with diary when useful, and stay the source of truth for recommendation outcomes.

## Prerequisites

1. Run `docs/schema.sql` v2 in Supabase (full file, or additive block if v1 already applied).  
2. Create Supabase Storage buckets (suggested): `avatars`, `covers` — public read, authenticated write to own folder `{user_id}/*`.  
3. Align SQLAlchemy models + Alembic with v2 columns/tables (do not leave models out of sync with pasted SQL).

## Constraints

- Keep modular monolith; no Redis/workers.  
- Ratings remain **one row per `(user, movie)`** and still drive recommendation SUCCESS/UNSUCCESSFUL.  
- Diary can store an optional `score`; on rate from movie page, upsert `ratings` (existing) and optionally upsert/create a diary entry for “watched”.  
- Frontend never calls TMDB.  
- YAGNI: no comments, custom lists, or feed in this phase.

---

## Scope

### In scope

| Area | What |
|------|------|
| Profile | Edit display name, bio; upload avatar + cover → `avatar_url` / `cover_url` |
| Ratings | Keep movie-page rate; add **rated films** on profile; show score on diary rows when present |
| Watchlist | Add/remove from movie page; list on profile |
| Watched / diary | Mark watched; diary list on profile (date, optional review/score) |
| Likes | Like/unlike movie; show like state + count on movie page; optional like on diary entry |
| Profile page | Tabs or sections: About · Diary · Watchlist · Liked · Rated |

### Out of scope

Activity feed, person-to-person rec analytics, Redis, comments, lists, email.

---

## Rating rules (explicit)

1. **`ratings` table is canonical** for recommendation resolution (unchanged).  
2. Rating UI: half-stars 0.5–5.0 (existing `RatingControl`).  
3. When user rates a movie:  
   - Upsert `ratings` (existing `PUT /ratings`).  
   - If no diary entry for that movie on that calendar day, create a `diary_entries` row with `watched_at = today` and `score` matching (optional but recommended default: **yes, auto-log watched**).  
4. When user logs diary with a score: also upsert `ratings` so recs resolve.  
5. Profile “Rated” = movies with a `ratings` row for that user, newest first.  
6. Clearing a rating (if you add delete): do **not** auto-delete diary; leave diary score nullable or unchanged — document choice (recommend: `DELETE /ratings` sets diary score null only if you implement delete; otherwise skip delete in G).

**Default for Phase G:** no rating delete; rate/update only. Auto-create diary on rate.

---

## Phase G1 — Schema & models  
**Owner:** Backend agent

- [x] Ensure DB matches `docs/schema.sql` v2 (`cover_url`, `watchlist`, `diary_entries`, `movie_likes`, `diary_likes`)  
- [x] SQLAlchemy models + Alembic revision `0002_profile_library` (or stamp if SQL already applied manually)  
- [x] User schema: expose `cover_url` on profile responses  

**Done when:** models import; migrations/stamp consistent with live DB.

---

## Phase G2 — Profile edit + media  
**Owner:** Backend + Frontend

### Backend
- [x] `PATCH /api/v1/users/me` — `display_name`, `bio`, `avatar_url`, `cover_url` (URL strings after upload)  
- [x] Optional: signed upload helpers documented; or frontend uploads to Supabase Storage then PATCHes URLs  

### Frontend
- [x] Profile edit UI (self only): bio, display name  
- [x] Avatar + cover upload → Storage → PATCH URLs  
- [x] Profile header shows cover + avatar  

**Done when:** user can change pic/cover/bio and reload persists.

---

## Phase G3 — Ratings (deepen)  
**Owner:** Backend + Frontend

### Backend
- [x] Keep `PUT /api/v1/ratings`  
- [x] On upsert: auto-create diary entry (same day / same movie dedupe rule: if entry exists for `user+movie+watched_at=today`, update its `score`; else insert)  
- [x] `GET /api/v1/users/{username}/ratings` — paginated list `{ movie, score, updated_at }`  
- [x] Embed counts on profile: `ratings_count` (optional but useful)  

### Frontend
- [x] Movie page rating control unchanged in behavior; toast/confirm when diary auto-logged (subtle)  
- [x] Profile **Rated** section/tab using new list endpoint  
- [x] Show user’s score on movie cards in that list  

**Tests:** rate → ratings row + diary row; second rate same day updates diary score; rec resolve still works.

---

## Phase G4 — Watchlist  
**Owner:** Backend + Frontend

### Backend
- [x] `POST /api/v1/watchlist` `{ movie_id }` / `DELETE /api/v1/watchlist/{movie_id}`  
- [x] `GET /api/v1/users/{username}/watchlist` (public or followers-only — default **public** for G)  
- [x] Movie detail: `on_watchlist: bool` for current user  

### Frontend
- [x] Movie page Save / Saved toggle  
- [x] Profile Watchlist grid  

**Tests:** unique constraint 409; delete idempotent or 404.

---

## Phase G5 — Diary / watched  
**Owner:** Backend + Frontend

### Backend
- [x] `POST /api/v1/diary` `{ movie_id, watched_at?, score?, review? }`  
- [x] `PATCH /api/v1/diary/{id}` / `DELETE /api/v1/diary/{id}` (own only)  
- [x] `GET /api/v1/users/{username}/diary` paginated  
- [x] If `score` provided → upsert `ratings` + resolve recommendations (reuse existing service)  
- [x] Movie detail: `watched: bool` (any diary row) + `watched_at` latest  

### Frontend
- [x] Movie page Mark watched (opens optional date/review or one-click today)  
- [x] Profile Diary list (grouped by month if easy; else flat newest-first)  

**Tests:** diary with score creates/updates rating and resolves recs.

---

## Phase G6 — Likes  
**Owner:** Backend + Frontend

### Backend
- [x] `POST/DELETE /api/v1/movies/{id}/like`  
- [x] `GET` like count + `liked_by_me` on movie detail  
- [x] Optional: `POST/DELETE /api/v1/diary/{id}/like` + count on diary list items  
- [x] Profile: `GET /api/v1/users/{username}/likes` (movies liked)  

### Frontend
- [x] Heart on movie page  
- [x] Profile Liked section  
- [x] Optional heart on diary rows  

**Tests:** unique like; unlike; counts.

---

## Phase G7 — Profile IA  
**Owner:** Frontend

- [x] `/users/:username` sections/tabs: **Diary · Watchlist · Rated · Liked** (+ existing rec stats)  
- [x] Empty states for each  
- [x] Self vs other: edit controls only for self  

---

## Agent handoff prompts

### Backend agent

Implement Phase G per `docs/superpowers/plans/2026-09-28-phase-g-profile-library-ratings-plan.md` and schema `docs/schema.sql` (v2). Sync models to DB. Ratings stay canonical for recommendation outcomes; diary score must call the same resolve path. Stop when G1–G6 API + tests pass.

### Frontend agent

Implement Phase G UI against the new endpoints. Profile: cover/avatar/edit + tabs for Diary, Watchlist, Rated, Liked. Movie page: rate (existing), watchlist toggle, mark watched, like. Follow `agents/frontend.mc` for polish on profile header only; keep library grids clear and usable.

### Sequencing

1. G1 schema/models  
2. G2 profile media + G3 ratings (can parallel after G1)  
3. G4 watchlist → G5 diary → G6 likes  
4. G7 profile tabs polish  

---

## Definition of done

- Schema v2 live; models match.  
- User can set avatar + cover + bio.  
- Rate on movie page still resolves recommendations; profile shows rated list; rating auto-logs diary.  
- Watchlist, diary, and movie likes work end-to-end on profile + movie page.  
- Pytest covers rating↔diary sync and watchlist/like uniqueness.
