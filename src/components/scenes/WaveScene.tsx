"use client";

import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { levelsFormula, waveLayout, wavePanels, type WavePanel } from "./wave";

type WaveSceneData = Extract<Scene, { kind: "wave" }>;

function Chip({ children }: { children: string }) {
  return <span className="rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-xs font-bold text-muted">{children}</span>;
}

/** Одна панель: подпись, рисунок (волна, сетка, отсчёты, ступеньки), ниже — числа. */
function Panel({ panel, reduce }: { panel: WavePanel; reduce: boolean }) {
  const { t, l } = useT();
  const lay = waveLayout(panel);
  const spring = reduce ? { duration: 0 } : springSoft;
  const dim = panel.digital; // при цифровой кривой исходная волна — бледная

  return (
    <div className="flex flex-col gap-1.5">
      {panel.label !== undefined && <p className="px-1 text-sm font-extrabold text-muted">{l(panel.label)}</p>}
      <div className="rounded-2xl border-2 border-border bg-surface p-1.5">
        <svg viewBox={`0 0 ${lay.w} ${lay.h}`} className="block h-auto w-full" aria-hidden="true">
          {lay.grid.map((y, k) => (
            <line key={`g${k}`} x1={8} x2={lay.w - 8} y1={y} y2={y} strokeWidth={1} strokeDasharray="3 4" className="stroke-border" />
          ))}
          <line x1={8} x2={lay.w - 8} y1={lay.axisY} y2={lay.axisY} strokeWidth={1.5} className="stroke-muted/60" />
          <path
            d={lay.wavePath}
            fill="none"
            strokeWidth={dim ? 2 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={dim ? "stroke-muted/45" : "stroke-primary"}
          />
          {lay.stepPath && (
            <m.path
              key={lay.stepPath}
              d={lay.stepPath}
              fill="none"
              strokeWidth={2.5}
              strokeLinejoin="round"
              className="stroke-ink-primary"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          {lay.samples.map((s) => {
            const y = panel.digital ? s.yq : s.y;
            return (
              <g key={`s${s.i}`}>
                <m.line
                  x1={s.x}
                  x2={s.x}
                  y1={lay.axisY}
                  initial={reduce ? false : { y2: lay.axisY, opacity: 0 }}
                  animate={{ y2: y, opacity: 1 }}
                  transition={{ ...spring, delay: reduce ? 0 : Math.min(s.i * 0.015, 0.3) }}
                  strokeWidth={lay.samples.length > 24 ? 1.2 : 1.6}
                  className={panel.digital ? "stroke-ink-primary/70" : "stroke-primary/60"}
                />
                {panel.digital && <circle cx={s.x} cy={s.y} r={1.8} className="fill-muted" />}
                <m.circle
                  cx={s.x}
                  r={lay.samples.length > 24 ? 2.4 : 3.2}
                  initial={reduce ? false : { cy: lay.axisY, opacity: 0 }}
                  animate={{ cy: y, opacity: 1 }}
                  transition={{ ...spring, delay: reduce ? 0 : Math.min(s.i * 0.015, 0.3) }}
                  className={panel.digital ? "fill-ink-primary stroke-surface" : "fill-surface stroke-ink-primary"}
                  strokeWidth={1.6}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {panel.samples > 0 && <Chip>{t("scene.wave.samples", { n: panel.samples })}</Chip>}
        {panel.bits !== undefined && <Chip>{t("scene.wave.bits", { n: panel.bits })}</Chip>}
        {panel.bits !== undefined && <Chip>{t("scene.wave.levels", { f: levelsFormula(panel.bits) })}</Chip>}
      </div>
    </div>
  );
}

/** Звук: волна, отсчёты с шагом 1/f, сетка уровней 2ⁱ и ступенчатая кривая; compare — второй рисунок ниже. */
export function WaveScene({ scene }: { scene: WaveSceneData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const panels = wavePanels(scene);
  const aria = panels
    .map((p, i) =>
      [
        i > 0 ? t("scene.wave.ariaCompare") : t("scene.wave.aria"),
        p.label !== undefined ? l(p.label) : "",
        p.samples > 0 ? t("scene.wave.samples", { n: p.samples }) : "",
        p.bits !== undefined ? t("scene.wave.bits", { n: p.bits }) : "",
        p.digital ? t("scene.wave.ariaDigital") : "",
      ]
        .filter(Boolean)
        .join(", "),
    )
    .join(". ");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3" role="img" aria-label={aria}>
      {panels.map((p, i) => (
        <Panel key={i} panel={p} reduce={reduce} />
      ))}
    </div>
  );
}
