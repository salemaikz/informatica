// Фон арены: небо, горы Тянь-Шаня, степь с юртой, тюльпаны и две площадки (одинаков в светлой и тёмной теме).

export const ARENA_W = 400;
export const ARENA_H = 370;
/** Центры площадок (в координатах арены). */
export const OPP_SPOT = { x: 292, y: 196 };
export const YOU_SPOT = { x: 104, y: 326 };

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity=".92">
      <ellipse cx="0" cy="0" rx="26" ry="9" />
      <ellipse cx="-12" cy="-7" rx="13" ry="10" />
      <ellipse cx="8" cy="-10" rx="15" ry="12" />
    </g>
  );
}

function Tulip({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 V12" stroke="#2f8a47" strokeWidth="2" strokeLinecap="round" />
      <path d="M-4 -1 Q-4 -9 0 -10 Q4 -9 4 -1 Q0 2 -4 -1Z" fill={c} stroke="#7a2438" strokeWidth=".8" />
    </g>
  );
}

function Platform({ x, y, rx, ry }: { x: number; y: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + ry * 0.5} rx={rx + 5} ry={ry + 3} fill="#2d7a42" opacity=".5" />
      <ellipse cx={x} cy={y + 7} rx={rx} ry={ry} fill="#9a6a45" />
      <ellipse cx={x} cy={y + 3} rx={rx} ry={ry} fill="#b98558" />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#53b95f" stroke="#2f8a47" strokeWidth="2.5" />
      <ellipse cx={x - 4} cy={y - 2} rx={rx * 0.82} ry={ry * 0.76} fill="#7bdc79" />
      <ellipse cx={x - rx * 0.18} cy={y - ry * 0.18} rx={rx * 0.55} ry={ry * 0.5} fill="#93e88a" opacity=".6" />
    </g>
  );
}

export function ArenaBg() {
  return (
    <svg viewBox={`0 0 ${ARENA_W} ${ARENA_H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id="cr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#62b8f2" />
          <stop offset=".6" stopColor="#bfe8fb" />
          <stop offset="1" stopColor="#f4fbe4" />
        </linearGradient>
        <linearGradient id="cr-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ed77a" />
          <stop offset="1" stopColor="#3f9f58" />
        </linearGradient>
        <radialGradient id="cr-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6c0" stopOpacity="1" />
          <stop offset="1" stopColor="#fff6c0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={ARENA_W} height={ARENA_H} fill="url(#cr-sky)" />
      <circle cx="330" cy="40" r="52" fill="url(#cr-sun)" />
      <circle cx="330" cy="40" r="17" fill="#fff3a8" />
      <Cloud x={70} y={44} s={1.1} />
      <Cloud x={190} y={26} s={0.8} />
      <Cloud x={380} y={96} s={0.9} />
      {/* горы со снежными шапками */}
      <path d="M-10 150 L50 78 L84 114 L128 62 L182 138 L214 108 L262 150Z" fill="#8fb4d9" />
      <path d="M128 62 L146 86 L134 82 L124 94 L112 80Z" fill="#fff" />
      <path d="M50 78 L64 94 L54 92 L46 100 L38 90Z" fill="#fff" />
      <path d="M200 150 L262 90 L300 130 L340 84 L410 150Z" fill="#7aa3cf" />
      <path d="M340 84 L358 106 L346 102 L338 112 L326 100Z" fill="#fff" />
      <path d="M262 90 L276 106 L266 104 L258 112 L250 102Z" fill="#fff" />
      {/* дальние холмы и юрта */}
      <path d="M-10 160 Q60 132 150 150 T330 146 T420 152 V190 H-10Z" fill="#9bdc8e" />
      <g transform="translate(78 140)">
        <ellipse cx="0" cy="22" rx="20" ry="4" fill="#4f9e5c" opacity=".5" />
        <path d="M-17 20 V4 Q-17 -2 0 -2 Q17 -2 17 4 V20Z" fill="#f6efe0" stroke="#8a6a4a" strokeWidth="1.6" />
        <path d="M-17 4 Q0 -22 17 4Z" fill="#fbf6ea" stroke="#8a6a4a" strokeWidth="1.6" />
        <path d="M-5 20 V9 Q0 5 5 9 V20Z" fill="#c8693f" />
        <path d="M-17 11 H17" stroke="#3aa6c9" strokeWidth="2" />
      </g>
      {/* степь */}
      <path d={`M-10 168 Q100 150 210 166 T410 160 V${ARENA_H} H-10Z`} fill="url(#cr-grass)" />
      <g fill="none" stroke="#5fbf66" strokeWidth="2.2" opacity=".55">
        <path d="M-10 210 Q120 196 250 212 T410 206" />
        <path d="M-10 262 Q130 246 260 264 T410 258" />
        <path d="M-10 318 Q140 302 270 322 T410 314" />
      </g>
      <Tulip x={22} y={196} c="#ff6b81" />
      <Tulip x={36} y={204} c="#ffd24d" />
      <Tulip x={370} y={236} c="#ff6b81" />
      <Tulip x={382} y={246} c="#fff" />
      <Tulip x={216} y={262} c="#ffd24d" />
      <Tulip x={354} y={344} c="#ff6b81" />
      <Tulip x={30} y={268} c="#fff" />
      <Platform x={OPP_SPOT.x} y={OPP_SPOT.y} rx={80} ry={21} />
      <Platform x={YOU_SPOT.x} y={YOU_SPOT.y} rx={104} ry={26} />
    </svg>
  );
}
