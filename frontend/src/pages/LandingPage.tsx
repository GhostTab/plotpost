import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountMenu } from "@/components/AccountMenu";
import { CameraIntro } from "@/components/landing/CameraIntro";
import { RotatingPosterStack } from "@/components/landing/RotatingPosterStack";
import { NavSearch } from "@/components/NavSearch";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { api, apiBaseUrl, posterUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MovieSummary } from "@/lib/types";

const INTRO_KEY = "moviesite:intro-seen";
const ease = [0.16, 1, 0.3, 1] as const;

type Phase = "rolling" | "opening" | "done";

function initialPhase(reduce: boolean | null): Phase {
  if (reduce) return "done";
  if (typeof window !== "undefined" && sessionStorage.getItem(INTRO_KEY)) return "done";
  return "rolling";
}

export function LandingPage() {
  const reduce = useReducedMotion();
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(reduce));

  const trending = useQuery({
    queryKey: ["movies", "trending"],
    queryFn: () => api.trendingMovies(),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const movies = trending.data ?? [];
  const lead = movies[0];

  useEffect(() => {
    document.body.style.overflow = phase === "done" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  const finish = useCallback(() => {
    sessionStorage.setItem(INTRO_KEY, "1");
    setPhase("done");
  }, []);
  const onRolled = useCallback(() => setPhase("opening"), []);

  return (
    <>
      {phase !== "done" ? (
        <CameraIntro
          backdrop={posterUrl(lead?.backdrop_path, "original")}
          opening={phase === "opening"}
          onRolled={onRolled}
          onOpened={finish}
          onSkip={finish}
        />
      ) : null}

      <div className="relative bg-[var(--color-paper)]">
        <div className="flex min-h-[100dvh] flex-col">
          <LandingNav signedIn={Boolean(session)} />
          <Hero movies={movies} signedIn={Boolean(session)} revealed={phase !== "rolling"} />
          {trending.isError ? (
            <p className="mx-auto max-w-6xl px-4 pb-4 text-sm text-red-300" role="alert">
              Couldn’t load movies. Check that the API is reachable ({apiBaseUrl}).
            </p>
          ) : null}
          {movies.length > 0 ? <FilmStrip movies={movies} /> : null}
        </div>
        {movies.length > 0 ? <TrendingNow movies={movies} signedIn={Boolean(session)} /> : null}
        <footer className="mx-auto w-full max-w-6xl border-t border-[var(--color-line)] px-4 py-8 text-xs text-[var(--color-muted)]">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </footer>
      </div>
    </>
  );
}

function LandingNav({ signedIn }: { signedIn: boolean }) {
  const linkClass = "px-3 py-2 text-[13px] font-medium transition hover:text-[var(--color-accent)]";

  return (
    <header className="absolute inset-x-0 top-0 z-10 bg-transparent">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="font-display bg-gradient-to-r from-[#f3c97a] to-[#c9832e] bg-clip-text text-xl font-semibold tracking-tight text-transparent"
          >
            Plotpost
          </Link>
          {signedIn ? (
            <nav className="hidden items-center sm:flex" aria-label="Primary">
              <Link to="/recommendations" className={`${linkClass} text-[var(--color-ink)]`}>
                Recommendations
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <NavSearch />
          {signedIn ? (
            <AccountMenu />
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 text-sm font-medium transition hover:text-[var(--color-accent)]">
                Sign in
              </Link>
              <Link to="/register" className={primaryButtonClass}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({
  movies,
  signedIn,
  revealed,
}: {
  movies: MovieSummary[];
  signedIn: boolean;
  revealed: boolean;
}) {
  const item = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: { duration: 0.8, delay, ease },
  });

  return (
    <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 pt-20 pb-6 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pb-8">
      <div>
        <motion.h1
          {...item(0.2)}
          className="font-display text-4xl leading-[1.12] font-medium tracking-[-0.02em] md:text-5xl lg:text-6xl"
        >
          Recommend a film.{" "}
          <span className="font-semibold text-[var(--color-accent)]">See if it lands.</span>
        </motion.h1>
        <motion.p
          {...item(0.35)}
          className="mt-4 max-w-[42ch] text-base leading-relaxed font-light tracking-wide text-[var(--color-muted)] md:text-lg"
        >
          Send movies to people who follow you. Their rating decides whether your pick was a hit.
        </motion.p>
        <motion.div {...item(0.5)} className="mt-6 flex flex-wrap gap-3">
          {signedIn ? (
            <Link to="/search" className={`${primaryButtonClass} hidden sm:inline-flex`}>
              Browse films
            </Link>
          ) : (
            <>
              <Link to="/register" className={`${primaryButtonClass} hidden sm:inline-flex`}>
                Get started
              </Link>
              <Link to="/login" className={`${secondaryButtonClass} hidden sm:inline-flex`}>
                Sign in
              </Link>
            </>
          )}
        </motion.div>
      </div>

      <div className="relative mx-auto h-[280px] w-full max-w-[360px] md:h-[360px] lg:h-[400px]">
        <RotatingPosterStack movies={movies} revealed={revealed} />
      </div>
    </section>
  );
}

function FilmStrip({ movies }: { movies: MovieSummary[] }) {
  const reel = movies.filter((m) => m.poster_path).slice(0, 14);
  const sprockets =
    "h-4 bg-[repeating-linear-gradient(90deg,transparent_0_10px,#2a2a2f_10px_22px)] bg-[length:32px_8px] bg-center bg-repeat-x";

  return (
    <section
      className="mt-auto shrink-0 overflow-hidden border-y border-[var(--color-line)] bg-[#070708] py-2"
      aria-label="Trending this week"
    >
      <div className={sprockets} />
      <div className="flex w-max animate-[reel_60s_linear_infinite] gap-2.5 py-2 motion-reduce:animate-none hover:[animation-play-state:paused]">
        {[...reel, ...reel].map((movie, i) => (
          <Link
            key={`${movie.id}-${i}`}
            to={`/movies/${movie.id}`}
            className="block aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-[4px] opacity-80 transition hover:opacity-100 md:w-28"
            aria-hidden={i >= reel.length}
            tabIndex={i >= reel.length ? -1 : undefined}
          >
            <img src={posterUrl(movie.poster_path, "w500") ?? ""} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
      <div className={sprockets} />
    </section>
  );
}

function TrendingNow({ movies, signedIn }: { movies: MovieSummary[]; signedIn: boolean }) {
  const list = movies.filter((m) => m.poster_path).slice(0, 12);

  return (
    <section className="relative border-b border-[var(--color-line)] bg-[var(--color-paper)] py-14 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.08),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--color-accent)] uppercase">
              This week
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Trending now
            </h2>
            <p className="mt-2 max-w-[42ch] text-sm text-[var(--color-muted)]">
              Open a title, rate it, and share the ones worth passing on.
            </p>
          </div>
          <Link
            to={signedIn ? "/search" : "/register"}
            className={`${secondaryButtonClass} shrink-0`}
          >
            {signedIn ? "Browse all" : "Join to share"}
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((movie, i) => {
            const year = movie.release_date?.slice(0, 4);
            return (
              <li key={movie.id}>
                <Link to={`/movies/${movie.id}`} className="group block">
                  <div className="aspect-[2/3] overflow-hidden rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface)]">
                    <img
                      src={posterUrl(movie.poster_path, "w500") ?? ""}
                      alt=""
                      loading={i < 6 ? "eager" : "lazy"}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-[15px] leading-snug font-semibold transition group-hover:text-[var(--color-accent)]">
                    {movie.title}
                  </h3>
                  {year ? (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{year}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
