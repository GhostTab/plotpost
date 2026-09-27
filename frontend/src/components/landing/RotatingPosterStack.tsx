import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { posterUrl } from "@/lib/api";
import type { MovieSummary } from "@/lib/types";

const INTERVAL_MS = 3500;

const SLOTS = [
  { x: "-28%", rotate: -9, scale: 0.9, z: 1 },
  { x: "0%", rotate: 0, scale: 1, z: 3 },
  { x: "28%", rotate: 9, scale: 0.92, z: 2 },
] as const;

function nextFresh(prev: number[], n: number): number {
  let candidate = (Math.max(...prev) + 1) % n;
  for (let i = 0; i < n; i += 1) {
    if (!prev.includes(candidate)) return candidate;
    candidate = (candidate + 1) % n;
  }
  return candidate;
}

type Props = {
  movies: MovieSummary[];
  revealed: boolean;
};

export function RotatingPosterStack({ movies, revealed }: Props) {
  const reduce = useReducedMotion();
  const pool = useMemo(
    () => movies.filter((m) => m.poster_path).slice(0, 12),
    [movies],
  );

  const [order, setOrder] = useState<number[]>([0, 1, 2]);

  useEffect(() => {
    if (pool.length === 0) return;
    const n = pool.length;
    setOrder([0, Math.min(1, n - 1), Math.min(2, n - 1)]);
  }, [pool.length]);

  useEffect(() => {
    if (reduce || !revealed || pool.length < 2) return;
    const id = window.setInterval(() => {
      setOrder((prev) => {
        const n = pool.length;
        return [prev[1] % n, prev[2] % n, nextFresh(prev, n)];
      });
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduce, revealed, pool.length]);

  if (pool.length === 0) {
    return <div className="absolute inset-8 animate-pulse rounded-[10px] bg-[var(--color-surface)]" />;
  }

  return (
    <div className="absolute inset-0" style={{ perspective: 900 }}>
      {order.map((poolIndex, slot) => {
        const movie = pool[poolIndex % pool.length];
        if (!movie) return null;
        return (
          <TiltPoster
            key={movie.id}
            movie={movie}
            slot={slot}
            revealed={revealed}
            reduce={Boolean(reduce)}
          />
        );
      })}
    </div>
  );
}

function TiltPoster({
  movie,
  slot,
  revealed,
  reduce,
}: {
  movie: MovieSummary;
  slot: number;
  revealed: boolean;
  reduce: boolean;
}) {
  const layout = SLOTS[slot];
  const src = posterUrl(movie.poster_path, "w780");
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const spring = { stiffness: 180, damping: 22, mass: 0.4 };
  const mx = useSpring(rawX, spring);
  const my = useSpring(rawY, spring);

  const rotateX = useTransform(my, [-0.5, 0.5], [12, -12]);
  const rotateY = useTransform(mx, [-0.5, 0.5], [-14, 14]);
  const glareX = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.28), transparent 55%)`;
  const lift = useTransform(my, [-0.5, 0.5], [-6, 6]);

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    rawX.set((event.clientX - rect.left) / rect.width - 0.5);
    rawY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 aspect-[2/3] w-[52%]"
      style={{ translateX: "-50%", translateY: "-50%", zIndex: layout.z }}
      initial={false}
      animate={
        revealed
          ? { opacity: 1, x: layout.x, rotate: layout.rotate, scale: layout.scale }
          : { opacity: 0, x: "0%", rotate: 0, scale: 0.9 }
      }
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 90, damping: 18, mass: 0.9 }
      }
    >
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative h-full w-full overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] will-change-transform"
        style={
          reduce
            ? undefined
            : {
                rotateX,
                rotateY,
                y: lift,
                transformStyle: "preserve-3d",
              }
        }
      >
        <Link
          to={`/movies/${movie.id}`}
          className="block h-full w-full"
          tabIndex={slot === 1 ? 0 : -1}
          aria-label={movie.title}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : null}
        </Link>
        {!reduce ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{ background: glare }}
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}
