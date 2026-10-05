"use client";

import { useMemo, useState } from "react";
import { SKILLS } from "@/content/skills";
import { MASTERED_FROM, masteryLevel, masteryNeeds } from "@/lib/mastery";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pluralForm } from "@/components/learn/map";
import { LEVEL_COLOR, percent } from "./format";

/** Сколько навыков показываем, пока список не раскрыт. */
const FOLDED = 12;

type Translate = ReturnType<typeof useT>["t"];

/** «До «освоено»: ещё 2 верных ответа без подсказки, в другой день» — чего не хватает по правилу #67. Пусто — всё есть. */
export function needsText(needs: { clean: number; days: number }, t: Translate): string {
  const parts: string[] = [];
  if (needs.clean > 0) parts.push(t(`progress.needs.clean.${pluralForm(needs.clean)}`, { n: needs.clean }));
  if (needs.days > 0) parts.push(needs.days === 1 ? t("progress.needs.day.one") : t("progress.needs.day.many", { n: needs.days }));
  return parts.length ? t("progress.needs", { parts: parts.join(", ") }) : "";
}

/**
 * Освоение навыков по правилу #67: «освоено» — оценка от 80%, не меньше 4 верных ответов без подсказки в 2 разных днях.
 * Рядом с «в процессе» (оценка уже высокая) — чего не хватает. Показываются навыки, по которым были ответы.
 */
export function SkillsMasteryCard({ className }: { className?: string }) {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const [open, setOpen] = useState(false);

  const { rows, counts } = useMemo(() => {
    const rows = SKILLS.flatMap((sk) => {
      const st = skills[sk.id];
      if (!st || !(st.attempts > 0)) return [];
      const lvl = masteryLevel(st);
      return [{ sk, st, lvl, needs: lvl === "progress" && st.mastery >= MASTERED_FROM ? masteryNeeds(st) : null }];
    });
    const counts = { mastered: 0, progress: 0, weak: 0 };
    for (const r of rows) if (r.lvl !== "new") counts[r.lvl]++;
    return { rows, counts };
  }, [skills]);

  const shown = open ? rows : rows.slice(0, FOLDED);

  return (
    <Card className={className}>
      <h2 className="font-extrabold">{t("progress.skills.title")}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 font-semibold text-muted">{t("stats.noData")}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-muted">{t("progress.skills.summary", { m: counts.mastered, p: counts.progress, w: counts.weak })}</p>
          <p className="mb-3 text-xs font-semibold text-muted">{t("progress.skills.rule")}</p>
          <ul className="flex flex-col gap-3">
            {shown.map(({ sk, st, lvl, needs }) => {
              const note = needs ? needsText(needs, t) : "";
              return (
                <li key={sk.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm font-bold">
                    <span className="min-w-0 break-normal">{l(sk.title)}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLOR[lvl] }} aria-hidden />
                      {t(`mastery.${lvl}`)} · {percent(st.mastery)}%
                    </span>
                  </div>
                  <ProgressBar value={st.mastery} color={LEVEL_COLOR[lvl]} height={10} label={`${l(sk.title)}: ${percent(st.mastery)}%`} />
                  {note && <p className="mt-1 text-xs font-bold text-warning-strong">{note}</p>}
                </li>
              );
            })}
          </ul>
          {rows.length > FOLDED && (
            <Button variant="ghost" className="mt-2" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? t("progress.skills.less") : t("progress.skills.more", { n: rows.length })}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
