"use client";

import clsx from "clsx";
import { m, type Variants } from "motion/react";
import { useId, type CSSProperties, type ReactNode } from "react";

// Маскот «Бит» — нарисован вручную в SVG (без внешних картинок, лёгкий, масштабируется).
// Живой: тело мягко «дышит», антенна покачивается, глаза моргают (CSS, без JS),
// а при смене настроения — реакция пружиной (прыжок радости, поникший вид).

export type Mood = "happy" | "neutral" | "thinking" | "sad" | "celebrate";

const EYE = "#7fe3ff";

function Eyes({ mood, blinkStyle }: { mood: Mood; blinkStyle: CSSProperties }) {
  switch (mood) {
    case "happy":
    case "celebrate":
      return (
        <g stroke={EYE} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M39 64 q7 -9 14 0" />
          <path d="M67 64 q7 -9 14 0" />
        </g>
      );
    case "thinking":
      return (
        <g fill={EYE}>
          <g className="mascot-eyes" style={blinkStyle}>
            <circle cx="46" cy="62" r="5" />
          </g>
          <rect x="68" y="60" width="13" height="4.5" rx="2.2" />
        </g>
      );
    case "sad":
      return (
        <g fill={EYE}>
          <g className="mascot-eyes" style={blinkStyle}>
            <circle cx="46" cy="64" r="4.5" />
            <circle cx="74" cy="64" r="4.5" />
          </g>
          <path d="M38 55 l12 4" stroke={EYE} strokeWidth="3" strokeLinecap="round" />
          <path d="M82 55 l-12 4" stroke={EYE} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g fill={EYE} className="mascot-eyes" style={blinkStyle}>
          <circle cx="46" cy="62" r="5.5" />
          <circle cx="74" cy="62" r="5.5" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  const common = { stroke: EYE, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  if (mood === "sad") return <path d="M50 80 q10 -7 20 0" {...common} />;
  if (mood === "thinking") return <path d="M52 78 h14" {...common} />;
  if (mood === "celebrate") return <path d="M48 74 q12 14 24 0 z" fill={EYE} />;
  return <path d="M50 75 q10 9 20 0" {...common} />;
}

/** Реакция на настроение: стартует при показе и при каждой смене `mood`. */
const REACT: Variants = {
  neutral: { y: 0, rotate: 0, scale: 1, scaleY: 1 },
  happy: { y: [0, -9, 0, -3, 0], rotate: 0, scale: 1, scaleY: 1, transition: { duration: 0.5, ease: "easeOut" } },
  celebrate: { y: [0, -16, 0, -9, 0, -3, 0], rotate: [0, -7, 7, -4, 0], scale: [1, 1.1, 1], scaleY: 1, transition: { duration: 0.9, ease: "easeOut" } },
  thinking: { y: 0, rotate: 5, scale: 1, scaleY: 1, transition: { type: "spring", stiffness: 220, damping: 14 } },
  sad: { y: 2, rotate: -3, scale: 1, scaleY: 0.96, transition: { type: "spring", stiffness: 160, damping: 16 } },
};

export function Mascot({ mood = "neutral", size = 96, className }: { mood?: Mood; size?: number; className?: string }) {
  // У каждого маскота своя фаза моргания — на экране они не моргают хором.
  const id = useId();
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  const blinkStyle: CSSProperties = { animationDelay: `-${((h % 45) / 10).toFixed(1)}s` };

  return (
    <m.svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={clsx("overflow-visible", className)}
      style={{ transformOrigin: "50% 90%" }}
      role="img"
      aria-label="Бит"
      initial={{ y: 0, rotate: 0, scale: 1, scaleY: 1 }}
      animate={mood}
      variants={REACT}
    >
      <g className="mascot-body" style={blinkStyle}>
        <g className="mascot-antenna">
          <line x1="60" y1="14" x2="60" y2="27" stroke="#1277b3" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="11" r="6.5" fill={mood === "sad" ? "#9aa6b8" : "#f0b400"} />
        </g>
        <rect x="9" y="54" width="12" height="24" rx="6" fill="#1277b3" />
        <rect x="99" y="54" width="12" height="24" rx="6" fill="#1277b3" />
        <rect x="17" y="26" width="86" height="78" rx="28" fill="#1a91d6" />
        <rect x="25" y="30" width="70" height="16" rx="8" fill="#fff" opacity="0.18" />
        <rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />
        <Eyes mood={mood} blinkStyle={blinkStyle} />
        <Mouth mood={mood} />
        <circle cx="35" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
        <circle cx="85" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
      </g>
    </m.svg>
  );
}

/** Маскот с репликой. */
export function MascotSays({ mood, children, size = 72 }: { mood?: Mood; children: ReactNode; size?: number }) {
  return (
    <div className="flex items-end gap-3">
      <Mascot mood={mood} size={size} className="shrink-0" />
      <div className="relative mb-3 rounded-2xl border-2 border-border bg-surface px-4 py-3 text-[15px] font-semibold leading-snug animate-fade-in">
        <span className="absolute -left-[9px] bottom-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-border bg-surface" />
        <span className="relative">{children}</span>
      </div>
    </div>
  );
}
