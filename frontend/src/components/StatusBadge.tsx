import type { RecommendationStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";

const styles: Record<RecommendationStatus, string> = {
  PENDING: "border-[var(--color-line)] text-[var(--color-muted)]",
  SUCCESS: "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  UNSUCCESSFUL: "border-red-900/70 bg-red-950/40 text-red-300",
};

export function StatusBadge({ status }: { status: RecommendationStatus | string }) {
  const key = (["PENDING", "SUCCESS", "UNSUCCESSFUL"].includes(status)
    ? status
    : "PENDING") as RecommendationStatus;
  return (
    <span
      className={`inline-flex rounded-[10px] border px-2.5 py-1 text-xs font-semibold tracking-wide ${styles[key]}`}
      data-testid="status-badge"
      data-status={key}
    >
      {statusLabel(key)}
    </span>
  );
}
