"use client";

import { useMemo } from "react";
import { UNITS } from "@/content/course";
import { schoolPlan } from "@/content/school-program";
import { cn } from "@/lib/cn";
import { schoolSectionRows, unitRows } from "@/lib/progress";
import { entVisible, toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { percent } from "./format";
import { useSkillStats } from "./useSkillStats";

interface Row {
  id: string;
  title: string;
  /** Цвет раздела (CSS); у школьных разделов — из палитры курса. */
  color: string;
  done: number;
  ready: number;
  soon: number;
  ratio: number;
  mastery: number | null;
}

/** Цвет раздела на полосе: чуть сдвинут к цвету текста, чтобы тёмные цвета были видны на тёмной теме, а светлые — на светлой. */
const barColor = (color: string) => `color-mix(in oklab, ${color} 78%, var(--text))`;

/** «Разделы курса»: полоса цветом раздела, «пройдено/готово», «скоро N» и средняя оценка освоения. */
export function UnitProgressList({ className }: { className?: string }) {
  const { t, l } = useT();
  const lessons = useApp((s) => s.lessons);
  const skills = useSkillStats();
  const skipBasics = useApp((s) => s.profile.skipBasics);
  const track = useApp((s) => s.profile.track);
  const gradeRaw = useApp((s) => s.profile.grade);
  const direction = useApp((s) => s.profile.direction);

  const school = !entVisible({ track }) && !!toSchoolGrade(gradeRaw);
  const rows = useMemo<Row[]>(() => {
    if (school) {
      const plan = schoolPlan(toSchoolGrade(gradeRaw)!, direction);
      if (plan) {
        return schoolSectionRows(plan, lessons).map((r, i) => ({
          id: r.id,
          title: l(r.title),
          color: UNITS[i % UNITS.length].color,
          done: r.done,
          ready: r.ready,
          soon: r.soon,
          ratio: r.ratio,
          mastery: null,
        }));
      }
    }
    return unitRows(lessons, skills, { skipBasics }).map((r) => ({
      id: r.id,
      title: l(r.title),
      color: r.color,
      done: r.done,
      ready: r.ready,
      soon: r.soon,
      ratio: r.ratio,
      mastery: r.mastery,
    }));
  }, [school, gradeRaw, lessons, skills, skipBasics, l]);

  return (
    <Card className={className}>
      <h2 className="mb-3 text-lg font-extrabold">{t(school ? "progress.units.school" : "progress.units.title")}</h2>
      <ul className="flex flex-col gap-3.5">
        {rows.map((r) => {
          const full = r.ready > 0 && r.done >= r.ready;
          return (
            <li key={r.id}>
              <div className="flex items-start justify-between gap-3">
                {/* Название — до двух строк по границам слов, без переноса посреди слова. */}
                <p className="line-clamp-2 min-w-0 flex-1 break-normal text-sm font-extrabold leading-snug">{r.title}</p>
                <p className={cn("shrink-0 text-sm font-extrabold tabular-nums", full ? "text-success-strong" : "text-muted")}>
                  {r.done}/{r.ready}
                </p>
              </div>
              <ProgressBar
                value={r.ratio}
                color={full ? "var(--success)" : barColor(r.color)}
                height={10}
                className="mt-1.5"
                label={t("progress.units.aria", { title: r.title, done: r.done, ready: r.ready })}
              />
              {(r.ready === 0 || r.soon > 0 || (r.mastery ?? 0) > 0) && (
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-bold text-muted">
                  {r.ready === 0 ? (
                    <span>{t("progress.units.waiting")}</span>
                  ) : (
                    <>
                      {(r.mastery ?? 0) > 0 && <span>{t("progress.units.mastery", { p: percent(r.mastery ?? 0) })}</span>}
                      {r.soon > 0 && <span>{t("progress.units.soon", { n: r.soon })}</span>}
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
