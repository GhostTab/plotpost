import { Star } from "@phosphor-icons/react";
import { useState } from "react";

const SCORES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

type StarRatingProps = {
  value: number | null;
  size?: number;
  className?: string;
  showValue?: boolean;
  emptyLabel?: string;
};

/** Read-only half-star display (0.5–5). */
export function StarRating({
  value,
  size = 18,
  className = "",
  showValue = false,
  emptyLabel = "Not rated yet",
}: StarRatingProps) {
  if (value == null) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[var(--color-muted)] ${className}`}>
        <span className="inline-flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={size} className="text-[var(--color-line)]" />
          ))}
        </span>
        {showValue ? <span className="text-sm">{emptyLabel}</span> : null}
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[var(--color-ink)] ${className}`}
      title={`${clamped.toFixed(1)} / 5`}
    >
      <span className="inline-flex gap-0.5" aria-label={`${clamped.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i));
          return <StarSlot key={i} fill={fill} size={size} />;
        })}
      </span>
      {showValue ? <span className="text-sm tabular-nums">{clamped.toFixed(1)}</span> : null}
    </span>
  );
}

function StarSlot({ fill, size }: { fill: number; size: number }) {
  if (fill >= 0.75) {
    return <Star size={size} weight="fill" className="text-[var(--color-accent)]" />;
  }
  if (fill >= 0.25) {
    return (
      <span className="relative inline-grid" style={{ width: size, height: size }}>
        <Star size={size} className="col-start-1 row-start-1 text-[var(--color-line)]" />
        <span className="col-start-1 row-start-1 overflow-hidden" style={{ width: "50%" }}>
          <Star size={size} weight="fill" className="text-[var(--color-accent)]" />
        </span>
      </span>
    );
  }
  return <Star size={size} className="text-[var(--color-line)]" />;
}

type RatingControlProps = {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
};

/** Interactive half-star rating control (0.5–5). */
export function RatingControl({ value, onChange, disabled }: RatingControlProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;

  function scoreAt(starIndex: number, half: boolean) {
    return SCORES[starIndex * 2 + (half ? 0 : 1)];
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id="rating-label">
        Your rating
      </p>
      <div
        className="inline-flex items-center gap-1"
        role="slider"
        aria-labelledby="rating-label"
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value != null ? `${value.toFixed(1)} out of 5` : "Not rated"}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 5 }).map((_, starIndex) => (
          <span key={starIndex} className="relative inline-flex">
            <button
              type="button"
              disabled={disabled}
              aria-label={`${scoreAt(starIndex, true)} stars`}
              className="absolute inset-y-0 left-0 z-10 w-1/2 disabled:cursor-not-allowed"
              onMouseEnter={() => setHover(scoreAt(starIndex, true))}
              onFocus={() => setHover(scoreAt(starIndex, true))}
              onClick={() => onChange(scoreAt(starIndex, true))}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${scoreAt(starIndex, false)} stars`}
              className="absolute inset-y-0 right-0 z-10 w-1/2 disabled:cursor-not-allowed"
              onMouseEnter={() => setHover(scoreAt(starIndex, false))}
              onFocus={() => setHover(scoreAt(starIndex, false))}
              onClick={() => onChange(scoreAt(starIndex, false))}
            />
            <StarSlot fill={Math.max(0, Math.min(1, display - starIndex))} size={28} />
          </span>
        ))}
        <span className="ml-2 text-sm tabular-nums text-[var(--color-muted)]">
          {value != null ? `${value.toFixed(1)} / 5` : "Tap a star"}
        </span>
      </div>
    </div>
  );
}
