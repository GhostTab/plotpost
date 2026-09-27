import { Heart, BookmarkSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RatingControl, StarRating } from "@/components/RatingControl";
import { ErrorMessage, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mapApiError } from "@/lib/format";
import { ApiError } from "@/lib/types";

type Tab = "overview" | "cast";

export function MoviePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const signedIn = Boolean(session);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const movieQuery = useQuery({
    queryKey: ["movies", id],
    queryFn: () => api.movie(id),
    enabled: Boolean(id),
  });

  const ratingMutation = useMutation({
    mutationFn: (score: number) => api.upsertRating(id, score),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["movies", id] });
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? mapApiError(err.code, err.message) : "Could not save rating.");
    },
  });

  if (movieQuery.isError) {
    return (
      <div className="px-4 py-10">
        <ErrorMessage
          message={movieQuery.error instanceof ApiError ? movieQuery.error.message : "Movie not found."}
        />
      </div>
    );
  }

  const movie = movieQuery.data;
  if (!movie) {
    return <div className="min-h-[70dvh] animate-pulse bg-[var(--color-surface)]" />;
  }

  const poster = posterUrl(movie.poster_path, "original");
  const backdrop = posterUrl(movie.backdrop_path, "original");
  const year = movie.release_date?.slice(0, 4);
  const genres = movie.genres?.length ? movie.genres : [];
  const genreLine = ["Film", ...genres].join(" · ");

  const metaParts = [
    year,
    movie.runtime ? `${movie.runtime} min` : null,
    movie.director ? `Dir. ${movie.director}` : null,
  ].filter(Boolean) as string[];

  function requireAuthAction() {
    navigate("/login", { state: { from: `/movies/${id}` } });
  }

  return (
    <div className="-mt-16 bg-[var(--color-paper)]">
      <section className="relative min-h-[72dvh] overflow-hidden md:min-h-[80dvh]">
        {backdrop ? (
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[var(--color-surface)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Concave black curve — content dips into the backdrop */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full text-[var(--color-paper)]"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path fill="currentColor" d="M0,320 L0,90 Q720,220 1440,90 L1440,320 Z" />
        </svg>
      </section>

      <div className="relative z-10 mx-auto -mt-[13rem] max-w-6xl px-4 pb-20 md:-mt-[20.5rem]">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-[var(--color-surface)] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.95)] md:mx-0 md:w-48 lg:w-56">
            <div className="aspect-[2/3]">
              {poster ? (
                <img src={poster} alt={`${movie.title} poster`} className="h-full w-full object-cover" />
              ) : null}
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-2 text-center md:pt-0 md:text-left">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--color-muted)] uppercase">
              {genreLine}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] font-semibold tracking-tight md:text-5xl lg:text-6xl">
              {movie.title}
            </h1>
            {movie.tagline ? (
              <p className="mt-2 font-display text-base italic text-[var(--color-muted)] md:text-lg">
                {movie.tagline}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[var(--color-muted)] md:justify-start">
              <StarRating value={movie.average_rating} size={16} showValue />
              {metaParts.map((part) => (
                <span key={part} className="inline-flex items-center gap-3">
                  <span className="text-[var(--color-line)]" aria-hidden>
                    ·
                  </span>
                  {part}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-3 md:justify-end md:pb-1">
            <button
              type="button"
              aria-label="Save"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-line)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              onClick={() => {
                if (!signedIn) requireAuthAction();
              }}
            >
              <BookmarkSimple size={20} />
            </button>
            <button
              type="button"
              aria-label="Favorite"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-line)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              onClick={() => {
                if (!signedIn) requireAuthAction();
              }}
            >
              <Heart size={20} />
            </button>
          </div>
        </div>

        <div className="mt-10 flex gap-8 border-b border-[var(--color-line)] text-sm font-medium tracking-wide">
          <button
            type="button"
            className={`border-b-2 pb-3 transition ${
              tab === "overview"
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`border-b-2 pb-3 transition ${
              tab === "cast"
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
            onClick={() => setTab("cast")}
          >
            Cast
          </button>
        </div>

        <div className="mt-8">
          {tab === "overview" ? (
            <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
              <div>
                <h2 className="font-display text-2xl font-medium">Story</h2>
                <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-[var(--color-muted)]">
                  {movie.overview || "No overview available."}
                </p>
              </div>
              <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
                {signedIn ? (
                  <div className="space-y-4">
                    <RatingControl
                      value={movie.my_rating}
                      disabled={ratingMutation.isPending}
                      onChange={(score) => ratingMutation.mutate(score)}
                    />
                    <button
                      type="button"
                      className={`${primaryButtonClass} w-full`}
                      onClick={() => navigate(`/recommendations/new?movieId=${movie.id}`)}
                    >
                      Recommend
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--color-muted)]">
                      Sign in to rate or recommend this film.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link to="/login" className={secondaryButtonClass}>
                        Sign in
                      </Link>
                      <Link to="/register" className={primaryButtonClass}>
                        Get started
                      </Link>
                    </div>
                  </div>
                )}
                {error ? (
                  <div className="mt-4">
                    <ErrorMessage message={error} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              {movie.cast && movie.cast.length > 0 ? (
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {movie.cast.map((person) => {
                    const face = posterUrl(person.profile_path, "w185");
                    return (
                      <li key={`${person.id}-${person.character}`} className="text-center">
                        <Link
                          to={`/people/${person.id}`}
                          className="group block transition hover:opacity-95"
                        >
                          <div className="mx-auto aspect-square w-full max-w-[120px] overflow-hidden rounded-full bg-[var(--color-surface)] ring-0 transition group-hover:ring-2 group-hover:ring-[var(--color-accent)]">
                            {face ? (
                              <img src={face} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-medium transition group-hover:text-[var(--color-accent)]">
                            {person.name}
                          </p>
                          {person.character ? (
                            <p className="mt-1 text-xs text-[var(--color-muted)]">{person.character}</p>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">Cast details are unavailable right now.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
