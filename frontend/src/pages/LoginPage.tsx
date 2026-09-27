import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authSubmitClass,
} from "@/components/AuthShell";
import { ErrorMessage } from "@/components/ui";
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
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Pick up where you left off — your feed, ratings, and shares."
      footer={
        <p className="text-sm text-[var(--color-muted)]">
          New here?{" "}
          <Link className="font-medium text-[var(--color-accent)] transition hover:brightness-110" to="/register">
            Create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-2">
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@email.com"
            className={authFieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            className={authFieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        <button type="submit" disabled={submitting} className={authSubmitClass}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
