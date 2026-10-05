"use client";

import { AnimatePresence, m } from "motion/react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Clock,
  Cpu,
  ClipboardCheck,
  Gamepad2,
  Hammer,
  NotebookPen,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LESSON_META, lessonMeta } from "@/content/catalog";
import { UNITS, lessonNumber } from "@/content/course-map";
import { SKILLS } from "@/content/skills";
import { GAMES } from "@/games/registry";
import { gameSkillsFor } from "@/lib/drill-meta";
import { ENTRY_COST, entryCost, formatHearts, lessonCost } from "@/lib/economy";
import { theoryPayState } from "@/lib/theory-pay";
import { shortDate } from "@/lib/date";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { HeartCost } from "@/components/economy/HeartCost";
import { useChips, useHearts, usePlan } from "@/components/economy/useEconomy";
import { ICONS } from "@/components/scenes/icons";
import { bestPercent, isDue, lessonTopics, pluralForm, topicLessons, xpKind } from "./map";
import { findLessonRef, unitVars, useNow } from "./useLearn";
import { lessonStep, stepReviewDays } from "@/lib/mastery-steps";
import { lessonXpFactor } from "@/lib/review";
import { XpIcon } from "@/components/economy/XpIcon";
import { chipsEstimate, chipsKey, lessonXpMax } from "@/components/economy/xp-chips";
import { StepMarks } from "./MasteryLegend";

// Шторка урока: описание, статус, сколько XP даст прохождение и режимы (учиться, проверить себя,
// игрой, только теория, конспект). Её открывают карта курса и другие экраны.
// Платные режимы (#40) показывают цену входа значком HeartCost; «Только теория» стоит 0,5, пока урок не пройден и
// конспект не оплачен за сутки (lib/theory-pay.ts); конспект в заметках бесплатен.

function ModeCard({
  href,
  icon: Icon,
  title,
  hint,
  main,
  onClick,
  expanded,
  cost,
  note,
}: {
  href?: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  main?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  /** Цена входа в сердечках; нет — режим бесплатный. */
  cost?: number;
  /** Мелкая подпись у цены: когда спишется сердечко. */
  note?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-[translate,box-shadow] duration-75 active:translate-y-[3px] active:shadow-none",
    main
      ? "bg-primary text-white shadow-[0_4px_0_var(--primary-strong)]"
      : "border-2 border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
  );
  const body = (
    <>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", main ? "bg-white/20" : "bg-primary-soft text-primary")}>
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        {/* Значок — рядом с названием; на узком экране переносится на следующую строку целиком. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-extrabold leading-tight">{title}</span>
          {cost ? <HeartCost n={cost} variant={main ? "solid" : "soft"} /> : null}
        </span>
        <span className={cn("block text-sm font-semibold leading-snug", main ? "text-white/85" : "text-muted")}>{hint}</span>
        {note && <span className={cn("mt-0.5 block text-xs font-bold leading-snug", main ? "text-white/80" : "text-muted")}>{note}</span>}
      </span>
      {onClick ? (
        <ChevronDown size={20} className={cn("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
      ) : (
        <ChevronRight size={20} className={cn("shrink-0", main ? "text-white/80" : "text-muted")} />
      )}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={cls}>
      {body}
    </button>
  );
}

function SheetBody({ lessonId }: { lessonId: string }) {
  const { t, l, lang } = useT();
  const now = useNow();
  const { multiplier: chipMult } = useChips();
  // При безлимите значки цены скрыты — и строка о плате тоже; у пробного периода вместо неё — до какого дня.
  const unlimited = useHearts().unlimited;
  const { plan, trial } = usePlan();
  const stat = useApp((s) => s.lessons[lessonId]);
  const theoryPaidAt = useApp((s) => s.theoryPaid[lessonId]);
  const [gamesOpen, setGamesOpen] = useState(false);
  const place = findLessonRef(lessonId);
  const lesson = lessonMeta(lessonId);
  const games = useMemo(
    () => (lesson ? GAMES.filter((g) => (g.shape || g.source) && gameSkillsFor(g, lesson.skills).length > 0) : []),
    [lesson],
  );
  if (!place) return null;
  const { unit, ref, unitIndex } = place;
  const UnitIcon = unit.icon ? ICONS[unit.icon] : BookOpen;
  const topics = lessonTopics(ref, unit, lesson, SKILLS);
  const topic = topics[0];

  const header = (
    <div className="flex items-start gap-3 pr-2">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-b-4 border-(--u-edge) bg-(--u-fill) text-white">
        <UnitIcon size={24} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-wide text-(--u-ink)">
          {t("learn.lesson", { n: lessonNumber(lessonId) })} · {t("learn.unit", { n: unitIndex + 1 })}
        </p>
        <h3 className="text-xl font-extrabold leading-tight">{l(ref.title)}</h3>
        <p className="text-sm font-semibold text-muted">{l(unit.title)}</p>
      </div>
    </div>
  );

  if (!lesson) {
    // Урок «скоро»: теория темы (если у темы есть готовые уроки) и тест по теме.
    const hasTheory = topic ? topicLessons(topic, UNITS, LESSON_META, SKILLS).some((x) => x.ref.status === "available") : false;
    return (
      <div className="flex flex-col gap-4" style={unitVars(unit.color)}>
        {header}
        <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
          <Hammer size={20} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <p className="font-extrabold">{t("learn2.sheet.soon")}</p>
            <p className="text-sm font-semibold text-muted">{t("learn2.sheet.soonHint")}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {hasTheory && (
            <ButtonLink href={`/theory#${unit.id}`} variant="secondary" block icon={<BookOpen size={18} />}>
              {t("learn2.sheet.topicTheory")}
            </ButtonLink>
          )}
          {topic && (
            <ButtonLink href={`/exam/run?kind=topic&topics=${topic}`} variant="primary" block icon={<ClipboardCheck size={18} />}>
              {t("learn2.topic.test")}
              <HeartCost n={ENTRY_COST.exam} variant="solid" />
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  const due = isDue(stat, now);
  const xp = xpKind(stat, now);
  const steps = lesson.stepCount;
  const maxXp = lessonXpMax(steps, lessonXpFactor(stat, now), !!stat);
  const step = lessonStep(stat, now);
  const stepDays = stepReviewDays(stat, now);
  // «Урок игрой» стоит как сам урок (1 или 2 сердечка).
  const gameCost = entryCost("game", lesson);
  // Теория: платная, пока урок не пройден и конспект не оплачен за сутки (при безлимите значок скрыт сам).
  const theoryState = theoryPayState({ done: !!stat && stat.completions > 0, unlimited, paidAt: theoryPaidAt, now });

  return (
    <div className="flex flex-col gap-4" style={unitVars(unit.color)}>
      {header}
      <p className="font-semibold text-muted">{l(lesson.description)}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Pill icon={<Clock size={13} />}>{t("common.minutes", { n: lesson.durationMin })}</Pill>
        <Pill>{t(`learn2.steps.${pluralForm(steps)}`, { n: steps })}</Pill>
        <Pill tone="gold" icon={<XpIcon size={16} decorative />}>
          {t(`learn2.xp.${xp}`)}
        </Pill>
        <Pill tone="gold" icon={<Cpu size={13} />}>
          {t(chipsKey("xp.reward", chipsEstimate(maxXp, chipMult)), { xp: maxXp, chips: chipsEstimate(maxXp, chipMult) })}
        </Pill>
      </div>

      {stat && stat.completions > 0 ? (
        <p className={cn("flex items-center gap-2 text-sm font-extrabold", due ? "text-streak" : "text-success-strong")}>
          {due ? <RotateCcw size={16} /> : <CircleCheckBig size={16} />}
          <span>
            {stat.completions > 1
              ? t("learn2.sheet.done", { n: stat.completions, best: bestPercent(stat.bestAccuracy) })
              : t("learn2.sheet.doneOnce", { best: bestPercent(stat.bestAccuracy) })}
            {/* Срок повторения — в строке ступени ниже. */}
            {due && ` · ${t("learn2.sheet.due")}`}
          </span>
        </p>
      ) : (
        <p className="text-sm font-extrabold text-primary">{t("learn2.sheet.new")}</p>
      )}
      {step !== "new" && (
        <p className="-mt-2 flex items-start gap-2 text-sm font-bold text-muted">
          <StepMarks step={step} className="mt-1.5" />
          <span>
            {t("mastery.step.label", { step: t(`mastery.step.${step}`) })}
            {" · "}
            {stepDays === 0 ? t("mastery.step.next.due") : t(`mastery.step.next.${pluralForm(stepDays ?? 0)}`, { n: stepDays ?? 0 })}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("learn2.sheet.modes")}</p>
        <ModeCard
          main
          href={`/lesson/${lessonId}`}
          icon={Play}
          title={t("learn2.mode.learn")}
          hint={t("learn2.mode.learnHint")}
          cost={lessonCost(lesson)}
          note={unlimited ? undefined : t("hearts15.sheet.startNote")}
        />
        <ModeCard
          href={`/lesson/${lessonId}?mode=check`}
          icon={ClipboardCheck}
          title={t("learn2.mode.check")}
          hint={t("learn2.mode.checkHint")}
          cost={ENTRY_COST.check}
        />
        {games.length > 0 && (
          <div className="flex flex-col gap-2">
            <ModeCard
              icon={Gamepad2}
              title={t("learn2.mode.game")}
              hint={t("learn2.mode.gameHint")}
              onClick={() => setGamesOpen((v) => !v)}
              expanded={gamesOpen}
              cost={gameCost}
            />
            <AnimatePresence initial={false}>
              {gamesOpen && (
                <m.ul
                  className="flex flex-col gap-1.5 overflow-hidden pl-3"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {games.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/game/${g.id}?lesson=${lessonId}`}
                        className="flex items-center gap-3 rounded-xl border-2 border-border bg-surface p-2 font-bold hover:bg-surface-2"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: g.color, color: g.ink }}>
                          <g.icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{l(g.title)}</span>
                        <HeartCost n={gameCost} />
                        <ChevronRight size={18} className="text-muted" />
                      </Link>
                    </li>
                  ))}
                </m.ul>
              )}
            </AnimatePresence>
          </div>
        )}
        <ModeCard
          href={`/theory/${lessonId}`}
          icon={BookOpen}
          title={t("learn2.mode.theory")}
          hint={t("learn2.mode.theoryHint")}
          cost={theoryState === "pay" ? ENTRY_COST.theory : undefined}
          note={
            theoryState === "pay"
              ? t("hearts15.sheet.theoryPay")
              : theoryState === "paid"
                ? t("hearts15.sheet.theoryPaid")
                : theoryState === "done"
                  ? t("hearts15.sheet.theoryDone")
                  : undefined
          }
        />
        <ModeCard href={`/notes/lesson/${lessonId}`} icon={NotebookPen} title={t("learn2.mode.notes")} hint={t("learn2.mode.notesHint")} />
        {!unlimited && <p className="px-1 text-xs font-bold text-muted">{t("hearts15.sheet.costNote", { cost: formatHearts(ENTRY_COST.theory) })}</p>}
        {unlimited && trial && plan.until !== undefined && (
          <p className="px-1 text-xs font-bold text-muted">{t("hearts15.sheet.trial", { date: shortDate(new Date(plan.until), lang) })}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Шторка урока. `lessonId` — открыть (null — закрыть). Последний урок держим, пока шторка уезжает.
 */
export function LessonSheet({ lessonId, onClose }: { lessonId: string | null; onClose: () => void }) {
  const { l } = useT();
  const [shown, setShown] = useState(lessonId);
  if (lessonId && lessonId !== shown) setShown(lessonId);
  const title = shown ? findLessonRef(shown)?.ref.title : undefined;
  return (
    // Урока нет на карте (старый id из сохранения, чужая ссылка) — не открываем пустую шторку.
    <Modal open={!!lessonId && !!findLessonRef(lessonId)} onClose={onClose} label={title ? l(title) : ""}>
      {shown && <SheetBody key={shown} lessonId={shown} />}
    </Modal>
  );
}
