import { User } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavSearch } from "@/components/NavSearch";
import { primaryButtonClass } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 text-[13px] font-medium transition",
    isActive ? "text-[var(--color-accent)]" : "text-[var(--color-ink)] hover:text-[var(--color-accent)]",
  ].join(" ");

const menuItemClass =
  "block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]";

export function AppShell() {
  const { profile, session, signOut, loading } = useAuth();
  const signedIn = Boolean(session);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isMovieDetail = /^\/movies\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <header
        className={`sticky top-0 z-30 ${
          isMovieDetail
            ? "border-b border-transparent bg-transparent"
            : "border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-paper)_90%,transparent)] backdrop-blur-md"
        }`}
      >
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
                <NavLink to="/recommendations" className={navLinkClass}>
                  Recommendations
                </NavLink>
              </nav>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2">
            <NavSearch />
            {signedIn ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-accent)] text-zinc-950 transition active:scale-[0.96]"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={profile?.username ?? "Account"}
                  onClick={() => setOpen((v) => !v)}
                  disabled={loading}
                >
                  <User size={16} weight="bold" />
                </button>
                {open ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-56 overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
                  >
                    {profile ? (
                      <p className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-muted)]">
                        Signed in as <span className="text-[var(--color-ink)]">@{profile.username}</span>
                      </p>
                    ) : null}
                    <Link
                      role="menuitem"
                      to={profile ? `/users/${profile.username}` : "/login"}
                      className={menuItemClass}
                      onClick={() => setOpen(false)}
                    >
                      My profile
                    </Link>
                    <Link
                      role="menuitem"
                      to="/recommendations"
                      className={`${menuItemClass} sm:hidden`}
                      onClick={() => setOpen(false)}
                    >
                      Recommendations
                    </Link>
                    <Link
                      role="menuitem"
                      to="/notifications"
                      className={menuItemClass}
                      onClick={() => setOpen(false)}
                    >
                      Notifications
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-950/40"
                      onClick={() => void handleLogout()}
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-medium transition hover:text-[var(--color-accent)]"
                >
                  Sign in
                </Link>
                <Link to="/register" className={primaryButtonClass}>
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={isMovieDetail ? "" : "mx-auto max-w-6xl px-4 py-10"}>
        <Outlet />
      </main>

      {!isMovieDetail ? (
        <footer className="mx-auto max-w-6xl border-t border-[var(--color-line)] px-4 py-8 text-xs text-[var(--color-muted)]">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </footer>
      ) : null}
    </div>
  );
}
