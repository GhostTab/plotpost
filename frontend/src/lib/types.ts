export type RecommendationStatus = "PENDING" | "SUCCESS" | "UNSUCCESSFUL";

export type RecommendationStats = {
  successful: number;
  unsuccessful: number;
  pending: number;
  completed: number;
  success_rate: number | null;
};

export type UserPublic = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
};

export type UserProfile = UserPublic & {
  recommendation_stats: RecommendationStats;
  ratings_count?: number;
  is_following: boolean;
  is_self: boolean;
};

export type UserProfileUpdate = {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

export type MovieSummary = {
  id: string;
  tmdb_id: number;
  title: string;
  overview: string | null;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
};

export type MovieDetail = MovieSummary & {
  recommended_by_count: number;
  average_rating: number | null;
  my_rating: number | null;
  tagline?: string | null;
  genres?: string[];
  director?: string | null;
  cast?: CastMember[];
  on_watchlist?: boolean;
  watched?: boolean;
  watched_at?: string | null;
  like_count?: number;
  liked_by_me?: boolean;
};

export type CastMember = {
  id?: number;
  name: string;
  character: string | null;
  profile_path: string | null;
};

export type PersonCredit = {
  tmdb_id: number;
  title: string;
  character: string | null;
  job: string | null;
  release_date: string | null;
  poster_path: string | null;
};

export type PersonDetail = {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string | null;
  filmography: PersonCredit[];
};

export type UserRatingItem = {
  movie: MovieSummary;
  score: string | number;
  updated_at: string;
};

export type WatchlistItem = {
  movie: MovieSummary;
  created_at: string;
};

export type DiaryEntry = {
  id: string;
  movie_id: string;
  watched_at: string;
  score: string | number | null;
  review: string | null;
  created_at: string;
  updated_at: string;
  movie: MovieSummary | null;
  like_count: number;
  liked_by_me: boolean;
};

export type LikedMovie = {
  movie: MovieSummary;
  created_at: string;
};

export type Recommendation = {
  id: string;
  sender_id: string;
  recipient_id: string;
  movie_id: string;
  message: string | null;
  status: RecommendationStatus;
  created_at: string;
  resolved_at: string | null;
  movie_title: string | null;
  movie_poster_path?: string | null;
  movie_overview?: string | null;
  sender_username: string | null;
  recipient_username: string | null;
  sender_rating?: number | null;
};

export type Notification = {
  id: string;
  type: "recommendation_received" | "recommendation_outcome" | string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type ApiErrorBody = {
  detail?: string;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, detail: string, code?: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
