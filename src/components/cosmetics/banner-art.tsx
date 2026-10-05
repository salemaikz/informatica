import type { ReactNode } from "react";
import { RARITY_VAR } from "@/components/ui/rarity";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import s from "./cosmetics.module.css";
import { bitString, gridPath, rayPath, scatterStars, starPath, wavePath } from "./geometry";

// Рисунки фонов карточки профиля. Система координат — viewBox 320×120 (рисунок «режется» по высоте блока:
// preserveAspectRatio="xMidYMid slice"). Цвета — только токены: RARITY_VAR и переменные темы.
// Текст поверх фона не лежит: имя и титул стоят на цвете карточки под полосой, поэтому читаются в обеих темах.

export const BANNER_W = 320;
export const BANNER_H = 120;

const cls = (animate: boolean, name: keyof typeof s) => (animate ? s[name] : undefined);
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const Fill = ({ color }: { color: string }) => <rect width={BANNER_W} height={BANNER_H} style={{ fill: color }} />;

// ---------- Заготовки, посчитанные один раз ----------

const GRID = gridPath(BANNER_W, BANNER_H, 16);
const BIN_ROWS = Array.from({ length: 8 }, (_, i) => bitString(26, 100 + i).split("").join(" "));
const NIGHT_STARS = scatterStars(36, 5, { w: BANNER_W, h: 96 }, [0.6, 1.6]);
const GOLD_SPARKS = [
  { x: 40, y: 30, r: 4 },
  { x: 118, y: 78, r: 3 },
  { x: 214, y: 24, r: 3.4 },
  { x: 286, y: 70, r: 4.4 },
  { x: 250, y: 104, r: 2.6 },
].map((p, i) => ({ ...p, d: starPath(p.x, p.y, p.r), delay: i * 0.6 }));
const SUN_RAYS = Array.from({ length: 18 }, (_, i) => rayPath(160, 132, 260, i * 20, i * 20 + 10));
const AURORA_STARS = scatterStars(16, 9, { w: BANNER_W, h: 70 }, [0.5, 1.2]);

// ---------- Фоны ----------

function Grid() {
  const c = RARITY_VAR.common;
  return (
    <>
      <Fill color="var(--rarity-common-soft)" />
      <path d={GRID} fill="none" stroke={c} strokeOpacity={0.26} strokeWidth={1} />
      {/* пометка на полях */}
      <text x={218} y={70} fontSize={19} fontWeight={700} fontStyle="italic" fontFamily="Georgia, 'Times New Roman', serif" fill={c} fillOpacity={0.5} transform="rotate(-5 218 70)">
        a² + b² = c²
      </text>
      <path d="M214 78 q22 5 44 -1" fill="none" stroke={c} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

function Binary() {
  const c = RARITY_VAR.common;
  return (
    <>
      <Fill color="var(--rarity-common-soft)" />
      {BIN_ROWS.map((row, i) => (
        <text key={i} x={i % 2 ? -10 : 0} y={14 + i * 16.5} fontSize={14} fontWeight={700} fontFamily={MONO} fill={c} fillOpacity={i % 3 === 0 ? 0.38 : 0.22}>
          {row}
        </text>
      ))}
    </>
  );
}

function Waves({ animate }: { animate: boolean }) {
  const c = RARITY_VAR.common;
  return (
    <>
      <Fill color="var(--rarity-common-soft)" />
      <path className={cls(animate, "drift")} d={wavePath(BANNER_W, BANNER_H, 54, 8, 170, 0)} fill={c} fillOpacity={0.2} />
      <path className={cls(animate, "driftSlow")} d={wavePath(BANNER_W, BANNER_H, 72, 7, 125, 1.6)} fill={c} fillOpacity={0.3} />
      <path className={cls(animate, "drift")} d={wavePath(BANNER_W, BANNER_H, 92, 6, 90, 3.1)} fill={c} fillOpacity={0.42} />
    </>
  );
}

const TRACES = [
  "M0 28H58L78 48H134",
  "M0 88H40L58 70H112L130 88H186",
  "M320 22H262L242 42H204",
  "M320 96H282L264 78H220",
  "M150 0V26L168 44",
  "M170 120V98L190 78",
  "M96 0V14L108 26H122",
  "M236 120V108L250 94",
];
const PADS: [number, number][] = [
  [134, 48],
  [186, 88],
  [204, 42],
  [220, 78],
  [168, 44],
  [190, 78],
  [122, 26],
  [250, 94],
  [0, 28],
  [0, 88],
];

function Circuit() {
  const c = RARITY_VAR.rare;
  return (
    <>
      <Fill color="var(--rarity-rare-soft)" />
      <g fill="none" stroke={c} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {TRACES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {PADS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={3.6} fill="var(--rarity-rare-soft)" stroke={c} strokeOpacity={0.8} strokeWidth={2} />
      ))}
      {/* микросхема с выводами */}
      <g>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} stroke={c} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round">
            <path d={`M${146 + i * 9} 36v-8M${146 + i * 9} 84v8`} />
          </g>
        ))}
        <rect x={138} y={36} width={48} height={48} rx={6} fill={c} fillOpacity={0.14} stroke={c} strokeOpacity={0.7} strokeWidth={2} />
        <rect x={150} y={48} width={24} height={24} rx={3} fill="none" stroke={c} strokeOpacity={0.55} strokeWidth={2} />
        <circle cx={156} cy={54} r={1.8} fill={c} fillOpacity={0.7} />
      </g>
    </>
  );
}

function Night({ uid }: { uid: string }) {
  const gid = `${uid}-night`;
  return (
    <>
      <defs>
        <linearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--art-shadow) 92%, var(--rarity-rare))" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--art-shadow) 60%, var(--rarity-rare))" }} />
        </linearGradient>
      </defs>
      <rect width={BANNER_W} height={BANNER_H} fill={`url(#${gid})`} />
      {NIGHT_STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="var(--art-gloss)" fillOpacity={st.o} />
      ))}
      <circle cx={262} cy={56} r={24} fill="var(--art-gloss)" fillOpacity={0.08} />
      <path d="M262 42A14 14 0 0 0 262 70A18.5 18.5 0 0 1 262 42Z" fill="var(--art-gloss)" fillOpacity={0.95} />
    </>
  );
}

function Aurora({ animate, uid }: { animate: boolean; uid: string }) {
  const a = `${uid}-au-a`;
  const b = `${uid}-au-b`;
  const c = `${uid}-au-c`;
  const stops = (color: string, top = 0.85) => (
    <>
      <stop offset="0" style={{ stopColor: color, stopOpacity: 0 }} />
      <stop offset="0.3" style={{ stopColor: color, stopOpacity: top }} />
      <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
    </>
  );
  return (
    <>
      <defs>
        <linearGradient id={a} x1={0} y1={0} x2={0} y2={1}>
          {stops(RARITY_VAR.rare)}
        </linearGradient>
        <linearGradient id={b} x1={0} y1={0} x2={0} y2={1}>
          {stops(RARITY_VAR.epic, 0.8)}
        </linearGradient>
        <linearGradient id={c} x1={0} y1={0} x2={0} y2={1}>
          {stops("color-mix(in srgb, var(--rarity-rare) 50%, var(--rarity-epic))", 0.7)}
        </linearGradient>
      </defs>
      <Fill color="color-mix(in srgb, var(--art-shadow) 90%, var(--rarity-epic))" />
      {AURORA_STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="var(--art-gloss)" fillOpacity={st.o * 0.8} />
      ))}
      <path className={cls(animate, "drift")} d="M-30 120C20 60 50 14 110 32S190 96 250 40 330 10 350 30V120Z" fill={`url(#${a})`} />
      <path className={cls(animate, "driftSlow")} d="M-30 120C30 80 70 40 130 58S210 108 270 56 330 36 350 56V120Z" fill={`url(#${b})`} />
      <path className={cls(animate, "drift")} d="M-30 120C10 96 60 70 110 84S200 112 260 80 320 68 350 84V120Z" fill={`url(#${c})`} />
    </>
  );
}

function Gold({ animate, uid }: { animate: boolean; uid: string }) {
  const c = RARITY_VAR.legendary;
  const gid = `${uid}-gold`;
  return (
    <>
      <defs>
        <radialGradient id={gid} cx={160} cy={132} r={120} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: c, stopOpacity: 0.6 }} />
          <stop offset="1" style={{ stopColor: c, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <Fill color="var(--rarity-legendary-soft)" />
      <g className={cls(animate, "raysSpin")}>
        {SUN_RAYS.map((d, i) => (
          <path key={i} d={d} fill={c} fillOpacity={0.26} />
        ))}
      </g>
      <circle cx={160} cy={132} r={120} fill={`url(#${gid})`} />
      {GOLD_SPARKS.map((sp, i) => (
        <path key={i} d={sp.d} fill={c} className={cls(animate, "twinkle")} style={animate ? { animationDelay: `${sp.delay}s` } : undefined} />
      ))}
    </>
  );
}

/** Фон по умолчанию (ничего не надето): мягкий primary и три крупных круга. */
export function DefaultBannerArt(): ReactNode {
  return (
    <>
      <Fill color="var(--primary-soft)" />
      <circle cx={52} cy={20} r={74} fill="var(--primary)" fillOpacity={0.09} />
      <circle cx={250} cy={104} r={96} fill="var(--primary)" fillOpacity={0.08} />
      <circle cx={170} cy={-16} r={44} fill="var(--primary)" fillOpacity={0.07} />
    </>
  );
}

/** Содержимое SVG фона (viewBox 0 0 320 120). `uid` — префикс id для градиентов. */
export function BannerArt({ id, animate = false, uid = "cb" }: { id: CosmeticId; animate?: boolean; uid?: string }): ReactNode {
  const def = cosmeticDef(id);
  if (!def || def.slot !== "banner") return null;
  switch (id) {
    case "banner-grid":
      return <Grid />;
    case "banner-binary":
      return <Binary />;
    case "banner-waves":
      return <Waves animate={animate} />;
    case "banner-circuit":
      return <Circuit />;
    case "banner-night":
      return <Night uid={uid} />;
    case "banner-aurora":
      return <Aurora animate={animate} uid={uid} />;
    case "banner-gold":
      return <Gold animate={animate} uid={uid} />;
    default:
      return null;
  }
}
