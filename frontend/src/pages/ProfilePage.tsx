import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { EmptyState, ErrorMessage, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { formatStats, mapApiError } from "@/lib/format";
import { ApiError } from "@/lib/types";

export function ProfilePage() {
  const { username = "" } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["users", username],
    queryFn: () => api.profile(username),
    enabled: Boolean(username),
  });

  const followMutation = useMutation({
    mutationFn: async (next: "follow" | "unfollow") => {
      if (next === "follow") await api.follow(username);
      else await api.unfollow(username);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users", username] });
      await queryClient.invalidateQueries({ queryKey: ["followers"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? mapApiError(err.code, err.message) : "Follow action failed.");
    },
  });

  const profile = profileQuery.data;

  return (
    <div>
      {profileQuery.isError ? (
        <ErrorMessage
          message={
            profileQuery.error instanceof ApiError
              ? profileQuery.error.message
              : "Profile not found."
          }
        />
      ) : null}

      {profile ? (
        <>
          <div className="flex flex-col gap-4 border-b border-[var(--color-line)] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <PageHeading
                title={profile.display_name || profile.username}
                subtitle={`@${profile.username}`}
              />
              {profile.bio ? (
                <p className="max-w-[65ch] text-base text-[var(--color-muted)]">{profile.bio}</p>
              ) : null}
            </div>
            {!profile.is_self ? (
              <button
                type="button"
                disabled={followMutation.isPending}
                className="rounded-[10px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                onClick={() =>
                  followMutation.mutate(profile.is_following ? "unfollow" : "follow")
                }
              >
                {profile.is_following ? "Unfollow" : "Follow"}
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          ) : null}

          <section className="mt-8">
            <h2 className="font-display text-3xl font-medium">Recommendation stats</h2>
            <p className="mt-3 text-base">{formatStats(profile.recommendation_stats)}</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {profile.recommendation_stats.pending} pending
            </p>
          </section>
        </>
      ) : (
        !profileQuery.isError && (
          <EmptyState title="Loading profile" body="Fetching user and stats…" />
        )
      )}
    </div>
  );
}
