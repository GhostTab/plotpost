import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authSubmitClass,
} from "@/components/AuthShell";
import { ErrorMessage } from "@/components/ui";
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
    <AuthShell
      eyebrow="Join Plotpost"
      title="Create account"
      subtitle="Pick a username — it becomes your public handle when you share films."
      footer={
        <p className="text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link className="font-medium text-[var(--color-accent)] transition hover:brightness-110" to="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-2">
          <label htmlFor="username" className={authLabelClass}>
            Username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-muted)]">
              @
            </span>
            <input
              id="username"
              required
              placeholder="yourhandle"
              className={`${authFieldClass} pl-9`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <p className="text-xs text-[var(--color-muted)]">Letters, numbers, underscore · min 3</p>
        </div>
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
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            className={authFieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        <button type="submit" disabled={submitting} className={authSubmitClass}>
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
