"use client";

import { cn } from "@/lib/cn";
import type { DictKey } from "@/i18n/dict";
import { translate, useT } from "@/i18n/useT";
import type { GateOp, Scene } from "@/lib/types";
import { CIRCUIT_GEO, GATE_STYLE } from "./circuit";
import { GATE_FORMULA, GLYPH_MAX_PX, gateGlyph, gatesColumns } from "./gates";

type GatesSceneData = Extract<Scene, { kind: "gates" }>;

const NAME_KEY: Record<GateOp, DictKey> = {
  and: "scene.gates.and",
  or: "scene.gates.or",
  not: "scene.gates.not",
  nand: "scene.gates.nand",
  nor: "scene.gates.nor",
  xor: "scene.gates.xor",
};

/** Значок вентиля — тот же рисунок, что в CircuitScene (рамка, «&» / «1» / «=1», кружок инверсии), с короткими выводами. */
function GateGlyph({ op, active }: { op: GateOp; active: boolean }) {
  const g = gateGlyph(op);
  const style = GATE_STYLE[op];
  const line = active ? "stroke-primary" : "stroke-muted";
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden="true" className="mx-auto block h-auto w-full" style={{ maxWidth: GLYPH_MAX_PX }}>
      {g.inputs.map(([x, y], i) => (
        <line key={i} x1={x} y1={y} x2={g.box.x} y2={y} strokeWidth={2.5} strokeLinecap="round" className={line} />
      ))}
      <line x1={g.box.x + g.box.w + (g.bubble ? CIRCUIT_GEO.bubble * 2 : 0)} y1={g.out[1]} x2={g.out[0]} y2={g.out[1]} strokeWidth={2.5} strokeLinecap="round" className={line} />
      <rect x={g.box.x} y={g.box.y} width={g.box.w} height={g.box.h} rx={7} strokeWidth={2} className={cn("fill-surface", line)} />
      <text x={g.box.x + g.box.w / 2} y={g.box.y + g.box.h / 2 + 6} textAnchor="middle" fontSize={style.symbol.length > 1 ? 16 : 20} fontWeight={800} className="fill-text font-mono">
        {style.symbol}
      </text>
      {g.bubble && <circle cx={g.bubble[0]} cy={g.bubble[1]} r={CIRCUIT_GEO.bubble} strokeWidth={2} className={cn("fill-surface", line)} />}
    </svg>
  );
}

/**
 * Галерея вентилей: значок (как в схемах), название и формула. `highlight` — рамка и фон `primary`.
 * Число колонок зависит от числа вентилей и от длины самого длинного слова названия (kk: «НЕМЕСЕ-ЕМЕС»).
 */
export function GatesScene({ scene }: { scene: GatesSceneData }) {
  const { t, lang } = useT();
  const names = scene.ops.map((op) => translate(lang, NAME_KEY[op]));
  const cols = gatesColumns(scene.ops.length, names);
  const hl = new Set(scene.highlight ?? []);
  const marked = scene.ops.filter((op) => hl.has(op)).map((op) => translate(lang, NAME_KEY[op]));
  const ariaLabel = `${t("scene.gates.aria")}: ${names.join(", ")}${marked.length ? `. ${t("scene.gates.ariaHl")}: ${marked.join(", ")}` : ""}`;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div role="img" aria-label={ariaLabel} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {scene.ops.map((op, i) => {
          const on = hl.has(op);
          return (
            <div
              key={op}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-2 text-center transition-colors duration-200",
                on ? "border-primary bg-primary-soft" : "border-border bg-surface",
              )}
            >
              <GateGlyph op={op} active={on} />
              <div className="text-[13px] font-bold leading-tight text-balance text-text">{names[i]}</div>
              <div className="font-mono text-xs font-bold text-muted">{GATE_FORMULA[op]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
