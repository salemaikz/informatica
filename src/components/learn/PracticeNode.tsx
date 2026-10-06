"use client";

import { m } from "motion/react";
import { Check, Dumbbell, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { useApp } from "@/lib/store";
import { springBouncy } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { bestPercent, completionsBadge, pathItemNodeId, type NodeItem, type NodeKindState, type PathNode } from "./map";
import { pluralKey } from "./useLearn";

// Узел «Практика» (после группы уроков) и «Повторение» (в конце раздела) на дороге: круглый, как урок, но «контуром»:
// доступен — primary (контур), пройден — success (заливка) и число прохождений. Ничего не блокирует (#22).

const SIZE = 68;
const HALF = SIZE / 2;
/** Зазор между узлом и подписью. */
const GAP = 12;

const FACE: Record<NodeKindState, string> = {
  done: "border-b-[6px] border-action-success-edge bg-action-success text-white",
  recommended: "border-2 border-b-[6px] border-primary bg-primary-soft text-primary",
  available: "border-2 border-b-[6px] border-primary bg-primary-soft text-primary",
};

export function PracticeNode({
  node,
  index,
  item,
  title,
  state,
  pulse,
  onOpen,
}: {
  node: PathNode;
  /** Номер элемента на дороге — для лёгкой «лесенки» появления. */
  index: number;
  item: NodeItem;
  /** Название группы («Ветвления») или раздела. */
  title: string;
  state: NodeKindState;
  /** Анимированный пульс — только когда на карте нет рекомендованного урока (пульсирует один следующий шаг). */
  pulse: boolean;
  onOpen: () => void;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const stat = useApp((s) => s.courseNodes[pathItemNodeId(item)!]);
  const runs = stat?.runs ?? 0;
  const done = state === "done";
  const Icon = item.kind === "practice" ? Dumbbell : RefreshCw;
  const kind = t(item.kind === "practice" ? "course3.node.practice" : "course3.node.recap");
  const badge = done ? completionsBadge(runs) : null;
  const best = bestPercent(stat?.best);
  const stateText = done ? t(pluralKey("course3.node.state.done", runs), { n: runs }) : state === "recommended" ? t("course3.node.state.recommended") : t("course3.node.state.new");
  const labelRight = node.label === "right";
  // Подпись: от края узла к центру и дальше, не шире половины дорожки (как у урока).
  const labelStyle = labelRight
    ? { left: `calc(50% + ${node.x + HALF + GAP}px)`, maxWidth: `min(12rem, calc(50% - ${node.x + HALF + GAP}px))` }
    : { right: `calc(50% - ${node.x - HALF - GAP}px)`, maxWidth: `min(12rem, calc(50% + ${node.x - HALF - GAP}px))` };

  return (
    <>
      <div className="absolute" style={{ left: `calc(50% + ${node.x - HALF}px)`, top: node.y - HALF, width: SIZE, height: SIZE }}>
        <m.div
          className="relative h-full w-full"
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ ...springBouncy, delay: (index % 4) * 0.05 }}
        >
          {state === "recommended" &&
            (reduce || !pulse ? (
              // «Меньше анимаций» или пульс занят уроком: вместо пульса — неподвижное кольцо, чтобы подсказка «пора» не пропала.
              <span aria-hidden className="pointer-events-none absolute -inset-1.5 rounded-full border-4 border-primary/30" />
            ) : (
              <m.span
                aria-hidden
                className="absolute inset-0 rounded-full border-4 border-primary"
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: 1.5, opacity: [0, 0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", opacity: { duration: 2.2, times: [0, 0.18, 1], repeat: Infinity, ease: "easeInOut" } }}
              />
            ))}
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            aria-label={t("course3.node.aria", { kind, title, state: stateText })}
            className={cn(
              "relative flex h-full w-full items-center justify-center rounded-full transition-[translate,border-width] duration-75",
              "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary active:translate-y-[4px] active:border-b-2",
              FACE[state],
            )}
          >
            {/* Пунктирное кольцо внутри: отличает узел тренировки от урока с его «бликом». */}
            <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-full border-2 border-dashed border-current opacity-35" />
            <Icon size={28} strokeWidth={2.4} aria-hidden />
          </button>
          {badge && (
            <span className="pointer-events-none absolute -right-1.5 -top-1 rounded-full border-2 border-surface bg-action-success px-1.5 text-[11px] font-black leading-4 text-white">
              {badge}
            </span>
          )}
          {done && (
            <span className="pointer-events-none absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface text-success-strong">
              <Check size={14} strokeWidth={3.5} aria-hidden />
            </span>
          )}
        </m.div>
      </div>

      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onOpen}
        className={cn("absolute -translate-y-1/2 text-left", !labelRight && "text-right")}
        style={{ ...labelStyle, top: node.y }}
      >
        <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">{kind}</span>
        <span className="line-clamp-2 text-sm font-extrabold leading-snug text-text">{title}</span>
        {done && best > 0 && <span className="mt-0.5 block text-xs font-bold text-success-strong">{t("course3.node.best", { best })}</span>}
      </button>
    </>
  );
}
