import type { RecommendationStats, RecommendationStatus } from "./types";

export function formatStats(stats: RecommendationStats): string {
  const base = `${stats.successful} successful out of ${stats.completed} completed`;
  if (stats.completed > 0 && stats.success_rate != null) {
    return `${base} (${stats.success_rate}%)`;
  }
  return base;
}

export function statusLabel(status: RecommendationStatus | string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "SUCCESS":
      return "Success";
    case "UNSUCCESSFUL":
      return "Unsuccessful";
    default:
      return status;
  }
}

export function validateCompose(input: {
  movieId: string | null;
  hasRating: boolean;
}): string | null {
  if (!input.movieId) return "Pick a movie to recommend.";
  if (!input.hasRating) return "Rate this film before sharing it with your followers.";
  return null;
}

export function mapApiError(code?: string, detail?: string): string {
  switch (code) {
    case "RECIPIENT_NOT_FOLLOWER":
      return "That person must follow you before you can recommend to them.";
    case "NO_FOLLOWERS":
      return "You need at least one follower before you can share a recommendation.";
    case "SENDER_RATING_REQUIRED":
      return "Rate this film before sharing it with your followers.";
    case "RECOMMENDATION_EXISTS":
      return "You already shared this movie with your followers.";
    case "SELF_FOLLOW":
      return "You cannot follow yourself.";
    case "FOLLOW_EXISTS":
      return "You already follow this user.";
    default:
      return detail ?? "Something went wrong. Try again.";
  }
}
