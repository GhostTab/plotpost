import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState, ErrorMessage } from "@/components/ui";
import { api, posterUrl } from "@/lib/api";
import { ApiError, type PersonCredit } from "@/lib/types";

export function PersonPage() {
  const params = useParams();
  const rawId = String(params.id ?? "").trim();
  const navigate = useNavigate();
  const personId = Number.parseInt(rawId, 10);

  const personQuery = useQuery({
    queryKey: ["people", personId],
    queryFn: () => api.person(personId),
    enabled: Number.isFinite(personId) && personId > 0,
  });

  const openMovie = useMutation({
    mutationFn: (tmdbId: number) => api.movieByTmdb(tmdbId),
    onSuccess: (movie) => navigate(`/movies/${movie.id}`),
  });

  if (!rawId || rawId === "undefined" || rawId === "null" || !Number.isFinite(personId) || personId <= 0) {
    return (
      <div className="px-4 py-10">
        <ErrorMessage message="This cast member has no person id yet. Redeploy the Railway backend, then hard-refresh the movie page." />
      </div>
    );
  }

  if (personQuery.isError) {
    return (
      <div className="px-4 py-10">
        <ErrorMessage
          message={
            personQuery.error instanceof ApiError
              ? personQuery.error.message
              : "Person not found."
          }
        />
      </div>
    );
  }

  const person = personQuery.data;
  const face = posterUrl(person?.profile_path ?? null, "w500");

  return (
    <div className="relative mx-auto max-w-6xl pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] -top-10 h-56 bg-[radial-gradient(ellipse_at_top,rgba(226,168,85,0.12),transparent_55%)]"
      />

      {personQuery.isLoading || !person ? (
        <EmptyState title="Loading" body="Fetching filmography…" />
      ) : (
        <>
          <header className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] sm:mx-0 sm:h-44 sm:w-44">
              {face ? (
                <img src={face} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 text-center sm:pt-2 sm:text-left">
              {person.known_for_department ? (
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--color-accent)] uppercase">
                  {person.known_for_department}
                </p>
              ) : null}
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                {person.name}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {[person.birthday?.slice(0, 4), person.place_of_birth].filter(Boolean).join(" · ") ||
                  "Filmography"}
              </p>
              {person.biography ? (
                <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
                  {person.biography.length > 420
                    ? `${person.biography.slice(0, 420).trim()}…`
                    : person.biography}
                </p>
              ) : null}
            </div>
          </header>

          <section className="relative mt-12">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">Filmography</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {person.filmography.length} title{person.filmography.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {openMovie.isError ? (
              <div className="mb-4">
                <ErrorMessage
                  message={
                    openMovie.error instanceof ApiError
                      ? openMovie.error.message
                      : "Could not open that film."
                  }
                />
              </div>
            ) : null}

            {person.filmography.length === 0 ? (
              <EmptyState title="No credits yet" body="TMDB didn’t return movie credits for this person." />
            ) : (
              <ul className="grid grid-cols-4 gap-x-2.5 gap-y-5 sm:gap-x-4 sm:gap-y-8 md:grid-cols-5 lg:grid-cols-6">
                {person.filmography.map((credit) => (
                  <FilmCreditCard
                    key={`${credit.tmdb_id}-${credit.character ?? credit.job ?? ""}`}
                    credit={credit}
                    busy={openMovie.isPending && openMovie.variables === credit.tmdb_id}
                    onOpen={() => openMovie.mutate(credit.tmdb_id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FilmCreditCard({
  credit,
  busy,
  onOpen,
}: {
  credit: PersonCredit;
  busy: boolean;
  onOpen: () => void;
}) {
  const poster = posterUrl(credit.poster_path, "w500");
  const year = credit.release_date?.slice(0, 4);
  const role = credit.character || credit.job;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="group w-full text-left disabled:opacity-60"
      >
        <div className="aspect-[2/3] overflow-hidden rounded-[6px] border border-[var(--color-line)] bg-[var(--color-surface)] sm:rounded-[8px]">
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-[12px] leading-snug font-semibold transition group-hover:text-[var(--color-accent)] sm:mt-3 sm:text-[15px]">
          {credit.title}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--color-muted)] sm:mt-1 sm:text-xs">
          {[year, role].filter(Boolean).join(" · ")}
        </p>
      </button>
    </li>
  );
}
