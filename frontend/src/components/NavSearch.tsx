import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, posterUrl } from "@/lib/api";

type Props = {
  className?: string;
};

export function NavSearch({ className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const suggestQuery = useQuery({
    queryKey: ["movies", "search", "suggest", debounced],
    queryFn: () => api.searchMovies(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const suggestions = (suggestQuery.data ?? []).slice(0, 6);
  const showDropdown = open && debounced.length >= 2;

  function close() {
    setOpen(false);
    setQ("");
    setDebounced("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const query = q.trim();
    if (!query) return;
    close();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function goToMovie(id: string) {
    close();
    navigate(`/movies/${id}`);
  }

  return (
    <div ref={wrapRef} className={`relative flex items-center ${className}`}>
      {open ? (
        <div className="relative">
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] pl-3 pr-1 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)]"
          >
            <MagnifyingGlass size={16} className="shrink-0 text-[var(--color-muted)]" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search movies"
              aria-label="Search movies"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              className="w-[min(52vw,16rem)] bg-transparent py-2 text-sm outline-none placeholder:text-[var(--color-muted)] focus:outline-none focus-visible:outline-none md:w-56"
            />
            <button
              type="button"
              aria-label="Close search"
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
              onClick={close}
            >
              <X size={14} />
            </button>
          </form>

          {showDropdown ? (
            <div
              role="listbox"
              className="absolute top-[calc(100%+0.5rem)] right-0 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
            >
              {suggestQuery.isFetching && suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[var(--color-muted)]">Searching…</p>
              ) : null}
              {suggestQuery.isSuccess && suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[var(--color-muted)]">No matches</p>
              ) : null}
              {suggestions.length > 0 ? (
                <ul>
                  {suggestions.map((movie) => {
                    const src = posterUrl(movie.poster_path, "w185");
                    const year = movie.release_date?.slice(0, 4);
                    return (
                      <li key={movie.id}>
                        <button
                          type="button"
                          role="option"
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-accent-soft)]"
                          onClick={() => goToMovie(movie.id)}
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
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {q.trim() ? (
                <Link
                  to={`/search?q=${encodeURIComponent(q.trim())}`}
                  className="block border-t border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-accent)] transition hover:bg-[var(--color-accent-soft)]"
                  onClick={close}
                >
                  See all results for “{q.trim()}”
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
          onClick={() => setOpen(true)}
        >
          <MagnifyingGlass size={18} />
        </button>
      )}
    </div>
  );
}
