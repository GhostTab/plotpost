export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--color-line)] px-6 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-[45ch] text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
    >
      {message}
    </p>
  );
}

export function PageHeading({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-4xl leading-[1.1] font-medium md:text-5xl">{title}</h1>
      {subtitle ? (
        <p className="mt-3 max-w-[65ch] text-base text-[var(--color-muted)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 transition focus:border-[var(--color-accent)] focus:outline-none";

export const primaryButtonClass =
  "rounded-[10px] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-zinc-950 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-[10px] border border-[var(--color-line)] px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-[0.98] disabled:opacity-60";
