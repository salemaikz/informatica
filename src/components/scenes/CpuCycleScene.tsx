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
const R = 108;
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

/** Ширина кристалла под текст, единицы. */
const INSTR_W = 54;
const INSTR_MIN = 9;

/** Размер шрифта команды в центре кристалла: короткая «2 + 3» крупно, длинная мельче (не меньше INSTR_MIN). */
export const instrFontSize = (len: number) => Math.max(INSTR_MIN, Math.min(17, Math.floor(INSTR_W / Math.max(len, 1) / 0.62)));

/** Длинную команду (шрифт ниже ~11) переносим на две строки по ближайшему к середине пробелу. */
export function instrLines(instr: string): string[] {
  if (instrFontSize(instr.length) >= 11 || !instr.includes(" ")) return [instr];
  const mid = instr.length / 2;
  let best = -1;
  for (let i = 0; i < instr.length; i++) if (instr[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [instr.slice(0, best).trim(), instr.slice(best + 1).trim()];
}

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
          {[-20, -7, 7, 20].map((o) => (
            <g key={o} stroke="var(--muted)" strokeWidth={2.4} strokeLinecap="round">
              <line x1={CX + o} y1={CY - 43} x2={CX + o} y2={CY - 36} />
              <line x1={CX + o} y1={CY + 36} x2={CX + o} y2={CY + 43} />
              <line x1={CX - 43} y1={CY + o} x2={CX - 36} y2={CY + o} />
              <line x1={CX + 36} y1={CY + o} x2={CX + 43} y2={CY + o} />
            </g>
          ))}
          <rect x={CX - 36} y={CY - 36} width={72} height={72} rx={10} fill="var(--surface-2)" stroke="var(--muted)" strokeWidth={2} />
          <rect x={CX - 28} y={CY - 28} width={56} height={56} rx={6} fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth={1.6} />
          {instr ? (
            (() => {
              const lines = instrLines(instr);
              const longest = Math.max(...lines.map((x) => x.length));
              const fs = instrFontSize(longest);
              return (
                <text
                  x={CX}
                  y={CY}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={fs}
                  fontWeight={800}
                  fill="var(--text)"
                >
                  {lines.map((ln, i) => (
                    <tspan
                      key={i}
                      x={CX}
                      dy={lines.length === 1 ? "0.35em" : i === 0 ? "-0.15em" : "1.15em"}
                      // длинная строка сжимается по ширине кристалла
                      textLength={ln.length * 0.62 * fs > INSTR_W ? INSTR_W : undefined}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {ln}
                    </tspan>
                  ))}
                </text>
              );
            })()
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
              <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={800} fill={on ? "var(--on-primary, #fff)" : "var(--muted)"}>
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
