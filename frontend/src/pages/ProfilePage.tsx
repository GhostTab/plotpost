import {
  Camera,
  CheckCircle,
  FilmSlate,
  Heart,
  Hourglass,
  PencilSimple,
  User,
  XCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { StarRating } from "@/components/RatingControl";
import {
  EmptyState,
  ErrorMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mapApiError } from "@/lib/format";
import { uploadProfileMedia } from "@/lib/storage";
import {
  ApiError,
  type DiaryEntry,
  type LikedMovie,
  type MovieSummary,
  type RecommendationStats,
  type UserRatingItem,
  type WatchlistItem,
} from "@/lib/types";

type LibraryTab = "diary" | "watchlist" | "rated" | "liked";

export function ProfilePage() {
  const { username = "" } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("diary");

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
    <div className="relative mx-auto max-w-6xl">
      {profileQuery.isError ? (
        <div className="space-y-3">
          <ErrorMessage
            message={
              profileQuery.error instanceof ApiError
                ? profileQuery.error.message
                : "Profile not found."
            }
          />
          <p className="text-sm text-[var(--color-muted)]">
            Couldn’t load @{username}. If this is your account, check that the API is reachable, then refresh.
          </p>
        </div>
      ) : null}

      {profile ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="relative h-36 bg-[var(--color-paper)] sm:h-48">
              {profile.cover_url ? (
                <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  aria-hidden
                  className="h-full w-full bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.22),transparent_55%),linear-gradient(180deg,#141416,#0a0a0b)]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent" />
            </div>

            <div className="relative px-4 pb-5 sm:px-6">
              <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-accent)] text-2xl font-semibold text-zinc-950 sm:h-24 sm:w-24 sm:text-3xl">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>{initial || <User size={28} weight="bold" />}</span>
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                      {displayName}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">@{profile.username}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 pb-1">
                  {profile.is_self ? (
                    <>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => setEditing(true)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <PencilSimple size={14} weight="bold" />
                          Edit profile
                        </span>
                      </button>
                      <Link to="/recommendations/new" className={primaryButtonClass}>
                        Share a film
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

              {profile.bio ? (
                <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-[var(--color-ink)] sm:text-base">
                  {profile.bio}
                </p>
              ) : profile.is_self ? (
                <p className="mt-4 text-sm text-[var(--color-muted)]">
                  No bio yet — add one from Edit profile.
                </p>
              ) : null}

              <p className="mt-3 text-xs text-[var(--color-muted)]">
                {profile.ratings_count ?? 0} rated ·{" "}
                {profile.recommendation_stats.successful} recommendation hits
              </p>
            </div>
          </header>

          {error ? (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          ) : null}

          {stats ? <StatsSection stats={stats} isSelf={profile.is_self} /> : null}

          <LibrarySection username={username} tab={tab} onTabChange={setTab} isSelf={profile.is_self} />

          {editing && profile.is_self && user?.id ? (
            <EditProfileModal
              displayName={profile.display_name ?? ""}
              bio={profile.bio ?? ""}
              userId={user.id}
              onClose={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                await queryClient.invalidateQueries({ queryKey: ["users", username] });
                await queryClient.invalidateQueries({ queryKey: ["me"] });
              }}
            />
          ) : null}
        </motion.div>
      ) : (
        !profileQuery.isError && (
          <EmptyState title="Loading profile" body="Fetching user and library…" />
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
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">Recommendation record</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {isSelf
            ? "How your shared picks land with followers."
            : "How this person’s shared picks land."}
        </p>
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

function LibrarySection({
  username,
  tab,
  onTabChange,
  isSelf,
}: {
  username: string;
  tab: LibraryTab;
  onTabChange: (t: LibraryTab) => void;
  isSelf: boolean;
}) {
  const tabs: { id: LibraryTab; label: string }[] = [
    { id: "diary", label: "Diary" },
    { id: "watchlist", label: "Watchlist" },
    { id: "rated", label: "Rated" },
    { id: "liked", label: "Liked" },
  ];

  const diaryQuery = useQuery({
    queryKey: ["users", username, "diary"],
    queryFn: () => api.userDiary(username),
    enabled: tab === "diary",
  });
  const watchlistQuery = useQuery({
    queryKey: ["users", username, "watchlist"],
    queryFn: () => api.userWatchlist(username),
    enabled: tab === "watchlist",
  });
  const ratedQuery = useQuery({
    queryKey: ["users", username, "ratings"],
    queryFn: () => api.userRatings(username),
    enabled: tab === "rated",
  });
  const likesQuery = useQuery({
    queryKey: ["users", username, "likes"],
    queryFn: () => api.userLikes(username),
    enabled: tab === "liked",
  });

  const active =
    tab === "diary"
      ? diaryQuery
      : tab === "watchlist"
        ? watchlistQuery
        : tab === "rated"
          ? ratedQuery
          : likesQuery;

  return (
    <section className="mt-12">
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1"
        role="tablist"
        aria-label="Library"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "bg-[var(--color-accent)] text-zinc-950"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {active.isError ? (
        <ErrorMessage
          message={
            active.error instanceof ApiError ? active.error.message : "Could not load this list."
          }
        />
      ) : null}

      {active.isLoading ? (
        <EmptyState title="Loading" body={`Fetching ${tab}…`} />
      ) : null}

      {tab === "diary" && diaryQuery.data ? (
        <DiaryList entries={diaryQuery.data} isSelf={isSelf} username={username} />
      ) : null}
      {tab === "watchlist" && watchlistQuery.data ? (
        <PosterGrid
          items={watchlistQuery.data.map((w: WatchlistItem) => ({
            movie: w.movie,
            caption: null,
          }))}
          emptyTitle={isSelf ? "Watchlist is empty" : "No watchlist picks"}
          emptyBody={
            isSelf
              ? "Save films from a movie page to see them here."
              : "This user hasn’t saved any films yet."
          }
        />
      ) : null}
      {tab === "rated" && ratedQuery.data ? (
        <PosterGrid
          items={ratedQuery.data.map((r: UserRatingItem) => ({
            movie: r.movie,
            caption: String(r.score),
            score: Number(r.score),
          }))}
          emptyTitle={isSelf ? "No ratings yet" : "No rated films"}
          emptyBody={
            isSelf
              ? "Rate a film to log it here (and in your diary)."
              : "This user hasn’t rated anything yet."
          }
        />
      ) : null}
      {tab === "liked" && likesQuery.data ? (
        <PosterGrid
          items={likesQuery.data.map((l: LikedMovie) => ({
            movie: l.movie,
            caption: null,
          }))}
          emptyTitle={isSelf ? "No likes yet" : "No liked films"}
          emptyBody={
            isSelf
              ? "Tap the heart on a movie page."
              : "This user hasn’t liked any films yet."
          }
        />
      ) : null}
    </section>
  );
}

function PosterGrid({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: { movie: MovieSummary; caption: string | null; score?: number }[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <ul className="grid grid-cols-4 gap-x-2.5 gap-y-5 sm:gap-x-4 sm:gap-y-8 md:grid-cols-5 lg:grid-cols-6">
      {items.map(({ movie, caption, score }) => {
        const src = posterUrl(movie.poster_path, "w500");
        const year = movie.release_date?.slice(0, 4);
        return (
          <li key={movie.id}>
            <Link to={`/movies/${movie.id}`} className="group block">
              <div className="aspect-[2/3] overflow-hidden rounded-[6px] border border-[var(--color-line)] bg-[var(--color-surface)] sm:rounded-[8px]">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : null}
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-[12px] leading-snug font-semibold transition group-hover:text-[var(--color-accent)] sm:mt-3 sm:text-[15px]">
                {movie.title}
              </h3>
              {typeof score === "number" ? (
                <div className="mt-1">
                  <StarRating value={score} size={12} />
                </div>
              ) : caption || year ? (
                <p className="mt-0.5 text-[10px] text-[var(--color-muted)] sm:text-xs">
                  {[year, caption].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DiaryList({
  entries,
  isSelf,
  username,
}: {
  entries: DiaryEntry[];
  isSelf: boolean;
  username: string;
}) {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      if (liked) await api.unlikeDiary(id);
      else await api.likeDiary(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users", username, "diary"] });
    },
  });

  if (entries.length === 0) {
    return (
      <EmptyState
        title={isSelf ? "Diary is empty" : "No diary entries"}
        body={
          isSelf
            ? "Rate a film or tap Mark watched to start your log."
            : "This user hasn’t logged any watches yet."
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
      {entries.map((entry) => {
        const movie = entry.movie;
        const src = posterUrl(movie?.poster_path ?? null, "w185");
        const score = entry.score != null ? Number(entry.score) : null;
        return (
          <li key={entry.id} className="flex gap-4 py-4">
            <Link
              to={movie ? `/movies/${movie.id}` : "#"}
              className="h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-[6px] border border-[var(--color-line)] bg-[var(--color-surface)]"
            >
              {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--color-muted)] uppercase">
                    {entry.watched_at}
                  </p>
                  <Link
                    to={movie ? `/movies/${movie.id}` : "#"}
                    className="mt-1 font-display text-lg font-semibold transition hover:text-[var(--color-accent)]"
                  >
                    {movie?.title ?? "Untitled"}
                  </Link>
                  {score != null ? (
                    <div className="mt-1">
                      <StarRating value={score} size={14} showValue />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    entry.liked_by_me
                      ? "border-rose-400/60 text-rose-300"
                      : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-rose-400/50 hover:text-rose-300"
                  }`}
                  disabled={likeMutation.isPending}
                  onClick={() =>
                    likeMutation.mutate({ id: entry.id, liked: entry.liked_by_me })
                  }
                >
                  <Heart size={12} weight={entry.liked_by_me ? "fill" : "regular"} />
                  {entry.like_count}
                </button>
              </div>
              {entry.review ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{entry.review}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EditProfileModal({
  displayName,
  bio,
  userId,
  onClose,
  onSaved,
}: {
  displayName: string;
  bio: string;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(displayName);
  const [nextBio, setNextBio] = useState(bio);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: import("@/lib/types").UserProfileUpdate = {
        display_name: name.trim() || null,
        bio: nextBio.trim() || null,
      };
      if (avatarFile) {
        body.avatar_url = await uploadProfileMedia("avatars", userId, avatarFile);
      }
      if (coverFile) {
        body.cover_url = await uploadProfileMedia("covers", userId, coverFile);
      }
      await api.updateMe(body);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="edit-profile-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="edit-profile-title" className="font-display text-2xl font-semibold">
            Edit profile
          </h2>
          <button
            type="button"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-2">
            <label className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
              Display name
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
              Bio
            </label>
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={nextBio}
              onChange={(e) => setNextBio(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`${secondaryButtonClass} inline-flex items-center justify-center gap-2`}
              onClick={() => avatarRef.current?.click()}
            >
              <Camera size={14} />
              {avatarFile ? avatarFile.name : "Avatar"}
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} inline-flex items-center justify-center gap-2`}
              onClick={() => coverRef.current?.click()}
            >
              <Camera size={14} />
              {coverFile ? coverFile.name : "Cover"}
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Uploads go to Supabase Storage buckets <code>avatars</code> and <code>covers</code>.
          </p>

          {error ? <ErrorMessage message={error} /> : null}

          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full`}>
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
