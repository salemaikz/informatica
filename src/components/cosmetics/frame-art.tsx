import type { ReactNode } from "react";
import { RARITY_VAR } from "@/components/ui/rarity";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import s from "./cosmetics.module.css";
import { arcPath, pixelRing, polar, round, scatterStars, starPath, wavyRingPath } from "./geometry";

// Рисунки рамок аватара. Система координат — viewBox 120×120, центр (60, 60), аватар — круг радиуса 48:
// рамка живёт в кольце между радиусами 48 и 60. Цвета — только токены: RARITY_VAR и переменные темы
// (--surface, --art-gloss, --art-shadow …), поэтому рисунки одинаково хороши в светлой и тёмной теме.

export const FRAME_BOX = 120;
/** Радиус аватара внутри рисунка: доля 48/60 от внешнего радиуса. */
export const FRAME_AVATAR_RATIO = 48 / 60;

const C = 60;
const ring = (r: number) => ({ cx: C, cy: C, r, fill: "none" as const });
const cls = (animate: boolean, name: keyof typeof s) => (animate ? s[name] : undefined);

/** Подложка кольца цвета карточки: рисунок «стоит» на ровном фоне, даже поверх фона профиля. */
const Band = ({ r = 54, w = 11 }: { r?: number; w?: number }) => <circle {...ring(r)} stroke="var(--surface)" strokeWidth={w} />;

// ---------- Заготовки, посчитанные один раз ----------

const BITS = "1011001110100101100110101001";
const WAVE_A = wavyRingPath(C, C, 54, 2.6, 14, 0);
const WAVE_B = wavyRingPath(C, C, 54, 2.6, 14, Math.PI);
const PIXELS = pixelRing(6, FRAME_BOX, 48.4, 59.2);
const GALAXY_STARS = scatterStars(18, 11, { cx: C, cy: C, rIn: 50.5, rOut: 57.5 }, [0.7, 1.5]);

const CIRCUIT = Array.from({ length: 16 }, (_, i) => {
  const a = i * 22.5;
  const p0 = polar(C, C, 49.6, a);
  if (i % 2 === 0) {
    const p1 = polar(C, C, 57, a);
    return { d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`, pad: polar(C, C, 57.7, a), solid: false };
  }
  const p1 = polar(C, C, 54.6, a);
  const p2 = polar(C, C, 54.6, a + 5.5);
  const p3 = polar(C, C, 57.3, a + 5.5);
  return { d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}L${p2.x} ${p2.y}L${p3.x} ${p3.y}`, pad: polar(C, C, 58, a + 5.5), solid: true };
});

const RAINBOW_COLORS = [RARITY_VAR.legendary, RARITY_VAR.epic, RARITY_VAR.rare, RARITY_VAR.common];
const RAINBOW_SEGMENTS = Array.from({ length: 48 }, (_, k) => {
  const t = (k / 48) * RAINBOW_COLORS.length;
  const i = Math.floor(t);
  const f = t - i;
  const a = RAINBOW_COLORS[i % RAINBOW_COLORS.length];
  const b = RAINBOW_COLORS[(i + 1) % RAINBOW_COLORS.length];
  const color = f < 0.001 ? a : `color-mix(in srgb, ${a} ${round((1 - f) * 100)}%, ${b})`;
  return { d: arcPath(C, C, 54.5, k * 7.5 - 0.5, (k + 1) * 7.5 + 0.5), color };
});
const RAINBOW_SPARKS = [40, 130, 220, 310].map((deg, i) => ({ ...polar(C, C, 57.6, deg), delay: i * 0.7 }));

// ---------- Рамки ----------

function Dots({ c }: { c: string }) {
  // 30 точек: пунктир с нулевой длиной штриха и круглыми концами; шаг = длина окружности / 30.
  return (
    <>
      <Band />
      <circle {...ring(54)} stroke={c} strokeWidth={5.4} strokeLinecap="round" strokeDasharray="0.01 11.3" />
      <circle {...ring(48.7)} stroke={c} strokeOpacity={0.35} strokeWidth={1} />
    </>
  );
}

function Bits({ c }: { c: string }) {
  return (
    <>
      <Band />
      {BITS.split("").map((b, i) => (
        <text
          key={i}
          x={C}
          y={11.6}
          textAnchor="middle"
          fontSize={12}
          fontWeight={800}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          fill={c}
          fillOpacity={b === "1" ? 1 : 0.5}
          transform={`rotate(${round((i * 360) / BITS.length)} ${C} ${C})`}
        >
          {b}
        </text>
      ))}
      <circle {...ring(48.7)} stroke={c} strokeOpacity={0.3} strokeWidth={1} />
    </>
  );
}

function Wave({ c }: { c: string }) {
  return (
    <>
      <Band />
      <path d={WAVE_B} fill="none" stroke={c} strokeOpacity={0.4} strokeWidth={3.2} strokeLinejoin="round" />
      <path d={WAVE_A} fill="none" stroke={c} strokeWidth={3.2} strokeLinejoin="round" />
    </>
  );
}

function Circuit({ c }: { c: string }) {
  return (
    <>
      <Band />
      <circle {...ring(53)} stroke={c} strokeWidth={2.4} strokeDasharray="19 5.7" />
      {CIRCUIT.map((t, i) => (
        <g key={i}>
          <path d={t.d} fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={t.pad.x} cy={t.pad.y} r={2.2} fill={t.solid ? c : "var(--surface)"} stroke={c} strokeWidth={1.6} />
        </g>
      ))}
    </>
  );
}

function Pixel({ c }: { c: string }) {
  return (
    <g shapeRendering="crispEdges">
      {PIXELS.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={6} height={6} fill={c} fillOpacity={p.alt ? 0.5 : 1} />
      ))}
    </g>
  );
}

function Orbit({ c, animate }: { c: string; animate: boolean }) {
  const sat = polar(C, C, 54, 0);
  return (
    <>
      <Band w={10} />
      <circle {...ring(54)} stroke={c} strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="2.5 5.2" strokeLinecap="round" />
      {/* маленькая «планета» на орбите — неподвижная */}
      <circle cx={polar(C, C, 54, 200).x} cy={polar(C, C, 54, 200).y} r={2} fill={c} fillOpacity={0.55} />
      {/* спутник с хвостом кружит по орбите */}
      <g className={cls(animate, "spin")}>
        <path d={arcPath(C, C, 54, -46, -2)} fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={3.4} strokeLinecap="round" />
        <circle cx={sat.x} cy={sat.y} r={5.2} fill={c} stroke="var(--surface)" strokeWidth={2} />
        <circle cx={sat.x - 1.5} cy={sat.y - 1.6} r={1.6} fill="var(--art-gloss)" fillOpacity={0.85} />
      </g>
    </>
  );
}

function Neon({ c, animate }: { c: string; animate: boolean }) {
  return (
    <>
      {/* мягкое свечение: несколько штрихов с убывающей непрозрачностью (без фильтров — одинаково везде) */}
      <g className={cls(animate, "pulse")}>
        <circle {...ring(54)} stroke={c} strokeOpacity={0.1} strokeWidth={12.5} />
        <circle {...ring(54)} stroke={c} strokeOpacity={0.18} strokeWidth={9} />
        <circle {...ring(54)} stroke={c} strokeOpacity={0.3} strokeWidth={6.4} />
      </g>
      <circle {...ring(54)} stroke={c} strokeWidth={3.4} />
      <circle {...ring(54)} stroke="var(--art-gloss)" strokeOpacity={0.7} strokeWidth={1} />
    </>
  );
}

function Galaxy({ c, animate, uid }: { c: string; animate: boolean; uid: string }) {
  const night = "color-mix(in srgb, var(--art-shadow) 86%, var(--rarity-epic))";
  const gid = `${uid}-galaxy`;
  return (
    <>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={6} y1={C} x2={114} y2={C}>
          <stop offset="0" style={{ stopColor: c }} />
          <stop offset="0.5" style={{ stopColor: RARITY_VAR.rare }} />
          <stop offset="1" style={{ stopColor: c }} />
        </linearGradient>
      </defs>
      <circle {...ring(54)} style={{ stroke: night }} strokeWidth={11.5} />
      {/* туманность: градиентное кольцо медленно поворачивается — цвет «переливается» */}
      <g className={cls(animate, "spinSlow")}>
        <circle {...ring(54)} stroke={`url(#${gid})`} strokeOpacity={0.9} strokeWidth={4.4} />
      </g>
      <circle {...ring(48.7)} stroke={c} strokeOpacity={0.45} strokeWidth={0.9} />
      {GALAXY_STARS.map((st, i) => (
        <circle
          key={i}
          cx={st.x}
          cy={st.y}
          r={st.r}
          fill="var(--art-gloss)"
          fillOpacity={st.o}
          className={i % 3 === 0 ? cls(animate, "twinkle") : undefined}
          style={i % 3 === 0 ? { animationDelay: `${st.delay}s` } : undefined}
        />
      ))}
    </>
  );
}

function Crown({ c, animate }: { c: string; animate: boolean }) {
  const edge = "color-mix(in srgb, var(--rarity-legendary) 55%, var(--art-shadow))";
  return (
    <>
      <Band w={11.5} />
      <g className={cls(animate, "pulse")}>
        <circle {...ring(54)} stroke={c} strokeOpacity={0.22} strokeWidth={10} />
      </g>
      <circle {...ring(54)} stroke={c} strokeWidth={4.8} />
      <circle {...ring(54)} stroke="var(--art-gloss)" strokeOpacity={0.55} strokeWidth={1.1} />
      <circle {...ring(48.7)} stroke={c} strokeOpacity={0.5} strokeWidth={0.9} />
      {/* корона сидит на верху кольца и слегка заходит на аватар */}
      <path d="M43 19 L40.5 6.5 L50.5 12.5 L60 3 L69.5 12.5 L79.5 6.5 L77 19 Z" fill={c} style={{ stroke: edge }} strokeWidth={1.2} strokeLinejoin="round" />
      <rect x={43} y={16.6} width={34} height={4.6} rx={1.6} fill={c} style={{ stroke: edge }} strokeWidth={1.2} />
      {[
        [40.5, 6.5],
        [60, 3],
        [79.5, 6.5],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={2.3} fill="var(--art-gloss)" style={{ stroke: edge }} strokeWidth={1} />
      ))}
      <circle cx={60} cy={18.9} r={1.5} fill="var(--art-gloss)" fillOpacity={0.9} />
    </>
  );
}

function Rainbow({ animate }: { animate: boolean }) {
  return (
    <>
      <Band r={54.5} w={12.5} />
      <g className={cls(animate, "spinFast")}>
        {RAINBOW_SEGMENTS.map((seg, i) => (
          <path key={i} d={seg.d} fill="none" strokeWidth={7.4} style={{ stroke: seg.color }} />
        ))}
      </g>
      <circle {...ring(50.6)} stroke="var(--art-gloss)" strokeOpacity={0.55} strokeWidth={1} />
      {RAINBOW_SPARKS.map((p, i) => (
        <path
          key={i}
          d={starPath(p.x, p.y, 3.2)}
          fill="var(--art-gloss)"
          className={cls(animate, "twinkle")}
          style={animate ? { animationDelay: `${p.delay}s` } : undefined}
        />
      ))}
    </>
  );
}

/**
 * Содержимое SVG рамки (viewBox 0 0 120 120). `animate` — включать ли CSS-анимации (выключают «Меньше анимаций»
 * и prefers-reduced-motion); `uid` — уникальный префикс id для градиентов, если на странице несколько рамок.
 */
export function FrameArt({ id, animate = false, uid = "cf" }: { id: CosmeticId; animate?: boolean; uid?: string }): ReactNode {
  const def = cosmeticDef(id);
  if (!def || def.slot !== "frame") return null;
  const c = RARITY_VAR[def.rarity];
  switch (id) {
    case "frame-dots":
      return <Dots c={c} />;
    case "frame-bits":
      return <Bits c={c} />;
    case "frame-wave":
      return <Wave c={c} />;
    case "frame-circuit":
      return <Circuit c={c} />;
    case "frame-pixel":
      return <Pixel c={c} />;
    case "frame-orbit":
      return <Orbit c={c} animate={animate} />;
    case "frame-neon":
      return <Neon c={c} animate={animate} />;
    case "frame-galaxy":
      return <Galaxy c={c} animate={animate} uid={uid} />;
    case "frame-crown":
      return <Crown c={c} animate={animate} />;
    case "frame-rainbow":
      return <Rainbow animate={animate} />;
    default:
      return null;
  }
}
