"use client";

import { BookOpen, ClipboardCheck, Clock, Layers, Play, RotateCcw, Trophy } from "lucide-react";
import { lessonMeta } from "@/content/catalog";
import { lessonNumber } from "@/content/course-map";
import type { LessonRef, Unit } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ICONS } from "@/components/scenes/icons";
import { pluralForm } from "./map";
import { unitVars } from "./useLearn";
import { UnitArt } from "./UnitArt";

// Карточка «Продолжить»: следующий урок (или урок, который пора повторить) и кнопка режимов.

export function ContinueCard({
  target,
  kind,
  unitIndex,
  firstTime,
  onModes,
}: {
  target?: { unit: Unit; ref: LessonRef };
  kind: "next" | "due";
  unitIndex: number;
  /** Ни одного урока ещё не пройдено. */
  firstTime: boolean;
  onModes: () => void;
}) {
  const { t, l } = useT();

  if (!target) {
    return (
      <div className="flex items-center gap-4 rounded-3xl border-2 border-gold/40 bg-gold-soft p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold text-white">
          <Trophy size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{t("learn2.hero.allDone")}</p>
          <p className="text-sm font-semibold text-muted">{t("learn2.hero.allDoneHint")}</p>
        </div>
        <ButtonLink href="/exam" size="sm" icon={<ClipboardCheck size={16} />} aria-label={t("learn2.quick.exam")} className="h-10 min-w-10 shrink-0">
          <span className="hidden sm:inline">{t("learn2.quick.exam")}</span>
        </ButtonLink>
      </div>
    );
  }

  const { unit, ref } = target;
  const lesson = lessonMeta(ref.id);
  const Icon = unit.icon ? ICONS[unit.icon] : BookOpen;
  const steps = lesson ? lesson.stepCount : 0;
  const cta = kind === "due" ? t("learn2.hero.review") : firstTime ? t("learn2.hero.start") : t("learn2.hero.continue");

  return (
    <div style={unitVars(unit.color)} className="relative overflow-hidden rounded-3xl border-2 border-(--u)/30 bg-surface">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-(--u)" />
      <UnitArt theme={unit.theme} className="absolute -right-6 -top-4 h-28 w-40 opacity-45" />
      <div className="relative flex flex-col gap-3 p-4 pl-5">
        <div className="flex items-center gap-2.5 pr-16">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--u-fill) text-white">
            <Icon size={18} />
          </span>
          <p className="min-w-0 text-xs font-extrabold uppercase leading-tight tracking-wide text-(--u-ink)">
            {kind === "due" ? t("learn2.hero.due") : t("learn2.hero.next")}
            <span className="block truncate font-bold normal-case tracking-normal text-muted">
              {t("learn.unit", { n: unitIndex + 1 })} · {t("learn.lesson", { n: lessonNumber(ref.id) })}
            </span>
          </p>
        </div>
        <h2 className="text-xl font-extrabold leading-tight">{l(ref.title)}</h2>
        <div className="flex items-center justify-between gap-2">
          {lesson ? (
            <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-muted">
              <span className="flex items-center gap-1">
                <Clock size={15} /> {t("common.minutes", { n: lesson.durationMin })}
              </span>
              <span>{t(`learn2.steps.${pluralForm(steps)}`, { n: steps })}</span>
            </p>
          ) : (
            <span />
          )}
          <Button variant="secondary" size="sm" onClick={onModes} icon={<Layers size={16} />} className="h-10 shrink-0">
            {t("learn2.hero.modes")}
          </Button>
        </div>
        <ButtonLink
          href={`/lesson/${ref.id}`}
          data-tour="continue"
          size="lg"
          block
          icon={kind === "due" ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
        >
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}
