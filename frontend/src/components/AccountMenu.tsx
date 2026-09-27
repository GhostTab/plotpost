import { User } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const menuItemClass =
  "block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]";

export function AccountMenu() {
  const { profile, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
          className="absolute right-0 z-40 mt-3 w-56 overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
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
  );
}
