"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

// Существа «Битвы существ»: 6 скинов, нарисованы вручную в SVG (viewBox 120×120, земля на y≈112).
// Единый контур (3 px), у каждой части 3 тона: основа, тень (полумесяц снизу-справа), блик.
// Все существа нарисованы анфас и смотрят влево; ваше существо страница рисует зеркально.

export type CreatureMood = "idle" | "hurt" | "stun" | "ko";

interface Pal {
  base: string;
  shade: string;
  light: string;
  ol: string;
}

const Uid = createContext("c");
const EYE_DARK = "#17182e";

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

/** Часть тела: основа + тень + блик + контур. */
function Part({
  d,
  p,
  k,
  dx = -4,
  dy = -5,
  hi,
  sw = 3,
}: {
  d: string;
  p: Pal;
  k: string;
  dx?: number;
  dy?: number;
  hi?: [number, number, number, number, number?];
  sw?: number;
}) {
  const id = `${useContext(Uid)}-${k}`;
  return (
    <g>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={p.shade} />
      <g clipPath={`url(#${id})`}>
        <path d={d} fill={p.base} transform={`translate(${dx} ${dy})`} />
        {hi && <ellipse cx={hi[0]} cy={hi[1]} rx={hi[2]} ry={hi[3]} fill={p.light} opacity=".6" transform={`rotate(${hi[4] ?? -25} ${hi[0]} ${hi[1]})`} />}
      </g>
      <path d={d} fill="none" stroke={p.ol} strokeWidth={sw} strokeLinejoin="round" />
    </g>
  );
}

function Eye({ cx, cy, r, mood, side, iris, look = -0.3 }: { cx: number; cy: number; r: number; mood: CreatureMood; side: -1 | 1; iris: string; look?: number }) {
  if (mood === "hurt") {
    const a = side === -1 ? 1 : -1; // левый глаз «>», правый «<»
    return <path d={`M${cx - a * r * 0.85} ${cy - r * 0.8} L${cx + a * r * 0.75} ${cy} L${cx - a * r * 0.85} ${cy + r * 0.8}`} fill="none" stroke={EYE_DARK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (mood === "ko") {
    const q = r * 0.65;
    return <path d={`M${cx - q} ${cy - q} L${cx + q} ${cy + q} M${cx + q} ${cy - q} L${cx - q} ${cy + q}`} stroke={EYE_DARK} strokeWidth="3.2" strokeLinecap="round" />;
  }
  if (mood === "stun") {
    let d = "";
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * Math.PI * 3.4;
      const rr = (i / 28) * r * 0.95;
      d += `${i ? "L" : "M"}${(cx + Math.cos(t) * rr).toFixed(2)} ${(cy + Math.sin(t) * rr).toFixed(2)}`;
    }
    return (
      <g>
        <circle cx={cx} cy={cy} r={r * 1.08} fill="#fff" stroke={EYE_DARK} strokeWidth="1.6" />
        <path d={d} fill="none" stroke={EYE_DARK} strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  const ix = cx + look * r * 0.3;
  return (
    <g className="cr-blink">
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.14} fill={EYE_DARK} />
      <ellipse cx={ix} cy={cy + r * 0.14} rx={r * 0.78} ry={r * 0.88} fill={iris} />
      <ellipse cx={ix} cy={cy + r * 0.1} rx={r * 0.4} ry={r * 0.52} fill={EYE_DARK} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.42} r={r * 0.33} fill="#fff" />
      <circle cx={cx + r * 0.36} cy={cy + r * 0.42} r={r * 0.15} fill="#fff" opacity=".9" />
    </g>
  );
}

function Eyes({ lx, rx, y, r, mood, iris, look }: { lx: number; rx: number; y: number; r: number; mood: CreatureMood; iris: string; look?: number }) {
  return (
    <>
      <Eye cx={lx} cy={y} r={r} mood={mood} side={-1} iris={iris} look={look} />
      <Eye cx={rx} cy={y} r={r} mood={mood} side={1} iris={iris} look={look} />
    </>
  );
}

function Mouth({ x, y, mood, w = 10, ol }: { x: number; y: number; mood: CreatureMood; w?: number; ol: string }) {
  const s = { stroke: ol, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  if (mood === "hurt")
    return (
      <g>
        <ellipse cx={x} cy={y + 1.5} rx={w * 0.26} ry={w * 0.34} fill={EYE_DARK} />
        <ellipse cx={x} cy={y + 3} rx={w * 0.15} ry={w * 0.1} fill="#ff7f9c" />
      </g>
    );
  if (mood === "stun") return <path d={`M${x - w / 2} ${y + 1} q${w / 6} -3.5 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0`} {...s} />;
  if (mood === "ko")
    return (
      <g>
        <path d={`M${x - w / 3} ${y} h${(w * 2) / 3}`} {...s} />
        <path d={`M${x + w * 0.05} ${y + 1} q${w * 0.2} ${w * 0.6} ${w * 0.32} 0z`} fill="#ff7f9c" stroke={ol} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    );
  return <path d={`M${x - w / 2} ${y} Q${x} ${y + w * 0.62} ${x + w / 2} ${y}`} {...s} />;
}

const Cheek = ({ x, y, rx = 5, ry = 3.5, c = "#ff7f9c" }: { x: number; y: number; rx?: number; ry?: number; c?: string }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={c} opacity=".55" />
);

/** Четырёхконечная искра. */
export function Spark({ x, y, s, c = "#fff7c2", delay = 0 }: { x: number; y: number; s: number; c?: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="cr-twinkle" style={{ animationDelay: `${delay}s` }} d={`M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s}Z`} fill={c} stroke="#fff" strokeWidth=".8" />
    </g>
  );
}

type Face = { mood: CreatureMood };

/* ───────── 1. Битик — круглый зверёк с хвостом-штекером ───────── */
const BITIK: Pal = { base: "#4ea6ff", shade: "#2b66d6", light: "#b4e0ff", ol: "#17356f" };

function Bitik({ mood }: Face) {
  const p = BITIK;
  return (
    <>
      {/* хвост со штекером */}
      <path d="M86 96 C110 100 117 78 104 65" stroke={p.ol} strokeWidth="9.5" fill="none" strokeLinecap="round" />
      <path d="M86 96 C110 100 117 78 104 65" stroke={p.base} strokeWidth="4" fill="none" strokeLinecap="round" />
      <g transform="rotate(-14 104 52)">
        <rect x="98" y="33" width="4.6" height="10" rx="1.2" fill="#ffd34d" stroke={p.ol} strokeWidth="2.2" />
        <rect x="107.4" y="33" width="4.6" height="10" rx="1.2" fill="#ffd34d" stroke={p.ol} strokeWidth="2.2" />
        <rect x="95" y="41" width="20" height="20" rx="4.5" fill="#dfe8f8" stroke={p.ol} strokeWidth="3" />
        <path d="M96.5 53 H113.5 V56.5 Q113.5 59.5 110.5 59.5 H99.5 Q96.5 59.5 96.5 56.5Z" fill="#a3b4d6" />
        <path d="M106 44.5 l-4 6 h3.4 l-1.8 5 5 -7 h-3.4z" fill="#4ea6ff" />
      </g>
      <Part d={ell(42, 108, 13, 7)} p={p} k="f1" dx={-2} dy={-2} />
      <Part d={ell(78, 108, 13, 7)} p={p} k="f2" dx={-2} dy={-2} />
      <Part d="M30 44 L21 11 Q42 12 53 32Z" p={p} k="e1" />
      <Part d="M90 44 L99 11 Q78 12 67 32Z" p={p} k="e2" dx={-3} />
      <path d="M21.5 12 Q32 12 40 17 L31 29 L26 24Z" fill="#ffd34d" opacity=".95" />
      <path d="M98.5 12 Q88 12 80 17 L89 29 L94 24Z" fill="#ffd34d" opacity=".95" />
      <Part d="M60 26 C88 26 103 48 103 74 C103 98 85 109 60 109 C35 109 17 98 17 74 C17 48 32 26 60 26Z" p={p} k="b" hi={[42, 44, 14, 8, -30]} />
      <Part d={ell(19, 84, 6.5, 10)} p={p} k="a1" dx={-2} dy={-2} />
      <Part d={ell(101, 84, 6.5, 10)} p={p} k="a2" dx={-2} dy={-2} />
      <ellipse cx="60" cy="92" rx="23" ry="15.5" fill="#dff2ff" />
      <path d="M38 94 Q60 112 82 94 Q82 106 60 107 Q38 106 38 94Z" fill="#b9dcf5" opacity=".7" />
      <ellipse cx="53" cy="91" rx="4" ry="6" fill="none" stroke={p.base} strokeWidth="2.4" />
      <path d="M67 85 v12" fill="none" stroke={p.base} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M61.5 31 l-6.5 10.5 h5.2 l-3 8.5 8.6 -11.5 h-5.4z" fill="#ffd34d" stroke={p.ol} strokeWidth="1.8" strokeLinejoin="round" />
      <Eyes lx={42} rx={78} y={62} r={8.6} mood={mood} iris="#35d3ff" />
      <Cheek x={28} y={75} />
      <Cheek x={92} y={75} />
      <Mouth x={60} y={73} mood={mood} w={11} ol={p.ol} />
    </>
  );
}

/* ───────── 2. Флоппик — черепашка с дискетой вместо панциря ───────── */
const FLOP_SKIN: Pal = { base: "#5bd39b", shade: "#2fa070", light: "#c4f7de", ol: "#14443a" };
const FLOP_DISK: Pal = { base: "#4458c6", shade: "#2b388c", light: "#8a99f2", ol: "#131b52" };

function Floppik({ mood }: Face) {
  const p = FLOP_SKIN;
  const d = FLOP_DISK;
  return (
    <>
      <Part d={ell(38, 108, 11, 6.5)} p={p} k="l1" dx={-2} dy={-2} />
      <Part d={ell(82, 108, 11, 6.5)} p={p} k="l2" dx={-2} dy={-2} />
      <Part d="M94 94 L113 98 Q116 106 106 108 L92 105Z" p={p} k="t" />
      {/* дискета-панцирь */}
      <Part d="M30 12 H78 L99 33 V82 Q99 90 91 90 H30 Q22 90 22 82 V20 Q22 12 30 12Z" p={d} k="disk" hi={[34, 26, 11, 6]} />
      <rect x="38" y="12" width="38" height="25" rx="2.5" fill="#dde4f0" stroke={d.ol} strokeWidth="3" />
      <rect x="38" y="30" width="38" height="7" fill="#aab6cf" />
      <rect x="62" y="17" width="9" height="14" rx="1.8" fill="#4a5575" stroke={d.ol} strokeWidth="2" />
      <rect x="30" y="43" width="60" height="31" rx="3.5" fill="#fbf6e4" stroke={d.ol} strokeWidth="2.6" />
      <path d="M33.5 43 H86.5 a3 3 0 0 1 3 3 V50 H30.5 V46 a3 3 0 0 1 3 -3Z" fill="#ff8a5c" />
      <path d="M37 58 H74 M37 65 H84" stroke="#6b7fd6" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M93 58 l-4 -4" stroke={d.light} strokeWidth="0" />
      {/* голова и лапки */}
      <Part d={ell(32, 99, 8, 6.5)} p={p} k="h1" dx={-2} dy={-2} />
      <Part d={ell(88, 99, 8, 6.5)} p={p} k="h2" dx={-2} dy={-2} />
      <Part d={ell(60, 90, 24, 20)} p={p} k="head" hi={[48, 78, 11, 5.5, -20]} />
      <Eyes lx={49} rx={71} y={88} r={6.6} mood={mood} iris="#1f8f68" />
      <Cheek x={38} y={97} rx={4.4} ry={3} />
      <Cheek x={82} y={97} rx={4.4} ry={3} />
      <Mouth x={60} y={97.5} mood={mood} w={8} ol={p.ol} />
    </>
  );
}

/* ───────── 3. Пиксёж — ёжик с пиксельными иглами ───────── */
const PIX_FACE: Pal = { base: "#ffd4a8", shade: "#e39a68", light: "#fff0dc", ol: "#4b2455" };
const PIX_Q: Pal = { base: "#8d5cf5", shade: "#5a2fc6", light: "#c9abff", ol: "#2c1260" };

function Pikseyozh({ mood }: Face) {
  const p = PIX_FACE;
  const q = PIX_Q;
  const sq: [number, number][] = [[24, 66], [36, 42], [90, 66], [48, 33], [80, 42]];
  return (
    <>
      <Part d={ell(44, 108, 11, 6.5)} p={p} k="f1" dx={-2} dy={-2} />
      <Part d={ell(76, 108, 11, 6.5)} p={p} k="f2" dx={-2} dy={-2} />
      <Part d="M12 86 V64 H22 V50 H32 V38 H44 V27 H76 V38 H88 V50 H98 V64 H108 V86 Q108 100 94 101 H26 Q12 100 12 86Z" p={q} k="q" dx={-5} dy={-5} sw={3.4} />
      {sq.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="8" height="8" fill={q.light} opacity=".75" />
      ))}
      {[[84, 52], [26, 78], [99, 76], [64, 31]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="7" height="7" fill="#6ff2ff" stroke="#e8fdff" strokeWidth="1" opacity=".95" />
      ))}
      <Part d={ell(33, 60, 7, 8.5)} p={p} k="ear1" dx={-2} dy={-2} />
      <Part d={ell(87, 60, 7, 8.5)} p={p} k="ear2" dx={-2} dy={-2} />
      <Part d="M28 79 C28 59 44 53 60 53 C76 53 92 59 92 79 C92 98 78 108 60 108 C42 108 28 98 28 79Z" p={p} k="face" hi={[46, 64, 11, 5]} />
      <ellipse cx="60" cy="91" rx="17" ry="12.5" fill={p.light} />
      <Part d={ell(31, 98, 6, 5)} p={p} k="h1" dx={-1.5} dy={-1.5} />
      <Part d={ell(89, 98, 6, 5)} p={p} k="h2" dx={-1.5} dy={-1.5} />
      <ellipse cx="60" cy="83.5" rx="5.4" ry="4" fill={p.ol} />
      <ellipse cx="58.5" cy="82" rx="1.6" ry="1" fill="#fff" opacity=".8" />
      <Eyes lx={45} rx={75} y={72} r={7.6} mood={mood} iris="#7a4bd8" />
      <Cheek x={34} y={85} />
      <Cheek x={86} y={85} />
      <Mouth x={60} y={91} mood={mood} w={9} ol={p.ol} />
    </>
  );
}

/* ───────── 4. Барысик — котёнок снежного барса ───────── */
const BARYS: Pal = { base: "#e8eef8", shade: "#aab6cf", light: "#ffffff", ol: "#33405e" };
const SPOT = "#58658a";

function Barysik({ mood }: Face) {
  const p = BARYS;
  const tail = "M84 101 C114 106 121 72 99 58";
  return (
    <>
      <path d={tail} stroke={p.ol} strokeWidth="19" fill="none" strokeLinecap="round" />
      <path d={tail} stroke={p.base} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d={tail} stroke={SPOT} strokeWidth="13" fill="none" strokeDasharray="5 9" />
      <path d="M99 58 l0 0" stroke={SPOT} strokeWidth="13" strokeLinecap="round" />
      <Part d={ell(35, 35, 10.5, 10.5)} p={p} k="e1" dx={-2} dy={-2} />
      <Part d={ell(85, 35, 10.5, 10.5)} p={p} k="e2" dx={-2} dy={-2} />
      <ellipse cx="35" cy="37" rx="5" ry="5" fill="#f4a6b8" />
      <ellipse cx="85" cy="37" rx="5" ry="5" fill="#f4a6b8" />
      <Part d={ell(44, 110, 12, 6.5)} p={p} k="f1" dx={-2} dy={-2} />
      <Part d={ell(76, 110, 12, 6.5)} p={p} k="f2" dx={-2} dy={-2} />
      <Part d={ell(60, 96, 27, 17)} p={p} k="body" hi={[44, 90, 10, 4.5]} />
      <g fill="none" stroke={SPOT} strokeWidth="2.2">
        <circle cx="42" cy="100" r="3.6" />
        <circle cx="78" cy="100" r="3.6" />
      </g>
      <Part d={ell(31, 94, 6, 8)} p={p} k="a1" dx={-2} dy={-2} />
      <Part d={ell(89, 94, 6, 8)} p={p} k="a2" dx={-2} dy={-2} />
      <Part d={ell(60, 56, 31, 28)} p={p} k="head" hi={[44, 40, 12, 6, -25]} />
      <g fill={SPOT}>
        <ellipse cx="60" cy="33" rx="4" ry="2.6" />
        <ellipse cx="49" cy="36" rx="3.2" ry="2.1" transform="rotate(-20 49 36)" />
        <ellipse cx="71" cy="36" rx="3.2" ry="2.1" transform="rotate(20 71 36)" />
      </g>
      <g stroke={SPOT} strokeWidth="2.6" strokeLinecap="round">
        <path d="M31 58 l7 1.5 M32.5 66 l7 -1" />
        <path d="M89 58 l-7 1.5 M87.5 66 l-7 -1" />
      </g>
      <ellipse cx="60" cy="69" rx="14.5" ry="10" fill="#fff" />
      <path d="M54.5 63 h11 l-5.5 6.2z" fill="#f48aa3" stroke={p.ol} strokeWidth="1.6" strokeLinejoin="round" />
      <Mouth x={60} y={71.5} mood={mood} w={9} ol={p.ol} />
      {/* бандана с золотым узором */}
      <path d="M36 82 Q60 93 84 82 L60 108Z" fill="#27b5d6" stroke={p.ol} strokeWidth="3" strokeLinejoin="round" />
      <path d="M36 82 Q60 93 84 82 L81 87 Q60 97 39 87Z" fill="#ffc933" stroke={p.ol} strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 94 l5 5 -5 5 -5 -5z" fill="#ffc933" stroke={p.ol} strokeWidth="1.8" strokeLinejoin="round" />
      <Eyes lx={44} rx={76} y={54} r={8.4} mood={mood} iris="#4fc3f7" />
      <Cheek x={34} y={67} />
      <Cheek x={86} y={67} />
    </>
  );
}

/* ───────── 5. Кибер-беркут — беркутёнок с цепями на крыльях ───────── */
const EAGLE_B: Pal = { base: "#8c5a3b", shade: "#5b3622", light: "#cd9768", ol: "#2b170e" };
const EAGLE_W: Pal = { base: "#f6f2ea", shade: "#cdc4b4", light: "#ffffff", ol: "#2b170e" };
const GOLD: Pal = { base: "#ffc42e", shade: "#d68f0c", light: "#fff0a8", ol: "#2b170e" };
const CYAN = "#37f2ff";

function KiberBerkut({ mood }: Face) {
  const b = EAGLE_B;
  const w = EAGLE_W;
  return (
    <>
      <Part d="M60 98 L40 119 Q60 125 80 119Z" p={b} k="tail" />
      <path d="M50 108 l-3 9 M60 110 v10 M70 108 l3 9" stroke={GOLD.base} strokeWidth="2.6" strokeLinecap="round" />
      {/* крылья с цепями */}
      <Part d="M31 60 C6 54 1 84 9 106 C21 106 31 99 38 88Z" p={b} k="w1" />
      <Part d="M89 60 C114 54 119 84 111 106 C99 106 89 99 82 88Z" p={b} k="w2" dx={-3} />
      <g fill="none" stroke={CYAN} strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 70 L18 74 L14 86 L21 97 M14 86 L24 87" strokeWidth="5" opacity=".28" />
        <path d="M30 70 L18 74 L14 86 L21 97 M14 86 L24 87" strokeWidth="2" />
        <path d="M90 70 L102 74 L106 86 L99 97 M106 86 L96 87" strokeWidth="5" opacity=".28" />
        <path d="M90 70 L102 74 L106 86 L99 97 M106 86 L96 87" strokeWidth="2" />
      </g>
      <g fill={CYAN}>
        <circle cx="18" cy="74" r="2.4" />
        <circle cx="14" cy="86" r="2.4" />
        <circle cx="102" cy="74" r="2.4" />
        <circle cx="106" cy="86" r="2.4" />
      </g>
      <path d="M9.5 104 Q22 108 38 90" stroke={GOLD.base} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M110.5 104 Q98 108 82 90" stroke={GOLD.base} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* лапы */}
      <Part d={ell(45, 111, 10, 5)} p={GOLD} k="t1" dx={-1.5} dy={-1.5} />
      <Part d={ell(75, 111, 10, 5)} p={GOLD} k="t2" dx={-1.5} dy={-1.5} />
      <Part d={ell(60, 88, 31, 23)} p={b} k="body" hi={[42, 76, 12, 5]} />
      <Part d={ell(60, 95, 20, 15.5)} p={w} k="chest" dx={-3} dy={-4} />
      <path d="M48 91 q4 4 8 0 M62 91 q4 4 8 0 M54.5 100 q4 4 8 0" stroke={w.shade} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* хохолок и голова */}
      <Part d="M44 32 L40 8 L56 24 L61 3 L67 24 L82 9 L77 33Z" p={w} k="crest" />
      <path d="M40 8 l2 7 M82 9 l-2 7 M61 3 l0 9" stroke={b.base} strokeWidth="3" strokeLinecap="round" />
      <Part d={ell(60, 51, 30, 27)} p={w} k="head" hi={[44, 38, 12, 6, -25]} />
      {/* кибер-полоски у глаз */}
      <g fill="none" stroke={CYAN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M31 53 H36 L39 58" />
        <path d="M89 53 H84 L81 58" />
      </g>
      <path d="M33 40 L53 47" stroke={b.ol} strokeWidth="4" strokeLinecap="round" />
      <path d="M87 40 L67 47" stroke={b.ol} strokeWidth="4" strokeLinecap="round" />
      <Eyes lx={44} rx={76} y={54} r={8} mood={mood} iris="#ffb81c" />
      <Part d="M51 59 Q60 53 69 59 Q67 73 60 79 Q53 73 51 59Z" p={GOLD} k="beak" dx={-2.5} dy={-3} sw={2.8} />
      <path d="M60 60 v10" stroke={GOLD.shade} strokeWidth="1.6" strokeLinecap="round" />
      <Cheek x={35} y={66} c="#f2a28a" />
      <Cheek x={85} y={66} c="#f2a28a" />
    </>
  );
}

/* ───────── 6. Драконкод — дракончик из светящегося кода (легендарный) ───────── */
const DRAGON: Pal = { base: "#2f3891", shade: "#1a1e54", light: "#6a76de", ol: "#090b26" };
const DR_GOLD: Pal = { base: "#ffd15a", shade: "#e09a1c", light: "#fff0b0", ol: "#090b26" };
const DR_WING: Pal = { base: "#19c1a0", shade: "#0d7d78", light: "#6af5d0", ol: "#090b26" };
const GREEN = "#4dffae";

function WingArt({ k }: { k: string }) {
  return (
    <g>
      <Part d="M42 64 C16 62 -2 42 4 12 C15 22 21 21 29 16 C30 28 36 36 45 40 C42 47 44 55 50 61Z" p={DR_WING} k={k} dx={-3} dy={-3} />
      <path d="M42 63 L6 14 M43 62 L31 19 M44 62 L44 41" stroke={DRAGON.ol} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <g fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round">
        <ellipse cx="19" cy="35" rx="2.6" ry="3.6" />
        <path d="M30 37 v7 M34 33 v8" />
        <ellipse cx="14" cy="22" rx="2.2" ry="3" />
        <path d="M38 50 h5" />
      </g>
    </g>
  );
}

function Drakonkod({ mood }: Face) {
  const d = DRAGON;
  const g = DR_GOLD;
  const tail = "M82 101 C106 112 118 96 109 80";
  return (
    <>
      <defs>
        <radialGradient id={`${useContext(Uid)}-aura`} cx="50%" cy="52%" r="50%">
          <stop offset="0" stopColor="#ffe27a" stopOpacity=".7" />
          <stop offset=".55" stopColor="#4dffae" stopOpacity=".22" />
          <stop offset="1" stopColor="#4dffae" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="62" r="64" fill={`url(#${useContext(Uid)}-aura)`} />
      <WingArt k="wl" />
      <g transform="translate(120 0) scale(-1 1)">
        <WingArt k="wr" />
      </g>
      {/* хвост с пламенем */}
      <path d={tail} stroke={d.ol} strokeWidth="14.5" fill="none" strokeLinecap="round" />
      <path d={tail} stroke={d.base} strokeWidth="8.5" fill="none" strokeLinecap="round" />
      <path d="M109 80 C97 72 103 61 106 51 C113 59 122 66 118 77 C116 84 111 84 109 80Z" fill="#ff8a1f" stroke={d.ol} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M109 78 C103 73 107 67 109 62 C113 67 116 72 113 76 C112 79 110 79 109 78Z" fill="#ffe46b" />
      <Part d={ell(43, 110, 12, 6)} p={d} k="f1" dx={-2} dy={-2} />
      <Part d={ell(77, 110, 12, 6)} p={d} k="f2" dx={-2} dy={-2} />
      <Part d={ell(60, 92, 28, 21)} p={d} k="body" hi={[42, 82, 11, 4.5]} />
      <Part d={ell(60, 96, 17, 15)} p={g} k="belly" dx={-3} dy={-3} sw={2.4} />
      <path d="M49 90 h22 M48 103 h24" stroke={g.shade} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <g fill="none" stroke={d.ol} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M53 90.5 L47.5 96.5 L53 102.5" />
        <path d="M67 90.5 L72.5 96.5 L67 102.5" />
        <path d="M63 89.5 L57 103.5" />
      </g>
      <Part d={ell(32, 96, 6.5, 7.5)} p={d} k="a1" dx={-2} dy={-2} />
      <Part d={ell(88, 96, 6.5, 7.5)} p={d} k="a2" dx={-2} dy={-2} />
      {/* рога и гребень */}
      <Part d="M41 36 Q29 18 19 15 Q24 32 33 44Z" p={g} k="h1" dx={-2} dy={-2} sw={2.8} />
      <Part d="M79 36 Q91 18 101 15 Q96 32 87 44Z" p={g} k="h2" dx={-3} dy={-2} sw={2.8} />
      <path d="M50 29 L54 18 L60 28 L66 18 L70 29Z" fill={g.base} stroke={d.ol} strokeWidth="2.6" strokeLinejoin="round" />
      <Part d={ell(60, 54, 31, 27)} p={d} k="head" hi={[44, 40, 12, 6, -25]} />
      <ellipse cx="60" cy="68" rx="15" ry="9.5" fill={d.light} stroke={d.ol} strokeWidth="2.4" />
      <ellipse cx="55" cy="66" rx="1.8" ry="1.3" fill={d.ol} />
      <ellipse cx="65" cy="66" rx="1.8" ry="1.3" fill={d.ol} />
      <g stroke={GREEN} strokeWidth="2.4" strokeLinecap="round">
        <path d="M55 36 v6 M60 34 v9 M65 36 v6" />
        <path d="M31 56 l4 -3 M31 62 l5 -1" opacity=".8" />
        <path d="M89 56 l-4 -3 M89 62 l-5 -1" opacity=".8" />
      </g>
      <Eyes lx={44} rx={76} y={52} r={8.6} mood={mood} iris="#6dffb4" />
      <Cheek x={33} y={66} c="#ff8f6b" />
      <Cheek x={87} y={66} c="#ff8f6b" />
      <Mouth x={60} y={74.5} mood={mood} w={9} ol={d.ol} />
      <Spark x={10} y={96} s={5} c="#ffe27a" />
      <Spark x={112} y={36} s={6} c="#9dffd3" delay={0.6} />
      <Spark x={16} y={62} s={3.6} c="#fff7c2" delay={1.1} />
      <Spark x={104} y={104} s={4} c="#ffe27a" delay={1.5} />
    </>
  );
}

const ART: Record<string, (p: Face) => ReactNode> = {
  bitik: Bitik,
  floppik: Floppik,
  pikseyozh: Pikseyozh,
  barysik: Barysik,
  kiberberkut: KiberBerkut,
  drakonkod: Drakonkod,
};

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .cr-breathe { animation: cr-breathe 2.9s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes cr-breathe { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.025,.968); } }
  .cr-blink { animation: cr-blink 4.8s infinite; transform-box: fill-box; transform-origin: 50% 50%; }
  @keyframes cr-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }
  .cr-twinkle { animation: cr-twinkle 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
  @keyframes cr-twinkle { 0%,100% { transform: scale(.35); opacity: .3; } 50% { transform: scale(1); opacity: 1; } }
}`;

/** Существо одного из скинов; `flip` — зеркально (ваше существо). */
export function Creature({ skin, size, mood = "idle", flip = false, shadow = false }: { skin: string; size: number; mood?: CreatureMood; flip?: boolean; shadow?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const Art = ART[skin] ?? Bitik;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ display: "block", overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }} aria-hidden>
      <style>{CSS}</style>
      {shadow && <ellipse cx="60" cy="113" rx="34" ry="6" fill="#000" opacity=".18" />}
      <Uid.Provider value={uid}>
        <g className="cr-breathe">
          <Art mood={mood} />
        </g>
      </Uid.Provider>
    </svg>
  );
}
