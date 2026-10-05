"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { skillById } from "@/content/skills";
import { cn } from "@/lib/cn";
import { skillSectionsOf } from "@/lib/course-view";
import { defaultOpenGroup, skillGroups, skillTotals, type SkillCounts, type SkillGroup, type SkillRow } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pluralForm } from "@/components/learn/map";
import { LEVEL_COLOR, percent } from "./format";
import { useSkillStats } from "./useSkillStats";

type Translate = ReturnType<typeof useT>["t"];

/** Цвет точки раздела: чуть сдвинут к цвету текста, чтобы был виден в обеих темах (как в «Разделах курса»). */
const dotColor = (color: string) => `color-mix(in oklab, ${color} 78%, var(--text))`;

/**
 * «До «освоено»: ещё 2 верных ответа без подсказки, в другой день» — чего не хватает по правилу #67. Пусто — всё есть.
 * Не хватает только дней — с действием: «ещё 1 верный ответ без подсказки в другой день» (один приход в другой день не считается).
 */
export function needsText(needs: { clean: number; days: number }, t: Translate): string {
  if (needs.clean <= 0 && needs.days > 0) {
    return t("progress.needs", { parts: needs.days === 1 ? t("progress.needs.dayOnly.one") : t("progress.needs.dayOnly.many", { n: needs.days }) });
  }
  const parts: string[] = [];
  if (needs.clean > 0) parts.push(t(`progress.needs.clean.${pluralForm(needs.clean)}`, { n: needs.clean }));
  if (needs.days > 0) parts.push(needs.days === 1 ? t("progress.needs.day.one") : t("progress.needs.day.many", { n: needs.days }));
  return parts.length ? t("progress.needs", { parts: parts.join(", ") }) : "";
}

const countsText = (c: SkillCounts, t: Translate) => t("progress16c.skills.counts", { m: c.mastered, p: c.progress, w: c.weak, n: c.new });

/** Тонкая полоса из долей: освоено, в процессе, слабо (остальное — серое «не начато»). Цвета освоения — как в строках. */
function StackBar({ counts, label }: { counts: SkillCounts; label: string }) {
  const total = counts.mastered + counts.progress + counts.weak + counts.new;
  if (total === 0) return null;
  const parts = [
    { key: "mastered", n: counts.mastered, color: LEVEL_COLOR.mastered },
    { key: "progress", n: counts.progress, color: LEVEL_COLOR.progress },
    { key: "weak", n: counts.weak, color: LEVEL_COLOR.weak },
  ] as const;
  return (
    <div role="img" aria-label={label} className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      {parts.map((p) => (p.n > 0 ? <span key={p.key} className="h-full" style={{ width: `${(p.n / total) * 100}%`, background: p.color }} /> : null))}
    </div>
  );
}

/** Одна строка навыка: цветная точка уровня, название, тонкая полоска и процент (у не начатого — «—»). */
function Row({ row }: { row: SkillRow }) {
  const { t, l } = useT();
  const sk = skillById(row.id);
  const title = sk ? l(sk.title) : row.id;
  const note = row.needs ? needsText(row.needs, t) : "";
  const none = row.level === "new";
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[row.level] }} aria-hidden />
        <span className={cn("min-w-0 flex-1 break-normal text-sm font-bold leading-snug", none && "text-muted")}>{title}</span>
        <span className="sr-only">{t(`mastery.${row.level}`)}</span>
        {/* Ширина полоски — у обёртки: сама полоска всегда w-full. */}
        <span className="w-14 shrink-0">
          <ProgressBar value={row.mastery} color={LEVEL_COLOR[row.level]} height={6} label={`${title}: ${percent(row.mastery)}%`} />
        </span>
        <span className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-muted">{none ? "—" : `${percent(row.mastery)}%`}</span>
      </div>
      {note && <p className="mt-0.5 pl-5 text-xs font-bold text-warning-strong">{note}</p>}
    </li>
  );
}

function Group({ group, open, onToggle }: { group: SkillGroup; open: boolean; onToggle: () => void }) {
  const { t, l } = useT();
  const title = group.title ? l(group.title) : t("progress16c.skills.other");
  const counts = countsText(group.counts, t);
  const panelId = `skills-${group.id}`;
  return (
    <li className="overflow-hidden rounded-2xl border-2 border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary"
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dotColor(group.color) }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block break-normal text-sm font-extrabold leading-snug">{title}</span>
          <span className="mt-0.5 block text-xs font-bold text-muted">{counts}</span>
          <StackBar counts={group.counts} label={counts} />
        </span>
        <ChevronDown size={20} aria-hidden className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={panelId} className="flex animate-fade-in flex-col border-t-2 border-border px-3 py-1.5">
          {group.rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Освоение навыков по правилу #67: «освоено» — оценка от 80%, не меньше 4 верных ответов без подсказки в 2 разных днях.
 * Навыки сгруппированы по разделам трека (курс ЕНТ или программа класса); в группе — все навыки раздела, в том числе
 * не начатые. Раскрыта по умолчанию группа со слабыми навыками (или первая). Логика группировки — lib/progress.ts.
 */
export function SkillsMasteryCard({ className }: { className?: string }) {
  const { t } = useT();
  const skills = useSkillStats();
  const track = useApp((s) => s.profile.track);
  const grade = useApp((s) => s.profile.grade);
  const direction = useApp((s) => s.profile.direction);
  const skipBasics = useApp((s) => s.profile.skipBasics);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => skillSectionsOf({ track, grade, direction, skipBasics }), [track, grade, direction, skipBasics]);
  const groups = useMemo(() => skillGroups(sections, skills), [sections, skills]);
  const totals = useMemo(() => skillTotals(groups), [groups]);
  const defaultOpen = defaultOpenGroup(groups);
  const touched = totals.mastered + totals.progress + totals.weak;

  return (
    <Card className={className}>
      <h2 className="font-extrabold">{t("progress.skills.title")}</h2>
      {groups.length === 0 ? (
        <p className="mt-2 font-semibold text-muted">{t("stats.noData")}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-muted">{countsText(totals, t)}</p>
          <p className="mb-3 text-xs font-semibold text-muted">{t(touched === 0 ? "progress16c.skills.empty" : "progress.skills.rule")}</p>
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <Group
                key={g.id}
                group={g}
                open={toggled[g.id] ?? g.id === defaultOpen}
                onToggle={() => setToggled((m) => ({ ...m, [g.id]: !(m[g.id] ?? g.id === defaultOpen) }))}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
