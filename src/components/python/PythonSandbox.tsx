"use client";

import { CircleCheck, Footprints, LoaderCircle, NotebookPen, Play, RotateCcw } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { cn } from "@/lib/cn";
import { PY_EXAMPLES, pyExampleCodeKey, pyExampleTitleKey, usesInput, type PyExampleId } from "@/lib/python/examples";
import { getLoadState, preloadPython, runPython, subscribeLoadState } from "@/lib/python/runner";
import type { PyStep, RunResult } from "@/lib/python/types";
import { pythonDict } from "@/i18n/parts/python";
import { useT } from "@/i18n/useT";
import type { Lang } from "@/lib/types";
import { ErrorCard } from "./ErrorCard";
import { PythonEditor, type PythonEditorHandle } from "./PythonEditor";
import { StepView } from "./StepView";

const DRAFT_KEY = "informatica-python-draft";
/** Черновик длиннее — не восстанавливаем (localStorage — недоверенные данные). */
const MAX_DRAFT = 50_000;

function readDraft(): string | null {
  try {
    const v = localStorage.getItem(DRAFT_KEY);
    return typeof v === "string" && v.length <= MAX_DRAFT ? v : null;
  } catch {
    return null;
  }
}
function writeDraft(code: string) {
  try {
    localStorage.setItem(DRAFT_KEY, code);
  } catch {
    // Приватный режим / запрет хранилища — черновик просто не запоминается.
  }
}

const exampleCodeIn = (id: PyExampleId, lang: Lang) => pythonDict[pyExampleCodeKey(id)][lang];

interface Base {
  code: string;
  stdin: string;
  example: PyExampleId | null;
}

interface Stepping {
  code: string;
  steps: PyStep[];
  index: number;
  result: RunResult;
}

/**
 * Python-песочница: редактор, запуск, пошаговое выполнение, ввод для input(), примеры, «В конспект».
 * Рендерится только в браузере (ssr: false), поэтому начальное состояние читает localStorage напрямую.
 */
export function PythonSandbox({ initialCode }: { initialCode: string | null }) {
  const { t, lang } = useT();
  const exampleCode = (id: PyExampleId) => t(pyExampleCodeKey(id));

  // Черновик читаем один раз: по нему же узнаём, какой пример был открыт (иначе после перезагрузки «нажат» не тот пример).
  const [draft] = useState(() => (initialCode != null ? null : readDraft()));
  const [base, setBase] = useState<Base>(() => {
    if (initialCode != null) return { code: initialCode, stdin: "", example: null };
    const fromDraft = draft != null ? PY_EXAMPLES.find((e) => (["ru", "kk"] as const).some((l) => draft === exampleCodeIn(e.id, l))) : undefined;
    const ex = fromDraft ?? (draft == null ? PY_EXAMPLES[0] : undefined);
    return ex ? { code: exampleCode(ex.id), stdin: ex.stdin, example: ex.id } : { code: exampleCode("vars"), stdin: "", example: null };
  });
  const [code, setCode] = useState(() => (initialCode != null ? initialCode : (draft ?? base.code)));
  const [stdin, setStdin] = useState(base.stdin);
  const [result, setResult] = useState<{ code: string; res: RunResult } | null>(null);
  const [busy, setBusy] = useState<"run" | "step" | null>(null);
  const [stepping, setStepping] = useState<Stepping | null>(null);
  const editor = useRef<PythonEditorHandle>(null);
  const loadState = useSyncExternalStore(subscribeLoadState, getLoadState, () => "idle" as const);

  const needInput = usesInput(code);
  const preload = () => {
    void preloadPython().catch(() => {});
  };

  const changeCode = (v: string) => {
    setCode(v);
    writeDraft(v);
  };

  const pickExample = (id: PyExampleId) => {
    const ex = PY_EXAMPLES.find((e) => e.id === id)!;
    const next = { code: exampleCode(id), stdin: ex.stdin, example: id };
    setBase(next);
    changeCode(next.code);
    setStdin(next.stdin);
    setResult(null);
    preload();
  };

  const reset = () => {
    // Пример — на текущем языке интерфейса (комментарии в коде примеров переведены).
    changeCode(base.example ? exampleCode(base.example) : base.code);
    setStdin(base.stdin);
    setResult(null);
  };

  const run = async (trace: boolean) => {
    if (busy) return;
    setBusy(trace ? "step" : "run");
    setResult(null);
    const snapshot = code;
    const res = await runPython(snapshot, { stdin: needInput ? stdin : "", trace });
    setBusy(null);
    // Шаги показываем, если программа хоть что-то выполнила; иначе (синтаксис, загрузка) — обычная ошибка.
    if (trace && res.steps && res.steps.length > 1) {
      setStepping({ code: snapshot, steps: res.steps, index: 0, result: res });
    } else {
      setResult({ code: snapshot, res });
    }
  };

  const saveToNotes = () => {
    let text = fenced(code.replace(/\s+$/, ""), "python");
    const out = result?.code === code ? result.res.stdout.replace(/\s+$/, "") : "";
    if (out) text += `\n\n${t("python.output")}:\n\n${fenced(out, "")}`;
    useSaveToNotes.getState().open({ source: "scratch", title: t("python.notes.title"), text });
  };

  const errorLine = result && result.code === code ? (result.res.error?.line ?? null) : null;
  const res = result?.res;

  if (stepping) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <StepView
          code={stepping.code}
          steps={stepping.steps}
          index={stepping.index}
          onIndex={(index) => setStepping((s) => (s ? { ...s, index } : s))}
          error={stepping.result.error}
          stderr={stepping.result.stderr}
          onExit={() => setStepping(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Header />

      <div>
        <h2 className="mb-2 text-[13px] font-extrabold text-muted">{t("python.examples")}</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {PY_EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => pickExample(ex.id)}
              aria-pressed={base.example === ex.id}
              className={cn(
                "h-11 shrink-0 rounded-full border-2 px-4 text-sm font-extrabold transition-colors",
                base.example === ex.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              {t(pyExampleTitleKey(ex.id))}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="py-code" className="text-[13px] font-extrabold text-muted">
          {t("python.editor.label")}
        </label>
        <PythonEditor ref={editor} id="py-code" value={code} onChange={changeCode} errorLine={errorLine} onRun={() => void run(false)} onFocus={preload} />
      </div>

      {needInput && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="py-stdin" className="text-[13px] font-extrabold text-muted">
            {t("python.stdin.label")}
          </label>
          <textarea
            id="py-stdin"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={3}
            placeholder={t("python.stdin.placeholder")}
            aria-describedby="py-stdin-hint"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="resize-y rounded-2xl border-2 border-border bg-surface px-3 py-2 font-mono text-[16px] leading-6 outline-none [font-variant-ligatures:none] focus:border-primary"
          />
          <p id="py-stdin-hint" className="text-sm font-semibold text-muted">
            {t("python.stdin.hint")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            size="lg"
            variant="primary"
            className="flex-1 px-3"
            disabled={busy !== null}
            onClick={() => void run(false)}
            icon={busy === "run" ? <LoaderCircle size={20} className="animate-spin" aria-hidden /> : <Play size={20} aria-hidden />}
          >
            {busy === "run" ? t("python.running") : t("python.run")}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="flex-1 px-3"
            disabled={busy !== null}
            onClick={() => void run(true)}
            icon={busy === "step" ? <LoaderCircle size={20} className="animate-spin" aria-hidden /> : <Footprints size={20} aria-hidden />}
          >
            {t("python.step")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="h-11" onClick={reset} title={t("python.reset.hint")} icon={<RotateCcw size={16} aria-hidden />}>
            {t("python.reset")}
          </Button>
          <Button size="sm" variant="ghost" className="h-11" onClick={saveToNotes} icon={<NotebookPen size={16} aria-hidden />}>
            {t("python.toNotes")}
          </Button>
        </div>
      </div>

      {loadState === "loading" && (
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-muted">
          <LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden />
          {t("python.load.loading")}
        </p>
      )}

      <section aria-label={t("python.output")} aria-live="polite" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-extrabold text-muted">{t("python.output")}</h2>
          {res && !res.error && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-success">
              <CircleCheck size={16} aria-hidden />
              {t("python.output.ok")}
            </span>
          )}
        </div>
        {!res ? (
          <p className="rounded-2xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-muted">
            {busy ? t("python.running") : t("python.output.idle")}
          </p>
        ) : (
          <>
            {(res.stdout || !res.error) && (
              <pre className="min-h-12 overflow-x-auto rounded-2xl border-2 border-border bg-surface px-3 py-2.5 font-mono text-[15px] leading-6 [font-variant-ligatures:none]">
                {res.stdout || <span className="font-sans text-muted">{t("python.output.empty")}</span>}
              </pre>
            )}
            {res.error && (
              <ErrorCard
                key={lang}
                error={res.error}
                stderr={res.stderr}
                onShowLine={(line) => editor.current?.revealLine(line)}
                onRetryLoad={() => void run(false)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Блок кода Markdown; ограда длиннее любой серии ` внутри — код с ``` не ломает конспект. */
function fenced(text: string, lang: string): string {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${lang}\n${text}\n${fence}`;
}

function Header() {
  const { t } = useT();
  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t("python.title")}</h1>
      <p className="font-semibold text-muted">{t("python.subtitle")}</p>
    </div>
  );
}
