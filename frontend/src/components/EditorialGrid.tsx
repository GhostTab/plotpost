import { Link } from "react-router-dom";
import { posterUrl } from "@/lib/api";
import type { MovieSummary } from "@/lib/types";

function year(movie: MovieSummary) {
  return movie.release_date?.slice(0, 4) ?? "Year unknown";
}

function Poster({ movie, className }: { movie: MovieSummary; className: string }) {
  const src = posterUrl(movie.poster_path, "w500");
  return (
    <div className={`shrink-0 overflow-hidden rounded-[6px] bg-[var(--color-line)] ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
    </div>
  );
}

function FeaturedCard({ movie }: { movie: MovieSummary }) {
  const backdrop = posterUrl(movie.backdrop_path, "original") ?? posterUrl(movie.poster_path, "original");
  return (
    <Link
      to={`/movies/${movie.id}`}
      className="group relative flex min-h-[420px] overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] md:min-h-[520px]"
    >
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-paper)] via-[color-mix(in_oklab,var(--color-paper)_45%,transparent)] to-transparent" />
      <div className="relative mt-auto p-6 md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Featured film
        </p>
        <h2 className="mt-3 font-display text-4xl leading-[1.1] font-medium md:text-6xl">
          {movie.title}
        </h2>
        <p className="mt-3 line-clamp-2 max-w-[55ch] text-sm text-[var(--color-muted)]">
          {movie.overview || "No overview available."}
        </p>
      </div>
    </Link>
  );
}

function PickCard({ movie, compact = false }: { movie: MovieSummary; compact?: boolean }) {
  return (
    <Link
      to={`/movies/${movie.id}`}
      className="group flex gap-4 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 transition duration-300 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-zinc-950 hover:shadow-[0_12px_40px_-12px_rgba(226,168,85,0.45)]"
    >
      <Poster movie={movie} className={compact ? "h-20 w-14" : "h-24 w-16"} />
      <div className="min-w-0 py-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)] transition group-hover:text-zinc-900">
          {year(movie)}
        </p>
        <p className="mt-1 truncate font-display text-xl leading-tight font-semibold">
          {movie.title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)] transition group-hover:text-zinc-800">
          {movie.overview || "No overview available."}
        </p>
      </div>
    </Link>
  );
}

export function EditorialGrid({ movies }: { movies: MovieSummary[] }) {
  const [featured, ...rest] = movies;
  if (!featured) return null;
  const side = rest.slice(0, 4);
  const bottom = rest.slice(4, 10);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <FeaturedCard movie={featured} />
        {side.length > 0 ? (
          <div className="grid content-start gap-3">
            {side.map((movie) => (
              <PickCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : null}
      </div>
      {bottom.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bottom.map((movie) => (
            <PickCard key={movie.id} movie={movie} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EditorialGridSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 lg:grid-cols-[1.45fr_1fr]" aria-hidden>
      <div className="min-h-[420px] rounded-[10px] bg-[var(--color-surface)] md:min-h-[520px]" />
      <div className="grid content-start gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[122px] rounded-[10px] bg-[var(--color-surface)]" />
        ))}
      </div>
    </div>
  );
}
