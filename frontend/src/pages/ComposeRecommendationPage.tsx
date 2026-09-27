import { MagnifyingGlass, UsersThree } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RatingControl, StarRating } from "@/components/RatingControl";
import { ErrorMessage, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import { mapApiError, validateCompose } from "@/lib/format";
import { ApiError } from "@/lib/types";

export function ComposeRecommendationPage() {
  const [params] = useSearchParams();
  const prefilledMovieId = params.get("movieId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [movieId, setMovieId] = useState(prefilledMovieId ?? "");
  const [movieQuery, setMovieQuery] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (prefilledMovieId) setMovieId(prefilledMovieId);
  }, [prefilledMovieId]);

  const followersQuery = useQuery({
    queryKey: ["followers"],
    queryFn: () => api.followers(),
  });

  const searchQuery = useQuery({
    queryKey: ["movies", "search", "compose", movieQuery],
    queryFn: () => api.searchMovies(movieQuery),
    enabled: movieQuery.trim().length > 1 && !movieId,
  });

  const selectedMovieQuery = useQuery({
    queryKey: ["movies", movieId],
    queryFn: () => api.movie(movieId),
    enabled: Boolean(movieId),
  });

  const selectedFromSearch = searchQuery.data?.find((m) => m.id === movieId);
  const selectedTitle =
    selectedMovieQuery.data?.title ?? selectedFromSearch?.title ?? null;
  const selectedPoster =
    selectedMovieQuery.data?.poster_path ?? selectedFromSearch?.poster_path ?? null;
  const myRating = selectedMovieQuery.data?.my_rating ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      api.createRecommendation({
        movie_id: movieId,
        message: message.trim() || undefined,
      }),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["movies"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/recommendations");
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError ? mapApiError(err.code, err.message) : "Could not share recommendation.",
      );
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (score: number) => api.upsertRating(movieId, score),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["movies", movieId] });
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError ? mapApiError(err.code, err.message) : "Could not save rating.",
      );
    },
  });

  function onCompose(event: FormEvent) {
    event.preventDefault();
    const validation = validateCompose({
      movieId: movieId || null,
      hasRating: myRating != null,
    });
    if (validation) {
      setFormError(validation);
      return;
    }
    createMutation.mutate();
  }

  const poster = posterUrl(selectedPoster, "w500");
  const followerCount = followersQuery.data?.length ?? 0;
  const followerPreview = useMemo(() => {
    const list = followersQuery.data ?? [];
    if (list.length === 0) return null;
    if (list.length === 1) return `@${list[0].username}`;
    if (list.length === 2) return `@${list[0].username} and @${list[1].username}`;
    return `@${list[0].username} and ${list.length - 1} others`;
  }, [followersQuery.data]);

  return (
    <div className="relative mx-auto max-w-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-52 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.12),transparent_60%)]"
      />

      <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--color-accent)] uppercase">
        Share
      </p>
      <h1 className="mt-2 font-display text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl">
        Recommend a film
      </h1>
      <p className="mt-3 max-w-[48ch] text-sm text-[var(--color-muted)] md:text-base">
        Your rating travels with the post. It’s shared with everyone who follows you.
      </p>

      <form
        className="relative mt-10 space-y-6"
        onSubmit={(e) => void onCompose(e)}
        data-testid="compose-form"
      >
        <div className="space-y-3">
          <label className="text-sm font-medium" htmlFor="movie-picker">
            Movie
          </label>

          {movieId ? (
            <div className="flex gap-4 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-[8px] bg-[var(--color-line)]">
                {poster ? <img src={poster} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1 py-1">
                <p className="font-display text-xl font-semibold">
                  {selectedMovieQuery.isLoading ? "Loading…" : selectedTitle ?? "Selected movie"}
                </p>
                {myRating != null ? (
                  <div className="mt-2">
                    <StarRating value={myRating} size={16} showValue />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="mt-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                  onClick={() => {
                    setMovieId("");
                    setMovieQuery("");
                    if (prefilledMovieId) navigate("/recommendations/new");
                  }}
                >
                  Choose a different film
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
              />
              <input
                id="movie-picker"
                type="search"
                placeholder="Search to pick a movie"
                value={movieQuery}
                onChange={(e) => setMovieQuery(e.target.value)}
                className="w-full rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pr-3 pl-10 outline-none focus:outline-none focus-visible:outline-none"
              />
              {searchQuery.data && searchQuery.data.length > 0 ? (
                <ul className="mt-2 max-h-56 overflow-auto rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)]">
                  {searchQuery.data.map((movie) => {
                    const thumb = posterUrl(movie.poster_path, "w185");
                    return (
                      <li key={movie.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--color-accent-soft)]"
                          onClick={() => {
                            setMovieId(movie.id);
                            setMovieQuery(movie.title);
                          }}
                        >
                          <div className="h-12 w-8 shrink-0 overflow-hidden rounded-[4px] bg-[var(--color-line)]">
                            {thumb ? (
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <span className="truncate font-medium">{movie.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        {movieId ? (
          <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <RatingControl
              value={myRating}
              disabled={ratingMutation.isPending || !movieId}
              onChange={(score) => ratingMutation.mutate(score)}
            />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Followers see this rating on your share.
            </p>
          </div>
        ) : null}

        <div className="flex items-start gap-3 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <UsersThree size={18} weight="duotone" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Shared with all followers</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {followersQuery.isLoading
                ? "Loading followers…"
                : followerCount === 0
                  ? "You don’t have followers yet — they’ll need to follow you first."
                  : `Goes to ${followerPreview}.`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium" htmlFor="message">
            Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          </label>
          <textarea
            id="message"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why they should watch this…"
            className="w-full resize-y rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 outline-none focus:outline-none focus-visible:outline-none"
          />
        </div>

        {formError ? <ErrorMessage message={formError} /> : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending || ratingMutation.isPending}
            className={primaryButtonClass}
          >
            {createMutation.isPending ? "Sharing…" : "Share with followers"}
          </button>
          <Link to="/recommendations" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
