"use client";

import { useMemo } from "react";
import { m } from "motion/react";
import { springSnappy } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { cn } from "@/lib/cn";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { SW_GEO, layoutSwitches, pointsOf, type SwitchPart } from "./switches";

type SwitchesSceneData = Extract<Scene, { kind: "switches" }>;

const ARIA_KEY: Record<SwitchesSceneData["mode"], DictKey> = {
  and: "scene.switches.aria.and",
  or: "scene.switches.aria.or",
  not: "scene.switches.aria.not",
  xor: "scene.switches.aria.xor",
};

/** Контактная точка: белая (фон) с обводкой. */
function Contact({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3.6} strokeWidth={2} className="fill-surface stroke-muted" />;
}

/** Ключ: однополюсный рычажок, переключатель на два контакта или кнопка-размыкатель. Положение анимируется. */
function Part({ part, live, reduce }: { part: SwitchPart; live: boolean; reduce: boolean }) {
  const tr = reduce ? { duration: 0 } : springSnappy;
  const lever = cn("transition-colors duration-200", live ? "stroke-success" : "stroke-muted");
  if (part.kind === "button") {
    const pressed = !part.closed;
    const [cx, cy] = part.pivot;
    return (
      <g>
        {part.contacts.map(([x, y], i) => (
          <Contact key={i} x={x} y={y} />
        ))}
        {/* Кнопка с перемычкой: нажатие отводит перемычку от контактов — цепь разорвана. */}
        <m.g initial={false} animate={{ y: pressed ? SW_GEO.press : 0 }} transition={tr}>
          <line x1={part.contacts[0][0]} y1={cy} x2={part.contacts[1][0]} y2={cy} strokeWidth={3.5} strokeLinecap="round" className={lever} />
          <line x1={cx} y1={cy - 24} x2={cx} y2={cy} strokeWidth={2.5} strokeLinecap="round" className="stroke-muted" />
          <line x1={cx - 10} y1={cy - 26} x2={cx + 10} y2={cy - 26} strokeWidth={5} strokeLinecap="round" className={pressed ? "stroke-danger" : "stroke-primary"} />
        </m.g>
      </g>
    );
  }
  const [px, py] = part.pivot;
  return (
    <g>
      {part.contacts.map(([x, y], i) => (
        <Contact key={i} x={x} y={y} />
      ))}
      <m.line x1={px} y1={py} initial={false} animate={{ x2: part.lever[0], y2: part.lever[1] }} transition={tr} strokeWidth={3.5} strokeLinecap="round" className={lever} />
      <circle cx={px} cy={py} r={3.6} className="fill-text" />
    </g>
  );
}

/**
 * Электрическая цепь: батарейка, ключи и лампа. and — ключи последовательно, or — параллельно, not — кнопка-размыкатель,
 * xor — «коридорная» лампа на двух переключателях. Горит ли лампа — считает код (`switches.ts`); по проводам с током идёт зелёный цвет.
 */
export function SwitchesScene({ scene }: { scene: SwitchesSceneData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const lay = useMemo(() => layoutSwitches(scene), [scene]);
  const G = SW_GEO;
  const lampWord = t("scene.switches.lamp");
  const aria = `${t(ARIA_KEY[scene.mode])}. ${lay.parts.map((p) => `${p.name} = ${p.value}`).join(", ")}. ${lampWord}: ${t(lay.on ? "scene.switches.lampOn" : "scene.switches.lampOff")}`;
  const [bx, by] = lay.battery;
  const [lx, ly] = lay.lamp;
  const lampStroke = lay.on ? "stroke-gold" : "stroke-muted";

  return (
    <svg role="img" aria-label={aria} viewBox={`0 0 ${lay.width} ${lay.height}`} className="mx-auto block h-auto w-full" style={{ maxWidth: Math.round(lay.width * 1.5) }}>
      {lay.wires.map((w, i) => (
        <polyline key={i} points={pointsOf(w.points)} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={cn("transition-colors duration-200", w.live ? "stroke-success" : "stroke-muted/60")} />
      ))}
      {lay.junctions.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={3.4} className={cn("transition-colors duration-200", lay.on ? "fill-success" : "fill-muted")} />
      ))}

      {/* Батарейка: длинная пластина и короткая. */}
      <line x1={bx - 4} y1={by - 12} x2={bx - 4} y2={by + 12} strokeWidth={3} strokeLinecap="round" className="stroke-text" />
      <line x1={bx + 4} y1={by - 7} x2={bx + 4} y2={by + 7} strokeWidth={5} strokeLinecap="round" className="stroke-text" />

      {lay.parts.map((p, i) => (
        <Part key={i} part={p} live={lay.on && p.closed} reduce={reduce} />
      ))}

      {/* Подписи ключей: имя и положение (1 — замкнут / нажат, у «НЕ» нажатие размыкает цепь). */}
      {lay.parts.map((p, i) => (
        <text key={`l${i}`} x={p.label[0]} y={p.label[1]} textAnchor="middle" fontSize={14} fontWeight={800} className="font-mono fill-text">
          {p.name} = <tspan className={p.value === 1 ? "fill-success-strong" : "fill-muted"}>{p.value}</tspan>
        </text>
      ))}

      {/* Лампа: горит — золотое свечение, не горит — серая. */}
      <m.circle cx={lx} cy={ly} r={G.lampR + 10} initial={false} animate={{ opacity: lay.on ? 0.35 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.25 }} className="fill-gold" />
      <circle cx={lx} cy={ly} r={G.lampR} strokeWidth={2.5} className={cn("transition-colors duration-200", lay.on ? "fill-gold-soft stroke-gold" : "fill-surface-2 stroke-muted")} />
      <path d={`M${lx - 10.6} ${ly - 10.6}L${lx + 10.6} ${ly + 10.6}M${lx + 10.6} ${ly - 10.6}L${lx - 10.6} ${ly + 10.6}`} strokeWidth={2.5} strokeLinecap="round" className={cn("transition-colors duration-200", lampStroke)} />
      <text x={lay.lampLabel[0]} y={lay.lampLabel[1]} textAnchor="middle" fontSize={13} fontWeight={800} className="fill-muted">
        {lampWord}: <tspan className={cn("font-mono", lay.on ? "fill-text" : "fill-muted")}>{lay.on ? 1 : 0}</tspan>
      </text>
    </svg>
  );
}
