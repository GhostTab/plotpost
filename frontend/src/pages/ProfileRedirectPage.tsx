import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

function usernameFromAuth(profileUsername: string | null | undefined, user: ReturnType<typeof useAuth>["user"]) {
  if (profileUsername) return profileUsername;
  const meta = user?.user_metadata?.username;
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  }
  return null;
}

/** Stable entry for “My profile” — waits for auth, then routes to /users/:username. */
export function ProfileRedirectPage() {
  const { profile, user, session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center text-sm text-[var(--color-muted)]">
        Opening profile…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: "/profile" }} />;
  }

  const username = usernameFromAuth(profile?.username, user);
  if (!username) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-2xl font-semibold">Profile unavailable</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          You’re signed in, but we couldn’t load your username yet. Try refreshing.
        </p>
      </div>
    );
  }

  return <Navigate to={`/users/${username}`} replace />;
}
