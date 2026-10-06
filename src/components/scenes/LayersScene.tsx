"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { iconFor } from "./icons";
import { layerState } from "./layers";

type LayersData = Extract<Scene, { kind: "layers" }>;

/**
 * Стопка слоёв сверху вниз (пользователь → программы → ОС → железо; регистры → кэш → ОЗУ → …).
 * highlight — слой в primary, остальные приглушены. axis — стрелка слева с подписями сверху и снизу.
 */
export function LayersScene({ scene }: { scene: LayersData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const axis = scene.axis;

  return (
    <div className="mx-auto flex w-full max-w-xl items-stretch gap-2.5">
      {axis && (
        <div className="flex w-[74px] shrink-0 flex-col items-center gap-1 py-1 text-center" aria-hidden="true">
          <span className="text-[11px] font-bold leading-tight text-muted">{l(axis.top)}</span>
          <ChevronUp className="size-4 shrink-0 text-muted" strokeWidth={3} />
          <span className="w-0.5 flex-1 rounded-full bg-border" />
          <ChevronDown className="size-4 shrink-0 text-muted" strokeWidth={3} />
          <span className="text-[11px] font-bold leading-tight text-muted">{l(axis.bottom)}</span>
        </div>
      )}
      <ol aria-label={axis ? `${t("basics.layers.aria")}. ${l(axis.top)} → ${l(axis.bottom)}` : t("basics.layers.aria")} className="flex min-w-0 flex-1 flex-col gap-2">
        {scene.items.map((item, i) => {
          const state = layerState(i, scene.highlight);
          const on = state === "active";
          const Icon = item.icon ? iconFor(item.icon) : null;
          return (
            <m.li
              key={i}
              aria-current={on || undefined}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: state === "dim" ? 0.72 : 1, y: 0 }}
              transition={{ ...springSoft, delay: reduce ? 0 : Math.min(i, 8) * 0.05 }}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-surface px-3 py-2.5",
                on ? "border-primary bg-primary-soft ring-2 ring-primary" : "border-border",
              )}
            >
              {Icon && (
                <span
                  className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-primary text-[color:var(--on-primary,#fff)]" : "bg-surface-2 text-muted")}
                  aria-hidden="true"
                >
                  <Icon className="size-5" strokeWidth={2} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px] font-extrabold leading-tight", on ? "text-ink-primary" : "text-text")}>{l(item.title)}</span>
                {item.text && <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-muted">{l(item.text)}</span>}
              </span>
            </m.li>
          );
        })}
      </ol>
    </div>
  );
}
