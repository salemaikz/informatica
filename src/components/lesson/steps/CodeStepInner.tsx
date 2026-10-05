"use client";

import { Code2, Eye, Lightbulb, Loader2, Square, SquareCheckBig, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Markdown } from "@/components/Markdown";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { ResultBanner } from "@/components/ide/ResultBanner";
import { LEVEL_LETTER } from "@/components/ide/shell-helpers";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { checkPython } from "@/lib/ide/python/check";
import { runPython, stopPython } from "@/lib/ide/python/runner";
import { PY_FORBID, TASKS } from "@/lib/ide/python/tasks";
import type { CheckResult } from "@/lib/ide/types";
import type { CodeStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import type { StepProps } from "./types";

type Phase = "idle" | "loading" | "running";

/**
 * Задача практикума на Python внутри урока (этап 14, решение #85): условие, редактор, «Проверить код».
 * Код проверяется тестами в браузере (Pyodide в Web Worker). Итог шага — onAnswer({type:"code", ok, tries, code}, {submit:true}):
 * с первой проверки — верно, позже — частично, «Показать решение» — неверно. XP и `codeTasks` практикума здесь не трогаем.
 */
export default function CodeStepInner({ step, answer, onAnswer, locked }: StepProps<CodeStep>) {
  const { t, l } = useT();
  const task = TASKS.find((x) => x.id === step.task) ?? null;
  const pyCheck = task?.check.kind === "python" ? task.check : null;

  const [code, setCode] = useState(task?.starter ?? "");
  const [tries, setTries] = useState(0);
  const [fail, setFail] = useState<CheckResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stopped, setStopped] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [sure, setSure] = useState(false);
  const busy = phase !== "idle";

  const mounted = useRef(true);
  const running = useRef(false);
  // Свежий onAnswer плеера: проверка идёт секунды, а замыкание плеера зависит от его состояния.
  const onAnswerRef = useRef(onAnswer);
  useEffect(() => {
    onAnswerRef.current = onAnswer;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Ушли с шага («Пропустить», выход) во время проверки — программа не должна крутиться в воркере.
      if (running.current) stopPython();
    };
  }, []);

  // Нижняя панель плеера перекрывает низ экрана — статус запуска и итог проверки подкручиваем в видимую область.
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fail) bannerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fail]);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "idle" || stopped || loadFailed) statusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase, stopped, loadFailed]);

  const solutionRef = useRef<HTMLDivElement>(null);
  const missed = locked && answer?.type === "code" && !answer.ok;
  useEffect(() => {
    if (!missed) return;
    const id = window.setTimeout(() => solutionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350);
    return () => window.clearTimeout(id);
  }, [missed]);

  async function check() {
    if (!task || !pyCheck || busy || locked) return;
    running.current = true;
    setPhase("running");
    setStopped(false);
    setLoadFailed(false);
    setSure(false);
    const flags = { stopped: false, loadFailed: false };
    const res = await checkPython(
      pyCheck,
      code,
      async (c, s) => {
        const r = await runPython({
          code: c,
          stdin: s,
          quiet: true,
          onStatus: (st) => {
            if (mounted.current) setPhase(st);
          },
        });
        if (r.stopped) flags.stopped = true;
        if (r.loadFailed) flags.loadFailed = true;
        return r;
      },
      PY_FORBID[task.id],
    );
    running.current = false;
    if (!mounted.current) return;
    setPhase("idle");
    // «Стоп», сбой загрузки Python и пустой код — не попытка: счётчик проверок не растёт.
    if (flags.stopped) {
      setStopped(true);
      return;
    }
    if (flags.loadFailed) {
      setLoadFailed(true);
      return;
    }
    if (!code.trim()) {
      setFail(res);
      return;
    }
    const n = tries + 1;
    setTries(n);
    if (res.ok) {
      setFail(null);
      onAnswerRef.current({ type: "code", ok: true, tries: n, code }, { submit: true });
    } else setFail(res);
  }

  /** «Показать решение»: шаг засчитывается как нерешённый — просим подтвердить (случайное нажатие стоило бы ошибки). */
  function giveUp() {
    if (!sure) {
      setSure(true);
      return;
    }
    onAnswerRef.current({ type: "code", ok: false, tries, code }, { submit: true });
  }

  // Плеер урока по Enter «проверяет» задание — кнопкам Enter оставляем для них самих.
  const keepEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") e.stopPropagation();
  };

  if (!task || !pyCheck) {
    return (
      <p data-step-kind="code" data-task={step.task} className="rounded-xl bg-warning-soft px-3 py-3 text-sm font-bold text-warning-strong">
        {t("iderun.code.missing", { skip: t("common.skip") })}
      </p>
    );
  }

  return (
    <div data-step-kind="code" data-task={step.task} className="flex flex-col gap-4" onKeyDown={locked ? undefined : keepEnter}>
      <section className="flex flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="primary" icon={<Code2 size={14} aria-hidden />}>
            {t("iderun.code.badge")}
          </Pill>
          <Pill tone="muted">{t("ide.level", { l: LEVEL_LETTER[task.level] })}</Pill>
        </div>
        <h2 className="text-lg font-extrabold leading-tight">{l(task.title)}</h2>
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("iderun.code.task")}</p>
        <Markdown>{l(task.prompt)}</Markdown>
      </section>

      <CodeEditor value={code} onChange={setCode} language="python" ariaLabel={t("idepy.editor.aria")} minHeight={200} readOnly={locked || busy} />

      {!locked && (
        <div className="flex flex-col gap-3">
          {busy ? (
            <Button variant="secondary" size="lg" block onClick={stopPython} icon={<Square size={18} fill="currentColor" aria-hidden />}>
              {t("iderun.stop")}
            </Button>
          ) : (
            <Button variant="success" size="lg" block onClick={check} icon={<SquareCheckBig size={20} aria-hidden />}>
              {t("iderun.code.check")}
            </Button>
          )}

          <div className="flex flex-wrap gap-2">
            {task.hint && (
              <Button variant="secondary" icon={<Lightbulb size={16} aria-hidden />} onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen}>
                {t(hintOpen ? "ide.task.hintHide" : "ide.task.hint")}
              </Button>
            )}
            {tries > 0 && !busy && (
              <Button variant={sure ? "secondary" : "ghost"} icon={<Eye size={16} aria-hidden />} onClick={giveUp} onBlur={() => setSure(false)}>
                {t(sure ? "iderun.code.solutionYes" : "ide.task.solution")}
              </Button>
            )}
          </div>
          {sure && <p className="text-sm font-bold text-muted">{t("iderun.code.solutionSure")}</p>}
          {tries === 0 && !busy && <p className="text-xs font-semibold text-muted">{t("iderun.code.rule")}</p>}

          {hintOpen && task.hint && (
            <div className="rounded-2xl border-2 border-primary/25 bg-primary-soft px-4 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-primary">
                <Lightbulb size={14} aria-hidden /> {t("ide.task.hint")}
              </p>
              <Markdown>{l(task.hint)}</Markdown>
            </div>
          )}
        </div>
      )}

      {/* Состояние запуска: загрузка Python, выполнение, «Стоп», нет сети. */}
      <div ref={statusRef} aria-live="polite" className="flex scroll-mb-28 flex-col gap-3 empty:hidden">
        {phase === "loading" && (
          <div className="flex items-start gap-3 rounded-xl bg-primary-soft px-3 py-3">
            <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin text-primary" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-primary">{t("idepy.loading")}</p>
              <p className="mt-0.5 text-xs text-muted">{t("idepy.loading.hint")}</p>
            </div>
          </div>
        )}
        {phase === "running" && (
          <p className="flex items-center gap-2 px-1 text-sm font-bold text-muted">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden />
            {t("idepy.running")}
          </p>
        )}
        {!busy && stopped && (
          <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm">
            <Square size={16} fill="currentColor" className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <p className="font-extrabold">{t("iderun.stopped")}</p>
          </div>
        )}
        {!busy && loadFailed && (
          <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-3 text-sm font-bold text-warning-strong">
            <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>{t("iderun.code.loadFail", { skip: t("common.skip") })}</p>
          </div>
        )}
      </div>

      {/* Не прошло: что не так и пример «вход / ожидалось / получено»; код можно править и проверять снова. */}
      {!busy && !locked && fail && !stopped && !loadFailed && <ResultBanner ref={bannerRef} state={{ result: fail, xp: 0, first: false }} next={null} listHref="/code/python" />}

      {/* Решение не найдено: эталон только для чтения. */}
      {missed && (
        <div ref={solutionRef} className="scroll-mb-64">
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">{t("ide.task.solutionTitle")}</p>
          <CodeEditor value={task.solution} onChange={() => {}} language="python" ariaLabel={t("ide.task.solutionAria")} readOnly minHeight={80} />
        </div>
      )}
    </div>
  );
}
