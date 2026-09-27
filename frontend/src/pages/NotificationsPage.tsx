import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorMessage, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { ApiError, type Notification } from "@/lib/types";

function notificationCopy(n: Notification): {
  title: string;
  body: string;
  movieId?: string;
  status?: string;
} {
  const payload = n.payload;
  const movieTitle = String(payload.movie_title ?? "a movie");
  const movieId = payload.movie_id ? String(payload.movie_id) : undefined;
  const status = payload.status ? String(payload.status) : undefined;

  if (n.type === "recommendation_received") {
    const sender = String(payload.sender_username ?? "someone");
    return {
      title: `${sender} recommended ${movieTitle}`,
      body: status && status !== "PENDING" ? `Already resolved as ${status}.` : "Open the movie to rate it.",
      movieId,
      status,
    };
  }

  if (n.type === "recommendation_outcome") {
    const recipient = String(payload.recipient_username ?? "recipient");
    return {
      title: `${movieTitle} marked ${status ?? "resolved"}`,
      body: `${recipient} rated this recommendation.`,
      movieId,
      status,
    };
  }

  return {
    title: n.type,
    body: JSON.stringify(payload),
    movieId,
    status,
  };
}

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications(),
    refetchOnMount: "always",
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div>
      <PageHeading
        title="Notifications"
        subtitle="In-app only. Refreshes when you open this page."
      />

      {listQuery.isError ? (
        <ErrorMessage
          message={
            listQuery.error instanceof ApiError
              ? listQuery.error.message
              : "Could not load notifications."
          }
        />
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      ) : null}

      {listQuery.isSuccess && listQuery.data.length === 0 ? (
        <EmptyState
          title="No notifications"
          body="Recommendation receives and outcomes will appear here."
        />
      ) : null}

      {listQuery.data && listQuery.data.length > 0 ? (
        <ul className="divide-y divide-[var(--color-line)]">
          {listQuery.data.map((n) => {
            const copy = notificationCopy(n);
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  unread ? "" : "opacity-70"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold">{copy.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{copy.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    {copy.movieId ? (
                      <Link className="text-[var(--color-accent)]" to={`/movies/${copy.movieId}`}>
                        View movie
                      </Link>
                    ) : null}
                    {copy.status ? <StatusBadge status={copy.status} /> : null}
                  </div>
                </div>
                {unread ? (
                  <button
                    type="button"
                    className="rounded-[10px] border border-[var(--color-line)] px-3 py-2 text-sm font-medium transition active:scale-[0.98]"
                    disabled={readMutation.isPending}
                    onClick={() => readMutation.mutate(n.id)}
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">Read</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
