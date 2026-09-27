import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

const FPS = 24;
const ROLL_SECONDS = 3.2;

function formatTimecode(frames: number) {
  const f = Math.floor(frames);
  const ff = f % FPS;
  const totalSeconds = Math.floor(f / FPS);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `00:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

const corners = [
  "top-0 left-0 border-t-2 border-l-2",
  "top-0 right-0 border-t-2 border-r-2",
  "bottom-0 left-0 border-b-2 border-l-2",
  "bottom-0 right-0 border-b-2 border-r-2",
];

const IRIS_MAX = "150vmax";
const irisTransition = { duration: 1.2, ease: [0.76, 0, 0.24, 1] as const };
const irisMask =
  "radial-gradient(circle at center, transparent var(--iris), black calc(var(--iris) + 1px))";

type Props = {
  backdrop: string | null;
  opening: boolean;
  onRolled: () => void;
  onOpened: () => void;
  onSkip: () => void;
};

export function CameraIntro({ backdrop, opening, onRolled, onOpened, onSkip }: Props) {
  const frames = useMotionValue(0);
  const timecode = useTransform(frames, formatTimecode);

  useEffect(() => {
    frames.set(0);
    const controls = animate(frames, ROLL_SECONDS * FPS, { duration: ROLL_SECONDS, ease: "linear" });
    const timer = window.setTimeout(onRolled, ROLL_SECONDS * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [frames, onRolled]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden bg-[#050506] text-[var(--color-ink)]"
      aria-hidden={opening}
      style={{ maskImage: irisMask, WebkitMaskImage: irisMask }}
      initial={{ "--iris": "0vmax" } as never}
      animate={{ "--iris": opening ? IRIS_MAX : "0vmax" } as never}
      transition={irisTransition}
      onAnimationComplete={() => {
        if (opening) onOpened();
      }}
    >
      {backdrop ? (
        <motion.img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.15, filter: "blur(18px)" }}
          animate={{ opacity: 0.28, scale: 1.02, filter: "blur(3px)" }}
          transition={{ duration: ROLL_SECONDS, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050506_85%)]" />

      <motion.div
        className="absolute inset-[6%] md:inset-[7%]"
        initial={{ opacity: 0, scale: 1.12 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {corners.map((pos) => (
          <span key={pos} className={`absolute h-10 w-10 border-[var(--color-ink)]/80 md:h-14 md:w-14 ${pos}`} />
        ))}

        <div className="absolute top-4 left-5 flex items-center gap-3 font-mono text-xs tracking-widest md:top-6 md:left-7">
          <motion.span
            className="h-2.5 w-2.5 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-red-400">REC</span>
          <motion.span className="text-[var(--color-ink)]/80">{timecode}</motion.span>
        </div>
        <div className="absolute top-4 right-5 font-mono text-xs tracking-widest text-[var(--color-ink)]/60 md:top-6 md:right-7">
          4K / 24 FPS
        </div>
        <div className="absolute bottom-4 left-5 font-mono text-xs tracking-widest text-[var(--color-ink)]/60 md:bottom-6 md:left-7">
          f/2.8 / ISO 800
        </div>
      </motion.div>

      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="relative flex flex-col items-center">
          <motion.span
            className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--color-ink)]/25 md:h-56 md:w-56"
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.h1
            className="relative pb-1 font-display text-5xl leading-[1.1] font-medium md:text-8xl"
            initial={{ opacity: 0, filter: "blur(16px)", letterSpacing: "0.35em" }}
            animate={{ opacity: 1, filter: "blur(0px)", letterSpacing: "0.04em" }}
            transition={{ delay: 0.5, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Plotpost
          </motion.h1>
          <motion.p
            className="relative mt-4 text-xs font-medium tracking-[0.3em] text-[var(--color-accent)] uppercase"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.6 }}
          >
            Picks with a verdict
          </motion.p>
        </div>
      </div>

      {opening ? (
        <span className="pointer-events-none absolute top-1/2 left-1/2 h-[300vmax] w-[300vmax] -translate-x-1/2 -translate-y-1/2">
          <motion.span
            className="block h-full w-full rounded-full border-[8px] border-[var(--color-accent)]"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 0.2 }}
            transition={irisTransition}
          />
        </span>
      ) : null}

      <button
        type="button"
        onClick={onSkip}
        className="absolute right-[calc(6%+1.25rem)] bottom-[calc(6%+0.75rem)] z-10 rounded-[10px] border border-[var(--color-line)] bg-[#050506]/70 px-3 py-1.5 font-mono text-xs tracking-widest text-[var(--color-ink)]/80 transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] md:right-[calc(7%+1.75rem)] md:bottom-[calc(7%+1.25rem)]"
      >
        SKIP INTRO
      </button>
    </motion.div>
  );
}
