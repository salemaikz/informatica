"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { skillById } from "@/content/skills";
import { cn } from "@/lib/cn";
import { weakSpots } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/components/economy/useEconomy";
import { percent } from "./format";
import { REASON_KEY, REASON_ROW } from "./weak-tone";

/**
 * Боковая карточка «Слабые места» (компьютер, правая колонка): до 3 навыков, у каждого — своя адресная ссылка
 * на тренировку. Данных мало или слабых мест нет — карточки нет. Подключается из `components/app/Widgets.tsx`
 * лениво: логика курса и банков не попадает в общий код всех страниц.
 */
export function WeakTopicsRail() {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const skillDays = useApp((s) => s.skillDays);
  const now = useNow();
  const spots = useMemo(() => weakSpots({ skills, skillDays, now }, 3), [skills, skillDays, now]);
  if (!spots.length) return null;
  return (
    <Card>
      <p className="mb-2 font-extrabold">{t("learn.weak.title")}</p>
      <ul className="flex flex-col gap-1.5">
        {spots.map((s) => {
          const title = skillById(s.skill) ? l(skillById(s.skill)!.title) : s.skill;
          return (
            <li key={s.skill}>
              <Link
                href={s.href}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-2xl px-3 py-1.5 hover:brightness-95 active:translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  REASON_ROW[s.reason],
                )}
                aria-label={t("progress.weak.ctaAria", { skill: title })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug">{title}</span>
                  <span className="block text-xs font-semibold opacity-80">{t(REASON_KEY[s.reason])}</span>
                </span>
                <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted">{percent(s.mastery)}%</span>
                <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/stats" className="mt-2 block text-sm font-extrabold text-primary">
        {t("progress.weak.all")} →
      </Link>
    </Card>
  );
}
