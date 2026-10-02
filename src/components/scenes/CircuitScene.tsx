"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { DictKey } from "@/i18n/dict";
import { translate, useT } from "@/i18n/useT";
import { CIRCUIT_GEO, GATE_STYLE, evalCircuit, gateLabelLines, layoutCircuit, pointsAttr, type Bit, type CircuitScene as CircuitSceneData, type CircuitNode, type GateOp } from "./circuit";

const OP_KEY: Record<GateOp, DictKey> = {
  and: "scene.op.and",
  or: "scene.op.or",
  not: "scene.op.not",
  nand: "scene.op.nand",
  nor: "scene.op.nor",
  xor: "scene.op.xor",
};

/** Класс обводки провода по значению: 1 — success, 0 — muted, без значений — нейтрально. */
const wireClass = (v: Bit | undefined) => (v === undefined ? "stroke-muted" : v === 1 ? "stroke-success" : "stroke-muted/50");

/** Плашка со значением 0/1 на проводе. */
function ValueChip({ x, y, v, below }: { x: number; y: number; v: Bit; below: boolean }) {
  const top = below ? y + 3 : y - 19;
  return (
    <g>
      <rect x={x - 8} y={top} width={16} height={16} rx={5} className={cn("transition-colors duration-200", v === 1 ? "fill-success-soft stroke-success" : "fill-surface-2 stroke-border")} strokeWidth={1.5} />
      <text x={x} y={top + 12} textAnchor="middle" fontSize={13} fontWeight={800} className={cn("font-mono", v === 1 ? "fill-success-strong" : "fill-muted")}>
        {v}
      </text>
    </g>
  );
}

function GateShape({ node, label, v }: { node: CircuitNode; label: string[]; v: Bit | undefined }) {
  const style = GATE_STYLE[node.op!];
  const left = node.x - node.w / 2;
  const top = node.y - node.h / 2;
  return (
    <g>
      <rect
        x={left}
        y={top}
        width={node.w}
        height={node.h}
        rx={7}
        strokeWidth={2}
        className={cn("transition-colors duration-200", v === 1 ? "fill-success-soft stroke-success" : "fill-surface stroke-muted")}
      />
      <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={style.symbol.length > 1 ? 16 : 20} fontWeight={800} className="fill-text font-mono">
        {style.symbol}
      </text>
      {style.inverted && <circle cx={left + node.w + CIRCUIT_GEO.bubble} cy={node.y} r={CIRCUIT_GEO.bubble} strokeWidth={2} className={cn("fill-surface", v === 1 ? "stroke-success" : "stroke-muted")} />}
      <text x={node.x} y={top + node.h + 15} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-muted">
        {label.map((line, i) => (
          <tspan key={i} x={node.x} dy={i === 0 ? 0 : CIRCUIT_GEO.labelLine}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function Terminal({ node, label, v }: { node: CircuitNode; label: string; v: Bit | undefined }) {
  return (
    <g>
      <circle
        cx={node.x}
        cy={node.y}
        r={CIRCUIT_GEO.r}
        strokeWidth={2}
        className={cn("transition-colors duration-200", v === 1 ? "fill-success-soft stroke-success" : v === 0 ? "fill-surface-2 stroke-muted" : "fill-primary-soft stroke-primary")}
      />
      <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={15} fontWeight={800} className="fill-text">
        {label}
      </text>
    </g>
  );
}

/**
 * Логическая схема в школьном стиле: входы слева, вентили-прямоугольники (&, 1, кружок инверсии),
 * выход F справа. Провода — ломаные; при `values` провод со значением 1 зелёный, 0 — серый, значения подписаны.
 * Рисуется SVG с viewBox и масштабируется по ширине.
 */
export function CircuitScene({ scene }: { scene: CircuitSceneData }) {
  const { t, lang } = useT();
  // Подписи вентилей на языке ученика; длинные («НЕМЕСЕ-ЕМЕС») — в две строки, под них раскладка даёт место.
  const labels = useMemo(() => {
    const out: Partial<Record<GateOp, string[]>> = {};
    for (const op of Object.keys(OP_KEY) as GateOp[]) out[op] = gateLabelLines(translate(lang, OP_KEY[op]));
    return out as Record<GateOp, string[]>;
  }, [lang]);
  const labelLines = Math.max(1, ...scene.gates.map((g) => labels[g.op].length));
  const layout = useMemo(() => layoutCircuit(scene, { labelLines }), [scene, labelLines]);
  const hasValues = !!scene.values;
  const vals = useMemo(() => (scene.values ? evalCircuit(scene, scene.values) : null), [scene]);
  const valueOf = (id: string): Bit | undefined => (vals ? vals[id === layout.outId ? scene.output : id] : undefined);
  const G = CIRCUIT_GEO;

  return (
    <svg
      role="img"
      aria-label={t("scene.circuit.aria")}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="mx-auto block h-auto w-full"
      style={{ maxWidth: Math.round(layout.width * 1.6) }}
    >
      {/* Провода — под узлами. Цвет — по значению источника. */}
      {layout.wires.map((w) => (
        <polyline
          key={`${w.from}>${w.to}:${w.port}`}
          points={pointsAttr(w.points)}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-colors duration-200", wireClass(valueOf(w.from)))}
        />
      ))}

      {layout.nodes.map((n) => {
        if (n.kind === "gate") return <GateShape key={n.id} node={n} label={labels[n.op!]} v={valueOf(n.id)} />;
        return <Terminal key={n.id} node={n} label={n.label} v={valueOf(n.id)} />;
      })}

      {/* Значения: по одной плашке на выходе каждого источника (вход или вентиль). */}
      {hasValues &&
        layout.nodes
          .filter((n) => n.kind !== "output")
          .map((n) => {
            const v = valueOf(n.id);
            if (v === undefined) return null;
            const px = n.x + n.w / 2 + (n.op && GATE_STYLE[n.op].inverted ? G.bubble * 2 : 0) + 12;
            // Плашка — с той стороны провода, куда не уходит вертикальный излом.
            const goesUp = layout.wires.some((w) => w.from === n.id && w.points.length > 2 && w.points[2][1] < n.y);
            return <ValueChip key={`v:${n.id}`} x={px} y={n.y} v={v} below={goesUp} />;
          })}
    </svg>
  );
}
