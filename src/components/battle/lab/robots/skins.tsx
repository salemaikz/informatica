"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import type { SkinDef } from "../types";

// Скины «Роботов-Битов»: палитра + набор аксессуаров. Силуэты разные: капюшон, повязка с хвостами, купол-шлем,
// шлем-шишак с плащом, крылья и нимб. Все цвета внутри рисунка — свои hex (как в Mascot.tsx).

export const SKINS: readonly SkinDef[] = [
  { id: "bit", name: "Бит", rarity: "common" },
  { id: "hacker", name: "Хакер", rarity: "common" },
  { id: "ninja", name: "Ниндзя", rarity: "rare" },
  { id: "astro", name: "Космонавт", rarity: "rare" },
  { id: "batyr", name: "Батыр", rarity: "epic" },
  { id: "gold", name: "Золотой Бит", rarity: "legendary" },
];

export interface Palette {
  /** Градиент корпуса: [смещение, цвет]. */
  stops: readonly (readonly [number, string])[];
  hi: string;
  lo: string;
  limb: string;
  trim: string;
  visor: string;
  eye: string;
  glove: string;
  boot: string;
  /** Цвет контура. */
  ol: string;
  /** Цвет головы, если отличается от корпуса. */
  head?: string;
}

export const PALETTES: Record<string, Palette> = {
  bit: {
    stops: [[0, "#4db6f0"], [0.45, "#1a91d6"], [1, "#1277b3"]],
    hi: "#4db6f0", lo: "#1277b3", limb: "#1b86c6", trim: "#f0b400", visor: "#10263d", eye: "#7fe3ff",
    glove: "#ffcb2e", boot: "#f0b400", ol: "#0b2a45",
  },
  hacker: {
    stops: [[0, "#465066"], [0.5, "#2c3342"], [1, "#1b202b"]],
    hi: "#465066", lo: "#1b202b", limb: "#252b38", trim: "#39ff88", visor: "#031a0e", eye: "#39ff88",
    glove: "#2c3342", boot: "#39ff88", ol: "#080b10",
  },
  ninja: {
    stops: [[0, "#3d4152"], [0.5, "#272a36"], [1, "#16171f"]],
    hi: "#3d4152", lo: "#16171f", limb: "#1f212b", trim: "#e63950", visor: "#0a0a0f", eye: "#ff5a70",
    glove: "#e63950", boot: "#e63950", ol: "#06060a",
  },
  astro: {
    stops: [[0, "#ffffff"], [0.5, "#e8edf4"], [1, "#b7c2d3"]],
    hi: "#ffffff", lo: "#b7c2d3", limb: "#d3dbe7", trim: "#ff7a2f", visor: "#17264d", eye: "#7fe3ff",
    glove: "#ff7a2f", boot: "#ff7a2f", ol: "#33466b", head: "#e8edf4",
  },
  batyr: {
    stops: [[0, "#c5d0e2"], [0.5, "#8a98b3"], [1, "#58647f"]],
    hi: "#c5d0e2", lo: "#58647f", limb: "#3c5aa8", trim: "#f2c14e", visor: "#170f22", eye: "#ffd166",
    glove: "#f2c14e", boot: "#c8322c", ol: "#1b2140",
  },
  gold: {
    stops: [[0, "#fff6b8"], [0.28, "#ffd34d"], [0.62, "#e8a313"], [1, "#a96500"]],
    hi: "#fff6b8", lo: "#b87100", limb: "#e8a313", trim: "#fff2b0", visor: "#2a1805", eye: "#fffbe0",
    glove: "#fff2b0", boot: "#fff2b0", ol: "#6a3b00",
  },
};

/** Ось вращения в координатах робота (viewBox 168×240). */
export const piv = (x: number, y: number) => ({ transformBox: "view-box", originX: x / 168, originY: y / 240 }) as const;

export interface GearCtx {
  p: Palette;
  u: string;
  loop: boolean;
}

export interface Gear {
  /** Позади всего (плащ, крылья, рюкзак, аура). */
  back?: (c: GearCtx) => ReactNode;
  /** За головой (задняя часть капюшона, плюмаж, хвосты повязки). */
  headBack?: (c: GearCtx) => ReactNode;
  /** На корпусе (панель, броня, пояс). */
  torso?: (c: GearCtx) => ReactNode;
  /** Поверх головы и визора (шлем, повязка, купол, корона). */
  head?: (c: GearCtx) => ReactNode;
  /** Поверх рук (наплечники, искры). */
  front?: (c: GearCtx) => ReactNode;
  noAntenna?: boolean;
  /** Рисуем антенну сами. */
  torsoW?: number;
}

const SPARK = "M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8Z";

function Sparkle({ x, y, s = 1, color = "#fff6c8", delay = 0, loop }: { x: number; y: number; s?: number; color?: string; delay?: number; loop: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <m.path
        d={SPARK}
        fill={color}
        initial={{ scale: 0.4, opacity: 0.2 }}
        animate={loop ? { scale: [0.4, 1.15, 0.4], opacity: [0.15, 1, 0.15] } : { scale: 0.9, opacity: 0.9 }}
        transition={{ duration: 1.8, repeat: loop ? Infinity : 0, delay, ease: "easeInOut" }}
      />
    </g>
  );
}

/* ---------- Бит ---------- */
const bit: Gear = {
  torso: ({ p }) => (
    <g>
      <rect x="57" y="108" width="26" height="19" rx="6" fill={p.visor} stroke={p.ol} strokeWidth="2.5" />
      <circle cx="70" cy="117.5" r="7" fill={p.eye} opacity="0.3" />
      <circle cx="70" cy="117.5" r="4.6" fill={p.eye} />
      <rect x="48" y="131" width="44" height="8" rx="3" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
      <rect x="64" y="130" width="12" height="10" rx="2.5" fill="#fff" opacity="0.85" stroke={p.ol} strokeWidth="2" />
    </g>
  ),
};

/* ---------- Хакер ---------- */
const CODE_COLS = ["1 0 1 1", "0 1 0", "1 1 0 1", "0 0 1", "1 0 1"];
const hacker: Gear = {
  headBack: ({ p }) => (
    <path
      d="M16 62 C16 28 38 12 70 12 C102 12 124 28 124 62 L124 92 C124 100 118 104 110 104 L30 104 C22 104 16 100 16 92Z"
      fill={p.lo}
      stroke={p.ol}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  ),
  torso: ({ p }) => (
    <g>
      <path d="M52 124 L88 124 L92 142 L48 142Z" fill={p.hi} opacity="0.55" stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M70 102 V124" stroke={p.ol} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="48" y="138" width="44" height="6" rx="3" fill={p.lo} stroke={p.ol} strokeWidth="2.5" />
      <path d="M58 104 l-1 14 M82 104 l1 14" stroke={p.trim} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="57" cy="119" r="2.6" fill={p.trim} />
      <circle cx="83" cy="119" r="2.6" fill={p.trim} />
    </g>
  ),
  head: ({ p, u, loop }) => (
    <g>
      <clipPath id={`${u}vclip`}>
        <rect x="36" y="32" width="72" height="50" rx="17" />
      </clipPath>
      <g clipPath={`url(#${u}vclip)`} opacity="0.5">
        <m.g
          animate={loop ? { y: [0, 22] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        >
          {[0, 1].map((k) => (
            <g key={k} transform={`translate(0 ${k * -22})`}>
              {CODE_COLS.map((c, i) => (
                <text key={i} x={42 + i * 14} y="0" fontSize="8" fontFamily="monospace" fontWeight="700" fill={p.trim}>
                  {c.split(" ").map((d, j) => (
                    <tspan key={j} x={42 + i * 14} dy={j === 0 ? 38 : 8}>
                      {d}
                    </tspan>
                  ))}
                </text>
              ))}
            </g>
          ))}
        </m.g>
      </g>
      {/* Капюшон спереди: кольцо вокруг визора. */}
      <path
        fillRule="evenodd"
        d="M17 62 C17 30 38 12 70 12 C102 12 123 30 123 62 L123 90 C123 98 117 103 109 103 L31 103 C23 103 17 98 17 90Z M36 30 H104 A18 18 0 0 1 112 46 V66 A18 18 0 0 1 98 84 H42 A18 18 0 0 1 28 66 V46 A18 18 0 0 1 36 30Z"
        fill={p.limb}
        stroke={p.ol}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M30 26 C46 14 94 14 110 26" stroke="#fff" strokeOpacity="0.14" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Завязки капюшона. */}
      <path d="M62 100 q-3 10 -2 18 M78 100 q3 10 2 18" stroke={p.trim} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="119" r="2.8" fill={p.trim} stroke={p.ol} strokeWidth="1.5" />
      <circle cx="80" cy="119" r="2.8" fill={p.trim} stroke={p.ol} strokeWidth="1.5" />
    </g>
  ),
};

/* ---------- Ниндзя ---------- */
const ninja: Gear = {
  noAntenna: true,
  back: ({ p }) => (
    <g>
      {/* Катана за спиной. */}
      <path d="M52 140 L98 66" stroke={p.ol} strokeWidth="9" strokeLinecap="round" />
      <path d="M52 140 L98 66" stroke="#cfd6e6" strokeWidth="5" strokeLinecap="round" />
      <path d="M88 82 L100 62" stroke={p.ol} strokeWidth="11" strokeLinecap="round" />
      <path d="M90 78 L99 64" stroke={p.trim} strokeWidth="7" strokeLinecap="round" />
      <rect x="85" y="76" width="14" height="5" rx="2" fill="#f2c14e" stroke={p.ol} strokeWidth="2" transform="rotate(-57 92 78)" />
    </g>
  ),
  headBack: ({ p, loop }) => (
    <g>
      {/* Хвосты повязки развеваются. */}
      <m.g
        style={piv(26, 37)}
        animate={loop ? { rotate: [0, -9, 4, -6, 0] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M28 33 C14 30 2 36 -9 30 L-4 42 C6 44 16 40 28 41Z" fill={p.trim} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M28 38 C16 42 8 52 -3 55 L6 62 C14 56 22 50 29 45Z" fill={p.trim} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
      </m.g>
      {/* Шарф: длинный конец позади. */}
      <m.path
        d="M52 100 C34 104 22 118 6 118 L10 130 C28 130 44 118 60 112Z"
        fill={p.trim}
        stroke={p.ol}
        strokeWidth="2.5"
        strokeLinejoin="round"
        style={piv(56, 106)}
        animate={loop ? { rotate: [0, 5, -3, 0] } : undefined}
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  ),
  torso: ({ p }) => (
    <g>
      <path d="M48 112 L92 128" stroke={p.trim} strokeWidth="5" strokeLinecap="round" opacity="0.95" />
      <rect x="48" y="131" width="44" height="9" rx="3" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
      {/* Сюрикен на поясе. */}
      <g transform="translate(70 135.5)">
        <path d="M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4Z" fill="#cfd6e6" stroke={p.ol} strokeWidth="1.8" strokeLinejoin="round" />
        <circle r="1.8" fill={p.ol} />
      </g>
    </g>
  ),
  head: ({ p }) => (
    <g>
      {/* Нижняя часть лица закрыта маской. */}
      <path d="M26 66 H114 V76 C114 88 100 94 70 94 C40 94 26 88 26 76Z" fill={p.lo} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 74 q30 8 60 0" stroke="#fff" strokeOpacity="0.12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Повязка. */}
      <path d="M24 28 C50 22 90 22 116 28 L116 42 C90 36 50 36 24 42Z" fill={p.trim} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <rect x="58" y="26" width="26" height="14" rx="4" fill="#cfd6e6" stroke={p.ol} strokeWidth="2.5" />
      <path d="M71 29 L71 37 M65 33 H77" stroke={p.ol} strokeWidth="2.2" strokeLinecap="round" />
      {/* Узел-пучок вместо антенны. */}
      <circle cx="70" cy="15" r="8" fill={p.lo} stroke={p.ol} strokeWidth="3" />
      <circle cx="68" cy="13" r="2.4" fill="#fff" opacity="0.3" />
    </g>
  ),
};

/* ---------- Космонавт ---------- */
const astro: Gear = {
  noAntenna: true,
  back: ({ p }) => (
    <g>
      <rect x="22" y="96" width="32" height="54" rx="11" fill={p.lo} stroke={p.ol} strokeWidth="3" />
      <rect x="28" y="104" width="8" height="38" rx="4" fill={p.trim} stroke={p.ol} strokeWidth="2" />
      <rect x="40" y="104" width="8" height="38" rx="4" fill="#7fe3ff" stroke={p.ol} strokeWidth="2" />
      <path d="M30 96 V86 M44 96 V88" stroke={p.ol} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  torso: ({ p }) => (
    <g>
      <rect x="55" y="108" width="30" height="22" rx="6" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
      <circle cx="63" cy="116" r="2.8" fill="#39ff88" />
      <circle cx="72" cy="116" r="2.8" fill="#ffd166" />
      <circle cx="80" cy="116" r="2.8" fill="#ff5a70" />
      <rect x="59" y="122" width="22" height="4" rx="2" fill={p.ol} opacity="0.55" />
      {/* Нашивка с флагом Казахстана. */}
      <rect x="49" y="134" width="16" height="9" rx="2.5" fill="#00afca" stroke={p.ol} strokeWidth="1.8" />
      <circle cx="57" cy="138.5" r="2.4" fill="#fec50c" />
      <rect x="48" y="130" width="44" height="3.5" fill={p.ol} opacity="0.25" />
    </g>
  ),
  head: ({ p, u }) => (
    <g>
      {/* Кольцо шлема. */}
      <rect x="34" y="92" width="72" height="14" rx="7" fill={p.trim} stroke={p.ol} strokeWidth="3" />
      <path d="M44 99 H96" stroke="#fff" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      {/* Стеклянный купол. */}
      <circle cx="70" cy="56" r="55" fill={`url(#${u}dome)`} stroke={p.ol} strokeWidth="3.5" />
      <path d="M26 36 A50 50 0 0 1 56 12" stroke="#fff" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M33 47 A48 48 0 0 1 36 40" stroke="#fff" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M112 78 A50 50 0 0 1 100 94" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Антенна связи. */}
      <path d="M118 28 L128 10" stroke={p.ol} strokeWidth="6" strokeLinecap="round" />
      <path d="M118 28 L128 10" stroke={p.lo} strokeWidth="3" strokeLinecap="round" />
      <circle cx="129" cy="8" r="5" fill="#ff5a70" stroke={p.ol} strokeWidth="2.5" />
    </g>
  ),
};

/* ---------- Батыр ---------- */
const batyr: Gear = {
  noAntenna: true,
  back: ({ p, loop }) => (
    <m.g
      style={piv(70, 104)}
      animate={loop ? { rotate: [0, 2.4, 0, -1.4, 0] } : undefined}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M42 104 C26 130 20 160 10 186 C32 178 56 184 70 176 C86 184 108 178 130 186 C122 160 114 130 98 104Z" fill="#2aa7d8" stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 180 C32 172 56 178 70 170 C86 178 108 172 128 180" stroke={p.trim} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M48 112 C44 134 40 150 34 168" stroke="#fff" strokeOpacity="0.2" strokeWidth="5" fill="none" strokeLinecap="round" />
    </m.g>
  ),
  headBack: ({ p, loop }) => (
    <m.g
      style={piv(70, 14)}
      animate={loop ? { rotate: [0, -5, 2, 0] } : undefined}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Плюмаж из конского волоса. */}
      <path d="M70 6 C56 -4 34 0 22 14 C34 10 44 12 52 20 C42 20 34 26 30 36 C46 26 62 24 74 22Z" fill="#c8322c" stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M62 10 C50 8 40 12 32 20" stroke="#ff8a7e" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
    </m.g>
  ),
  torso: ({ p }) => (
    <g>
      <rect x="48" y="130" width="44" height="10" rx="3" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
      <circle cx="70" cy="135" r="7" fill="#c8322c" stroke={p.ol} strokeWidth="2.5" />
      <circle cx="70" cy="135" r="2.6" fill={p.trim} />
      {/* Орнамент «кошкар мүйіз» — два завитка рогов. */}
      <g stroke={p.trim} strokeWidth="3.2" fill="none" strokeLinecap="round">
        <path d="M70 124 C70 116 62 112 58 114 C54 116 55 121 59 120 C62 119 61 116 59 116" />
        <path d="M70 124 C70 116 78 112 82 114 C86 116 85 121 81 120 C78 119 79 116 81 116" />
      </g>
      <path d="M52 106 L88 106" stroke={p.trim} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    </g>
  ),
  head: ({ p, u }) => (
    <g>
      {/* Кольчужная бармица по бокам. */}
      <path d="M22 54 L36 54 L38 98 C30 100 24 94 22 86Z" fill={`url(#${u}mail)`} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M118 54 L104 54 L102 98 C110 100 116 94 118 86Z" fill={`url(#${u}mail)`} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Шлем-шишак. */}
      <path d="M22 52 C20 28 40 14 70 14 C100 14 120 28 118 52 L118 46 C96 38 44 38 22 46Z" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 42 C48 34 92 34 118 42 L118 52 C92 44 48 44 22 52Z" fill={p.trim} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      {/* Орнамент на ободе. */}
      <g fill={p.ol} opacity="0.75">
        {[34, 46, 58, 82, 94, 106].map((x) => (
          <path key={x} d={`M${x} 46 l4 -4 l4 4 l-4 4Z`} transform={`translate(0 ${Math.abs(x - 70) * 0.04})`} />
        ))}
      </g>
      <path d="M62 14 L70 -8 L78 14Z" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="14" r="6" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
      {/* Наносник. */}
      <path d="M70 46 V60" stroke={p.ol} strokeWidth="9" strokeLinecap="round" />
      <path d="M70 46 V60" stroke={p.trim} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  front: ({ p, u }) => (
    <g>
      {/* Наплечники с орнаментом. */}
      {[44, 96].map((x) => (
        <g key={x}>
          <circle cx={x} cy="110" r="13.5" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="3" />
          <circle cx={x} cy="110" r="8.6" fill="none" stroke={p.trim} strokeWidth="3" />
          <circle cx={x} cy="110" r="2.8" fill="#c8322c" />
        </g>
      ))}
    </g>
  ),
};

/* ---------- Золотой Бит ---------- */
const gold: Gear = {
  back: ({ p, u, loop }) => (
    <g>
      {/* Сияние и вращающиеся лучи. */}
      <circle cx="70" cy="100" r="96" fill={`url(#${u}aura)`} />
      <m.g
        style={piv(70, 100)}
        animate={loop ? { rotate: 360 } : undefined}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        opacity="0.5"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <path key={i} d="M70 100 L62 4 L78 4Z" fill={`url(#${u}ray)`} transform={`rotate(${i * 36} 70 100)`} />
        ))}
      </m.g>
      {/* Крылья света. */}
      {[1, -1].map((s) => (
        <m.g
          key={s}
          style={piv(70, 112)}
          animate={loop ? { rotate: [0, s * -4, 0] } : undefined}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <g transform={s === 1 ? undefined : "translate(140 0) scale(-1 1)"}>
            <path d="M96 106 C112 92 128 70 136 38 C138 62 134 88 112 110Z" fill={`url(#${u}wing)`} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M96 114 C116 104 134 88 142 66 C142 92 130 112 108 124Z" fill={`url(#${u}wing)`} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M94 124 C112 120 130 108 138 92 C136 116 124 134 104 138Z" fill={`url(#${u}wing)`} stroke={p.ol} strokeWidth="2.5" strokeLinejoin="round" />
          </g>
        </m.g>
      ))}
    </g>
  ),
  torso: ({ p }) => (
    <g>
      <rect x="57" y="107" width="26" height="22" rx="7" fill={p.visor} stroke={p.ol} strokeWidth="2.5" />
      <circle cx="70" cy="118" r="9.5" fill="#fffbe0" opacity="0.35" />
      <circle cx="70" cy="118" r="6.4" fill="#fffbe0" />
      <circle cx="70" cy="118" r="3.2" fill="#fff" />
      <path d="M52 106 L62 106 M78 106 L88 106 M52 126 L58 126 M82 126 L88 126" stroke={p.hi} strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      <rect x="48" y="131" width="44" height="8" rx="3" fill="#fff2b0" stroke={p.ol} strokeWidth="2.5" />
      <path d="M64 135 H76" stroke={p.ol} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  head: ({ p, u, loop }) => (
    <g>
      {/* Нимб над головой. */}
      <ellipse cx="70" cy="0" rx="30" ry="7.5" fill="none" stroke={p.ol} strokeWidth="8" opacity="0.8" />
      <ellipse cx="70" cy="0" rx="30" ry="7.5" fill="none" stroke="#ffe27a" strokeOpacity="0.4" strokeWidth="9" />
      <ellipse cx="70" cy="0" rx="30" ry="7.5" fill="none" stroke="#fff2b0" strokeWidth="4.5" />
      {/* Корона-гребень. */}
      <path d="M38 28 L44 10 L56 24 L70 4 L84 24 L96 10 L102 28Z" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="14" r="4.2" fill="#7fe3ff" stroke={p.ol} strokeWidth="2" />
      <circle cx="44" cy="12" r="2.6" fill="#fff" />
      <circle cx="96" cy="12" r="2.6" fill="#fff" />
      {/* Блик, пробегающий по металлу. */}
      <clipPath id={`${u}hclip`}>
        <rect x="26" y="22" width="88" height="72" rx="28" />
      </clipPath>
      <g clipPath={`url(#${u}hclip)`}>
        <m.rect
          x="-40"
          y="10"
          width="9"
          height="100"
          fill="#fff"
          opacity="0.4"
          transform="skewX(-20)"
          animate={loop ? { x: [-40, 160] } : { x: -40 }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
        />
      </g>
    </g>
  ),
  front: ({ p, u, loop }) => (
    <g>
      {/* Шипастые наплечники. */}
      {[1, -1].map((s) => (
        <g key={s} transform={s === 1 ? undefined : "translate(140 0) scale(-1 1)"}>
          <path d="M84 108 C94 98 106 98 112 104 L116 90 L102 112 C98 118 90 118 84 116Z" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="2.8" strokeLinejoin="round" />
        </g>
      ))}
      <Sparkle x={22} y={50} s={1.1} loop={loop} />
      <Sparkle x={122} y={84} s={0.9} delay={0.6} loop={loop} />
      <Sparkle x={106} y={22} s={0.8} delay={1.1} loop={loop} />
      <Sparkle x={34} y={128} s={0.8} delay={0.3} loop={loop} />
      <Sparkle x={116} y={152} s={0.7} delay={1.4} loop={loop} />
      <Sparkle x={70} y={-26} s={0.9} delay={0.9} color="#ffffff" loop={loop} />
    </g>
  ),
};

export const GEARS: Record<string, Gear> = { bit, hacker, ninja, astro, batyr, gold };
