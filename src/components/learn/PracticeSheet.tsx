"use client";

import { ClipboardCheck, CircleCheckBig, Dumbbell, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import { ENTRY_COST } from "@/lib/economy";
import { MINITEST_MIN, PRACTICE_COUNT, RECAP_COUNT, miniTestSize } from "@/lib/course-mix-meta";
import { practiceNodeId, recapNodeId } from "@/content/groups";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/Button";
import { HeartCost } from "@/components/economy/HeartCost";
import { bestPercent, type NodeItem } from "./map";
import { pluralKey } from "./useLearn";

// Лист узла «Практика» / «Повторение»: что внутри, лучший результат и кнопки. У практики ещё «Мини-тест» —
// 6 заданий ЕНТ группы в настоящем формате, 1 сердечко (#81). Практика и повторение тоже стоят сердечко (этап 16В, решение F).

function SheetBody({ item, unit, unitIndex }: { item: NodeItem; unit: Unit; unitIndex: number }) {
  const { t, l } = useT();
  const practice = item.kind === "practice";
  const nodeId = practice ? practiceNodeId(item.group) : recapNodeId(item.unitId);
  const stat = useApp((s) => s.courseNodes[nodeId]);
  const Icon = practice ? Dumbbell : RefreshCw;
  const title = practice ? t("course3.practice.title", { group: l(item.group.title) }) : t("course3.recap.title", { unit: l(unit.title) });
  const runs = stat?.runs ?? 0;
  // Заданий ЕНТ в группе должно хватать на мини-тест (не меньше трёх).
  const testSize = useMemo(() => (practice ? miniTestSize(item.group) : 0), [practice, item]);
  const hasTest = practice && testSize >= MINITEST_MIN;
  const testRuns = stat?.testRuns ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 pr-2">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-b-4 border-primary-strong bg-primary text-white">
          <Icon size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">{t("learn.unit", { n: unitIndex + 1 })}</p>
          <h3 className="text-xl font-extrabold leading-tight">{title}</h3>
        </div>
      </div>

      <p className="font-semibold text-muted">{t(practice ? "econ16c.sheet.practice.desc" : "econ16c.sheet.recap.desc", { n: practice ? PRACTICE_COUNT : RECAP_COUNT })}</p>

      {runs > 0 ? (
        <p className="flex items-center gap-2 text-sm font-extrabold text-success-strong">
          <CircleCheckBig size={16} aria-hidden className="shrink-0" />
          <span>{t(pluralKey("course3.sheet.done", runs), { n: runs, best: bestPercent(stat?.best) })}</span>
        </p>
      ) : (
        <p className="text-sm font-extrabold text-primary">{t("course3.sheet.new")}</p>
      )}
      {hasTest && testRuns > 0 && (
        <p className="-mt-2 flex items-center gap-2 text-sm font-bold text-muted">
          <ClipboardCheck size={16} aria-hidden className="shrink-0" />
          <span>{t("course3.sheet.testBest", { best: bestPercent(stat?.testBest) })}</span>
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {practice ? (
          <ButtonLink href={`/drill?mode=practice&node=${nodeId}`} size="lg" block icon={<Dumbbell size={20} aria-hidden />}>
            {t("course3.sheet.start")}
            <HeartCost n={ENTRY_COST.drill} variant="solid" />
          </ButtonLink>
        ) : (
          <ButtonLink href={`/drill?mode=recap&unit=${item.unitId}`} size="lg" block icon={<RefreshCw size={20} aria-hidden />}>
            {t("course3.sheet.startRecap")}
            <HeartCost n={ENTRY_COST.drill} variant="solid" />
          </ButtonLink>
        )}
        {hasTest && (
          <div className="flex flex-col gap-1.5">
            <ButtonLink href={`/drill?mode=minitest&node=${nodeId}`} variant="secondary" size="lg" block icon={<ClipboardCheck size={20} aria-hidden />}>
              {t("course3.sheet.test")}
              <HeartCost n={ENTRY_COST.check} />
            </ButtonLink>
            <p className="px-1 text-xs font-bold text-muted">{t("course3.sheet.testHint", { n: testSize })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Лист узла. `item` — открыть (null — закрыть); последний узел держим, пока лист уезжает. */
export function PracticeSheet({ item, unit, unitIndex, onClose }: { item: NodeItem | null; unit: Unit; unitIndex: number; onClose: () => void }) {
  const { t, l } = useT();
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);
  const label = shown ? (shown.kind === "practice" ? t("course3.practice.title", { group: l(shown.group.title) }) : t("course3.recap.title", { unit: l(unit.title) })) : "";
  return (
    <Modal open={!!item} onClose={onClose} label={label}>
      {shown && <SheetBody key={shown.kind === "practice" ? shown.group.id : shown.unitId} item={shown} unit={unit} unitIndex={unitIndex} />}
    </Modal>
  );
}
