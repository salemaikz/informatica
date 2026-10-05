"use client";

import clsx from "clsx";
import { BookOpen, Library, Clock, Cpu, Heart, Map as MapIcon, Repeat, RotateCcw, Sparkles, StepForward, Target, Zap } from "lucide-react";
import { m } from "motion/react";
import { AchievementBadge } from "@/components/app/AchievementBadge";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { LessonVia, SessionResult } from "@/lib/types";
import type { LessonFeedbackResponse } from "@/lib/ai-types";
import { useApp } from "@/lib/store";
import { feedback as giveFeedback } from "@/lib/feedback";
import { lessonFeedback } from "@/lib/ai";
import { buildStudentContext } from "@/lib/student-context";
import { achievementById } from "@/lib/gamification";
import { DAY_MS, REPLAY_XP } from "@/lib/review";
import { formatFactor, nextLessonId } from "@/lib/drill";
import { getLesson } from "@/content/course";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { decaySkills, masteryLevel } from "@/lib/mastery";
import { breakdownOf } from "@/lib/player-events";
import { skillById } from "@/content/skills";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Markdown } from "@/components/Markdown";
import { useSkillStats } from "@/components/progress/useSkillStats";
import { Mascot } from "@/components/mascot/Mascot";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { springBouncy } from "@/components/motion/presets";

export const MASTERY_COLOR = {
  new: "var(--border)",
  weak: "var(--danger)",
  progress: "var(--warning)",
  mastered: "var(--success)",
} as const;

/** Плитка точности по смыслу цвета (токены, обе темы). */
const ACC_TILE = {
  success: { cls: "border-success text-success", bg: "bg-success" },
  warning: { cls: "border-warning text-warning-strong", bg: "bg-warning" },
  danger: { cls: "border-danger text-danger", bg: "bg-danger" },
} as const;

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type FeedbackState = { status: "loading" } | { status: "done"; data: LessonFeedbackResponse } | { status: "failed" };

/**
 * Запрашивает у ИИ отзыв об уроке и обновляет «память наставника».
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
    .then((data) => {
      if (data.memory) useApp.getState().setMemory(data.memory);
      onState({ status: "done", data });
    })
    .catch(() => {
      useApp.getState().refundAi(receipt);
      onState({ status: "failed" });
    });
}

export function Results({
  kind,
  lessonId,
  title,
  result,
  bonusXp,
  chips = 0,
  heart = false,
  achievements,
  feedback,
  via,
  xpFactor = 1,
  extra,
}: {
  kind: "lesson" | "drill";
  lessonId?: string;
  title: string;
  result: SessionResult;
  bonusXp: number;
  /** Чипов заработано за сессию (разница wallet.earned с начала). */
  chips?: number;
  /** Тренировка вернула сердечко. */
  heart?: boolean;
  achievements: string[];
  feedback: FeedbackState;
  /** Режим урока (check — «Проверить себя»). */
  via?: LessonVia;
  /** Множитель XP за этот урок (< 1 — повтор). */
  xpFactor?: number;
  /** Дополнительный блок под заголовком (например, итог экстерна). */
  extra?: ReactNode;
}) {
  const router = useRouter();
  const { t, l } = useT();
  const skills = useSkillStats();
  const lessons = useApp((s) => s.lessons);
  const dueAt = useApp((s) => (lessonId ? s.lessons[lessonId]?.dueAt : undefined));
  // «Сейчас» фиксируем при показе итогов: для расчёта «повторение через N дней».
  const [shownAt] = useState(() => Date.now());
  const nextDays = dueAt !== undefined ? Math.max(1, Math.round((dueAt - shownAt) / DAY_MS)) : null;
  const next = kind === "lesson" && lessonId ? nextLessonId(lessonId, lessons) : null;
  const lesson = lessonId ? getLesson(lessonId) : undefined;

  const accuracy = Math.round(result.accuracy * 100);
  const totalXp = result.xp + bonusXp;
  // Пропущенное задание — не ошибка (#66): в «ошибки» и в темы урока не попадает.
  const answered = result.answers.filter((a) => !a.skipped);
  const mistakes = answered.filter((a) => !a.correct && !a.retry);
  const sessionSkills = [...new Set(answered.map((a) => a.skill).filter(Boolean))] as string[];
  // Из чего сложилась точность: сам / с подсказкой / пропущено (сумма = предъявлено).
  const mix = breakdownOf(result);

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
      if (accuracy === 100) {
        timer = setTimeout(() => {
          confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors });
          confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors });
        }, 350);
      }
    });
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- конфетти запускаем один раз при показе итогов
  }, []);

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
          {via === "check" ? t("modes.check.title") : kind === "lesson" ? t("res.lesson") : t("res.drill")}
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
          { icon: <Zap size={18} />, label: t("res.xp"), value: totalXp, format: (n: number) => `+${Math.round(n)}`, cls: "border-gold text-warning-strong", bg: "bg-gold" },
          { icon: <Target size={18} />, label: t("res.accuracy"), value: accuracy, format: (n: number) => `${Math.round(n)}%`, cls: accTile.cls, bg: accTile.bg },
          { icon: <Clock size={18} />, label: t("res.time"), value: result.durationSec, format: (n: number) => formatTime(Math.round(n)), cls: "border-primary text-primary", bg: "bg-primary", hint: t("res2.timeHint") },
        ].map((s, i) => (
          // Плитки въезжают лесенкой, числа «накручиваются» следом за своей плиткой.
          <m.div
            key={i}
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

      {(chips > 0 || heart) && (
        <div className="flex flex-wrap justify-center gap-2">
          {chips > 0 && (
            <m.span
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-gold bg-gold-soft px-3.5 py-1.5 font-extrabold text-warning-strong"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springBouncy, delay: 0.55 }}
            >
              <Cpu size={18} className="text-gold" aria-hidden /> {t("hearts.res.chips", { n: chips })}
            </m.span>
          )}
          {heart && (
            <m.span
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-heart bg-heart-soft px-3.5 py-1.5 font-extrabold text-heart-strong"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springBouncy, delay: 0.7 }}
              title={t("hearts.res.heartHint")}
            >
              <Heart size={18} fill="currentColor" aria-hidden /> {t("hearts.res.heart")}
            </m.span>
          )}
        </div>
      )}

      {achievements.length > 0 && (
        <div className="flex flex-col gap-2">
          {achievements.map((id, i) => {
            const a = achievementById(id);
            if (!a) return null;
            return (
              <m.div
                key={id}
                className="flex items-center gap-3 rounded-2xl border-2 border-gold bg-gold-soft px-4 py-3"
                initial={{ opacity: 0, scale: 0.6, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...springBouncy, delay: 0.9 + i * 0.28 }}
              >
                <AchievementBadge icon={a.icon} size={44} />
                <div>
                  <p className="text-xs font-extrabold uppercase text-warning-strong">{t("res.achievement")}</p>
                  <p className="font-extrabold">{l(a.title)}</p>
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
            <ButtonLink href={`/theory/${lessonId}`} variant="ghost" block icon={<Library size={18} />}>
              {t("theory.read")}
            </ButtonLink>
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
          <Button size="lg" block disabled={!armed} onClick={() => router.push(kind === "lesson" ? "/learn" : "/practice")}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
