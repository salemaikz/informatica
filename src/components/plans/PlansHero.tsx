"use client";

import { Cpu, Heart, Sparkles, type LucideIcon } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Mascot } from "@/components/mascot/Mascot";

// Вокруг маскота парят значки того, что даёт тариф: сердечки (розовый), ИИ (фиолетовый), чипы (золотой).
const FLOATERS: { icon: LucideIcon; tone: string; pos: string; delay: number; fill?: boolean }[] = [
  { icon: Heart, tone: "bg-heart-soft text-heart border-heart/40", pos: "left-2 top-4", delay: 0, fill: true },
  { icon: Sparkles, tone: "bg-ai-soft text-ai border-ai/40", pos: "right-0 top-1", delay: 0.6 },
  { icon: Cpu, tone: "bg-gold-soft text-warning-strong border-gold/60", pos: "right-6 bottom-0", delay: 1.2 },
];

/** Верх окна тарифов: маскот с золотым свечением, заголовок и подзаголовок. */
export function PlansHero({ subtitle }: { subtitle: DictKey }) {
  const { t } = useT();
  return (
    <header className="flex flex-col items-center text-center">
      <div className="relative grid h-28 w-56 place-items-center sm:h-36 sm:w-60" aria-hidden>
        <span className="absolute h-36 w-36 rounded-full bg-gold/30 blur-3xl" />
        <m.div initial={{ opacity: 0, scale: 0.7, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
          <Mascot mood="happy" size={92} />
        </m.div>
        {FLOATERS.map(({ icon: Icon, tone, pos, delay, fill }) => (
          <m.span
            key={pos}
            className={cn("absolute grid h-10 w-10 place-items-center rounded-2xl border-2 shadow-sm", tone, pos)}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
            transition={{ opacity: { delay: 0.3 + delay / 3 }, scale: { delay: 0.3 + delay / 3, type: "spring", stiffness: 380, damping: 16 }, y: { duration: 3.2, delay, repeat: Infinity, ease: "easeInOut" } }}
          >
            <Icon size={20} fill={fill ? "currentColor" : "none"} strokeWidth={2.5} />
          </m.span>
        ))}
      </div>
      <h1 className="text-balance text-2xl font-extrabold leading-tight sm:mt-1 sm:text-3xl">{t("plans.title")}</h1>
      <p className="mt-1.5 max-w-sm text-balance text-sm font-semibold leading-snug text-muted sm:mt-2 sm:text-base">{t(subtitle)}</p>
    </header>
  );
}
