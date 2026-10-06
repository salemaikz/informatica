"use client";

import { Play, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import type { LessonStat } from "@/lib/review";
import { LESSON_META } from "@/content/catalog";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { bestUnitResult, unitTimeLimitSec, type Stars } from "@/lib/exam";
import { ENTRY_COST } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { HeartCost } from "@/components/economy/HeartCost";
import { useCheckpoint } from "@/components/exam/checkpoint";
import { StarRow } from "@/components/exam/StarRow";
import { EXAM_FORMAT, examLink, randomSeed } from "@/components/exam/logic";
import { unitVars } from "./useLearn";

// «Тест по разделу» — узел в конце раздела на карте: трофей цвета раздела, под ним звёзды лучшего результата.
// Нажатие открывает шторку: что внутри и «Начать». Доступна всегда (рекомендуется после уроков раздела).

export function CheckpointNode({ unit, lessons }: { unit: Unit; lessons: Record<string, LessonStat> }) {
  const { t, l } = useT();
  const router = useRouter();
  const cp = useCheckpoint(unit);
  const exams = useApp((s) => s.exams);
  const [open, setOpen] = useState(false);
  const best = useMemo(() => bestUnitResult(exams, unit.id), [exams, unit.id]);

  if (cp === null) return null;
  const title = l(unit.title);
  const stars: Stars = best?.stars ?? 0;
  const status = best ? t("exam.unit.best", { a: best.points, b: best.max }) : t("exam.unit.new");
  // Считаем те же уроки, что и в total: готовые и есть в курсе.
  const ready = unit.lessons.filter((r) => r.status === "available" && !!LESSON_META[r.id]);
  const total = ready.length;
  const done = ready.filter((r) => (lessons[r.id]?.completions ?? 0) > 0).length;
  const allDone = done >= total;
  const f = EXAM_FORMAT.unit;
  // Время — по числу заданий (90 секунд на задание).
  const minutes = Math.round(unitTimeLimitSec(cp.size) / 60);

  const start = () => {
    setOpen(false);
    router.push(examLink("unit", randomSeed(), [], unit.id));
  };

  return (
    <div className="flex flex-col items-center px-4 pb-2 pt-1 text-center" style={unitVars(unit.color)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t("exam.unit.node.aria", { unit: title, state: `${status}, ${t("exam.unit.stars", { n: stars })}` })}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[76px] w-[76px] items-center justify-center rounded-[28px] border-b-[6px] text-white transition-[translate,border-width] duration-75",
          "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary active:translate-y-[4px] active:border-b-2",
          "border-(--u-edge) bg-(--u-fill) disabled:opacity-60",
        )}
      >
        <Trophy size={34} strokeWidth={2.2} aria-hidden />
      </button>
      <StarRow stars={stars} className="mt-2.5" />
      <p className="mt-1.5 text-sm font-extrabold">{t("exam.unit.node")}</p>
      <p className="max-w-64 text-xs font-bold text-muted">{status}</p>

      <Modal open={open} onClose={() => setOpen(false)} label={t("exam.unit.title", { unit: title })}>
        <div className="flex flex-col gap-4 text-left" style={unitVars(unit.color)}>
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-b-4 border-(--u-edge) bg-(--u-fill) text-white">
              <Trophy size={28} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-tight">{t("exam.unit.title", { unit: title })}</h2>
              <p className="mt-0.5 text-sm font-semibold text-muted">{t("exam.unit.sheet.desc", { n: cp.size })}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="muted">{t("exam.fmt.questions", { n: cp.size })}</Pill>
            <Pill tone="muted">{t("common.minutes", { n: minutes })}</Pill>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5">
            <span className="min-w-0 text-sm font-extrabold">{status}</span>
            <StarRow stars={stars} size={22} />
          </div>
          <ul className="flex flex-col gap-1.5 text-sm font-semibold text-muted">
            <li>{t("exam.unit.sheet.kinds")}</li>
            <li>{t("exam.unit.sheet.result")}</li>
            <li className={allDone ? "text-success-strong" : undefined}>
              {allDone ? t("exam.unit.sheet.ready") : t("exam.unit.sheet.recommend", { done, total })}
            </li>
            {cp.size < f.questions && <li>{t("exam.unit.sheet.shorter", { n: cp.size })}</li>}
          </ul>
          <Button size="lg" block icon={<Play size={20} aria-hidden />} onClick={start}>
            {t("common.start")}
            {/* Тест по разделу стоит 1 сердечко (ENTRY_COST.checkpoint, #120); списывается на экране условий по «Начать». */}
            <HeartCost n={ENTRY_COST.checkpoint} variant="solid" />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
