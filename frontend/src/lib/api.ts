import { ApiError, type ApiErrorBody } from "./types";
import { supabase } from "./supabase";

/** Prefer explicit env; in production default to same-origin `/api/v1` (Vercel → Railway rewrite). */
function resolveApiBaseUrl(): string {
  let fromEnv = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  if (!fromEnv) {
    if (import.meta.env.PROD) return "/api/v1";
    return "http://127.0.0.1:8000/api/v1";
  }
  fromEnv = fromEnv.replace(/\/$/, "");
  if (!/\/api\/v1$/i.test(fromEnv)) {
    fromEnv = `${fromEnv}/api/v1`;
  }
  return fromEnv;
}

export const apiBaseUrl = resolveApiBaseUrl();

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) return null;

  // Refresh if expired or within 60s of expiry (getSession can return a stale access_token).
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }
  return session.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const body = (data ?? {}) as ApiErrorBody;
    throw new ApiError(
      response.status,
      body.detail ?? response.statusText,
      body.code,
    );
  }

  return data as T;
}

export const api = {
  me: () => apiFetch<import("./types").UserProfile>("/users/me"),
  updateMe: (body: import("./types").UserProfileUpdate) =>
    apiFetch<import("./types").UserProfile>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  profile: (username: string) =>
    apiFetch<import("./types").UserProfile>(`/users/${encodeURIComponent(username)}`),
  userRatings: (username: string) =>
    apiFetch<import("./types").UserRatingItem[]>(
      `/users/${encodeURIComponent(username)}/ratings`,
    ),
  userWatchlist: (username: string) =>
    apiFetch<import("./types").WatchlistItem[]>(
      `/users/${encodeURIComponent(username)}/watchlist`,
    ),
  userDiary: (username: string) =>
    apiFetch<import("./types").DiaryEntry[]>(`/users/${encodeURIComponent(username)}/diary`),
  userLikes: (username: string) =>
    apiFetch<import("./types").LikedMovie[]>(`/users/${encodeURIComponent(username)}/likes`),
  followers: () => apiFetch<import("./types").UserPublic[]>("/users/me/followers"),
  follow: (username: string) =>
    apiFetch<void>(`/follows/${encodeURIComponent(username)}`, { method: "POST" }),
  unfollow: (username: string) =>
    apiFetch<void>(`/follows/${encodeURIComponent(username)}`, { method: "DELETE" }),
  searchMovies: (q: string) =>
    apiFetch<import("./types").MovieSummary[]>(`/movies/search?q=${encodeURIComponent(q)}`),
  trendingMovies: () => apiFetch<import("./types").MovieSummary[]>("/movies/trending"),
  movie: (id: string) => apiFetch<import("./types").MovieDetail>(`/movies/${id}`),
  movieByTmdb: (tmdbId: number) =>
    apiFetch<import("./types").MovieSummary>(`/movies/tmdb/${tmdbId}`),
  person: (id: number | string) =>
    apiFetch<import("./types").PersonDetail>(`/people/${id}`),
  upsertRating: (movieId: string, score: number) =>
    apiFetch<{ id: string; score: string }>(`/ratings`, {
      method: "PUT",
      body: JSON.stringify({ movie_id: movieId, score }),
    }),
  addWatchlist: (movieId: string) =>
    apiFetch<import("./types").WatchlistItem>("/watchlist", {
      method: "POST",
      body: JSON.stringify({ movie_id: movieId }),
    }),
  removeWatchlist: (movieId: string) =>
    apiFetch<void>(`/watchlist/${movieId}`, { method: "DELETE" }),
  createDiary: (body: {
    movie_id: string;
    watched_at?: string;
    score?: number;
    review?: string;
  }) =>
    apiFetch<import("./types").DiaryEntry>("/diary", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  likeMovie: (movieId: string) =>
    apiFetch<void>(`/movies/${movieId}/like`, { method: "POST" }),
  unlikeMovie: (movieId: string) =>
    apiFetch<void>(`/movies/${movieId}/like`, { method: "DELETE" }),
  likeDiary: (entryId: string) =>
    apiFetch<void>(`/diary/${entryId}/like`, { method: "POST" }),
  unlikeDiary: (entryId: string) =>
    apiFetch<void>(`/diary/${entryId}/like`, { method: "DELETE" }),
  createRecommendation: (body: { movie_id: string; message?: string }) =>
    apiFetch<import("./types").Recommendation[]>("/recommendations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  inbox: () => apiFetch<import("./types").Recommendation[]>("/recommendations/inbox"),
  outbox: () => apiFetch<import("./types").Recommendation[]>("/recommendations/outbox"),
  notifications: () => apiFetch<import("./types").Notification[]>("/notifications"),
  markNotificationRead: (id: string) =>
    apiFetch<import("./types").Notification>(`/notifications/${id}/read`, {
      method: "POST",
    }),
};

export function posterUrl(path: string | null | undefined, size = "w500"): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
