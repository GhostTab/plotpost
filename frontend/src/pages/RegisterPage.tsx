import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ErrorMessage, PageHeading } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function RegisterPage() {
  const { signUp, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, underscore).");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email.trim(), password, cleanUsername);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-10">
      <PageHeading
        title="Create account"
        subtitle="Pick a username. It becomes your public profile handle."
      />
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-2">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            required
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 transition focus:border-[var(--color-accent)] focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="text-xs text-[var(--color-muted)]">Letters, numbers, underscore.</p>
        </div>
        <div className="grid gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 transition focus:border-[var(--color-accent)] focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 transition focus:border-[var(--color-accent)] focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[10px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        Already registered?{" "}
        <Link className="font-medium text-[var(--color-accent)]" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
