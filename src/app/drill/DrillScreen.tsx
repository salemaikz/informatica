"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Play, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EntTopicId, QuestionStep, SessionResult } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import { skillById } from "@/content/skills";
import { ENTRY_COST } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import {
  buildHistoryRedo,
  buildMistakes,
  buildReview,
  buildSkill,
  buildSmart,
  buildTopic,
  hasBank,
  lessonAccuracies,
  unitById,
  type DrillMode,
} from "@/lib/drill";
import { decaySkills } from "@/lib/mastery";
import { buildMiniTest, buildPractice, buildRecap, miniTestPoints, weakestSkill } from "@/lib/course-mix";
import { buildContextDrill } from "@/lib/context-drill";
import { buildReviewDrill } from "@/lib/code-review-drill";
import { parseReviewArea } from "@/lib/code-review-areas";
import { groupOfPracticeNode, recapNodeId } from "@/content/groups";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { useHeartsOutOnEntry } from "@/components/lesson/useHeartsOutOnEntry";
import { EntryGate } from "@/components/economy/EntryGate";
import { HeartCost } from "@/components/economy/HeartCost";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

interface Built {
  steps: QuestionStep[];
  mistakeMap?: Record<string, string>;
  /** Разминка: уроки, чьё расписание повторения сдвигаем по итогам. */
  reviewLessons?: string[];
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
  /** Область «Чтения кода» (py, db, sql, sheet, web, mix) — режим codeview. */
  area?: string;
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
      return { steps: p.item ? buildContextDrill(p.item, seed) : [] };
    case "codeview": {
      const area = parseReviewArea(p.area);
      return { steps: area ? buildReviewDrill(area, seed) : [] };
    }
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
    case "review": {
      const r = buildReview(s.lessons, s.skills, Date.now(), seed);
      return { steps: r.steps, reviewLessons: r.lessons, fallback: r.fallback };
    }
    default:
      return { steps: buildSmart(s.lessons, s.skills, seed) };
  }
}

/** Экран старта мини-теста (#95): сердечко списывается по «Начать», а не при первом ответе. */
function MiniStart({ title, count, onStart }: { title: string; count: number; onStart: () => boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [noHearts, setNoHearts] = useState(false);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="flex flex-wrap items-center gap-1.5">
        <Pill tone="muted">{t("exam.fmt.questions", { n: count })}</Pill>
        <HeartCost n={ENTRY_COST.check} />
      </p>
      <p className="rounded-2xl border-2 border-border bg-surface p-4 text-[15px] font-semibold">{t("unittest.mini.desc")}</p>
      <Button
        size="lg"
        block
        icon={<Play size={20} aria-hidden />}
        onClick={() => {
          if (!onStart()) setNoHearts(true);
        }}
      >
        {t("common.start")}
        <HeartCost n={ENTRY_COST.check} variant="solid" />
      </Button>
      <ButtonLink href="/learn" variant="ghost">
        {t("common.cancel")}
      </ButtonLink>
      <OutOfHearts open={noHearts} need={ENTRY_COST.check} onClose={() => setNoHearts(false)} onResume={() => setNoHearts(false)} onExit={() => router.push("/learn")} />
    </div>
  );
}

export function DrillScreen({ mode, skill, unit, topic, entry, node, item, area }: { mode: DrillMode } & Params) {
  const { t, l } = useT();
  const [session] = useState(() => buildSession(mode, { skill, unit, topic, entry, node, item, area }));
  const recordCourseNode = useApp((s) => s.recordCourseNode);
  // Мини-тест: вход оплачен кнопкой «Начать» (плеер дальше не списывает).
  const [started, setStarted] = useState(false);
  // Итог мини-теста: баллы «как на ЕНТ» и слабое место (этап 14).
  const [mini, setMini] = useState<{ points: number; max: number; weak?: string } | null>(null);
  const markReviewed = useApp((s) => s.markReviewed);
  // Мини-тест группы — как «Проверить себя»: 1 сердечко (этап 14), списывается по «Начать» (#95). Практика и повторение — бесплатно (#40).
  useHeartsOutOnEntry(mode === "minitest" && session.steps.length ? ENTRY_COST.check : 0, "check");

  const onSessionFinish = useCallback(
    (result: SessionResult) => {
      // Узлы курса 3.0 (этап 14): прохождение практики, повторения и мини-теста — на карту.
      // Мини-тест — по баллам как на ЕНТ (multi и «соответствие» весят 2), практика и повторение — по точности.
      const points = mode === "minitest" ? miniTestPoints(session.steps, result.answers) : null;
      const groupNode = node && groupOfPracticeNode(node) ? node : undefined;
      if (mode === "practice" && groupNode) recordCourseNode(groupNode, "practice", result.accuracy);
      if (mode === "minitest" && groupNode && points) recordCourseNode(groupNode, "minitest", points.max > 0 ? points.points / points.max : 0);
      if (mode === "recap" && unitById(unit)) recordCourseNode(recapNodeId(unit!), "recap", result.accuracy);
      if (points) setMini({ ...points, weak: weakestSkill(result.answers) });
      if (mode === "review" && session.reviewLessons?.length) {
        // Точность считаем по заданиям навыков каждого урока: стор сдвинет расписание повторения.
        for (const [id, acc] of Object.entries(lessonAccuracies(result.answers, session.reviewLessons))) markReviewed([id], acc);
      }
    },
    [mode, unit, node, session, markReviewed, recordCourseNode],
  );

  const recapUnit = unitById(unit);
  const nodeGroup = node ? groupOfPracticeNode(node) : undefined;
  const topicShort = mode === "topic" && topic && ENT_TOPICS.some((x) => x.id === topic) ? l(entTopicById(topic as EntTopicId).short) : "";
  const title =
    mode === "mistakes" || mode === "history"
      ? t("prac.mistakes")
      : mode === "skill" && skill && skillById(skill)
        ? l(skillById(skill)!.title)
        : mode === "review" && !session.fallback
          ? t("modes.review.title")
          : mode === "practice" && nodeGroup
            ? t("course3.practice.title", { group: l(nodeGroup.title) })
            : mode === "minitest" && nodeGroup
              ? t("course3.minitest.title", { group: l(nodeGroup.title) })
              : mode === "recap" && recapUnit
                ? t("course3.recap.title", { unit: l(recapUnit.title) })
                : mode === "context"
                  ? t("iderun.context.title")
                  : mode === "codeview"
                    ? parseReviewArea(area)
                      ? t("codeview.session", { area: t(`codeview.area.${parseReviewArea(area)!}`) })
                      : t("codeview.title")
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
              : mode === "minitest"
                ? t("course3.minitest.empty")
                : mode === "practice" || mode === "recap"
                  ? t("course3.empty")
                  : t("modes.empty")}
        </p>
        <ButtonLink
          href={mode === "practice" || mode === "minitest" || mode === "recap" ? "/learn" : mode === "history" ? "/history" : mode === "context" ? "/code/context" : mode === "codeview" ? "/code/review" : "/practice"}
          variant="secondary"
        >
          {t("common.back")}
        </ButtonLink>
      </div>
    );
  }

  let extra: ReactNode = null;
  if (mini) {
    // Баллы как на ЕНТ: от 80% — «освоено» (success), иначе — «в процессе» (warning).
    const good = mini.max > 0 && mini.points / mini.max >= 0.8;
    const weak = mini.weak ? skillById(mini.weak) : undefined;
    extra = (
      <div className={cn("flex flex-col gap-3 rounded-3xl border-2 p-4 text-center", good ? "border-success/40 bg-success-soft" : "border-warning/40 bg-warning-soft")}>
        <p className={cn("text-xl font-extrabold", good ? "text-success-strong" : "text-warning-strong")}>{t("course3.minitest.points", { points: mini.points, max: mini.max })}</p>
        {weak && (
          <p className="flex items-center justify-center gap-2 text-sm font-bold">
            <Target size={16} className="shrink-0 text-danger" aria-hidden />
            <span>{t("course3.minitest.weak", { skill: l(weak.title) })}</span>
          </p>
        )}
      </div>
    );
  }

  // Мини-тест (#95): до «Начать» — экран старта; вход (1 сердечко) списывается кнопкой, плеер дальше не списывает (entryCost 0).
  // Нет сердечек на входе — «Сердечки закончились» (EntryGate). Остальные режимы — бесплатно.
  if (mode === "minitest" && !started) {
    return (
      <EntryGate need={ENTRY_COST.check} exitHref="/learn">
        <MiniStart
          title={title}
          count={session.steps.length}
          onStart={() => {
            if (!useApp.getState().payEntry(ENTRY_COST.check).ok) return false;
            setStarted(true);
            return true;
          }}
        />
      </EntryGate>
    );
  }
  return (
    <LessonPlayer
      kind="drill"
      title={title}
      mode={mode}
      steps={session.steps}
      mistakeMap={session.mistakeMap}
      onSessionFinish={onSessionFinish}
      resultsExtra={extra}
      testMode={mode === "minitest"}
    />
  );
}
