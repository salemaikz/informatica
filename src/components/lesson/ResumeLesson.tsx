"use client";

import { Play, RotateCcw, Zap } from "lucide-react";
import { m } from "motion/react";
import type { LessonRun } from "@/lib/lesson-run";
import { runPaid } from "@/lib/lesson-run";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Mascot } from "@/components/mascot/Mascot";
import { springBouncy } from "@/components/motion/presets";
import { HeartCost } from "@/components/economy/HeartCost";
import { HeartsBar } from "@/components/economy/HeartsBar";
import { useNow } from "@/components/economy/useEconomy";
import { graceText, resumeStep } from "./run-snapshot";

/**
 * Экран «Урок не закончен» (#41): урок в режиме «Учиться» сохранён — продолжить с того же шага или начать заново.
 * Цена входа (#40): «Продолжить» стоит сердечко, только если вход не оплачен (или окно RUN_GRACE_MS прошло) и впереди есть задания;
 * «Начать заново» стоит всегда. Полноэкранный, по стилю как «Сердечки закончились».
 */
export function ResumeLesson({
  title,
  run,
  total,
  ahead,
  cost,
  onContinue,
  onRestart,
  backHref,
}: {
  /** Название урока (уже на языке интерфейса). */
  title: string;
  run: LessonRun;
  /** Шагов в уроке — для «Шаг N из M» и полоски. */
  total: number;
  /** Впереди есть задания — значит, при первом ответе спишется вход. */
  ahead: boolean;
  /** Цена входа в урок (lessonCost). */
  cost: number;
  onContinue: () => void;
  onRestart: () => void;
  backHref: string;
}) {
  const { t, lang } = useT();
  const now = useNow();
  const free = !ahead || (now > 0 && runPaid(run, now));
  const { n, m: all } = resumeStep(run, total);

  return (
    <main className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-4">
        {/* Запас сердечек — чтобы решить, продолжать или начинать заново (вход стоит сердечко). */}
        <HeartsBar className="self-end" />
        <div className="flex flex-col items-center gap-2 text-center">
          <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
            <Mascot mood="thinking" size={96} />
          </m.div>
          <h1 className="text-2xl font-extrabold leading-tight">{t("hearts.resume.title")}</h1>
          <p className="font-bold text-muted">{title}</p>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-extrabold">{t("hearts.resume.step", { n, m: all })}</span>
            {run.xp > 0 && (
              <Pill tone="gold" icon={<Zap size={12} aria-hidden />}>
                {t("hearts.resume.xp", { n: run.xp })}
              </Pill>
            )}
          </div>
          <ProgressBar value={run.done / Math.max(1, total)} label={title} />
        </Card>

        <div className="flex flex-col gap-2">
          <Button size="lg" block icon={<Play size={20} fill="currentColor" aria-hidden />} onClick={onContinue} autoFocus>
            {t("hearts.resume.continue")}
            {!free && <HeartCost n={cost} variant="solid" />}
          </Button>
          {!free && <p className="text-center text-sm font-semibold text-muted">{t("hearts.resume.grace", { time: graceText(lang) })}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" block icon={<RotateCcw size={18} aria-hidden />} onClick={onRestart}>
            {t("hearts.resume.restart")}
            <HeartCost n={cost} />
          </Button>
          <p className="text-center text-sm font-semibold text-muted">{t("hearts.resume.restartHint")}</p>
        </div>

        <ButtonLink href={backHref} variant="ghost" block>
          {t("common.back")}
        </ButtonLink>
      </div>
    </main>
  );
}
