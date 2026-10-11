"use client";

import { m } from "motion/react";
import { useId, type ReactNode } from "react";

// Корабли «Космобоя». Все нарисованы в рамке 120×140, нос смотрит вверх, двигатели внизу (y≈116–140).
// Единый контур, 3 тона металла, огни двигателей. Соперник — тот же рисунок, повёрнутый на 180°.

export const SHIP_W = 120;
export const SHIP_H = 140;
const OUT = "#0a1226";
const SW = 2.4;

interface Pal {
  hi: string;
  base: string;
  shade: string;
  acc: string;
  acc2: string;
  glow: string;
  cock: string;
}

const PAL: Record<string, Pal> = {
  shuttle: { hi: "#f4f8ff", base: "#aebfe0", shade: "#5f7099", acc: "#ff6b57", acc2: "#ffd1c9", glow: "#59c8ff", cock: "#37b6ff" },
  scout: { hi: "#eafff6", base: "#7fd9b6", shade: "#2f8f78", acc: "#ffd447", acc2: "#fff3b5", glow: "#7dffcf", cock: "#5ee7ff" },
  interceptor: { hi: "#ffe3d6", base: "#e0503f", shade: "#7d1f2e", acc: "#ffb02e", acc2: "#ffe08a", glow: "#ff8a3c", cock: "#ffd25e" },
  barys: { hi: "#f6fbff", base: "#a9bdd6", shade: "#51628a", acc: "#2b3350", acc2: "#f4a3b8", glow: "#7ae7ff", cock: "#5ef0ff" },
  cruiser: { hi: "#d9d2ff", base: "#7b6bd6", shade: "#322a6e", acc: "#ffcf4a", acc2: "#fff0b0", glow: "#c08bff", cock: "#9ee8ff" },
  tulpar: { hi: "#ffffff", base: "#fff3cf", shade: "#d9a53b", acc: "#ffbf2e", acc2: "#fff8dd", glow: "#7be9ff", cock: "#58ecff" },
};

/** Рисунок рассчитан на объект с размерами SHIP_W × SHIP_H; stalled — двигатели «глохнут» (оглушение). */
export function Ship({ skin, stalled = false }: { skin: string; stalled?: boolean }) {
  const p = (useId() || "s").replace(/[^a-zA-Z0-9]/g, "");
  const pal = PAL[skin] ?? PAL.shuttle;
  const ctx: Ctx = { p, pal, stalled, g: (n) => `url(#${p}${n})` };
  return (
    <g strokeLinejoin="round" strokeLinecap="round" strokeWidth={SW} stroke={OUT}>
      <defs>
        <Metal id={`${p}h`} {...pal} />
        <Metal id={`${p}w`} {...pal} shadeFirst />
        <linearGradient id={`${p}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.hi} />
          <stop offset="0.5" stopColor={pal.base} />
          <stop offset="1" stopColor={pal.shade} />
        </linearGradient>
        <linearGradient id={`${p}c`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={pal.cock} />
          <stop offset="1" stopColor="#12306e" />
        </linearGradient>
      </defs>
      {skin === "scout" ? <Scout {...ctx} /> : skin === "interceptor" ? <Interceptor {...ctx} /> : skin === "barys" ? <Barys {...ctx} /> : skin === "cruiser" ? <Cruiser {...ctx} /> : skin === "tulpar" ? <Tulpar {...ctx} /> : <Shuttle {...ctx} />}
    </g>
  );
}

interface Ctx {
  p: string;
  pal: Pal;
  stalled: boolean;
  g: (n: string) => string;
}

function Metal({ id, hi, base, shade, shadeFirst }: Pal & { id: string; shadeFirst?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={shadeFirst ? base : shade} />
      <stop offset="0.3" stopColor={hi} />
      <stop offset="0.6" stopColor={base} />
      <stop offset="1" stopColor={shade} />
    </linearGradient>
  );
}

/** Зеркало: рисует детей и их отражение относительно оси x=60. */
function Sym({ children }: { children: ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="matrix(-1 0 0 1 120 0)">{children}</g>
    </>
  );
}

/** Огонь двигателя: ядро + оболочка, мерцает; при stalled — рвано гаснет. */
function Flame({ x, y, w = 12, h = 26, glow, stalled, id }: { x: number; y: number; w?: number; h?: number; glow: string; stalled: boolean; id: string }) {
  const anim = stalled
    ? { scaleY: [1, 0.25, 0.9, 0.1, 0.6, 0.2, 1], opacity: [1, 0.05, 0.8, 0, 0.6, 0.1, 1] }
    : { scaleY: [1, 1.28, 0.86, 1.18, 1], opacity: [0.95, 1, 0.88, 1, 0.95] };
  return (
    <g transform={`translate(${x} ${y})`} stroke="none">
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={w * 1.3} cy={2} fill={`url(#${id})`} />
      <m.g style={{ originX: 0.5, originY: 0 }} animate={anim} transition={{ duration: stalled ? 0.5 : 0.38, repeat: Infinity, ease: "easeInOut" }}>
        <path d={`M${-w / 2} 0 Q${-w / 2} ${h * 0.55} 0 ${h} Q${w / 2} ${h * 0.55} ${w / 2} 0 Z`} fill={glow} opacity="0.9" />
        <path d={`M${-w / 4} 0 Q${-w / 4} ${h * 0.4} 0 ${h * 0.68} Q${w / 4} ${h * 0.4} ${w / 4} 0 Z`} fill="#ffffff" />
      </m.g>
    </g>
  );
}

function Nozzle({ x, y, w = 14, color }: { x: number; y: number; w?: number; color: string }) {
  return <path d={`M${x - w / 2} ${y} h${w} l-2 7 h${-(w - 4)} z`} fill={color} />;
}

/** Блик на фонаре кабины. */
function Canopy({ d, g }: { d: string; g: (n: string) => string }) {
  return (
    <>
      <path d={d} fill={g("c")} />
    </>
  );
}

/* ---------------- Шаттл ---------------- */
function Shuttle({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <Flame x={60} y={118} w={16} h={28} glow={pal.glow} stalled={stalled} id={`${p}f1`} />
      <Flame x={34} y={110} w={8} h={16} glow={pal.glow} stalled={stalled} id={`${p}f2`} />
      <Flame x={86} y={110} w={8} h={16} glow={pal.glow} stalled={stalled} id={`${p}f3`} />
      <Sym>
        <path d="M49 64 L13 101 Q6 109 14 113 L49 108 Z" fill={g("w")} />
        <path d="M13 101 Q6 109 14 113 L25 112 L22 99 Z" fill={pal.acc} />
        <path d="M49 74 L24 100" stroke={pal.shade} strokeWidth="1.4" fill="none" />
        <rect x="29" y="100" width="10" height="12" rx="3" fill={pal.shade} />
      </Sym>
      <Nozzle x={60} y={114} w={20} color={pal.shade} />
      <path d="M60 5 C72 22 79 52 79 86 L79 112 Q79 117 74 117 L46 117 Q41 117 41 112 L41 86 C41 52 48 22 60 5 Z" fill={g("h")} />
      <path d="M52 31 Q60 20 68 31 L66 38 Q60 31 54 38 Z" fill={pal.acc} />
      <path d="M60 66 V112" stroke={pal.shade} strokeWidth="1.3" fill="none" opacity="0.6" />
      <Sym>
        <rect x="45" y="84" width="9" height="3.2" rx="1.6" fill={pal.shade} stroke="none" />
        <rect x="45" y="92" width="9" height="3.2" rx="1.6" fill={pal.acc} stroke="none" />
      </Sym>
      <Canopy d="M60 38 C69 46 69 62 60 72 C51 62 51 46 60 38 Z" g={g} />
      <path d="M56 47 Q58 43 61 44 Q56 52 56 60 Z" fill="#fff" opacity="0.7" stroke="none" />
    </>
  );
}

/* ---------------- Разведчик ---------------- */
function Scout({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <Flame x={60} y={112} w={11} h={30} glow={pal.glow} stalled={stalled} id={`${p}f1`} />
      <Flame x={17} y={108} w={9} h={22} glow={pal.glow} stalled={stalled} id={`${p}f2`} />
      <Flame x={103} y={108} w={9} h={22} glow={pal.glow} stalled={stalled} id={`${p}f3`} />
      <Sym>
        {/* стреловидное крыло с гондолой на конце */}
        <path d="M53 62 L21 88 L21 100 L53 92 Z" fill={g("w")} />
        <path d="M21 88 L21 100 L30 98 L30 85 Z" fill={pal.acc} />
        <rect x="11" y="78" width="12" height="30" rx="6" fill={g("h")} />
        <rect x="13" y="84" width="8" height="5" rx="2.5" fill={pal.cock} stroke="none" />
        {/* антенна-штырь */}
        <path d="M54 30 L40 12" fill="none" />
        <circle cx="40" cy="11" r="2.6" fill={pal.acc} />
      </Sym>
      <path d="M60 3 C66 14 70 34 70 62 L70 108 Q70 112 66 112 L54 112 Q50 112 50 108 L50 62 C50 34 54 14 60 3 Z" fill={g("h")} />
      <path d="M60 3 C62.5 8 64 12 65 18 L55 18 C56 12 57.5 8 60 3 Z" fill={pal.acc} />
      {/* радар */}
      <path d="M66 70 L82 62" fill="none" />
      <ellipse cx="86" cy="60" rx="10" ry="5.5" transform="rotate(-24 86 60)" fill={g("v")} />
      <ellipse cx="86" cy="60" rx="4" ry="2.2" transform="rotate(-24 86 60)" fill={pal.acc} stroke="none" />
      <Canopy d="M60 24 C67 34 67 54 60 64 C53 54 53 34 60 24 Z" g={g} />
      <path d="M56 33 Q58 29 60.5 30 Q56 40 56 48 Z" fill="#fff" opacity="0.75" stroke="none" />
      <path d="M53 78 H67 M53 86 H67 M53 94 H67" stroke={pal.shade} strokeWidth="1.4" fill="none" />
    </>
  );
}

/* ---------------- Перехватчик ---------------- */
function Interceptor({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <Flame x={44} y={116} w={13} h={34} glow={pal.glow} stalled={stalled} id={`${p}f1`} />
      <Flame x={76} y={116} w={13} h={34} glow={pal.glow} stalled={stalled} id={`${p}f2`} />
      <Sym>
        {/* вертикальные стабилизаторы */}
        <path d="M100 96 L112 66 L116 112 L104 116 Z" fill={g("w")} />
        <path d="M112 66 L116 112 L110 112 L108 80 Z" fill={pal.acc} />
        {/* дельта-крыло */}
        <path d="M54 22 L6 120 L26 114 L52 98 Z" fill={g("w")} />
        <path d="M26 114 L6 120 L20 92 L32 100 Z" fill={pal.shade} />
        <path d="M34 90 L20 116" stroke={pal.acc} strokeWidth="3" fill="none" />
        <path d="M44 62 L26 100" stroke={pal.acc2} strokeWidth="1.6" fill="none" opacity="0.8" />
        {/* пушки */}
        <rect x="14" y="62" width="5.4" height="26" rx="2.7" fill={pal.shade} />
        <circle cx="16.7" cy="61" r="2.6" fill={pal.glow} />
      </Sym>
      <Nozzle x={44} y={112} w={16} color={pal.shade} />
      <Nozzle x={76} y={112} w={16} color={pal.shade} />
      <path d="M60 4 C70 22 74 46 74 76 L78 112 Q78 118 72 118 L48 118 Q42 118 42 112 L46 76 C46 46 50 22 60 4 Z" fill={g("h")} />
      <path d="M60 4 C64 12 66 20 66 28 L54 28 C54 20 56 12 60 4 Z" fill={pal.acc} />
      <path d="M60 28 V114" stroke={pal.shade} strokeWidth="1.5" fill="none" opacity="0.55" />
      <Canopy d="M60 40 C68 50 68 66 60 80 C52 66 52 50 60 40 Z" g={g} />
      <path d="M56 50 Q58 45 61 46 Q56 56 56 66 Z" fill="#fff" opacity="0.75" stroke="none" />
      <Sym>
        <path d="M47 92 L55 100 L55 108 L47 104 Z" fill={pal.acc} />
      </Sym>
    </>
  );
}

/* ---------------- Звёздный барыс ---------------- */
function Barys({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <Flame x={51} y={114} w={10} h={26} glow={pal.glow} stalled={stalled} id={`${p}f1`} />
      <Flame x={69} y={114} w={10} h={26} glow={pal.glow} stalled={stalled} id={`${p}f2`} />
      {/* хвост с кольцами */}
      <path d="M72 108 C108 124 120 90 104 62 C110 88 98 104 74 98 Z" fill={g("v")} />
      <path d="M95 110 L99 97 M105 96 L108 84 M107 80 L109 69" stroke={pal.acc} strokeWidth="3.2" fill="none" />
      <path d="M104 62 C108 68 110 74 109 82 C107 76 105 70 104 62 Z" fill="#fff" />
      <Sym>
        {/* лапы-крылья с когтями */}
        <path d="M45 62 L11 90 L16 93 L5 106 L12 107 L8 119 L26 108 L46 96 Z" fill={g("w")} />
        <path d="M11 90 L16 93 L5 106 L12 107 L8 119 L14 112 L9 104 L18 92 Z" fill="#fff" stroke="none" opacity="0.9" />
        <ellipse cx="30" cy="92" rx="2.4" ry="3.6" fill={pal.acc} stroke="none" transform="rotate(35 30 92)" />
        <ellipse cx="24" cy="102" rx="2" ry="3" fill={pal.acc} stroke="none" transform="rotate(35 24 102)" />
      </Sym>
      {/* тело */}
      <path d="M45 54 L75 54 L79 82 L77 115 Q77 118 73 118 L47 118 Q43 118 43 115 L41 82 Z" fill={g("h")} />
      <path d="M48 70 L60 79 L72 70 M48 84 L60 93 L72 84" stroke={pal.shade} strokeWidth="2" fill="none" />
      <circle cx="52" cy="104" r="2.6" fill={pal.acc} stroke="none" />
      <circle cx="66" cy="100" r="2.2" fill={pal.acc} stroke="none" />
      <circle cx="60" cy="110" r="2" fill={pal.acc} stroke="none" />
      {/* голова-нос */}
      <Sym>
        <path d="M41 28 L33 2 L57 11 Z" fill={g("h")} />
        <path d="M42 22 L38 9 L50 14 Z" fill={pal.acc2} stroke="none" />
      </Sym>
      <path d="M60 5 C68 5 74 12 76 22 L91 31 L81 42 L85 55 L70 52 Q60 58 50 52 L35 55 L39 42 L29 31 L44 22 C46 12 52 5 60 5 Z" fill={g("h")} />
      <path d="M60 8 V19 M54 10 L56 19 M66 10 L64 19" stroke={pal.acc} strokeWidth="2.6" fill="none" />
      <Sym>
        <circle cx="41" cy="44" r="2.4" fill={pal.acc} stroke="none" />
        <circle cx="46" cy="49" r="1.8" fill={pal.acc} stroke="none" />
        <circle cx="37" cy="38" r="1.8" fill={pal.acc} stroke="none" />
        <path d="M42 46 L25 42 M42 50 L24 53" stroke="#ffffff" strokeWidth="1.4" fill="none" opacity="0.9" />
        {/* глаз */}
        <path d="M43 29 L57 34 L54 41 Q46 42 42 35 Z" fill={pal.cock} />
        <path d="M43 29 L57 34 L54 41 Q46 42 42 35 Z" fill="#fff" opacity="0.25" stroke="none" />
        <path d="M51 33 V40" stroke={pal.acc} strokeWidth="2.6" fill="none" />
      </Sym>
      <path d="M54 45 H66 L60 53 Z" fill="#e8708f" />
      <path d="M60 53 V56 M53 57 Q60 61 67 57" stroke={OUT} strokeWidth="1.8" fill="none" />
    </>
  );
}

/* ---------------- Крейсер ---------------- */
function Cruiser({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <Flame x={42} y={118} w={15} h={34} glow={pal.glow} stalled={stalled} id={`${p}f1`} />
      <Flame x={60} y={118} w={16} h={42} glow={pal.glow} stalled={stalled} id={`${p}f2`} />
      <Flame x={78} y={118} w={15} h={34} glow={pal.glow} stalled={stalled} id={`${p}f3`} />
      <Sym>
        {/* боковые бронепонтоны */}
        <path d="M30 44 L12 58 L8 100 L16 120 L32 118 L32 62 Z" fill={g("w")} />
        <path d="M12 58 L8 100 L16 120 L20 118 L15 100 L18 60 Z" fill={pal.shade} stroke="none" opacity="0.7" />
        <path d="M10 76 H30 M10 92 H30" stroke={pal.acc} strokeWidth="2.4" fill="none" />
        {/* башня с двумя стволами */}
        <rect x="19" y="38" width="3.4" height="26" rx="1.7" fill={pal.shade} />
        <rect x="24.5" y="38" width="3.4" height="26" rx="1.7" fill={pal.shade} />
        <circle cx="23.5" cy="66" r="8" fill={g("v")} />
        <circle cx="23.5" cy="66" r="3.4" fill={pal.glow} stroke="none" />
      </Sym>
      <Nozzle x={42} y={114} w={18} color={pal.shade} />
      <Nozzle x={60} y={114} w={18} color={pal.shade} />
      <Nozzle x={78} y={114} w={18} color={pal.shade} />
      <path d="M60 4 L76 14 L88 38 L94 70 L90 114 Q90 118 86 118 L34 118 Q30 118 30 114 L26 70 L32 38 L44 14 Z" fill={g("h")} />
      {/* золотая окантовка и палуба */}
      <path d="M60 4 L76 14 L88 38 L94 70" fill="none" stroke={pal.acc} strokeWidth="2" opacity="0.9" />
      <path d="M60 4 L44 14 L32 38 L26 70" fill="none" stroke={pal.acc} strokeWidth="2" opacity="0.9" />
      <path d="M46 40 H74 L80 60 H40 Z" fill={g("v")} />
      <path d="M40 60 H80 L82 96 H38 Z" fill={pal.shade} opacity="0.55" stroke="none" />
      <path d="M60 14 V40 M60 60 V114" stroke={pal.acc} strokeWidth="2" fill="none" />
      {/* мостик */}
      <path d="M48 62 L72 62 L68 80 L52 80 Z" fill={g("c")} />
      <path d="M52 66 H68 M52 72 H68" stroke="#fff" strokeWidth="1.2" opacity="0.7" fill="none" />
      <circle cx="60" cy="24" r="6.4" fill={pal.glow} />
      <circle cx="60" cy="24" r="2.6" fill="#fff" stroke="none" />
      <Sym>
        <circle cx="45" cy="104" r="2.2" fill={pal.acc} stroke="none" />
        <circle cx="37" cy="86" r="1.8" fill={pal.glow} stroke="none" />
        <path d="M37 98 H50 M37 104 H46" stroke={pal.acc2} strokeWidth="1.4" fill="none" opacity="0.8" />
      </Sym>
    </>
  );
}

/* ---------------- Тұлпар ---------------- */
const SPARKS: [number, number, number, number][] = [
  [10, 14, 5, 0],
  [108, 26, 4, 0.6],
  [6, 98, 3.4, 1.1],
  [112, 92, 4.4, 0.3],
  [60, -6, 3.6, 0.9],
];

function Tulpar({ pal, g, stalled, p }: Ctx) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}a`}>
          <stop offset="0" stopColor="#ffe9a0" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#ffc44a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffc44a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset="0.5" stopColor="#ffc93a" />
          <stop offset="1" stopColor="#c2831a" />
        </linearGradient>
        <linearGradient id={`${p}i`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#bdeeff" />
          <stop offset="1" stopColor="#6fc4ee" />
        </linearGradient>
        <linearGradient id={`${p}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.5" stopColor="#ffa930" />
          <stop offset="1" stopColor="#ff6a2a" />
        </linearGradient>
      </defs>
      <m.ellipse cx="60" cy="68" rx="92" ry="92" fill={`url(#${p}a)`} stroke="none" animate={{ opacity: [0.7, 1, 0.7], scale: [0.96, 1.04, 0.96] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ originX: 0.5, originY: 0.5 }} />
      {/* хвост: потоки света */}
      {[
        { d: "M56 116 C42 124 54 134 38 146", c: "#7be9ff" },
        { d: "M64 116 C78 124 66 134 82 146", c: "#7be9ff" },
        { d: "M60 116 C52 128 68 136 60 150", c: "#ffd45c" },
      ].map((t, i) => (
        <m.path key={i} d={t.d} fill="none" stroke={t.c} strokeWidth={i === 2 ? 4.6 : 3.4} animate={{ pathLength: stalled ? [1, 0.2, 0.8, 0.1, 1] : [1, 0.8, 1] }} transition={{ duration: stalled ? 0.5 : 1 + i * 0.25, repeat: Infinity }} />
      ))}
      <Flame x={60} y={114} w={12} h={22} glow="#ffd45c" stalled={stalled} id={`${p}f1`} />
      {/* крылья: сильный взмах вверх, перья по заднему краю */}
      <Sym>
        <path d="M50 68 C38 48 20 28 3 8 C-3 20 -4 34 0 44 C-4 52 -2 62 3 68 C0 76 4 86 10 90 C9 98 15 106 23 109 C31 112 41 108 49 98 Z" fill={`url(#${p}i)`} />
        <path d="M50 68 C40 54 26 38 11 24 C13 40 16 54 21 66 C23 76 29 88 37 94 L49 90 Z" fill={`url(#${p}g)`} />
        <path d="M50 70 C42 60 32 48 22 38 C24 52 28 64 34 74 L49 84 Z" fill="#fff" />
        <path d="M50 70 L2 44 M50 72 L4 68 M50 76 L11 90 M50 82 L24 108" stroke="#5aa9d6" strokeWidth="1.3" fill="none" />
      </Sym>
      {/* корпус-шея */}
      <path d="M49 50 L71 50 L76 96 L68 118 Q60 124 52 118 L44 96 Z" fill={g("h")} />
      <path d="M48 82 L72 82 L70 96 L50 96 Z" fill={`url(#${p}g)`} />
      <circle cx="60" cy="89" r="3.4" fill={pal.cock} />
      <path d="M54 104 H66 M55 111 H65" stroke="#c2831a" strokeWidth="1.6" fill="none" />
      {/* грива: языки пламени от загривка */}
      {[
        "M50 30 C40 32 32 40 28 54 C36 48 44 46 51 46 Z",
        "M51 44 C40 48 32 58 29 74 C37 66 46 64 53 62 Z",
        "M52 58 C44 62 37 72 37 86 C43 78 49 76 55 75 Z",
      ].map((d, i) => (
        <m.path key={i} d={d} fill={`url(#${p}m)`} strokeWidth="1.8" animate={{ skewY: [0, 5, -3, 0], opacity: [1, 0.88, 1] }} transition={{ duration: 1.3 + i * 0.2, repeat: Infinity, ease: "easeInOut" }} style={{ originX: 1, originY: 0 }} />
      ))}
      <path d="M46 61 Q60 70 74 61 L72 69 Q60 77 48 69 Z" fill={`url(#${p}g)`} />
      {/* голова коня в профиль, мордой вверх (чуть повёрнута) */}
      <g transform="rotate(-9 60 52)">
        <path d="M51 38 C45 26 43 14 36 8 C46 8 53 16 56 26 Z" fill={`url(#${p}m)`} />
        <path d="M51 40 L43 8 L60 28 Z" fill={g("h")} />
        <path d="M50.6 35 L45.5 15 L56.6 28 Z" fill="#ffc93a" stroke="none" />
        <path d="M54 0 Q60 -2 66 2 Q69 8 67 14 Q66 20 71 24 Q80 30 76 41 Q73 48 66 52 L66 60 L48 60 L50 46 Q47 38 50 32 Q54 26 53.5 18 Q52 11 53 6 Q52 2 54 0 Z" fill={g("h")} />
        <path d="M53.6 10 Q60 13.5 66.6 11" stroke="#c2831a" strokeWidth="2.8" fill="none" />
        <path d="M57 20 Q66 25 74 34" stroke="#c2831a" strokeWidth="2.4" fill="none" />
        <ellipse cx="60.6" cy="5" rx="1.4" ry="2" fill={OUT} stroke="none" transform="rotate(-20 60.6 5)" />
        <path d="M58 25 Q64 21 70 26 Q64 30.5 58 25 Z" fill={pal.cock} />
        <path d="M60 24.6 Q64 22.6 67.6 25" stroke="#fff" strokeWidth="1.5" fill="none" />
        <path d="M67 33 L72 38 L67 43 L62 38 Z" fill="#ffc93a" />
      </g>
      {SPARKS.map(([x, y, r, d], i) => (
        <m.path
          key={i}
          d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`}
          fill="#fff6c8"
          stroke="none"
          animate={{ scale: [0.2, 1, 0.2], opacity: [0, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: d }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
      ))}
    </>
  );
}
