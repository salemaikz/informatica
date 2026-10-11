"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { GRID, SPRITES, build, type Px } from "./sprites";

const FLICKER = [1, 0.35, 0.9, 0.5, 1, 0.7, 1];

/** Пиксельный герой: тело + мерцающие слои + свечение и искры у эпика и легенды. */
export function SpriteView({ skin, className, crop = false, tint }: { skin: string; className?: string; crop?: boolean; tint?: string }) {
  const reduce = useReducedMotion();
  const s = SPRITES[skin] ?? SPRITES.warrior;
  const b = build(skin);
  const vb = crop ? `${b.box.x - 1} ${b.box.y - 1} ${b.box.w + 2} ${b.box.h + 2}` : `0 0 ${GRID} ${GRID}`;
  const flicker = (delay: number) =>
    reduce ? undefined : { opacity: FLICKER, transition: { duration: 1.1, repeat: Infinity, ease: "linear" as const, delay } };
  const layer = (paths: typeof b.paths) =>
    paths.map((p) => <path key={p.c} d={p.d} fill={p.c} />);
  return (
    <div className={cn("relative", className)} style={tint ? { filter: tint } : undefined}>
      {s.aura && (
        <m.div
          aria-hidden
          className="absolute inset-[8%] rounded-full blur-xl"
          style={{ background: `radial-gradient(closest-side, ${s.aura}88, transparent)` }}
          animate={reduce ? undefined : { opacity: s.embers ? FLICKER : [0.5, 0.9, 0.5] }}
          transition={{ duration: s.embers ? 1.4 : 2.4, repeat: Infinity, ease: "linear" }}
        />
      )}
      {s.behind && (
        <m.svg aria-hidden viewBox={vb} shapeRendering="crispEdges" className="absolute inset-0 h-full w-full" animate={flicker(0.3)}>
          {layer(b.behind)}
        </m.svg>
      )}
      <svg viewBox={vb} shapeRendering="crispEdges" className="relative block h-full w-full" role="img" aria-label="герой">
        {layer(b.paths)}
      </svg>
      {s.fx && (
        <m.svg aria-hidden viewBox={vb} shapeRendering="crispEdges" className="absolute inset-0 h-full w-full" animate={flicker(0)}>
          {layer(b.fx)}
        </m.svg>
      )}
      {s.embers && !reduce && <Embers colors={s.embers} />}
    </div>
  );
}

function Embers({ colors }: { colors: string[] }) {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <m.span
          key={i}
          aria-hidden
          className="absolute block"
          style={{ left: `${22 + ((i * 37) % 58)}%`, bottom: "22%", width: i % 3 === 0 ? 4 : 3, height: i % 3 === 0 ? 4 : 3, background: colors[i % colors.length] }}
          animate={{ y: [0, -70 - (i % 4) * 14], opacity: [0, 1, 0] }}
          transition={{ duration: 1.8 + (i % 3) * 0.4, repeat: Infinity, delay: i * 0.25, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

/** Рассыпание на пиксели: блоки 2×2 разлетаются сверху вниз. */
export function Dissolve({ skin, grey = false }: { skin: string; grey?: boolean }) {
  const b = build(skin);
  const blocks = new Map<string, Px>();
  for (const p of b.pixels) {
    const k = `${p.x >> 1},${p.y >> 1}`;
    if (!blocks.has(k)) blocks.set(k, p);
  }
  const cell = 100 / GRID;
  return (
    <div className="absolute inset-0" style={grey ? { filter: "grayscale(1)" } : undefined}>
      {[...blocks.values()].map((p, i) => {
        const r1 = ((i * 2654435761) >>> 0) / 4294967296;
        const r2 = ((i * 40503 + 12345) >>> 0) % 1000 / 1000;
        return (
          <m.span
            key={i}
            className="absolute block"
            style={{ left: `${(p.x >> 1) * 2 * cell}%`, top: `${(p.y >> 1) * 2 * cell}%`, width: `${cell * 2}%`, height: `${cell * 2}%`, background: p.c }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: (r1 - 0.5) * 120, y: [0, -30 - r2 * 70, 40 + r2 * 40], opacity: [1, 1, 0] }}
            transition={{ duration: 1.1, delay: 0.45 + (p.y / GRID) * 0.4 + r2 * 0.15, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- эффекты
const FX_PAL: Record<string, string> = { w: "#ffffff", y: "#ffe45c", o: "#ff8a1f", d: "#c2410c" };

function slashRows(n: number): string[] {
  const rows: string[] = [];
  for (let j = 0; j < n; j++) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const w = 0.6 + 3.2 * Math.sin(Math.PI * t);
      const dist = Math.abs(j - i - 2 * Math.sin(Math.PI * t));
      s += dist < w * 0.35 ? "w" : dist < w * 0.7 ? "y" : dist < w ? "o" : ".";
    }
    rows.push(s);
  }
  return rows;
}
function PixelArt({ rows, className }: { rows: string[]; className?: string }) {
  return (
    <svg viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" className={className} aria-hidden>
      {rows.flatMap((row, j) => [...row].map((ch, i) => (ch === "." ? null : <rect key={`${i}-${j}`} x={i} y={j} width="1" height="1" fill={FX_PAL[ch]} />)))}
    </svg>
  );
}
const SLASH = slashRows(22);
const STAR = ["...y...", "..yyy..", "yywwwyy", "..yyy..", "...y..."];
const BURST = (() => {
  const n = 15;
  return Array.from({ length: n }, (_, j) =>
    [...Array(n)].map((_, i) => {
      const dx = Math.abs(i - 7), dy = Math.abs(j - 7);
      if (dx + dy < 2) return "w";
      if (dx === 0 || dy === 0) return dx + dy < 7 ? "y" : ".";
      if (dx === dy) return dx < 5 ? "o" : ".";
      return ".";
    }).join(""),
  );
})();

/** Росчерк удара: диагональ, вспышка искры. big — крит (две диагонали и звезда). */
export function Slash({ big }: { big?: boolean }) {
  return (
    <m.div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.5, x: -24, y: -24 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1, 1], x: [-24, 0, 6, 10], y: [-24, 0, 6, 10] }}
      transition={{ duration: 0.45, times: [0, 0.3, 0.7, 1], ease: "linear" }}
    >
      <PixelArt rows={SLASH} className={big ? "h-36 w-36" : "h-24 w-24"} />
      {big && <PixelArt rows={SLASH} className="absolute h-36 w-36 -scale-x-100" />}
      {big && <PixelArt rows={BURST} className="absolute h-44 w-44" />}
    </m.div>
  );
}

export function PixelStar({ className }: { className?: string }) {
  return <PixelArt rows={STAR} className={className} />;
}
