"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, Flag } from "lucide-react";
import type { EntTopicId, QuestionStep, SessionResult } from "@/lib/types";
import { useApp } from "@/lib/store";
import { getLesson } from "@/content/course";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import { skillById } from "@/content/skills";
import { ENTRY_COST } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import {
  buildExternSession,
  buildHistoryRedo,
  buildMistakes,
  buildReview,
  buildSkill,
  buildSmart,
  buildTopic,
  EXTERN_PASS,
  externPassed,
  externStartLesson,
  hasBank,
  lessonAccuracies,
  unitById,
  type DrillMode,
} from "@/lib/drill";
import { decaySkills } from "@/lib/mastery";
import { buildMiniTest, buildPractice, buildRecap } from "@/lib/course-mix";
import { buildContextDrill } from "@/lib/context-drill";
import { groupOfPracticeNode, recapNodeId } from "@/content/groups";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { useHeartsOutOnEntry } from "@/components/lesson/useHeartsOutOnEntry";
import { EntryGate } from "@/components/economy/EntryGate";
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
  /** Режим history: записи нет в истории (вытеснена, удалена, опечатка в ссылке). */
  missing?: boolean;
}

interface Params {
  skill?: string;
  unit?: string;
  topic?: string;
  entry?: string;
  /** Узел «Практика» (practice:<урок>) — режимы practice и minitest. */
  node?: string;
  /** Контекстное задание практикума — режим context. */
  item?: string;
}

/** Собирает набор заданий для тренировки один раз при открытии экрана. */
function buildSession(mode: DrillMode, p: Params): Built {
  const st = useApp.getState();
  const seed = Date.now();
  // Освоение с затуханием (#45): слабые и давно не тренированные навыки выпадают чаще.
  const s = { ...st, skills: decaySkills(st.skills, seed) };
  switch (mode) {
    case "practice": {
      const group = p.node ? groupOfPracticeNode(p.node) : undefined;
      return { steps: group ? buildPractice(group, s.lessons, s.skills, seed) : [] };
    }
    case "minitest": {
      const group = p.node ? groupOfPracticeNode(p.node) : undefined;
      return { steps: group ? buildMiniTest(group, seed) : [] };
    }
    case "recap":
      return { steps: unitById(p.unit) ? buildRecap(p.unit!, s.lessons, s.skills, seed) : [] };
    case "context":
      return { steps: p.item ? buildContextDrill(p.item) : [] };
    case "mistakes": {
      const { steps, map } = buildMistakes(s.mistakes, s.skills, seed);
      return { steps, mistakeMap: map };
    }
    case "history": {
      const entry = s.history.find((e) => e.id === p.entry);
      if (!entry) return { steps: [], missing: true };
      const { steps, map } = buildHistoryRedo(entry, s.skills, seed);
      return { steps, mistakeMap: map };
    }
    case "skill":
      return { steps: p.skill && skillById(p.skill) && hasBank(p.skill) ? buildSkill(p.skill, s.skills, seed) : [] };
    case "topic": {
      const topic = ENT_TOPICS.find((x) => x.id === p.topic)?.id;
      return { steps: topic ? buildTopic(topic, s.skills, seed) : [] };
    }
    case "extern": {
      const ex = buildExternSession(p.unit, s.lessons, seed);
      // Засчитать нечего — экран «нечего сдавать», а не тренировка без итога.
      return ex.lessons.length ? { steps: ex.steps, externLessons: ex.lessons } : { steps: [] };
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

export function DrillScreen({ mode, skill, unit, topic, entry, node, item }: { mode: DrillMode } & Params) {
  const { t, l } = useT();
  const [session] = useState(() => buildSession(mode, { skill, unit, topic, entry, node, item }));
  const recordCourseNode = useApp((s) => s.recordCourseNode);
  const [outcome, setOutcome] = useState<ExternOutcome | null>(null);
  const completeLessons = useApp((s) => s.completeLessons);
  const markReviewed = useApp((s) => s.markReviewed);
  // Экстерн стоит 2 сердечка (#40): не хватает на входе — «сердечки закончились» (#69). Пустой набор экран не открывает — события нет.
  useHeartsOutOnEntry(mode === "extern" && session.steps.length ? ENTRY_COST.extern : 0, "extern");
  // Мини-тест группы — как «Проверить себя»: 1 сердечко (этап 14). Практика и повторение — бесплатно (#40).
  useHeartsOutOnEntry(mode === "minitest" && session.steps.length ? ENTRY_COST.check : 0, "check");

  const onSessionFinish = useCallback(
    (result: SessionResult) => {
      // Узлы курса 3.0 (этап 14): прохождение практики, повторения и мини-теста — на карту.
      if ((mode === "practice" || mode === "minitest") && node && groupOfPracticeNode(node)) recordCourseNode(node, mode, result.accuracy);
      if (mode === "recap" && unitById(unit)) recordCourseNode(recapNodeId(unit!), "recap", result.accuracy);
      if (mode === "review" && session.reviewLessons?.length) {
        // Точность считаем по заданиям навыков каждого урока: стор сдвинет расписание повторения.
        for (const [id, acc] of Object.entries(lessonAccuracies(result.answers, session.reviewLessons))) markReviewed([id], acc);
      }
      if (mode === "extern" && session.externLessons?.length) {
        if (externPassed(result.accuracy)) {
          completeLessons(session.externLessons, "extern", result.accuracy);
          setOutcome({ passed: true, accuracy: result.accuracy, credited: session.externLessons.length });
        } else {
          // Начинать — с первого непройденного урока раздела (даже если экстерн его не проверял).
          setOutcome({ passed: false, accuracy: result.accuracy, lessonId: externStartLesson(unit, useApp.getState().lessons) ?? session.externLessons[0] });
        }
      }
    },
    [mode, unit, node, session, completeLessons, markReviewed, recordCourseNode],
  );

  const externUnit = unitById(unit);
  const nodeGroup = node ? groupOfPracticeNode(node) : undefined;
  const topicShort = mode === "topic" && topic && ENT_TOPICS.some((x) => x.id === topic) ? l(entTopicById(topic as EntTopicId).short) : "";
  const title =
    mode === "mistakes" || mode === "history"
      ? t("prac.mistakes")
      : mode === "skill" && skill && skillById(skill)
        ? l(skillById(skill)!.title)
        : mode === "review" && !session.fallback
          ? t("modes.review.title")
          : mode === "extern" && externUnit
            ? t("modes.extern.title", { unit: l(externUnit.title) })
            : mode === "practice" && nodeGroup
              ? t("course3.practice.title", { group: l(nodeGroup.title) })
              : mode === "minitest" && nodeGroup
                ? t("course3.minitest.title", { group: l(nodeGroup.title) })
                : mode === "recap" && externUnit
                  ? t("course3.recap.title", { unit: l(externUnit.title) })
                  : mode === "context"
                    ? t("iderun.context.title")
            : mode === "topic"
              ? t("modes.topic.title", { topic: topicShort })
              : t("prac.smart");

  if (!session.steps.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">
          {mode === "mistakes"
            ? t("prac.noMistakes")
            : mode === "history"
              ? session.missing
                ? t("history.detail.notFound")
                : t("history.redo.none")
              : mode === "extern"
                ? t("modes.extern.none")
                : mode === "practice" || mode === "minitest" || mode === "recap"
                  ? t("course3.empty")
                  : t("modes.empty")}
        </p>
        <ButtonLink
          href={mode === "extern" || mode === "practice" || mode === "minitest" || mode === "recap" ? "/learn" : mode === "history" ? "/history" : mode === "context" ? "/code/context" : "/practice"}
          variant="secondary"
        >
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

  // Экстерн стоит 2 сердечка (#40), мини-тест — 1 (этап 14): плеер спишет при первом ответе, на входе проверяем, что хватает.
  // Остальные режимы — бесплатно.
  const cost = mode === "extern" ? ENTRY_COST.extern : mode === "minitest" ? ENTRY_COST.check : 0;
  const paid = cost > 0;
  const player = (
    <LessonPlayer
      kind="drill"
      title={title}
      mode={mode}
      steps={session.steps}
      mistakeMap={session.mistakeMap}
      onSessionFinish={onSessionFinish}
      resultsExtra={extra}
      entryCost={paid ? cost : undefined}
    />
  );
  return paid ? (
    <EntryGate need={cost} exitHref="/learn">
      {player}
    </EntryGate>
  ) : (
    player
  );
}
