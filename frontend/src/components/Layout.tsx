import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AccountMenu } from "@/components/AccountMenu";
import { NavSearch } from "@/components/NavSearch";
import { primaryButtonClass } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 text-[13px] font-medium transition",
    isActive ? "text-[var(--color-accent)]" : "text-[var(--color-ink)] hover:text-[var(--color-accent)]",
  ].join(" ");

export function AppShell() {
  const { session } = useAuth();
  const signedIn = Boolean(session);
  const location = useLocation();
  const isMovieDetail = /^\/movies\/[^/]+$/.test(location.pathname);

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
              <AccountMenu />
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
    </div>
  );
}
