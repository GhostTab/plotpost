import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const ease = [0.16, 1, 0.3, 1] as const;

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--color-paper)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(226,168,85,0.16),transparent_45%),radial-gradient(ellipse_at_80%_100%,rgba(201,131,46,0.1),transparent_40%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-4 pt-6">
        <Link
          to="/"
          className="font-display bg-gradient-to-r from-[#f3c97a] to-[#c9832e] bg-clip-text text-xl font-semibold tracking-tight text-transparent"
        >
          Plotpost
        </Link>
        <Link
          to="/"
          className="text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
        >
          Back
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
        >
          <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--color-accent)] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-[var(--color-muted)]">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease }}
        >
          {children}
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.18 }}
        >
          {footer}
        </motion.div>
      </main>
    </div>
  );
}

export const authFieldClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-surface)_80%,transparent)] px-4 py-3 text-[15px] transition placeholder:text-[#5c5c66] hover:border-[color-mix(in_oklab,var(--color-accent)_35%,var(--color-line))] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:outline-none";

export const authLabelClass = "text-xs font-medium tracking-[0.08em] text-[var(--color-muted)] uppercase";

export const authSubmitClass =
  "w-full rounded-xl bg-[var(--color-accent)] px-4 py-3.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60";
