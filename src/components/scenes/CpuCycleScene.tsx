"use client";

import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";

type CpuCycleData = Extract<Scene, { kind: "cpu-cycle" }>;

const NAME_KEYS = ["basics.cpu.s0", "basics.cpu.s1", "basics.cpu.s2", "basics.cpu.s3"] as const;
const DESC_KEYS = ["basics.cpu.d0", "basics.cpu.d1", "basics.cpu.d2", "basics.cpu.d3"] as const;

// Геометрия (viewBox 360×290): центр кольца, радиус, четыре этапа по диагоналям, по часовой стрелке.
const VW = 360;
const VH = 290;
const CX = 180;
const CY = 150;
const R = 104;
const NODE_R = 22;
/** Углы этапов (градусы, 0 = вправо, по часовой): слева-сверху, справа-сверху, справа-снизу, слева-снизу. */
const ANGLES = [-135, -45, 45, 135] as const;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r = R) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) });
const f = (n: number) => +n.toFixed(2);

/** Дуга по кольцу от этапа i к следующему со стрелкой на конце. */
function arcArrow(i: number) {
  const gap = 19; // отступ от кружков (градусы)
  const a1 = ANGLES[i] + gap;
  const a2 = ANGLES[i] + 90 - gap;
  const p1 = pt(a1);
  const p2 = pt(a2);
  // Наконечник: остриё в конце дуги, направление — касательная к кольцу.
  const tx = -Math.sin(rad(a2));
  const ty = Math.cos(rad(a2));
  const nx = -ty; // нормаль
  const ny = tx;
  const len = 9;
  const half = 5.5;
  const bx = p2.x - tx * len;
  const by = p2.y - ty * len;
  return {
    d: `M${f(p1.x)} ${f(p1.y)} A${R} ${R} 0 0 1 ${f(p2.x)} ${f(p2.y)}`,
    head: `${f(p2.x + tx * 2)},${f(p2.y + ty * 2)} ${f(bx + nx * half)},${f(by + ny * half)} ${f(bx - nx * half)},${f(by - ny * half)}`,
  };
}

/** Размер шрифта команды в центре кристалла: короткая «2 + 3» крупно, длинная мельче. */
export const instrFontSize = (len: number) => Math.max(8, Math.min(17, Math.floor(56 / Math.max(len, 1) / 0.62)));

/**
 * Цикл процессора: выборка → декодирование → выполнение → запись по кругу вокруг значка процессора.
 * step — активный этап (primary), instr — команда в центре.
 */
export function CpuCycleScene({ scene }: { scene: CpuCycleData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const step = scene.step;
  const instr = scene.instr?.trim();
  const fade = reduce ? undefined : "fill 250ms ease, stroke 250ms ease, opacity 250ms ease";

  const aria =
    step === undefined
      ? t("basics.cpu.aria")
      : `${t("basics.cpu.aria")}. ${t("basics.cpu.now", { n: step + 1, name: t(NAME_KEYS[step]) })}`;

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={aria} className="block h-auto w-full">
        {/* кольцо-подложка */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" />

        {/* стрелки между этапами */}
        {ANGLES.map((_, i) => {
          const a = arcArrow(i);
          const on = step === i;
          const color = on ? "var(--primary)" : "var(--muted)";
          return (
            <g key={i} aria-hidden="true" style={{ opacity: on ? 1 : 0.5, transition: fade }}>
              <path d={a.d} fill="none" stroke={color} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
              <polygon points={a.head} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />
            </g>
          );
        })}

        {/* процессор в центре */}
        <g aria-hidden="true">
          {[-18, -6, 6, 18].map((o) => (
            <g key={o} stroke="var(--muted)" strokeWidth={2.4} strokeLinecap="round">
              <line x1={CX + o} y1={CY - 40} x2={CX + o} y2={CY - 33} />
              <line x1={CX + o} y1={CY + 33} x2={CX + o} y2={CY + 40} />
              <line x1={CX - 40} y1={CY + o} x2={CX - 33} y2={CY + o} />
              <line x1={CX + 33} y1={CY + o} x2={CX + 40} y2={CY + o} />
            </g>
          ))}
          <rect x={CX - 33} y={CY - 33} width={66} height={66} rx={9} fill="var(--surface-2)" stroke="var(--muted)" strokeWidth={2} />
          <rect x={CX - 24} y={CY - 24} width={48} height={48} rx={5} fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth={1.6} />
          {instr ? (
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono"
              fontSize={instrFontSize(instr.length)}
              fontWeight={800}
              fill="var(--text)"
            >
              {instr}
            </text>
          ) : (
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill="var(--primary)">
              CPU
            </text>
          )}
        </g>

        {/* этапы */}
        {ANGLES.map((deg, i) => {
          const c = pt(deg);
          const on = step === i;
          const top = i < 2;
          const ly = top ? c.y - NODE_R - 12 : c.y + NODE_R + 22;
          return (
            <g key={i} aria-hidden="true">
              {on && <circle cx={c.x} cy={c.y} r={NODE_R + 6} fill="var(--primary)" opacity={0.2} />}
              <circle
                cx={c.x}
                cy={c.y}
                r={NODE_R}
                fill={on ? "var(--primary)" : "var(--surface)"}
                stroke={on ? "var(--primary-strong)" : "var(--border)"}
                strokeWidth={2.5}
                style={{ transition: fade }}
              />
              <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={800} fill={on ? "#fff" : "var(--muted)"}>
                {i + 1}
              </text>
              <text
                x={c.x}
                y={ly}
                textAnchor="middle"
                fontSize={14}
                fontWeight={on ? 800 : 700}
                fill={on ? "var(--primary)" : "var(--text)"}
                style={{ transition: fade }}
              >
                {t(NAME_KEYS[i])}
              </text>
            </g>
          );
        })}
      </svg>

      {step !== undefined && (
        <div className={cn("mx-auto mt-1 max-w-sm rounded-2xl bg-primary-soft px-4 py-2.5 text-center")}>
          <div className="text-xs font-extrabold text-primary">
            {t("basics.cpu.step", { n: step + 1 })} · {t(NAME_KEYS[step])}
          </div>
          <div className="mt-0.5 text-sm font-semibold leading-snug text-text">{t(DESC_KEYS[step])}</div>
        </div>
      )}
    </div>
  );
}
