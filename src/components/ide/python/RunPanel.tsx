"use client";

import { Play, Square } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/useT";
import { runPython, stopPython, type PyRunResult } from "@/lib/ide/python/runner";
import { readsInput } from "@/lib/ide/python/source";
import { OutputPanel, type RunPhase } from "./OutputPanel";

/**
 * Запуск программы из сцены кода (scene.run, этап 14): кнопка «Запустить» / «Стоп», поле «Ввод» (если программа читает
 * input()), окно вывода. Python — в браузере (Pyodide в Web Worker), на сервер ничего не уходит.
 */
export function RunPanel({ code }: { code: string }) {
  const { t } = useT();
  const inputId = useId();
  const needsInput = readsInput(code);
  const [stdin, setStdin] = useState("");
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [result, setResult] = useState<PyRunResult | null>(null);

  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Ушли со страницы во время запуска — не оставляем программу крутиться в воркере.
      if (running.current) stopPython();
    };
  }, []);

  const busy = phase !== "idle";
  const errorLine = (e: { line: number | null; text: string }) => (e.line ? `${t("idepy.err.line", { n: e.line })}: ${e.text}` : e.text);

  async function run() {
    if (busy) return;
    running.current = true;
    setPhase("running");
    const r = await runPython({
      code,
      stdin,
      onStatus: (s) => {
        if (mounted.current) setPhase(s);
      },
    });
    running.current = false;
    if (!mounted.current) return;
    setPhase("idle");
    setResult(r);
  }

  // Плеер урока по Enter «проверяет» задание — кнопкам и полю запуска Enter оставляем для них самих.
  const keepEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") e.stopPropagation();
  };

  return (
    <section aria-label={t("iderun.run.title")} onKeyDown={keepEnter} className="flex flex-col gap-2.5">
      {needsInput && (
        <div>
          <label htmlFor={inputId} className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-muted">
            {t("iderun.run.input")}
          </label>
          <textarea
            id={inputId}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="min-h-20 w-full resize-y rounded-2xl border-2 border-border bg-surface px-3 py-2 font-mono text-[15px] outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted">{t("iderun.run.input.hint")}</p>
        </div>
      )}

      {busy ? (
        <Button variant="secondary" block onClick={stopPython} icon={<Square size={18} fill="currentColor" aria-hidden />}>
          {t("iderun.stop")}
        </Button>
      ) : (
        <Button variant="primary" block onClick={run} icon={<Play size={20} aria-hidden />}>
          {t("idepy.run")}
        </Button>
      )}

      {(busy || result) && <OutputPanel phase={phase} result={result} errorLine={errorLine} idleText={false} eofText={t("iderun.run.eof")} />}
    </section>
  );
}
