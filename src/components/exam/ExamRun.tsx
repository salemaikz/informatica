"use client";

import { ChevronLeft, ChevronRight, Flag, LayoutGrid, Play, TimerOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENT_POOL } from "@/content/ent";
import { entTopicById } from "@/content/ent-topics";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { buildExam, EXAM_TIME_LIMIT_SEC, type ExamKind, type ExamPaper } from "@/lib/exam";
import {
  buildSummary,
  createAttempt,
  loadActiveAttempt,
  deleteAttempt,
  newAttemptId,
  progressOf,
  saveAttemptState,
  setActiveAttempt,
  skillScoresOf,
  addTime,
  toggleFlag,
  type ExamAttempt,
} from "@/lib/exam-store";
import { useApp } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";
import { ignoreKey } from "@/lib/keys";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { useToolboxLevel } from "@/components/tools/useToolbox";
import { ExamNotes } from "./ExamNotes";
import { formatClock, randomSeed, remainingSec } from "./logic";
import { Navigator } from "./Navigator";
import { QuestionView } from "./QuestionView";

export interface ExamRunProps {
  kind: ExamKind | null;
  seed: number | null;
  topics: EntTopicId[];
}

type Phase =
  | { name: "loading" }
  /** Нет параметров и нет начатой попытки. */
  | { name: "none" }
  /** Новая попытка: показываем вариант и условия, таймер пока не идёт. */
  | { name: "intro"; paper: ExamPaper; seed: number; topics: EntTopicId[]; replaces: ExamAttempt | null }
  /** Есть начатая другая попытка: продолжить или начать новую. */
  | { name: "resume"; active: ExamAttempt; fresh: { paper: ExamPaper; seed: number; topics: EntTopicId[] } | null }
  | { name: "run"; attempt: ExamAttempt };

const sameVariant = (a: ExamAttempt, kind: ExamKind, seed: number | null, topics: EntTopicId[]) =>
  a.kind === kind && (seed === null || a.seed === seed) && (kind !== "topic" || (a.topics ?? []).join() === topics.join());

function buildFresh(kind: ExamKind, seed: number | null, topics: EntTopicId[]) {
  const s = seed ?? randomSeed();
  return { paper: buildExam({ kind, seed: s, pool: ENT_POOL, topics }), seed: s, topics };
}

/** Экран прохождения: загрузка → (продолжить?) → условия → сами задания. Спокойная оболочка без маскота, XP, звуков и ИИ. */
export function ExamRun({ kind, seed, topics: topicsProp }: ExamRunProps) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  // Массив из пропсов может прийти новым при той же строке — эффект зависит от строки, а не от ссылки.
  const topicsKey = topicsProp.join(",");
  const topics = useMemo(() => (topicsKey ? (topicsKey.split(",") as EntTopicId[]) : []), [topicsKey]);

  useEffect(() => {
    let off = false;
    loadActiveAttempt().then((active) => {
      if (off) return;
      if (active && (!kind || sameVariant(active, kind, seed, topics))) return setPhase({ name: "run", attempt: active });
      if (!kind) return setPhase({ name: "none" });
      if (active) return setPhase({ name: "resume", active, fresh: null });
      setPhase({ name: "intro", ...buildFresh(kind, seed, topics), replaces: null });
    });
    return () => {
      off = true;
    };
  }, [kind, seed, topics]);

  if (phase.name === "run") return <Runner key={phase.attempt.id} initial={phase.attempt} />;

  return (
    <Calm>
      {phase.name === "loading" && <p className="py-20 text-center font-bold text-muted">{t("common.loading")}</p>}
      {phase.name === "none" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-extrabold">{t("exam.run.none")}</p>
          <ButtonLink href="/exam">{t("exam.run.toHub")}</ButtonLink>
        </div>
      )}
      {phase.name === "resume" && kind && (
        <ResumeChoice
          active={phase.active}
          onContinue={() => setPhase({ name: "run", attempt: phase.active })}
          onFresh={() => setPhase({ name: "intro", ...buildFresh(kind, seed, topics), replaces: phase.active })}
        />
      )}
      {phase.name === "intro" && (
        <Intro
          paper={phase.paper}
          topics={phase.topics}
          onStart={async () => {
            if (phase.replaces) await deleteAttempt(phase.replaces.id);
            const now = Date.now();
            const attempt: ExamAttempt = {
              id: newAttemptId(now),
              kind: phase.paper.kind,
              seed: phase.seed,
              topics: phase.paper.kind === "topic" ? phase.topics : undefined,
              paper: phase.paper,
              answers: {},
              current: 0,
              startedAt: now,
              elapsedMs: 0,
            };
            await createAttempt(attempt);
            await setActiveAttempt(attempt.id);
            setPhase({ name: "run", attempt });
          }}
        />
      )}
    </Calm>
  );
}

function Calm({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">{children}</div>
    </div>
  );
}

function ResumeChoice({ active, onContinue, onFresh }: { active: ExamAttempt; onContinue: () => void; onFresh: () => void }) {
  const { t } = useT();
  const { answered } = progressOf(active.paper, active.answers);
  const left = remainingSec(active.paper.timeLimitSec, active.elapsedMs);
  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-extrabold">{t("exam.resume.title")}</h1>
      <p className="font-semibold text-muted">
        {t(`exam.mode.${active.kind}` as DictKey)} · {t("exam.resume.progress", { done: answered, total: active.paper.items.length })} ·{" "}
        {t("exam.resume.left", { time: formatClock(left) })}
      </p>
      <Button size="lg" block icon={<Play size={20} aria-hidden />} onClick={onContinue}>
        {t("exam.resume.continue")}
      </Button>
      <Button variant="secondary" block onClick={onFresh}>
        {t("exam.resume.fresh")}
      </Button>
      <p className="text-sm font-semibold text-muted">{t("exam.resume.freshWarn")}</p>
    </div>
  );
}

function Intro({ paper, topics, onStart }: { paper: ExamPaper; topics: EntTopicId[]; onStart: () => Promise<void> }) {
  const { t, l } = useT();
  const [busy, setBusy] = useState(false);
  const empty = paper.items.length === 0;
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t(`exam.mode.${paper.kind}` as DictKey)}</h1>
        {!empty && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="muted">{t("exam.fmt.questions", { n: paper.items.length })}</Pill>
            <Pill tone="muted">{t("common.minutes", { n: Math.round(paper.timeLimitSec / 60) })}</Pill>
            <Pill tone="muted">{t("exam.fmt.points", { n: paper.maxPoints })}</Pill>
          </p>
        )}
      </div>
      {empty ? (
        <p className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-3.5 font-semibold">{t("exam.run.emptyPaper")}</p>
      ) : (
        <ul className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-surface p-4 text-[15px] font-semibold">
          <li>{t("exam.rule.timer", { n: Math.round(paper.timeLimitSec / 60) })}</li>
          <li>{t("exam.rule.tools")}</li>
          <li>{t("exam.rule.noAi")}</li>
          <li>{t("exam.rule.save")}</li>
        </ul>
      )}
      {paper.kind === "topic" && topics.length > 0 && <p className="text-sm font-bold text-muted">{t("exam.run.topics", { list: topics.map((x) => l(entTopicById(x).short)).join(", ") })}</p>}
      <ExamNotes paper={paper} />
      {!empty && (
        <Button
          size="lg"
          block
          disabled={busy}
          icon={<Play size={20} aria-hidden />}
          onClick={() => {
            setBusy(true);
            onStart().catch(() => setBusy(false));
          }}
        >
          {t("exam.run.begin")}
        </Button>
      )}
      <ButtonLink href="/exam" variant="ghost">
        {empty ? t("exam.run.toHub") : t("common.cancel")}
      </ButtonLink>
    </div>
  );
}

type Sheet = null | "nav" | "finish" | "exit";

function Runner({ initial }: { initial: ExamAttempt }) {
  const { t } = useT();
  const router = useRouter();
  useToolboxLevel("ent");

  const paper = initial.paper;
  const total = paper.items.length;
  const limitSec = paper.timeLimitSec || EXAM_TIME_LIMIT_SEC[paper.kind];
  const baseMs = initial.elapsedMs;

  const [answers, setAnswers] = useState(initial.answers);
  const [current, setCurrent] = useState(initial.current);
  const [elapsedMs, setElapsedMs] = useState(baseMs);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [timeUp, setTimeUp] = useState(() => remainingSec(limitSec, baseMs) === 0);
  const [finishing, setFinishing] = useState(false);

  // Актуальное состояние для обработчиков, таймера и сохранения.
  const answersRef = useRef(initial.answers);
  const currentRef = useRef(initial.current);
  const resumedAt = useRef(0);
  const enteredAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);
  const timeUpRef = useRef(remainingSec(limitSec, baseMs) === 0);

  const elapsedNow = useCallback(() => baseMs + Math.max(0, Date.now() - resumedAt.current), [baseMs]);

  const persist = useCallback(() => {
    if (doneRef.current || resumedAt.current === 0) return;
    const { paper: _paper, ...rest } = initial;
    void _paper;
    saveAttemptState({ ...rest, answers: answersRef.current, current: currentRef.current, elapsedMs: elapsedNow() }).catch(() => {});
  }, [initial, elapsedNow]);

  const schedule = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persist();
    }, 350);
  }, [persist]);

  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    persist();
  }, [persist]);

  const commit = useCallback(
    (next: typeof answers) => {
      answersRef.current = next;
      setAnswers(next);
      schedule();
    },
    [schedule],
  );

  /** Время, проведённое на текущем задании, — в его ответ. */
  const leaveQuestion = useCallback(() => {
    const now = Date.now();
    const ms = now - enteredAt.current;
    enteredAt.current = now;
    const key = paper.items[currentRef.current]?.key;
    if (key) {
      answersRef.current = addTime(answersRef.current, key, ms);
      setAnswers(answersRef.current);
    }
  }, [paper]);

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      leaveQuestion();
      currentRef.current = i;
      setCurrent(i);
      setSheet(null);
      schedule();
      window.scrollTo({ top: 0 });
    },
    [leaveQuestion, schedule, total],
  );

  // Таймер, сохранение при уходе со страницы.
  useEffect(() => {
    const now = Date.now();
    resumedAt.current = now;
    enteredAt.current = now;
    let ticks = 0;
    const tick = () => {
      const e = baseMs + (Date.now() - resumedAt.current);
      setElapsedMs(e);
      // Время пишем и без действий ученика: если браузер выгрузит вкладку без pagehide, потеряется не больше 15 с.
      if (++ticks % 15 === 0 && !saveTimer.current) persist();
      // Время вышло: фиксируем время текущего задания, ответы закрываются, итог — по кнопке.
      if (remainingSec(limitSec, e) === 0 && !timeUpRef.current) {
        timeUpRef.current = true;
        leaveQuestion();
        setSheet(null);
        setTimeUp(true);
      }
    };
    const id = setInterval(tick, 1000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [baseMs, limitSec, flush, persist, leaveQuestion]);

  // Стрелки — между заданиями (если не печатаем в калькуляторе/черновике).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e) || sheet || timeUp) return;
      if (e.key === "ArrowRight") go(currentRef.current + 1);
      if (e.key === "ArrowLeft") go(currentRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, sheet, timeUp]);

  const finish = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFinishing(true);
    leaveQuestion();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const now = Date.now();
    const attempt: ExamAttempt = {
      ...initial,
      answers: answersRef.current,
      current: currentRef.current,
      elapsedMs: Math.min(elapsedNow(), limitSec * 1000),
      finishedAt: now,
    };
    useApp.getState().recordExam(buildSummary(attempt, now), skillScoresOf(paper, attempt.answers));
    const { paper: _paper, ...state } = attempt;
    void _paper;
    try {
      await saveAttemptState(state);
      await setActiveAttempt(null);
    } catch {
      // Итог уже в сторе; без разбора в IndexedDB экран результата покажет итог.
    }
    router.replace(`/exam/result/${attempt.id}`);
  };

  const exit = () => {
    flush();
    router.push("/exam");
  };

  const q = paper.items[current];
  const a = answers[q.key];
  const left = remainingSec(limitSec, elapsedMs);
  const progress = progressOf(paper, answers);
  const locked = timeUp || finishing;
  const last = current === total - 1;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b-2 border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-3 pt-[env(safe-area-inset-top)] min-[400px]:gap-2">
          <button
            type="button"
            onClick={() => setSheet("exit")}
            aria-label={t("exam.run.exit")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
          >
            <X size={22} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSheet("nav")}
            aria-label={t("exam.nav.open")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 text-sm font-extrabold lg:pointer-events-none"
          >
            <LayoutGrid size={16} className="text-muted max-[379px]:hidden lg:hidden" aria-hidden />
            {current + 1} / {total}
          </button>
          <div className="flex-1" />
          <span
            role="timer"
            aria-label={t("exam.run.timeLeft")}
            className={cn("font-mono text-lg font-extrabold tabular-nums", left <= 300 ? "text-warning-strong" : "text-text")}
          >
            {formatClock(left)}
          </span>
          <ToolboxButton variant="icon" />
          <Button size="sm" variant="secondary" className="h-10" onClick={() => setSheet("finish")} disabled={finishing}>
            {t("exam.run.finish")}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-8 px-4 pb-32 pt-5 sm:px-6">
        <main className="min-w-0 max-w-2xl flex-1">
          <QuestionView key={q.key} q={q} number={current + 1} answers={answers} onChange={commit} locked={locked} flagged={!!a?.flagged} />
        </main>
        <aside className="sticky top-20 hidden h-fit w-72 shrink-0 rounded-3xl border-2 border-border bg-surface p-4 lg:block">
          <p className="mb-3 font-extrabold">{t("exam.nav.title")}</p>
          <Navigator paper={paper} answers={answers} current={current} onGo={go} />
        </aside>
      </div>

      {/* Нижняя панель: назад / флажок / далее */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <Button variant="secondary" className="min-w-0 flex-1 whitespace-nowrap px-3 sm:max-w-44" disabled={current === 0} onClick={() => go(current - 1)} icon={<ChevronLeft size={18} aria-hidden />}>
            {t("common.back")}
          </Button>
          <button
            type="button"
            aria-pressed={!!a?.flagged}
            aria-label={a?.flagged ? t("exam.flag.off") : t("exam.flag.on")}
            disabled={locked}
            onClick={() => commit(toggleFlag(answersRef.current, q.key))}
            className={cn(
              "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-extrabold sm:px-4",
              a?.flagged ? "border-warning bg-warning-soft text-warning-strong" : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Flag size={18} fill={a?.flagged ? "currentColor" : "none"} aria-hidden />
            <span className="hidden min-[400px]:inline">{t("exam.flag.label")}</span>
          </button>
          {last ? (
            <Button className="min-w-0 flex-1 whitespace-nowrap px-3 sm:max-w-44" onClick={() => setSheet("finish")} disabled={finishing}>
              {t("exam.run.finish")}
            </Button>
          ) : (
            <Button className="min-w-0 flex-1 whitespace-nowrap px-3 sm:max-w-44" onClick={() => go(current + 1)}>
              {t("common.next")}
              <ChevronRight size={18} aria-hidden />
            </Button>
          )}
        </div>
      </nav>

      {/* Навигатор шторкой (телефон) */}
      <Modal open={sheet === "nav"} onClose={() => setSheet(null)} label={t("exam.nav.title")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t("exam.nav.title")}</h2>
          <span className="text-sm font-bold text-muted">{t("exam.nav.count", { done: progress.answered, total })}</span>
        </div>
        <Navigator paper={paper} answers={answers} current={current} onGo={go} />
      </Modal>

      <Modal open={sheet === "finish"} onClose={() => setSheet(null)} label={t("exam.finish.title")}>
        <h2 className="mb-2 text-xl font-extrabold">{t("exam.finish.title")}</h2>
        <div className="mb-4 flex flex-col gap-1 font-semibold">
          <p className={progress.unanswered > 0 ? "text-warning-strong" : "text-success-strong"}>
            {progress.unanswered > 0 ? t("exam.finish.unanswered", { n: progress.unanswered }) : t("exam.finish.allAnswered")}
          </p>
          {progress.flagged > 0 && <p className="text-muted">{t("exam.finish.flagged", { n: progress.flagged })}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={finish} disabled={finishing}>
            {t("exam.finish.confirm")}
          </Button>
          <Button variant="secondary" block onClick={() => setSheet(null)}>
            {t("exam.finish.back")}
          </Button>
        </div>
      </Modal>

      <Modal open={sheet === "exit"} onClose={() => setSheet(null)} label={t("exam.exit.title")}>
        <h2 className="mb-2 text-xl font-extrabold">{t("exam.exit.title")}</h2>
        <p className="mb-4 font-semibold text-muted">{t("exam.exit.desc")}</p>
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={() => setSheet(null)}>
            {t("exam.exit.stay")}
          </Button>
          <Button variant="secondary" block onClick={exit}>
            {t("exam.exit.leave")}
          </Button>
        </div>
      </Modal>

      {/* Время вышло: ответы закрыты, показываем итог по кнопке. */}
      <Modal open={timeUp && !finishing} onClose={() => {}} label={t("exam.timeup.title")}>
        <div className="flex flex-col items-center gap-3 text-center">
          <TimerOff size={40} className="text-warning-strong" aria-hidden />
          <h2 className="text-xl font-extrabold">{t("exam.timeup.title")}</h2>
          <p className="font-semibold text-muted">{t("exam.timeup.desc")}</p>
          <Button size="lg" block onClick={finish}>
            {t("exam.timeup.show")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
