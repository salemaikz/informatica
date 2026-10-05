"use client";

import { Cpu, Flame, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { HOUR, PLAN_FEATURES, lessonChips, perfectChips } from "@/lib/economy";
import { completedLessonsCount, showAfterFirst } from "@/lib/tour";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { useChips, usePlanTier } from "@/components/economy/useEconomy";
import { Button } from "@/components/ui/Button";

function Row({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>{icon}</span>
      <span className="min-w-0 pt-1.5 text-sm font-semibold leading-snug">{children}</span>
    </li>
  );
}

/**
 * Карточка на итогах первого пройденного урока (#104): что значат опыт, чипы, огонь и сердечки — по строке на каждое.
 * Один раз; «Понятно, дальше» её убирает. Сама решает, показываться ли (`showAfterFirst`), поэтому в итоги урока
 * вставляется безусловно: `{kind === "lesson" && <AfterFirstLesson />}`. Числа — из lib/economy.ts.
 */
export function AfterFirstLesson({ className }: { className?: string }) {
  const { t } = useT();
  const tips = useApp((s) => s.tips);
  const completed = useApp((s) => completedLessonsCount(s.lessons));
  const tier = usePlanTier();
  const { multiplier } = useChips();
  if (!showAfterFirst(tips, completed)) return null;
  // На «Безлимите» сердечки не кончаются — про срок восстановления не говорим; бонус чипов — с множителем тарифа.
  const unlimited = tier === "unlimited";
  const hours = PLAN_FEATURES[tier].regenMs / HOUR;
  const bonus = lessonChips(true, multiplier);
  const perfect = perfectChips(multiplier);

  return (
    <section aria-label={t("tour.after.title")} className={cn("flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4 animate-fade-in", className)}>
      <h2 className="text-lg font-extrabold">{t("tour.after.title")}</h2>
      <ul className="flex flex-col gap-3">
        <Row tone="bg-gold-soft text-warning-strong" icon={<span className="text-xs font-extrabold">XP</span>}>
          {t("tour.after.xp")}
        </Row>
        <Row tone="bg-gold-soft text-gold" icon={<Cpu size={18} aria-hidden />}>
          {t("tour.after.chips", { n: bonus, p: perfect })}
        </Row>
        <Row tone="bg-streak-soft text-streak" icon={<Flame size={18} aria-hidden />}>
          {t("tour.after.streak")}
        </Row>
        <Row tone="bg-heart-soft text-heart" icon={<Heart size={18} fill="currentColor" aria-hidden />}>
          {unlimited ? t("tour.after.heartsUnlimited") : t("tour.after.hearts", { h: hours })}
        </Row>
      </ul>
      <Button block onClick={() => useApp.getState().noteTip("after-first")}>
        {t("tour.after.ok")}
      </Button>
    </section>
  );
}
