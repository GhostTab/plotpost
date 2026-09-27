# Design: Recommendation Vertical Slice

**Date:** 2026-09-27  
**Status:** Approved for spec review  
**Product:** Social movie tracking & recommendation platform (MOVIESITE)

## 1. Goal

Ship one end-to-end vertical slice that proves the product differentiator:

> Person-to-person movie recommendations have measurable outcomes based on the recipient’s rating.

Success looks like:

1. User B follows User A  
2. A finds a movie and recommends it to B (hub or movie page)  
3. B sees it in inbox / gets an in-app notification  
4. B rates the movie  
5. System sets SUCCESS or UNSUCCESSFUL automatically  
6. A’s stats and notification update  
7. Movie page shows “Recommended by N people”

Sender cannot manually mark success.

## 2. Scope

### In scope

- Project foundation (no Docker)
- Supabase Auth + local `users` profiles
- Follow / unfollow (required for recommend eligibility)
- TMDB-backed movie search & detail via backend only
- Ratings (0.5–5.0, half-star steps)
- Recommendations + automatic outcome calculation
- Recommendation hub (compose + inbox + outbox)
- In-app notifications
- Public “Recommended by N” on movie pages
- Basic profile with recommendation statistics display
- Agent task split for backend / frontend

### Out of scope (later phases)

- Diary, watchlist, written reviews (beyond numeric rating)
- Activity feed
- Redis, background workers, email notifications
- Person-to-person / genre recommendation analytics
- Likes, comments, custom lists, chat, ML recommendations
- Microservices, Kubernetes, Docker Compose

## 3. Decisions Locked in Brainstorming

| Topic | Decision |
|-------|----------|
| First sub-project | Recommendation vertical slice |
| When PENDING resolves | Rating alone resolves (mark watched optional / later) |
| Who can receive a recommend | Only the sender’s **followers** |
| Duplicates | One row per `(sender, recipient, movie)` — block duplicates |
| Recommendations UI | Dedicated hub: compose + inbox + outbox |
| Entry points | Hub + “Recommend” on movie page (movie prefilled) |
| Notifications | In-app only |
| Already rated before recommend | Allow recommend; resolve immediately from existing rating |
| Social proof on movie | Show “Recommended by N people” |
| Architecture style | Sync modular monolith (Approach 1) |
| Nav | Primary: Search, Recommendations; Profile dropdown: My profile, Notifications, Log out |

## 4. Architecture

```text
React (Vite + TypeScript + Tailwind + React Router + TanStack Query)
                    REST /api/v1
FastAPI modular monolith
  auth | users | follows | movies | ratings | recommendations | notifications
                    │
               PostgreSQL
                    │
         TMDB (movies module only)

Supabase Auth (identity tokens)
```

- PostgreSQL is the source of truth.
- Frontend never calls TMDB directly.
- No Redis/workers in this slice: recommendation resolution and notification inserts happen in the same DB transaction as the triggering write.
- Application runs directly on the developer machine (no Docker).

### Domain ownership

| Module | Owns |
|--------|------|
| `users` | Profile fields, username uniqueness, provisioning from auth |
| `follows` | Follow graph; supports “recipient must follow sender” |
| `movies` | Local movie cache, TMDB integration, recommended-by count |
| `ratings` | One rating per user/movie; triggers resolution |
| `recommendations` | Create/list/resolve, threshold config, stats |
| `notifications` | In-app notification rows |

## 5. Pages & Navigation

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Logged-out → login; logged-in → search or recommendations hub |
| `/login`, `/register` | Supabase Auth |
| `/search` | Movie search |
| `/movies/:id` | Detail, rate, recommend shortcut, “Recommended by N” |
| `/users/:username` | Profile, follow/unfollow, recommendation stats |
| `/recommendations` | Hub: compose + inbox + outbox |
| `/notifications` | In-app notification list + mark read |

### Chrome

- **Primary nav:** Search · Recommendations  
- **Profile dropdown:** My profile · Notifications · Log out  

## 6. Data Model

### Tables

**users**  
`id` (Supabase auth uid), `username` UNIQUE, `display_name`, `bio`, `avatar_url`, `created_at`, `updated_at`

**follows**  
`follower_id`, `following_id`, `created_at`  
UNIQUE `(follower_id, following_id)`; CHECK no self-follow

**movies**  
`id`, `tmdb_id` UNIQUE, `title`, `overview`, `release_date`, `poster_path`, `backdrop_path`, `runtime`, timestamps, other cached fields as needed

**ratings**  
`user_id`, `movie_id`, `score` (Numeric, 0.5–5.0), timestamps  
UNIQUE `(user_id, movie_id)`

**recommendations**  
`id`, `sender_id`, `recipient_id`, `movie_id`, `message` (nullable), `status` (`PENDING` | `SUCCESS` | `UNSUCCESSFUL`), `created_at`, `resolved_at` (nullable)  
UNIQUE `(sender_id, recipient_id, movie_id)`  
CHECK no self-recommend  

**notifications**  
`id`, `user_id`, `type`, `payload` (JSON), `read_at` (nullable), `created_at`

No separate `recommendation_results` table: status is stored on `recommendations`.

### Business rules

Central function (single place; threshold configurable once):

```text
calculate_recommendation_result(rating) ->
  null     -> PENDING
  >= 4.0   -> SUCCESS
  <  4.0   -> UNSUCCESSFUL
```

Default threshold: `4.0` on a 5.0 scale.

**Stats (computed, not denormalized columns in this slice):**

```text
completed = successful + unsuccessful
success_rate = successful / completed   (pending excluded)
```

UI always shows denominator form, e.g. `34 successful out of 42 completed`, plus percentage when completed > 0.

**Recommended by N:**  
`COUNT(DISTINCT sender_id)` for that movie (any status counts as a send).

## 7. Data Flow

### Auth

Frontend authenticates with Supabase → sends JWT to FastAPI → backend verifies and ensures a `users` row exists.

### Movies

Search/detail hits movies service → return local row if present → else TMDB → upsert required fields → return. Respect TMDB attribution/terms.

### Follow

B follows A → A may recommend to B. Compose recipient picker lists **followers of the current user**.

### Create recommendation

`POST /api/v1/recommendations`

Validations: authenticated; not self; recipient follows sender; no duplicate triple.

- If recipient already rated the movie → set status via `calculate_recommendation_result` immediately; notify recipient (new recommend) and sender (outcome).  
- Else → `PENDING`; notify recipient only.

### Rate movie

`PUT /api/v1/ratings`

Upsert rating. In the same transaction: resolve open recommendations for `(recipient=me, movie_id)` → update status → notify each sender. Re-resolving an already terminal recommendation is a no-op (no duplicate outcome notifications).

### Hub & notifications

- Inbox: recommendations where `recipient_id = me`  
- Outbox: recommendations where `sender_id = me`  
- Notifications: list + mark read; refetch on open (no websockets)

## 8. API Contract Sketch (Tech Lead owned)

All under `/api/v1`. Auth required except health/public movie read if explicitly allowed (default: authenticated for social actions). Any authenticated request auto-provisions a `users` row if missing (no separate sync endpoint).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/users/{username}` | Profile + stats |
| POST | `/follows/{username}` | Follow |
| DELETE | `/follows/{username}` | Unfollow |
| GET | `/users/me/followers` | For recipient picker |
| GET | `/movies/search?q=` | Search |
| GET | `/movies/{id}` | Detail + avg rating + `recommended_by_count` + my rating |
| PUT | `/ratings` | `{ movie_id, score }` |
| POST | `/recommendations` | `{ recipient_id, movie_id, message? }` |
| GET | `/recommendations/inbox` | Paginated |
| GET | `/recommendations/outbox` | Paginated |
| GET | `/users/{username}/recommendation-stats` | Or embedded in profile |
| GET | `/notifications` | Paginated |
| POST | `/notifications/{id}/read` | Mark read |

Pagination: cursor or limit/offset consistently (prefer limit/offset for slice simplicity; document max page size).

Error body: `{ "detail": "...", "code": "..." }`

Notable codes: `RECIPIENT_NOT_FOLLOWER`, `RECOMMENDATION_EXISTS`, validation `422`, auth `401`, not found `404`, TMDB upstream `502`/`503`.

## 9. Error Handling & Privacy

- DB constraints enforce uniqueness and self-follow/self-recommend bans where possible.  
- TMDB failures do not leave corrupt half-written movie state.  
- Inbox/outbox and recommendation messages are visible to participants only.  
- Public profile: aggregate recommendation stats.  
- Movie page: public recommended-by count.  
- Frontend: inline errors on forms; empty states for empty inbox/outbox/notifications.

## 10. Testing

### Backend (Pytest + HTTPX)

Must cover:

- Follower gate on create  
- Duplicate 409  
- Threshold mapping (≥4 SUCCESS, &lt;4 UNSUCCESSFUL, null PENDING)  
- Immediate resolve when recipient already rated  
- Stats exclude pending from denominator  
- Recommended-by count increments  
- Idempotent resolve (no duplicate outcome notifications)

### Frontend (Vitest)

- Compose validation  
- Status badges  
- Stats formatting  
- Nav / dropdown links  

### Manual

Two-user path through follow → recommend → rate → stats → notification → movie N count.

## 11. Agent Task Split

Tech Lead owns this spec and the API contract. After the implementation plan exists, agents execute as follows.

### Backend agent

1. FastAPI modular monolith layout, Alembic, Postgres config, env (no Docker)  
2. Supabase JWT verification + user provisioning  
3. `follows` module  
4. `movies` + TMDB proxy/search/detail + recommended-by count  
5. `ratings` + transactional hook to recommendations  
6. `recommendations` (create, inbox/outbox, resolve, stats, threshold config)  
7. `notifications` (create, list, mark read)  
8. Pytest suite for section 10 rules  

### Frontend agent

1. Vite/React/TS/Tailwind/Router/Query app shell  
2. Auth pages + session handling  
3. Nav: Search + Recommendations; profile dropdown (profile, notifications, logout)  
4. Search + movie page (rate, recommend shortcut, Recommended by N)  
5. Profile page (follow + stats display)  
6. Recommendations hub (compose / inbox / outbox)  
7. Notifications page  
8. Integrate against `/api/v1` contract  

### Suggested order

Backend: auth → users → follows → movies → ratings/recommendations/notifications.  
Frontend may build shell/pages against mocks in parallel, then integrate.

## 12. Success Criteria

Slice is done when two real users can complete the loop on a local stack without Docker, automated tests cover the recommendation business rules above, and the hub + movie page + notifications reflect PENDING / SUCCESS / UNSUCCESSFUL correctly.

## 13. Next Step After Spec Approval

Invoke **writing-plans** to produce the implementation plan. Do not start implementation coding until that plan exists and is followed. Agent task lists above feed the plan’s work breakdown.
