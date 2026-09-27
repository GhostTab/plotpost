import { ArrowRight, ChatCircle, FilmSlate, PaperPlaneTilt, User, UsersThree } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StarRating } from "@/components/RatingControl";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorMessage, primaryButtonClass } from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import type { Recommendation } from "@/lib/types";

type Tab = "inbox" | "outbox";

type FeedItem = {
  key: string;
  rec: Recommendation;
  audienceCount: number;
  perspective: Tab;
};

export function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("inbox");

  const inboxQuery = useQuery({
    queryKey: ["recommendations", "inbox"],
    queryFn: () => api.inbox(),
  });

  const outboxQuery = useQuery({
    queryKey: ["recommendations", "outbox"],
    queryFn: () => api.outbox(),
  });

  const active = tab === "inbox" ? inboxQuery : outboxQuery;
  const pendingInbox = useMemo(
    () => (inboxQuery.data ?? []).filter((r) => r.status === "PENDING").length,
    [inboxQuery.data],
  );
  const counts = useMemo(
    () => ({
      inbox: inboxQuery.data?.length ?? 0,
      outbox: outboxQuery.data ? groupOutbox(outboxQuery.data).length : 0,
    }),
    [inboxQuery.data, outboxQuery.data],
  );

  const feedItems = useMemo((): FeedItem[] => {
    const rows = active.data ?? [];
    if (tab === "inbox") {
      return rows.map((rec) => ({
        key: rec.id,
        rec,
        audienceCount: 1,
        perspective: "inbox" as const,
      }));
    }
    return groupOutbox(rows).map((group) => ({
      key: group.key,
      rec: group.rec,
      audienceCount: group.count,
      perspective: "outbox" as const,
    }));
  }, [active.data, tab]);

  return (
    <div className="relative mx-auto max-w-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-20%] -top-16 h-72 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.14),transparent_55%)]"
      />

      <header className="relative mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Feed</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {pendingInbox > 0
                ? `${pendingInbox} waiting for your rating`
                : "Person-to-person film picks"}
            </p>
          </div>
          <Link
            to="/recommendations/new"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 active:scale-[0.98]"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            Share
          </Link>
        </div>

        <Link
          to="/recommendations/new"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 transition hover:border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-line))]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <FilmSlate size={18} weight="duotone" />
          </span>
          <span className="min-w-0 flex-1 text-sm text-[var(--color-muted)]">
            Rate a film and share it with everyone who follows you…
          </span>
          <ArrowRight size={16} className="shrink-0 text-[var(--color-muted)]" />
        </Link>
      </header>

      <div
        className="relative mb-6 grid grid-cols-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1"
        role="tablist"
        aria-label="Recommendation feed"
      >
        {(
          [
            { id: "inbox" as const, label: "For you", count: counts.inbox },
            { id: "outbox" as const, label: "Yours", count: counts.outbox },
          ] as const
        ).map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`rounded-full px-3 py-2.5 text-sm font-medium transition ${
                selected
                  ? "bg-[var(--color-accent)] text-zinc-950 shadow-[0_8px_24px_-12px_rgba(226,168,85,0.8)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span className={`ml-1.5 tabular-nums ${selected ? "text-zinc-800" : ""}`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {active.isError ? (
        <ErrorMessage message={tab === "inbox" ? "Could not load your feed." : "Could not load sent picks."} />
      ) : null}

      {active.isLoading ? <FeedSkeleton /> : null}

      {active.isSuccess ? (
        feedItems.length === 0 ? (
          <EmptyFeed perspective={tab} />
        ) : (
          <ul className="space-y-4">
            {feedItems.map((item, index) => (
              <motion.li
                key={item.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
              >
                <RecPost rec={item.rec} perspective={item.perspective} audienceCount={item.audienceCount} />
              </motion.li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function groupOutbox(rows: Recommendation[]) {
  const map = new Map<string, { key: string; rec: Recommendation; count: number }>();
  for (const rec of rows) {
    const key = `${rec.movie_id}:${rec.message ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { key, rec, count: 1 });
    }
  }
  return Array.from(map.values());
}

function RecPost({
  rec,
  perspective,
  audienceCount,
}: {
  rec: Recommendation;
  perspective: Tab;
  audienceCount: number;
}) {
  const other = perspective === "inbox" ? rec.sender_username : rec.recipient_username;
  const poster = posterUrl(rec.movie_poster_path, "w500");
  const when = relativeTime(rec.created_at);
  const initial = (perspective === "outbox" ? "Y" : (other?.[0] ?? "?")).toUpperCase();

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {perspective === "outbox" ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3c97a] to-[#c9832e] text-sm font-bold text-zinc-950">
            {initial}
          </span>
        ) : other ? (
          <Link
            to={`/users/${other}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3c97a] to-[#c9832e] text-sm font-bold text-zinc-950"
            aria-label={`@${other}`}
          >
            {initial}
          </Link>
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-line)] text-[var(--color-muted)]">
            <User size={18} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug">
            {perspective === "inbox" ? (
              <>
                {other ? (
                  <Link to={`/users/${other}`} className="font-semibold hover:text-[var(--color-accent)]">
                    @{other}
                  </Link>
                ) : (
                  <span className="font-semibold">Someone</span>
                )}{" "}
                <span className="text-[var(--color-muted)]">shared a film with followers</span>
              </>
            ) : (
              <>
                <span className="font-semibold">You</span>{" "}
                <span className="text-[var(--color-muted)]">
                  shared with {audienceCount} follower{audienceCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </p>
          {when ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{when}</p> : null}
        </div>

        {perspective === "inbox" ? <StatusBadge status={rec.status} /> : null}
        {perspective === "outbox" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
            <UsersThree size={12} />
            {audienceCount}
          </span>
        ) : null}
      </div>

      {rec.sender_rating != null ? (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)]">
              {perspective === "inbox" ? "Their rating" : "Your rating"}
            </span>
            <StarRating value={rec.sender_rating} size={14} showValue />
          </div>
        </div>
      ) : null}

      {rec.message ? (
        <div className="px-4 pb-3">
          <div className="flex gap-2 rounded-xl bg-[color-mix(in_oklab,var(--color-paper)_65%,transparent)] px-3.5 py-3">
            <ChatCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-accent)]" weight="fill" />
            <p className="text-sm leading-relaxed text-[var(--color-ink)]/95">“{rec.message}”</p>
          </div>
        </div>
      ) : null}

      <Link
        to={`/movies/${rec.movie_id}`}
        className="group mx-4 mb-4 block overflow-hidden rounded-xl border border-[var(--color-line)]"
      >
        <div className="flex">
          <div className="relative w-[7.25rem] shrink-0 self-stretch overflow-hidden bg-[var(--color-paper)] sm:w-32">
            {poster ? (
              <img
                src={poster}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="grid h-full min-h-[9.5rem] place-items-center text-[var(--color-muted)]">
                <FilmSlate size={28} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 bg-[color-mix(in_oklab,var(--color-paper)_55%,var(--color-surface))] px-4 py-3.5">
            <p className="text-[10px] font-medium tracking-[0.18em] text-[var(--color-accent)] uppercase">
              Film
            </p>
            <h2 className="mt-1 font-display text-lg leading-tight font-semibold transition group-hover:text-[var(--color-accent)] sm:text-xl">
              {rec.movie_title ?? "Untitled"}
            </h2>
            {rec.movie_overview ? (
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
                {rec.movie_overview}
              </p>
            ) : null}
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)]">
              Open film
              <ArrowRight size={12} />
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

function EmptyFeed({ perspective }: { perspective: Tab }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-line)] px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        {perspective === "inbox" ? (
          <FilmSlate size={26} weight="duotone" />
        ) : (
          <PaperPlaneTilt size={26} weight="duotone" />
        )}
      </div>
      <p className="mt-5 font-display text-2xl font-medium">
        {perspective === "inbox" ? "Your feed is quiet" : "No shares yet"}
      </p>
      <p className="mx-auto mt-2 max-w-[36ch] text-sm text-[var(--color-muted)]">
        {perspective === "inbox"
          ? "When people you follow share films, their posts land here."
          : "Rate a film and share it with all your followers."}
      </p>
      {perspective === "outbox" ? (
        <Link to="/recommendations/new" className={`${primaryButtonClass} mt-6 inline-flex`}>
          Share a film
        </Link>
      ) : null}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <ul className="space-y-4" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="h-11 w-11 rounded-full bg-[var(--color-line)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-[var(--color-line)]" />
              <div className="h-3 w-1/4 rounded bg-[var(--color-line)]" />
            </div>
          </div>
          <div className="mx-4 mb-4 h-28 rounded-xl bg-[var(--color-line)]" />
        </li>
      ))}
    </ul>
  );
}

function relativeTime(iso: string) {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.round((now - then) / 1000);
    if (sec < 60) return "just now";
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 14) return `${day}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return null;
  }
}
