"use client";

import { BookOpen } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import type { LessonStat } from "@/lib/review";
import type { SkillStat } from "@/lib/mastery";
import { LESSON_META } from "@/content/catalog";
import { lessonNumber } from "@/content/course-map";
import { SKILLS } from "@/content/skills";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar, Ring } from "@/components/ui/ProgressBar";
import { ICONS } from "@/components/scenes/icons";
import {
  averageMastery,
  isPassed,
  nodeState,
  pathItemNodeId,
  pathLayout,
  pathPassed,
  unitNodeStates,
  pluralForm,
  segmentDone,
  unitPathItems,
  unitProgress,
  unitSkillIds,
  type NodeItem,
} from "./map";
import { unitVars } from "./useLearn";
import { UnitArt } from "./UnitArt";
import { LessonNode } from "./LessonNode";
import { CheckpointNode } from "./CheckpointNode";
import { PracticeNode } from "./PracticeNode";
import { PracticeSheet } from "./PracticeSheet";

// Раздел на карте = «местность»: шапка с иллюстрацией, прогрессом и освоением + извилистая дорога через уроки.

function UnitHeader({ unit, index, lessons, skills }: { unit: Unit; index: number; lessons: Record<string, LessonStat>; skills: Record<string, SkillStat> }) {
  const { t, l } = useT();
  const Icon = unit.icon ? ICONS[unit.icon] : BookOpen;
  const p = unitProgress(unit, lessons);
  const mastery = averageMastery(unitSkillIds(unit, LESSON_META, SKILLS), skills);
  const soon = p.total - p.ready;
  const pct = Math.round(mastery * 100);
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-(--u)/25 bg-(--u-soft) p-4">
      {/* Декор — только в зоне pr-24 строки заголовка (96×72), ниже начинается описание: не пересекает текст. */}
      <UnitArt theme={unit.theme} className="absolute right-3 top-3 h-[72px] w-24 opacity-[0.15]" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start gap-3 pr-24">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-b-4 border-(--u-edge) bg-(--u-fill) text-white">
            <Icon size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-(--u-ink)">{t("learn.unit", { n: index + 1 })}</p>
            <h2 className="text-lg font-extrabold leading-tight">{l(unit.title)}</h2>
          </div>
        </div>
        <p className="pr-8 text-sm font-semibold text-muted">{l(unit.description)}</p>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <ProgressBar value={p.total ? p.done / p.total : 0} color="var(--u)" height={10} />
            <p className="mt-1.5 text-sm font-bold">
              {t(pluralForm(p.total) === "one" ? "learn2.unit.progress.one" : "learn2.unit.progress.many", { done: p.done, total: p.total })}
              {soon > 0 && <span className="text-muted"> · {t("learn2.unit.soon", { n: soon })}</span>}
            </p>
          </div>
          <div title={t("learn2.unit.mastery", { n: pct })} aria-label={t("learn2.unit.mastery", { n: pct })} role="img">
            <Ring value={mastery} size={48} stroke={6} color="var(--success)">
              <span className="text-xs font-black">{pct}%</span>
            </Ring>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/theory#${unit.id}`} variant="secondary" size="sm" className="h-10" icon={<BookOpen size={16} />}>
            {t("learn2.unit.theory")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function UnitSectionImpl({
  unit,
  index,
  lessons,
  skills,
  recommendedId,
  now,
  onOpen,
}: {
  unit: Unit;
  index: number;
  lessons: Record<string, LessonStat>;
  skills: Record<string, SkillStat>;
  recommendedId: string | undefined;
  now: number;
  onOpen: (lessonId: string) => void;
}) {
  const { l } = useT();
  const courseNodes = useApp((s) => s.courseNodes);
  const [sheet, setSheet] = useState<NodeItem | null>(null);
  // Дорога раздела: уроки и узлы «Практика» (после группы) и «Повторение» (в конце раздела), этап 14.
  const items = useMemo(() => unitPathItems(unit), [unit]);
  // Соседние разделы начинают змейку с разных сторон.
  const layout = useMemo(() => pathLayout(items.length, index % 2 ? 3 : 0), [items.length, index]);
  const lessonStates = new Map(unit.lessons.map((ref) => [ref.id, nodeState(ref, lessons[ref.id], recommendedId, now)]));
  const passed = pathPassed(items, (ref) => isPassed(lessonStates.get(ref.id)!), courseNodes);
  const nodeStates = unitNodeStates(items, unit, lessons, courseNodes);
  const rest = layout.segments.filter((s) => !segmentDone(s, passed)).map((s) => s.d).join("");
  const done = layout.segments.filter((s) => segmentDone(s, passed)).map((s) => s.d).join("");
  // Широкая «обочина» — только между уроками (вход и выход к мостику — тонким пунктиром).
  const inner = layout.segments.filter((s) => s.from >= 0 && s.to >= 0).map((s) => s.d).join("");

  return (
    <section id={`unit-${unit.id}`} data-unit={unit.id} aria-label={l(unit.title)} className="scroll-mt-[132px] lg:scroll-mt-[76px]" style={unitVars(unit.color)}>
      <UnitHeader unit={unit} index={index} lessons={lessons} skills={skills} />
      <div className="relative" style={{ height: layout.height }}>
        <svg
          aria-hidden
          className="pointer-events-none absolute top-0 overflow-visible"
          style={{ left: `calc(50% - ${layout.width / 2}px)` }}
          width={layout.width}
          height={layout.height}
          viewBox={`${-layout.width / 2} 0 ${layout.width} ${layout.height}`}
          fill="none"
          strokeLinecap="round"
        >
          {inner && <path d={inner} stroke="var(--u)" strokeOpacity={0.09} strokeWidth={34} />}
          {rest && <path d={rest} stroke="var(--border)" strokeWidth={7} strokeDasharray="1 14" />}
          {done && <path d={done} stroke="var(--u)" strokeWidth={9} />}
        </svg>
        {items.map((it, i) =>
          it.kind === "lesson" ? (
            <LessonNode
              key={it.ref.id}
              node={layout.nodes[i]}
              index={i}
              number={lessonNumber(it.ref.id)}
              lesson={it.ref}
              state={lessonStates.get(it.ref.id)!}
              completions={lessons[it.ref.id]?.completions ?? 0}
              onOpen={() => onOpen(it.ref.id)}
            />
          ) : (
            <PracticeNode
              key={pathItemNodeId(it)}
              node={layout.nodes[i]}
              index={i}
              item={it}
              title={l(it.kind === "practice" ? it.group.title : unit.title)}
              state={nodeStates.get(pathItemNodeId(it)!) ?? "available"}
              onOpen={() => setSheet(it)}
            />
          ),
        )}
      </div>
      {/* Тест по разделу — после последнего урока (нет готовых уроков или заданий — узла нет). */}
      <CheckpointNode unit={unit} lessons={lessons} />
      <PracticeSheet item={sheet} unit={unit} unitIndex={index} onClose={() => setSheet(null)} />
    </section>
  );
}

export const UnitSection = memo(UnitSectionImpl);
