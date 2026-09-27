import { ApiError, type ApiErrorBody } from "./types";
import { supabase } from "./supabase";

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1").replace(
  /\/$/,
  "",
);

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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

  const response = await fetch(`${baseUrl}${path}`, {
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
  profile: (username: string) =>
    apiFetch<import("./types").UserProfile>(`/users/${encodeURIComponent(username)}`),
  followers: () => apiFetch<import("./types").UserPublic[]>("/users/me/followers"),
  follow: (username: string) =>
    apiFetch<void>(`/follows/${encodeURIComponent(username)}`, { method: "POST" }),
  unfollow: (username: string) =>
    apiFetch<void>(`/follows/${encodeURIComponent(username)}`, { method: "DELETE" }),
  searchMovies: (q: string) =>
    apiFetch<import("./types").MovieSummary[]>(`/movies/search?q=${encodeURIComponent(q)}`),
  trendingMovies: () => apiFetch<import("./types").MovieSummary[]>("/movies/trending"),
  movie: (id: string) => apiFetch<import("./types").MovieDetail>(`/movies/${id}`),
  upsertRating: (movieId: string, score: number) =>
    apiFetch<{ id: string; score: string }>(`/ratings`, {
      method: "PUT",
      body: JSON.stringify({ movie_id: movieId, score }),
    }),
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
