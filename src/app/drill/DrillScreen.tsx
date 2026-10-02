"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, Flag } from "lucide-react";
import type { EntTopicId, QuestionStep, SessionResult } from "@/lib/types";
import { useApp } from "@/lib/store";
import { getLesson } from "@/content/course";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import { skillById } from "@/content/skills";
import { useT } from "@/i18n/useT";
import {
  buildExtern,
  buildMistakes,
  buildReview,
  buildSkill,
  buildSmart,
  buildTopic,
  EXTERN_PASS,
  externLessons,
  externPassed,
  hasBank,
  lessonAccuracies,
  unitById,
  type DrillMode,
} from "@/lib/drill";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { ButtonLink } from "@/components/ui/Button";

interface Built {
  steps: QuestionStep[];
  mistakeMap?: Record<string, string>;
  /** Разминка: уроки, чьё расписание повторения сдвигаем по итогам. */
  reviewLessons?: string[];
  /** Экстерн: уроки, которые засчитаем при зачёте. */
  externLessons?: string[];
  /** Разминка без повторов превратилась в умную тренировку. */
  fallback?: boolean;
}

/** Собирает набор заданий для тренировки один раз при открытии экрана. */
function buildSession(mode: DrillMode, p: { skill?: string; unit?: string; topic?: string }): Built {
  const s = useApp.getState();
  const seed = Date.now();
  switch (mode) {
    case "mistakes": {
      const { steps, map } = buildMistakes(s.mistakes, s.skills, seed);
      return { steps, mistakeMap: map };
    }
    case "skill":
      return { steps: p.skill && skillById(p.skill) && hasBank(p.skill) ? buildSkill(p.skill, s.skills, seed) : [] };
    case "topic": {
      const topic = ENT_TOPICS.find((x) => x.id === p.topic)?.id;
      return { steps: topic ? buildTopic(topic, s.skills, seed) : [] };
    }
    case "extern": {
      const lessons = externLessons(p.unit, s.lessons);
      return { steps: buildExtern(p.unit, s.lessons, seed), externLessons: lessons };
    }
    case "review": {
      const r = buildReview(s.lessons, s.skills, Date.now(), seed);
      return { steps: r.steps, reviewLessons: r.lessons, fallback: r.fallback };
    }
    default:
      return { steps: buildSmart(s.lessons, s.skills, seed) };
  }
}

type ExternOutcome = { passed: true; accuracy: number; credited: number } | { passed: false; accuracy: number; lessonId?: string };

export function DrillScreen({ mode, skill, unit, topic }: { mode: DrillMode; skill?: string; unit?: string; topic?: string }) {
  const { t, l } = useT();
  const [session] = useState(() => buildSession(mode, { skill, unit, topic }));
  const [outcome, setOutcome] = useState<ExternOutcome | null>(null);
  const completeLessons = useApp((s) => s.completeLessons);
  const markReviewed = useApp((s) => s.markReviewed);

  const onSessionFinish = useCallback(
    (result: SessionResult) => {
      if (mode === "review" && session.reviewLessons?.length) {
        // Точность считаем по заданиям навыков каждого урока: стор сдвинет расписание повторения.
        for (const [id, acc] of Object.entries(lessonAccuracies(result.answers, session.reviewLessons))) markReviewed([id], acc);
      }
      if (mode === "extern" && session.externLessons?.length) {
        if (externPassed(result.accuracy)) {
          completeLessons(session.externLessons, "extern", result.accuracy);
          setOutcome({ passed: true, accuracy: result.accuracy, credited: session.externLessons.length });
        } else {
          setOutcome({ passed: false, accuracy: result.accuracy, lessonId: session.externLessons[0] });
        }
      }
    },
    [mode, session, completeLessons, markReviewed],
  );

  const externUnit = unitById(unit);
  const topicShort = mode === "topic" && topic && ENT_TOPICS.some((x) => x.id === topic) ? l(entTopicById(topic as EntTopicId).short) : "";
  const title =
    mode === "mistakes"
      ? t("prac.mistakes")
      : mode === "skill" && skill && skillById(skill)
        ? l(skillById(skill)!.title)
        : mode === "review" && !session.fallback
          ? t("modes.review.title")
          : mode === "extern" && externUnit
            ? t("modes.extern.title", { unit: l(externUnit.title) })
            : mode === "topic"
              ? t("modes.topic.title", { topic: topicShort })
              : t("prac.smart");

  if (!session.steps.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">
          {mode === "mistakes" ? t("prac.noMistakes") : mode === "extern" ? t("modes.extern.none") : t("modes.empty")}
        </p>
        <ButtonLink href={mode === "extern" ? "/learn" : "/practice"} variant="secondary">
          {t("common.back")}
        </ButtonLink>
      </div>
    );
  }

  let extra: ReactNode = null;
  if (outcome?.passed) {
    extra = (
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-success/40 bg-success-soft p-4 text-center">
        <p className="flex items-center justify-center gap-2 text-xl font-extrabold text-success-strong">
          <Check size={22} strokeWidth={3} /> {t("modes.extern.passed")}
        </p>
        <p className="font-semibold">{t("modes.extern.passedText", { n: Math.round(outcome.accuracy * 100), k: outcome.credited })}</p>
        <ButtonLink href="/learn" variant="success" icon={<Flag size={18} />}>
          {t("modes.extern.toMap")}
        </ButtonLink>
      </div>
    );
  } else if (outcome) {
    const lesson = outcome.lessonId ? getLesson(outcome.lessonId) : undefined;
    extra = (
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-warning/40 bg-warning-soft p-4 text-center">
        <p className="text-xl font-extrabold text-warning-strong">{t("modes.extern.failed")}</p>
        <p className="font-semibold">
          {t("modes.extern.failedText", {
            need: Math.round(EXTERN_PASS * 100),
            n: Math.round(outcome.accuracy * 100),
            lesson: lesson ? l(lesson.title) : "",
          })}
        </p>
        {lesson && (
          <ButtonLink href={`/lesson/${lesson.id}`} icon={<Flag size={18} />}>
            {t("modes.extern.toLesson")}
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <LessonPlayer
      kind="drill"
      title={title}
      steps={session.steps}
      mistakeMap={session.mistakeMap}
      onSessionFinish={onSessionFinish}
      resultsExtra={extra}
    />
  );
}
