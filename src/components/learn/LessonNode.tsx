"use client";

import { m } from "motion/react";
import { Clock, Lock, Play, Star } from "lucide-react";
import type { LessonRef } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { completionsBadge, type NodeState, type PathNode } from "./map";

// Узел урока на дороге: круглая «кнопка» с объёмным низом + подпись сбоку (со стороны центра).

const SIZE = 68;
const HALF = SIZE / 2;
/** Зазор между узлом и подписью. */
const GAP = 12;

const FACE: Record<NodeState, string> = {
  done: "border-warning-strong bg-gold text-white",
  due: "border-warning-strong bg-gold text-white",
  recommended: "border-(--u-edge) bg-(--u-fill) text-white",
  available: "border-(--u-edge) bg-(--u-fill) text-white",
  soon: "border-2 border-b-[6px] border-border bg-surface-2 text-muted",
};

export function LessonNode({
  node,
  index,
  number,
  lesson,
  state,
  completions,
  onOpen,
}: {
  node: PathNode;
  index: number;
  number: number;
  lesson: LessonRef;
  state: NodeState;
  completions: number;
  onOpen: () => void;
}) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const title = l(lesson.title);
  const passed = state === "done" || state === "due";
  const labelRight = node.label === "right";
  const badge = passed ? completionsBadge(completions) : null;
  // Подпись: от края узла к центру и дальше, не шире половины дорожки.
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
          transition={{ type: "spring", stiffness: 380, damping: 20, delay: (index % 4) * 0.05 }}
        >
          {state === "recommended" && !reduce && (
            <m.span
              aria-hidden
              className="absolute inset-0 rounded-full border-4 border-(--u)"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <button
            type="button"
            onClick={onOpen}
            aria-label={t("learn2.node.aria", { n: number, title, state: t(`learn2.state.${state}`) })}
            className={cn(
              "relative flex h-full w-full items-center justify-center rounded-full border-b-[6px] transition-[translate,border-width] duration-75",
              "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary active:translate-y-[4px] active:border-b-2",
              FACE[state],
            )}
          >
            {state !== "soon" && <span aria-hidden className="absolute inset-x-3.5 top-[5px] h-6 rounded-[50%] border-t-[3px] border-white/30" />}
            {state === "soon" ? (
              <Lock size={24} />
            ) : passed ? (
              <Star size={30} fill="currentColor" strokeWidth={1.5} />
            ) : (
              <Play size={28} fill="currentColor" className="translate-x-0.5" />
            )}
          </button>
          {badge && (
            <span className="pointer-events-none absolute -right-1.5 -top-1 rounded-full border-2 border-surface bg-warning-strong px-1.5 text-[11px] font-black leading-4 text-white">
              {badge}
            </span>
          )}
          {state === "due" && (
            <span className="pointer-events-none absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-streak text-white">
              <Clock size={13} strokeWidth={3} />
            </span>
          )}
          {state === "recommended" && (
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 border-border bg-surface px-2.5 py-1 text-xs font-extrabold text-(--u-ink) shadow-sm">
              {t("learn2.hero.start")}
              <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-border bg-surface" />
            </span>
          )}
        </m.div>
      </div>

      {state === "recommended" && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={node.x > 0 ? { left: `calc(50% + ${node.x + HALF + 4}px)`, top: node.y - 30 } : { right: `calc(50% - ${node.x - HALF - 4}px)`, top: node.y - 30 }}
        >
          <Mascot size={40} mood="happy" />
        </div>
      )}

      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onOpen}
        className={cn("absolute -translate-y-1/2 text-left", !labelRight && "text-right")}
        style={{ ...labelStyle, top: node.y }}
      >
        <span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted">{t("learn.lesson", { n: number })}</span>
        <span className={cn("line-clamp-2 text-sm font-extrabold leading-snug", state === "soon" ? "text-muted" : "text-text")}>{title}</span>
      </button>
    </>
  );
}
