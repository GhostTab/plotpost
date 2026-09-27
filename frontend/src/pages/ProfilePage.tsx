import { CheckCircle, FilmSlate, Hourglass, User, XCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorMessage, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { api } from "@/lib/api";
import { mapApiError } from "@/lib/format";
import { ApiError, type RecommendationStats } from "@/lib/types";

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
  const stats = profile?.recommendation_stats;
  const displayName = profile?.display_name || profile?.username || "";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="relative mx-auto max-w-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-15%] -top-16 h-64 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.14),transparent_55%)]"
      />

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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="relative">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-accent)] text-2xl font-semibold text-zinc-950 sm:h-20 sm:w-20 sm:text-3xl">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{initial || <User size={28} weight="bold" />}</span>
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                    {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">@{profile.username}</p>
                  {profile.bio ? (
                    <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[var(--color-ink)]">
                      {profile.bio}
                    </p>
                  ) : profile.is_self ? (
                    <p className="mt-3 text-sm text-[var(--color-muted)]">
                      No bio yet — your picks will speak for you.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
                {profile.is_self ? (
                  <>
                    <Link to="/recommendations/new" className={primaryButtonClass}>
                      Share a film
                    </Link>
                    <Link to="/recommendations" className={secondaryButtonClass}>
                      Open feed
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={followMutation.isPending}
                    className={profile.is_following ? secondaryButtonClass : primaryButtonClass}
                    onClick={() =>
                      followMutation.mutate(profile.is_following ? "unfollow" : "follow")
                    }
                  >
                    {followMutation.isPending
                      ? "…"
                      : profile.is_following
                        ? "Following"
                        : "Follow"}
                  </button>
                )}
              </div>
            </div>
          </header>

          {error ? (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          ) : null}

          {stats ? <StatsSection stats={stats} isSelf={profile.is_self} /> : null}
        </motion.div>
      ) : (
        !profileQuery.isError && (
          <EmptyState title="Loading profile" body="Fetching user and stats…" />
        )
      )}
    </div>
  );
}

function StatsSection({ stats, isSelf }: { stats: RecommendationStats; isSelf: boolean }) {
  const rate =
    stats.completed > 0 && stats.success_rate != null ? `${stats.success_rate}%` : "—";

  const cards = [
    {
      key: "hits",
      label: "Hits",
      value: stats.successful,
      hint: "They liked your pick",
      icon: CheckCircle,
      tone: "text-emerald-400",
    },
    {
      key: "misses",
      label: "Misses",
      value: stats.unsuccessful,
      hint: "Didn’t land",
      icon: XCircle,
      tone: "text-rose-400",
    },
    {
      key: "pending",
      label: "Pending",
      value: stats.pending,
      hint: "Waiting on a rating",
      icon: Hourglass,
      tone: "text-[var(--color-accent)]",
    },
    {
      key: "rate",
      label: "Hit rate",
      value: rate,
      hint: stats.completed > 0 ? `${stats.completed} completed` : "No outcomes yet",
      icon: FilmSlate,
      tone: "text-[var(--color-accent)]",
    },
  ] as const;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Recommendation record</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {isSelf
              ? "How your shared picks land with followers."
              : "How this person’s shared picks land."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {card.label}
                </p>
                <Icon size={16} weight="duotone" className={card.tone} />
              </div>
              <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{card.value}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{card.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
