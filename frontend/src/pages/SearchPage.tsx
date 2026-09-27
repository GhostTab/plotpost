import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorMessage } from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import { ApiError, type MovieSummary } from "@/lib/types";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q")?.trim() ?? "";
  const [q, setQ] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searching = submitted.length > 0;

  useEffect(() => {
    const next = params.get("q")?.trim() ?? "";
    setQ(next);
    setSubmitted(next);
    setDebounced(next);
  }, [params]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const trendingQuery = useQuery({
    queryKey: ["movies", "trending"],
    queryFn: () => api.trendingMovies(),
    enabled: !searching,
    staleTime: 10 * 60_000,
  });

  const searchQuery = useQuery({
    queryKey: ["movies", "search", submitted],
    queryFn: () => api.searchMovies(submitted),
    enabled: searching,
  });

  const suggestQuery = useQuery({
    queryKey: ["movies", "search", "suggest", debounced],
    queryFn: () => api.searchMovies(debounced),
    enabled: dropdownOpen && debounced.length >= 2 && debounced !== submitted,
    staleTime: 30_000,
  });

  const active = searching ? searchQuery : trendingQuery;
  const suggestions = (suggestQuery.data ?? []).slice(0, 6);
  const showDropdown =
    dropdownOpen && debounced.length >= 2 && (suggestions.length > 0 || suggestQuery.isFetching);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = q.trim();
    setSubmitted(next);
    setDropdownOpen(false);
    if (next) setParams({ q: next });
    else setParams({});
  }

  function clearQuery() {
    setQ("");
    setSubmitted("");
    setDebounced("");
    setParams({});
    setDropdownOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-56 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.12),transparent_60%)]"
      />

      <section className="relative mx-auto max-w-2xl pt-2 pb-10 text-center">
        <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--color-accent)] uppercase">
          {searching ? "Search" : "Browse"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl">
          {searching ? (
            <>
              Results for <span className="text-[var(--color-accent)]">“{submitted}”</span>
            </>
          ) : (
            "Find your next film"
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-sm text-[var(--color-muted)] md:text-base">
          {searching
            ? "Pick a title to open its page."
            : "Search by title, or browse what’s trending this week."}
        </p>

        <div ref={wrapRef} className="relative mt-8">
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)]"
          >
            <button
              type="submit"
              aria-label="Search"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--color-muted)] transition hover:text-[var(--color-accent)]"
            >
              <MagnifyingGlass size={18} />
            </button>
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setDropdownOpen(true);
                if (!e.target.value.trim()) {
                  setSubmitted("");
                  setParams({});
                }
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search movies"
              aria-label="Search movies"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-[var(--color-muted)] focus:outline-none focus-visible:outline-none"
              autoFocus={!initial}
            />
            {q ? (
              <button
                type="button"
                aria-label="Clear search"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
                onClick={clearQuery}
              >
                <X size={16} />
              </button>
            ) : null}
          </form>

          {showDropdown ? (
            <div
              role="listbox"
              className="absolute top-[calc(100%+0.5rem)] left-0 z-40 w-full overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
            >
              {suggestQuery.isFetching && suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[var(--color-muted)]">Searching…</p>
              ) : null}
              <ul>
                {suggestions.map((movie) => {
                  const src = posterUrl(movie.poster_path, "w185");
                  const year = movie.release_date?.slice(0, 4);
                  return (
                    <li key={movie.id}>
                      <Link
                        to={`/movies/${movie.id}`}
                        role="option"
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[var(--color-accent-soft)]"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <div className="h-12 w-8 shrink-0 overflow-hidden rounded-[4px] bg-[var(--color-line)]">
                          {src ? (
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{movie.title}</p>
                          {year ? (
                            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{year}</p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {active.isError ? (
        <ErrorMessage
          message={active.error instanceof ApiError ? active.error.message : "Could not load movies."}
        />
      ) : null}

      {active.isLoading ? <MovieListSkeleton /> : null}

      {active.isSuccess && active.data.length === 0 ? (
        <EmptyState
          title={searching ? "No movies found" : "Nothing trending yet"}
          body={
            searching
              ? "Try a different spelling or a shorter title."
              : "Search for a title above to get started."
          }
        />
      ) : null}

      {active.data && active.data.length > 0 ? (
        <div>
          {!searching ? (
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-medium">Trending now</h2>
              <p className="text-xs tracking-wide text-[var(--color-muted)] uppercase">
                {active.data.length} titles
              </p>
            </div>
          ) : (
            <p className="mb-5 text-sm text-[var(--color-muted)]">
              {active.data.length} result{active.data.length === 1 ? "" : "s"}
            </p>
          )}
          <MovieList movies={active.data} />
        </div>
      ) : null}
    </div>
  );
}

function MovieList({ movies }: { movies: MovieSummary[] }) {
  return (
    <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
      {movies.map((movie) => {
        const src = posterUrl(movie.poster_path, "w500");
        const year = movie.release_date?.slice(0, 4);
        return (
          <li key={movie.id}>
            <Link
              to={`/movies/${movie.id}`}
              className="group flex gap-4 py-5 transition hover:bg-[color-mix(in_oklab,var(--color-surface)_70%,transparent)] sm:gap-5"
            >
              <div className="h-[7.5rem] w-[5rem] shrink-0 overflow-hidden rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface)] sm:h-36 sm:w-24">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                {year ? (
                  <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--color-accent)] uppercase">
                    {year}
                  </p>
                ) : null}
                <h3 className="mt-1 font-display text-xl leading-tight font-semibold transition group-hover:text-[var(--color-accent)] sm:text-2xl">
                  {movie.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-muted)] sm:line-clamp-4">
                  {movie.overview || "No overview available."}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MovieListSkeleton() {
  return (
    <ul className="animate-pulse divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex gap-5 py-5">
          <div className="h-36 w-24 shrink-0 rounded-[8px] bg-[var(--color-surface)]" />
          <div className="min-w-0 flex-1 space-y-3 py-1">
            <div className="h-3 w-12 rounded bg-[var(--color-surface)]" />
            <div className="h-6 w-2/3 rounded bg-[var(--color-surface)]" />
            <div className="h-4 w-full rounded bg-[var(--color-surface)]" />
            <div className="h-4 w-5/6 rounded bg-[var(--color-surface)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
