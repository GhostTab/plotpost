import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, PageHeading } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-10">
      <PageHeading title="Sign in" subtitle="Use your Supabase account to continue." />
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
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
            autoComplete="current-password"
            required
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 transition focus:border-[var(--color-accent)] focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[10px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 dark:text-zinc-950"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        No account?{" "}
        <Link className="font-medium text-[var(--color-accent)]" to="/register">
          Create one
        </Link>
      </p>
    </div>
  );
}
