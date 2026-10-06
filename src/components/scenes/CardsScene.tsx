"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { iconFor } from "./icons";

type CardsScene = Extract<Scene, { kind: "cards" }>;
type Tone = NonNullable<CardsScene["items"][number]["tone"]>;

/** Цвет значка по смыслу (токены темы): статические строки, чтобы Tailwind их увидел. */
const TONE: Record<Tone, string> = {
  primary: "bg-primary-soft text-ink-primary",
  success: "bg-success-soft text-ink-success",
  danger: "bg-danger-soft text-ink-danger",
  warning: "bg-warning-soft text-ink-warning",
  ai: "bg-ai-soft text-ink-ai",
  gold: "bg-gold-soft text-ink-warning",
  muted: "bg-surface-2 text-muted",
};

/** Карточки с иконками: на телефоне 2 колонки, при columns = 3 на ≥ 480 px — 3. Появляются лёгким каскадом. */
export function CardsScene({ scene }: { scene: CardsScene }) {
  const { l } = useT();
  const reduce = useReduceMotion();
  return (
    <div className={cn("mx-auto grid w-full max-w-xl grid-cols-2 gap-2.5", scene.columns === 3 && "min-[480px]:grid-cols-3")}>
      {scene.items.map((item, i) => {
        const Icon = iconFor(item.icon);
        return (
          <m.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: reduce ? 0 : Math.min(i, 8) * 0.05 }}
            className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3"
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE[item.tone ?? "primary"])}>
              <Icon size={22} strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold leading-tight break-words">{l(item.title)}</div>
              {item.text && <p className="mt-0.5 text-sm leading-snug text-muted break-words">{l(item.text)}</p>}
            </div>
          </m.div>
        );
      })}
    </div>
  );
}
