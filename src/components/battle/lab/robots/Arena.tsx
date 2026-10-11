"use client";

import { useId } from "react";

// Фон арены: ночная серверная — стойки с мигающими огоньками, неоновое кольцо-ядро, лучи прожекторов и глянцевый пол.
// Картинка своя и одинаковая в светлой и тёмной теме. Размер 390×380, земля у y≈350.

const LED = ["#39ff88", "#7fe3ff", "#ff4d8d", "#ffb020", "#7fe3ff", "#39ff88"];

/** Детерминированный «шум» для огоньков. */
function rnd(i: number, j: number) {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function Rack({ x, w, top, bottom, seed }: { x: number; w: number; top: number; bottom: number; seed: number }) {
  const units = Math.floor((bottom - top - 14) / 15);
  return (
    <g>
      <rect x={x} y={top} width={w} height={bottom - top} rx="3" fill="#0d1535" stroke="#27327a" strokeWidth="1.6" />
      <rect x={x + 3} y={top + 3} width={w - 6} height="5" rx="2" fill="#18246a" />
      {Array.from({ length: units }).map((_, i) => {
        const y = top + 12 + i * 15;
        const lit = rnd(seed, i) > 0.25;
        const col = LED[Math.floor(rnd(seed + 3, i) * LED.length)];
        const blink = rnd(seed + 7, i) > 0.55;
        return (
          <g key={i}>
            <rect x={x + 4} y={y} width={w - 8} height="11" rx="2" fill={lit ? "#162058" : "#11194a"} />
            <rect x={x + w - 20} y={y + 3} width="13" height="1.8" rx="0.9" fill="#2c3a8c" />
            <rect x={x + w - 20} y={y + 6.4} width="13" height="1.8" rx="0.9" fill="#2c3a8c" />
            <circle
              cx={x + 9}
              cy={y + 5.5}
              r="2"
              fill={col}
              opacity={lit ? 1 : 0.25}
              className={blink ? "motion-safe:animate-pulse" : undefined}
              style={blink ? { animationDelay: `${(rnd(seed, i) * 2).toFixed(2)}s`, animationDuration: `${(1.2 + rnd(seed + 1, i) * 1.6).toFixed(2)}s` } : undefined}
            />
            <circle cx={x + 15} cy={y + 5.5} r="1.4" fill={LED[(i + seed) % LED.length]} opacity={lit ? 0.7 : 0.2} />
          </g>
        );
      })}
    </g>
  );
}

export function ArenaBg() {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const racks: ReactRack[] = [
    { x: 6, w: 52, seed: 1 },
    { x: 62, w: 52, seed: 2 },
    { x: 118, w: 40, seed: 3 },
    { x: 232, w: 40, seed: 4 },
    { x: 276, w: 52, seed: 5 },
    { x: 332, w: 52, seed: 6 },
  ];
  const vx = 195;
  return (
    <svg viewBox="0 0 390 380" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${u}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060a1f" />
          <stop offset="0.7" stopColor="#10173f" />
          <stop offset="1" stopColor="#1a1f55" />
        </linearGradient>
        <linearGradient id={`${u}floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#222a6e" />
          <stop offset="1" stopColor="#0a0e2e" />
        </linearGradient>
        <linearGradient id={`${u}beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe9ff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#bfe9ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${u}core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7fe3ff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#3b7bff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#3b7bff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}vig`} cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id={`${u}hud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040f" stopOpacity="0.85" />
          <stop offset="1" stopColor="#02040f" stopOpacity="0" />
        </linearGradient>
        <filter id={`${u}neon`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="390" height="380" fill={`url(#${u}wall)`} />

      {/* Ядро арены: неоновые кольца и двоичная лента. */}
      <circle cx={vx} cy="178" r="96" fill={`url(#${u}core)`} />
      <g fill="none" filter={`url(#${u}neon)`}>
        <circle cx={vx} cy="178" r="64" stroke="#7fe3ff" strokeWidth="2.4" opacity="0.8" />
        <circle cx={vx} cy="178" r="48" stroke="#ff4d8d" strokeWidth="1.6" opacity="0.7" strokeDasharray="4 7" />
        <circle cx={vx} cy="178" r="80" stroke="#7fe3ff" strokeWidth="1.2" opacity="0.35" strokeDasharray="2 9" />
      </g>
      <text x={vx} y="172" textAnchor="middle" fontSize="30" fontWeight="900" fontFamily="monospace" fill="#7fe3ff" opacity="0.85" filter={`url(#${u}neon)`}>
        1011
      </text>
      <text x={vx} y="196" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="monospace" letterSpacing="3" fill="#ff7aa8" opacity="0.9">
        BIT ARENA
      </text>

      {racks.map((r, i) => (
        <Rack key={i} x={r.x} w={r.w} top={i === 2 || i === 3 ? 96 : 72} bottom={322} seed={r.seed} />
      ))}

      {/* Потолочные балки и прожекторы. */}
      <rect x="0" y="0" width="390" height="22" fill="#05081c" />
      <path d="M0 22 H390" stroke="#27327a" strokeWidth="2" />
      {[70, 195, 320].map((x) => (
        <g key={x}>
          <rect x={x - 16} y="16" width="32" height="8" rx="3" fill="#cfe9ff" opacity="0.9" />
          <path d={`M${x - 14} 24 L${x - 70} 346 L${x + 70} 346 L${x + 14} 24Z`} fill={`url(#${u}beam)`} />
        </g>
      ))}

      {/* Пол: неоновая кромка и сетка в перспективе. */}
      <path d="M0 322 H390 V380 H0Z" fill={`url(#${u}floor)`} />
      <g stroke="#4a5cff" strokeOpacity="0.4" strokeWidth="1.2">
        {Array.from({ length: 15 }).map((_, i) => {
          const xb = -240 + i * 60;
          return <line key={i} x1={vx + (xb - vx) * 0.34} y1="322" x2={xb} y2="380" />;
        })}
        {[333, 346, 362].map((y) => (
          <line key={y} x1="0" y1={y} x2="390" y2={y} />
        ))}
      </g>
      <rect x="0" y="321" width="390" height="2.6" fill="#7fe3ff" filter={`url(#${u}neon)`} />
      <ellipse cx="96" cy="352" rx="84" ry="14" fill="#7fe3ff" opacity="0.1" />
      <ellipse cx="294" cy="352" rx="84" ry="14" fill="#ff4d8d" opacity="0.1" />

      <rect width="390" height="82" fill={`url(#${u}hud)`} />
      <rect width="390" height="380" fill={`url(#${u}vig)`} />
    </svg>
  );
}

interface ReactRack {
  x: number;
  w: number;
  seed: number;
}
