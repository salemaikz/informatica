"use client";

import { monoFit } from "../logic";
import { ArtSvg, Floor, Sparkle, SuccessBadge, Wall } from "./parts";

const LOCKER_Y = 16;
const LOCKER_H = 134;

/** Шкафчик в школьной раздевалке: боковые приглушены, центральный — «наш». */
function SideLocker({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y={LOCKER_Y} width="90" height={LOCKER_H} rx="7" className="fill-primary/45 stroke-primary/60" strokeWidth="2.5" />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={x + 22} y={28 + k * 7} width="46" height="3.5" rx="1.75" className="fill-primary-strong/50" />
      ))}
      <rect x={x + 75} y="80" width="6" height="26" rx="3" className="fill-surface/70" />
    </g>
  );
}

function Vents({ x }: { x: number }) {
  return (
    <g>
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={x + 22} y={28 + k * 7} width="46" height="3.5" rx="1.75" className="fill-primary-strong/70" />
      ))}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={x + 22} y={124 + k * 7} width="46" height="3.5" rx="1.75" className="fill-primary-strong/70" />
      ))}
    </g>
  );
}

function Ball({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 14} rx="15" ry="3.5" className="fill-text/10" />
      <circle cx={x} cy={y} r="14" className="fill-streak" />
      <path d={`M${x - 14} ${y} q14 -9 28 0 M${x - 14} ${y} q14 9 28 0 M${x} ${y - 14} v28`} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" />
    </g>
  );
}

/** Шкафчик с замком и стикером-кодом; открытый — створка распахнута, внутри книги и мяч. */
export function LockerArt({ open, code }: { open: boolean; code?: string }) {
  return (
    <ArtSvg>
      <Wall />
      <Floor />
      <SideLocker x={21} />
      <SideLocker x={209} />

      {open ? (
        <g>
          <rect x="115" y={LOCKER_Y} width="90" height={LOCKER_H} rx="7" className="fill-primary-strong" />
          <rect x="121" y="22" width="78" height="122" rx="4" className="fill-surface-2" />
          <rect x="121" y="78" width="78" height="5" className="fill-border" />
          {/* полка с книгами */}
          <rect x="128" y="52" width="10" height="26" rx="2" className="fill-success" />
          <rect x="139" y="57" width="9" height="21" rx="2" className="fill-streak" />
          <rect x="149" y="50" width="11" height="28" rx="2" className="fill-primary" />
          <rect x="166" y="64" width="28" height="14" rx="3" className="fill-gold" />
          {code && (
            <g transform="rotate(-4 165 36)">
              <rect x="141" y="25" width="48" height="22" rx="2.5" className="fill-gold-soft stroke-gold" strokeWidth="1.5" />
              <text x="165" y="37" textAnchor="middle" dominantBaseline="central" fontSize={monoFit(code.length, 40, 12)} fontWeight={800} className="fill-text font-mono">
                {code}
              </text>
            </g>
          )}
          <Ball x={160} y={118} />
          {/* створка, распахнутая к зрителю */}
          <polygon points="115,16 85,6 85,162 115,150" className="fill-primary stroke-primary-strong" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="108,30 94,24 94,60 108,64" className="fill-primary-strong/40" />
          <circle cx="91" cy="92" r="3.4" className="fill-gold" />
          <Sparkle x={236} y={60} s={8} />
          <Sparkle x={262} y={96} s={6} delay={1} />
          <SuccessBadge x={286} y={32} />
        </g>
      ) : (
        <g>
          <rect x="115" y={LOCKER_Y} width="90" height={LOCKER_H} rx="7" className="fill-primary stroke-primary-strong" strokeWidth="3" />
          <Vents x={115} />
          <rect x="190" y="80" width="7" height="28" rx="3.5" className="fill-gold" />
          {/* навесной замок */}
          <path d="M186 113 v-5 a5 5 0 0 1 10 0 v5" fill="none" className="stroke-text/70" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="181" y="113" width="20" height="15" rx="3.5" className="fill-gold stroke-warning-strong" strokeWidth="1.5" />
          <circle cx="191" cy="120" r="2" className="fill-warning-strong" />
          {/* стикер с кодом */}
          {code && (
            <g transform="rotate(-5 160 80)">
              <rect x="128.5" y="60.5" width="66" height="44" rx="3" className="fill-text/10" />
              <rect x="127" y="59" width="66" height="44" rx="3" className="fill-gold-soft stroke-gold" strokeWidth="1.8" />
              <rect x="146" y="54" width="28" height="9" rx="2" className="fill-text/15" />
              <text x="160" y="83" textAnchor="middle" dominantBaseline="central" fontSize={monoFit(code.length, 56, 18)} fontWeight={800} className="fill-text font-mono">
                {code}
              </text>
            </g>
          )}
        </g>
      )}

      {!open && <Ball x={284} y={176} />}
    </ArtSvg>
  );
}
