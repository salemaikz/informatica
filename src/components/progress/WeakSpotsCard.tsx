"use client";

import { Crosshair } from "lucide-react";
import { useMemo } from "react";
import { skillById } from "@/content/skills";
import { MIN_ANSWERS, hasEnoughData, pendingWeakCount, weakSpots } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useNow } from "@/components/economy/useEconomy";
import { DataSince } from "./DataSince";
import { percent } from "./format";
import { REASON_KEY, REASON_TONE } from "./weak-tone";

export { REASON_TONE };

/**
 * «Слабые места» (#71): до 5 навыков с низкой оценкой, упавшей точностью или давней практикой.
 * У каждого — освоение, точность за 30 дней, причина и адресная кнопка «Потренировать». Данных мало — спокойная подсказка, не красная.
 */
export function WeakSpotsCard({ limit = 5, className }: { limit?: number; className?: string }) {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const skillDays = useApp((s) => s.skillDays);
  const now = useNow();
  const spots = useMemo(() => weakSpots({ skills, skillDays, now }, limit), [skills, skillDays, now, limit]);
  const enough = hasEnoughData(skills);
  // Слабые навыки, по которым ответов ещё меньше порога: говорить «слабых мест нет» нельзя (C21).
  const pending = useMemo(() => pendingWeakCount(skills), [skills]);

  return (
    <Card className={className}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Crosshair size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{t("progress.weak.title")}</h2>
          <p className="text-sm font-semibold text-muted">{t("progress.weak.sub")}</p>
        </div>
      </div>

      {spots.length === 0 ? (
        <div>
          {pending > 0 ? (
            <p className="font-bold text-muted">{t("progress.weak.pending")}</p>
          ) : (
            <>
              <p className="font-extrabold">{enough ? t("progress.weak.empty") : t("progress.weak.fewData", { n: MIN_ANSWERS })}</p>
              {enough && <p className="text-sm font-semibold text-muted">{t("progress.weak.emptyHint")}</p>}
            </>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {spots.map((s) => {
            const sk = skillById(s.skill);
            const title = sk ? l(sk.title) : s.skill;
            return (
              <li key={s.skill} className="rounded-2xl bg-surface-2 p-3">
                <p className="break-normal font-extrabold leading-snug">{title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted">
                  <span>{t("progress.weak.mastery", { p: percent(s.mastery) })}</span>
                  <span>{s.acc30 === null ? t("progress.weak.accNone") : t("progress.weak.acc", { p: percent(s.acc30) })}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Pill tone={REASON_TONE[s.reason]}>{t(REASON_KEY[s.reason])}</Pill>
                  <ButtonLink href={s.href} variant="secondary" aria-label={t("progress.weak.ctaAria", { skill: title })}>
                    {t("progress.weak.cta")}
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <DataSince period={30} className="mt-3" />
    </Card>
  );
}
