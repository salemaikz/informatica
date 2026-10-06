"use client";

import { Check, ListOrdered } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef } from "react";
import type { Scene, WorkedStep } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Markdown } from "@/components/Markdown";
import { Pill } from "@/components/ui/Pill";
import { SceneView } from "@/components/scenes/SceneView";
import { springBouncy, springSoft } from "@/components/motion/presets";

/** Сцена последнего из открытых шагов, у которого она есть (картинка «растёт» вместе с разбором). */
function currentScene(step: WorkedStep, shown: number): Scene | undefined {
  for (let i = shown - 1; i >= 0; i--) {
    const scene = step.steps[i].scene;
    if (scene) return scene;
  }
  return undefined;
}

/**
 * Пошаговый разбор «смотри, как решаю». Сколько шагов открыто — решает плеер (кнопка «Следующий шаг» / Enter),
 * здесь только отрисовка: нумерованный список (новый шаг подсвечен, старые приглушены), одна сцена сверху и итог.
 */
export function WorkedView({ step, revealed }: { step: WorkedStep; revealed: number }) {
  const { t, l } = useT();
  const total = step.steps.length;
  const shown = Math.max(1, Math.min(revealed, total));
  const finished = shown >= total;
  const scene = currentScene(step, shown);
  const endRef = useRef<HTMLDivElement>(null);

  // Новый шаг может оказаться под нижней панелью — подкручиваем (scroll-mb у маркера учитывает панель).
  useEffect(() => {
    if (shown <= 1) return;
    const id = window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
    return () => window.clearTimeout(id);
  }, [shown]);

  return (
    <div className="flex flex-col gap-4">
      <Pill tone="primary" className="self-start" icon={<ListOrdered size={14} />}>
        {t("lesson.worked")}
      </Pill>
      <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
      {/* Один SceneView без key: между состояниями он плавно перерисовывается сам. */}
      {scene && <SceneView scene={scene} />}
      <ol className="flex flex-col gap-2.5">
        {step.steps.slice(0, shown).map((s, i) => {
          const latest = i === shown - 1;
          return (
            <m.li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-2xl border-2 px-3 py-2 transition-colors duration-300",
                latest ? "border-primary/40 bg-primary-soft" : "border-transparent text-muted",
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-colors duration-300",
                  latest ? "bg-action-primary text-white" : "bg-surface-2 text-muted",
                )}
              >
                {i + 1}
              </span>
              <Markdown className={cn("min-w-0 flex-1 text-[17px]", latest && "font-semibold")}>{l(s.text)}</Markdown>
            </m.li>
          );
        })}
      </ol>
      {finished && step.result && (
        <m.div
          className="flex items-start gap-3 rounded-2xl border-2 border-success/30 bg-success-soft px-4 py-3 text-success-strong"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springBouncy, delay: 0.08 }}
        >
          <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action-success text-white">
            <Check size={16} strokeWidth={3.5} />
          </span>
          <Markdown className="min-w-0 flex-1 text-[17px] font-bold">{l(step.result)}</Markdown>
        </m.div>
      )}
      <div ref={endRef} aria-hidden className="scroll-mb-56" />
    </div>
  );
}
