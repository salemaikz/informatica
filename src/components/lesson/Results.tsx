"use client";

import clsx from "clsx";
import { BookOpen, Library, Clock, Cpu, Flame, Map as MapIcon, Repeat, RotateCcw, Share2, Sparkles, StepForward, Target } from "lucide-react";
import { m } from "motion/react";
import { AchievementBadge } from "@/components/app/AchievementBadge";
import { LevelBadge, TierPill } from "@/components/app/LevelBadge";
import { RARITY_BORDER, RARITY_LABEL, RARITY_SOFT, RARITY_TEXT } from "@/components/ui/rarity";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lesson, LessonVia, SessionResult } from "@/lib/types";
import type { LessonFeedbackResponse } from "@/lib/ai-types";
import { useApp } from "@/lib/store";
import { feedback as giveFeedback } from "@/lib/feedback";
import { lessonFeedback } from "@/lib/ai";
import { buildStudentContext } from "@/lib/student-context";
import { achievementById, levelInfo, levelTitle, newTierOnLevelUp } from "@/lib/gamification";
import { encodeShare, SHARE_MAX_XP, type ShareResult } from "@/lib/share-code";
import { isPerfectSession, PERFECT_RUN_SHOW_FROM, type PerfectDrop } from "@/lib/perfect";
import { DAY_MS, REPLAY_XP } from "@/lib/review";
import { formatFactor, nextLessonId } from "@/lib/drill-meta";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { decaySkills, masteryLevel } from "@/lib/mastery";
import { breakdownOf } from "@/lib/player-events";
import { skillById } from "@/content/skills";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { XpIcon } from "@/components/economy/XpIcon";
import { useChips } from "@/components/economy/useEconomy";
import { chipsKey } from "@/components/economy/xp-chips";
import { PerfectDropTile } from "@/components/economy/PerfectDropTile";
import { ChipFlight } from "@/components/motion/ChipFlight";
import { formatMult } from "@/components/economy/shop-helpers";
import { GuideSpot } from "@/components/guide/GuideSpot";
import { StreakIgnite } from "@/components/motion/StreakIgnite";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Markdown } from "@/components/Markdown";
import { useSkillStats } from "@/components/progress/useSkillStats";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Mascot } from "@/components/mascot/Mascot";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { springBouncy } from "@/components/motion/presets";
import { MASTERY_COLOR } from "@/components/progress/mastery-color";

/** Плитка точности по смыслу цвета (токены, обе темы). */
const ACC_TILE = {
  success: { cls: "border-success text-success", bg: "bg-action-success" },
  warning: { cls: "border-warning text-warning-strong", bg: "bg-warning" },
  danger: { cls: "border-danger text-danger", bg: "bg-action-danger" },
} as const;

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type FeedbackState = { status: "loading" } | { status: "done"; data: LessonFeedbackResponse } | { status: "failed" };

/**
 * Запрашивает у ИИ отзыв об уроке («памяти наставника» больше нет — этап 16В, L).
 * Вызывается из обработчика завершения урока (не из эффекта), поэтому запрос уходит ровно один раз.
 */
export function requestLessonFeedback(result: SessionResult, onState: (s: FeedbackState) => void) {
  const app = useApp.getState();
  // Отзыв после урока бесплатный (дешёвая модель), но учитывается в дневном потолке.
  const receipt = app.spendAi("feedback");
  if (!receipt.ok) {
    onState({ status: "failed" });
    return;
  }
  onState({ status: "loading" });
  // Пропуск — не ошибка и не повод судить об освоении: в контекст отзыва он не попадает (как и раньше, до записи пропусков).
  const answered = result.answers.filter((a) => !a.skipped);
  const mistakes = answered.filter((a) => !a.correct && !a.retry);
  const skills = [...new Set(answered.map((a) => a.skill).filter(Boolean))] as string[];
  // Освоение для ИИ — с затуханием (#80), как у наставника.
  const stats = decaySkills(app.skills, Date.now());
  lessonFeedback({
    context: buildStudentContext(app),
    lesson: result.title,
    accuracy: result.accuracy,
    durationSec: result.durationSec,
    mistakes: mistakes.slice(0, 8).map((m) => ({ q: m.prompt, given: m.given, expected: m.expected })),
    skills: skills.map((id) => ({ title: skillById(id)?.title[app.profile.lang] ?? id, mastery: stats[id]?.mastery ?? 0 })),
  })
    .then((data) => onState({ status: "done", data }))
    .catch(() => {
      useApp.getState().refundAi(receipt);
      onState({ status: "failed" });
    });
}

export function Results({
  kind,
  lessonId,
  lesson,
  title,
  result,
  bonusXp,
  chips = 0,
  firstPass = false,
  lessonChips: lessonPart = 0,
  perfectDrop = null,
  achievements,
  feedback,
  via,
  xpFactor = 1,
  extra,
  doneHref,
}: {
  kind: "lesson" | "drill";
  lessonId?: string;
  /** Урок (для «В конспект»): название и шпаргалка. */
  lesson?: Pick<Lesson, "title" | "conspect">;
  title: string;
  result: SessionResult;
  bonusXp: number;
  /** Чипов заработано за сессию (разница wallet.earned с начала). */
  chips?: number;
  /** Первое прохождение урока и фактически начисленные чипы за урок (из finishSession, уже с множителем). */
  firstPass?: boolean;
  lessonChips?: number;
  /** «Сюрприз за идеальный урок» / мини-тест на 100% (этап 16В): что уже выдано в finishSession; null — броска не было. */
  perfectDrop?: PerfectDrop | null;
  achievements: string[];
  feedback: FeedbackState;
  /** Режим урока (check — «Проверить себя»). */
  via?: LessonVia;
  /** Множитель XP за этот урок (< 1 — повтор). */
  xpFactor?: number;
  /** Дополнительный блок под заголовком (например, итог экстерна). */
  extra?: ReactNode;
  /** Куда ведёт «Продолжить»: по умолчанию урок — на карту, тренировка — в «Практику». */
  doneHref?: string;
}) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const { multiplier: chipMult } = useChips();
  const skills = useSkillStats();
  const lessons = useApp((s) => s.lessons);
  const dueAt = useApp((s) => (lessonId ? s.lessons[lessonId]?.dueAt : undefined));
  // «Сейчас» фиксируем при показе итогов: для расчёта «повторение через N дней».
  const [shownAt] = useState(() => Date.now());
  const nextDays = dueAt !== undefined ? Math.max(1, Math.round((dueAt - shownAt) / DAY_MS)) : null;
  const next = kind === "lesson" && lessonId ? nextLessonId(lessonId, lessons) : null;
  // «Идеально!» (R2): урок без единой ошибки. Чипы и серия — только за первое прохождение (в сторе уже одно засчитанное).
  const perfect = kind === "lesson" && isPerfectSession(result);
  const perfectRun = useApp((s) => s.perfectRun.current);
  // Чипы из сюрприза показывает своя плитка (с полётом чипов), в сумму сессии они не входят.
  const dropChips = perfectDrop?.kind === "chips" ? perfectDrop.amount : 0;
  const sessionChips = Math.max(0, chips - dropChips);
  // Из чего сложились чипы сессии: урок, прочее (цель дня, достижения). Суммы уже умножены — стор их и начислил.
  const otherChips = Math.max(0, sessionChips - lessonPart);
  const chipParts = [
    lessonPart > 0 ? t(firstPass ? "perfect.break.lesson" : "perfect.break.repeat", { n: lessonPart }) : "",
    otherChips > 0 ? t("perfect.break.other", { n: otherChips }) : "",
  ].filter(Boolean);

  const accuracy = Math.round(result.accuracy * 100);
  const totalXp = result.xp + bonusXp;
  // Новый уровень и ступень (этап 16В, J): опыт сессии уже в сторе, поэтому «до» — вычитанием; снимок при показе итогов.
  const [levels] = useState(() => {
    const xp = useApp.getState().xp;
    return { from: levelInfo(Math.max(0, xp - totalXp)).level, to: levelInfo(xp).level };
  });
  const newTier = newTierOnLevelUp(levels.from, levels.to);
  // Пропущенное задание — не ошибка (#66): в «ошибки» и в темы урока не попадает.
  const answered = result.answers.filter((a) => !a.skipped);
  const mistakes = answered.filter((a) => !a.correct && !a.retry);
  const sessionSkills = [...new Set(answered.map((a) => a.skill).filter(Boolean))] as string[];
  // Из чего сложилась точность: сам / с подсказкой / пропущено (сумма = предъявлено).
  const mix = breakdownOf(result);

  // «Поделиться» уроком (этап 16В, M): ненавязчивая кнопка в «Что дальше». В ссылке только числа — точность, XP, «идеально»,
  // сколько уроков пройдено; ни имени, ни названия урока. Урок уже засчитан в сторе, поэтому пройденных не меньше одного.
  const shareLesson = useMemo<ShareResult | null>(() => {
    if (kind !== "lesson") return null;
    const passed = Object.values(lessons).filter((s) => (s?.completions ?? 0) > 0).length;
    const r: ShareResult = {
      t: "lesson",
      accuracy: Math.max(0, Math.min(100, accuracy)),
      xp: Math.max(0, Math.min(SHARE_MAX_XP, Math.round(totalXp))),
      // «Идеально» в коде — только при точности 100 (иначе код негодный и кнопка пропала бы, share-code.ts).
      perfect: perfect && accuracy === 100,
      n: Math.max(1, passed),
      lang,
    };
    return encodeShare(r) ? r : null;
  }, [kind, lessons, accuracy, totalXp, perfect, lang]);

  // Защита от двойного клика: второй клик «Продолжить» из урока не должен сразу уводить с итогов.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // «Меньше анимаций» (настройка или система) — без конфетти.
    if (useApp.getState().profile.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#1a91d6", "#21b26f", "#f0b400", "#7656f5"];
    let timer: ReturnType<typeof setTimeout> | undefined;
    void import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors });
      // Идеальный результат — ещё два «залпа» с боков.
      if (perfect || accuracy === 100) {
        timer = setTimeout(() => {
          confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors });
          confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors });
        }, 350);
      }
    });
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- конфетти запускаем один раз при показе итогов
  }, []);

  // Звуки итогов: «идеально» играет плеер вместо обычного сигнала завершения, монетку — полёт чипов (ChipFlight).

  // Достижения «выскакивают» по одному — каждое со своим звуком.
  useEffect(() => {
    const timers = achievements.map((_, i) => setTimeout(() => giveFeedback("pop"), 900 + i * 280));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- список достижений фиксирован на время показа
  }, []);

  const staticFeedback = accuracy >= 90 ? t("res.static.great") : accuracy >= 60 ? t("res.static.good") : t("res.static.ok");
  // Точность по смыслу цвета: зелёная от 80%, янтарная 50–79%, красная ниже 50%.
  const accTile = ACC_TILE[accuracy >= 80 ? "success" : accuracy >= 50 ? "warning" : "danger"];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pb-32 pt-8">
      <m.div
        className="flex flex-col items-center gap-2 text-center"
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={springBouncy}
      >
        <Mascot mood="celebrate" size={112} />
        <h1 className="text-3xl font-extrabold">
          {perfect ? t("perfect.title") : via === "check" ? t("modes.check.title") : kind === "lesson" ? t("res.lesson") : t("res.drill")}
        </h1>
        <p className="font-semibold text-muted">{title}</p>
        {kind === "lesson" && (xpFactor < 1 || nextDays !== null) && (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {xpFactor < 1 && (
              <Pill tone="warning" icon={<Repeat size={14} />}>
                {t(xpFactor === REPLAY_XP.review ? "modes.review.res" : "modes.replay.res", { f: formatFactor(xpFactor) })}
              </Pill>
            )}
            {nextDays !== null && <Pill tone="muted">{t("modes.nextReview", { n: nextDays })}</Pill>}
          </div>
        )}
      </m.div>

      {extra}

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <XpIcon size={16} className="border-white/70 bg-white/20 text-white" />, label: t("res.xp"), value: totalXp, format: (n: number) => `+${Math.round(n)}`, cls: "border-gold text-warning-strong", bg: "bg-gold" },
          { icon: <Target size={18} />, label: t("res.accuracy"), value: accuracy, format: (n: number) => `${Math.round(n)}%`, cls: accTile.cls, bg: accTile.bg },
          { icon: <Clock size={18} />, label: t("res.time"), value: result.durationSec, format: (n: number) => formatTime(Math.round(n)), cls: "border-primary text-primary", bg: "bg-action-primary", hint: t("res2.timeHint") },
        ].map((s, i) => (
          // Плитки въезжают лесенкой, числа «накручиваются» следом за своей плиткой.
          <m.div
            key={i}
            data-tour={i === 0 ? "res-xp" : undefined}
            title={"hint" in s ? s.hint : undefined}
            className={clsx("overflow-hidden rounded-2xl border-2", s.cls)}
            initial={{ opacity: 0, y: 28, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...springBouncy, delay: 0.15 + i * 0.12 }}
          >
            <div className={clsx("flex items-center justify-center gap-1 py-1 text-xs font-extrabold text-white", s.bg)}>
              {s.icon} {s.label}
            </div>
            <div className="bg-surface py-3 text-center text-2xl font-extrabold">
              <CountUp value={s.value} format={s.format} delay={0.25 + i * 0.12} />
            </div>
          </m.div>
        ))}
      </div>

      {/* Точность честная (#66): из скольких заданий сам, сколько с подсказкой и пропущено. Нейтральным цветом — это не оценка. */}
      {mix.asked > 0 && (
        <ul aria-label={t("res2.breakdown")} className="-mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs font-bold text-muted">
          <li>{t("res2.self", { x: mix.self, n: mix.asked })}</li>
          {mix.hinted > 0 && <li>{t("res2.hinted", { n: mix.hinted })}</li>}
          {mix.skipped > 0 && <li>{t("res2.skipped", { n: mix.skipped })}</li>}
        </ul>
      )}

      {/* Сколько чипов дала сессия — с разбивкой (урок · прочее). У тренировки без чипов плитки нет. */}
      <div className="flex flex-wrap items-start justify-center gap-2">
        {(kind === "lesson" || sessionChips > 0) && (
          <m.div
            data-tour="res-chips"
            className="relative flex flex-col items-center rounded-2xl border-2 border-gold bg-gold-soft px-4 py-2 text-warning-strong"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: 0.55 }}
          >
            <span data-chip-target className="inline-flex items-center gap-1.5 font-extrabold">
              <Cpu size={18} className="text-gold" aria-hidden /> {t(chipsKey("xp.chipsPlus", sessionChips), { n: sessionChips })}
            </span>
            {sessionChips > 0 && <ChipFlight amount={sessionChips} targetSelector="[data-chip-target]" />}
            {chipParts.length > 0 && <span className="text-xs font-bold text-muted">{chipParts.join(" · ")}{chipMult !== 1 ? ` · ${t("perfect.multNote", { mult: formatMult(chipMult) })}` : ""}</span>}
          </m.div>
        )}
      </div>

      {/* «Сюрприз за идеальный урок» (этап 16В): капсула раскрывается и показывает то, что уже выдано стором. */}
      {perfectDrop && (
        <div className="mx-auto w-full max-w-sm">
          <PerfectDropTile drop={perfectDrop} variant={kind === "lesson" ? "lesson" : "test"} delay={0.8} flightTarget="[data-chip-target]" />
        </div>
      )}

      {/* Серия идеальных уроков подряд — с 2-го (R2). */}
      {perfect && firstPass && perfectRun >= PERFECT_RUN_SHOW_FROM && (
        <div className="-mt-2 flex flex-col items-center gap-1">
          <m.p
            className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-streak bg-streak-soft px-3.5 py-1.5 font-extrabold text-streak"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: 0.85 }}
          >
            <Flame size={18} aria-hidden /> {t("perfect.run", { n: perfectRun })}
          </m.p>
          <p className="text-center text-xs font-bold text-muted">{t("perfect.runHint")}</p>
        </div>
      )}

      {/* Обёртка — метка для Бита-проводника; огня нет — обёртка пустая и не занимает места. */}
      <div data-tour="res-streak" className="empty:hidden">
        <StreakIgnite delay={1.7} />
      </div>

      {/* Бит-проводник: метка «итоги урока» — на первом пройденном уроке Бит покажет опыт, чипы и серию. */}
      {kind === "lesson" && via !== "check" && <GuideSpot kind="results" />}

      {/* Новый уровень: бейдж уровня по ступени; при переходе на новую ступень (5, 10, 20, 30) — строка в её цвете. */}
      {levels.to > levels.from && (
        <m.div
          className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-primary-soft px-4 py-3"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springBouncy, delay: 0.8 }}
        >
          <div className="flex items-center gap-4">
            <LevelBadge level={levels.to} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase text-primary">{t("gamify.newLevel")}</p>
              <p className="text-lg font-extrabold leading-tight">
                {t("stats.level")} {levels.to} · {l(levelTitle(levels.to))}
              </p>
            </div>
          </div>
          {newTier && (
            <TierPill tier={newTier} className="w-full">
              {t("gamify.newTier", { tier: t(`gamify.tier.${newTier}`) })}
            </TierPill>
          )}
        </m.div>
      )}

      {achievements.length > 0 && (
        <div className="flex flex-col gap-2">
          {achievements.map((id, i) => {
            const a = achievementById(id);
            if (!a) return null;
            return (
              <m.div
                key={id}
                className={clsx("flex items-center gap-3 rounded-2xl border-2 px-4 py-3", RARITY_BORDER[a.rarity], RARITY_SOFT[a.rarity])}
                initial={{ opacity: 0, scale: 0.6, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...springBouncy, delay: 0.9 + i * 0.28 }}
              >
                <AchievementBadge icon={a.icon} rarity={a.rarity} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold uppercase text-muted">{t("res.achievement")}</p>
                  <p className="font-extrabold leading-tight">{l(a.title)}</p>
                  {/* Редкость вместо числа чипов: выданное зависит от множителя и могло не совпасть с показанным (E4). */}
                  <p className={clsx("text-xs font-extrabold", RARITY_TEXT[a.rarity])}>{t(RARITY_LABEL[a.rarity])}</p>
                </div>
              </m.div>
            );
          })}
        </div>
      )}

      <Reveal delay={0.5} className="rounded-3xl border-2 border-ai/30 bg-ai-soft p-4 sm:p-5">
        <p className="mb-2 flex items-center gap-1.5 font-extrabold text-ai">
          <Sparkles size={18} /> {t("res.ai")}
        </p>
        {feedback.status === "loading" && (
          <div className="flex flex-col gap-2" aria-busy>
            <div className="h-4 w-11/12 animate-pulse rounded bg-ai/15" />
            <div className="h-4 w-9/12 animate-pulse rounded bg-ai/15" />
          </div>
        )}
        {feedback.status === "done" && (
          <div className="animate-fade-in">
            <Markdown>{feedback.data.feedback}</Markdown>
            {feedback.data.focus.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {feedback.data.focus.map((f, i) => (
                  <li key={i} className="rounded-full bg-surface px-3 py-1 text-sm font-bold text-ai">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {feedback.status === "failed" && <p className="font-semibold">{staticFeedback}</p>}
      </Reveal>

      {sessionSkills.length > 0 && (
        <Card appear>
          <p className="mb-3 font-extrabold">{t("res.skills")}</p>
          <div className="flex flex-col gap-3">
            {sessionSkills.map((id) => {
              const st = skills[id];
              const lvl = masteryLevel(st);
              return (
                <div key={id}>
                  <div className="mb-1 flex justify-between text-sm font-bold">
                    <span>{skillById(id) ? l(skillById(id)!.title) : id}</span>
                    <span style={{ color: MASTERY_COLOR[lvl] }}>{t(`mastery.${lvl}`)}</span>
                  </div>
                  <ProgressBar value={st?.mastery ?? 0} color={MASTERY_COLOR[lvl]} height={10} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {kind === "lesson" && lessonId && (
        <Card appear>
          <p className="mb-3 font-extrabold">{t("modes.next.title")}</p>
          <div className="flex flex-col gap-3">
            {next ? (
              <ButtonLink href={`/lesson/${next}`} size="lg" block icon={<StepForward size={20} />}>
                {t("modes.next.lesson")}
              </ButtonLink>
            ) : (
              <ButtonLink href="/learn" size="lg" block icon={<MapIcon size={20} />}>
                {t("modes.next.map")}
              </ButtonLink>
            )}
            <div className="grid grid-cols-2 gap-3">
              <ButtonLink href="/drill?mode=smart" variant="secondary" block icon={<RotateCcw size={18} className="shrink-0" />} className="h-auto min-h-11 py-2 text-center leading-tight">
                {t("modes.next.weak")}
              </ButtonLink>
              <Button
                variant="secondary"
                block
                icon={<BookOpen size={18} className="shrink-0" />}
                className="h-auto min-h-11 py-2 leading-tight"
                disabled={!lesson}
                onClick={() => lesson && useSaveToNotes.getState().open({ source: "lesson", lessonId, title: l(lesson.title), text: l(lesson.conspect) })}
              >
                {t("modes.next.note")}
              </Button>
            </div>
            <div className="flex gap-3">
              <ButtonLink href={`/theory/${lessonId}`} variant="ghost" block icon={<Library size={18} />} className="h-auto min-h-11 flex-1 py-2 leading-tight">
                {t("theory.read")}
              </ButtonLink>
              {shareLesson && (
                <ShareSheet
                  source={shareLesson}
                  what="lesson"
                  label={<span className="sr-only">{t("share.btn.short")}</span>}
                  icon={<Share2 size={20} aria-hidden />}
                  variant="ghost"
                  className="h-11 w-11 shrink-0 px-0"
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {mistakes.length > 0 && (
        <Card appear>
          <p className="mb-2 font-extrabold">{t("stats.mistakes")}</p>
          <ul className="flex flex-col gap-2">
            {mistakes.map((m, i) => (
              <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <p className="font-semibold">{m.prompt}</p>
                <p className="mt-1">
                  <span className="font-bold text-danger line-through">{m.given || "—"}</span>
                  <span className="mx-2 text-muted">→</span>
                  <span className="font-mono font-bold text-success">{m.expected}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex max-w-xl px-4">
          <Button size="lg" block data-tour="res-continue" disabled={!armed} onClick={() => router.push(doneHref ?? (kind === "lesson" ? "/learn" : "/practice"))}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
