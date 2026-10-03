import { RUN_TIMEOUT_MS, type PyRunLike } from "./check";
import { parseTrace, type TraceData } from "./trace";

// Запуск Python в браузере: один общий Web Worker с Pyodide (public/ide/python-worker.js).
// Загрузка по требованию (первый запуск), таймаут 5 с → worker.terminate() и ленивое пересоздание.
// Только в браузере (Worker). Чистая логика проверки — в check.ts.

const WORKER_URL = "/ide/python-worker.js";

export type RunStatus = "loading" | "running";

export interface PyRunResult extends PyRunLike {
  error?: { line: number | null; text: string } | null;
  trace?: TraceData;
  /** Время выполнения программы, мс. */
  ms: number;
  /** Вывод был обрезан (слишком длинный). */
  cut?: boolean;
}

export interface RunOptions {
  code: string;
  stdin?: string;
  /** Собрать пошаговую трассировку. */
  trace?: boolean;
  timeoutMs?: number;
  /** Загрузка Pyodide / программа запущена (с этого момента идёт таймаут). */
  onStatus?: (s: RunStatus) => void;
}

interface WorkerMsg {
  type: string;
  id?: number;
  text?: string;
  line?: number | null;
  kind?: string;
  trace?: unknown;
  ms?: number;
  cut?: boolean;
}

let worker: Worker | null = null;
let seq = 0;
let chain: Promise<unknown> = Promise.resolve();

function dropWorker() {
  worker?.terminate();
  worker = null;
}

function getWorker(): Worker {
  // Модульный воркер: Pyodide 314+ не работает в «классических» (importScripts).
  worker ??= new Worker(WORKER_URL, { type: "module" });
  return worker;
}

function execute(opts: RunOptions): Promise<PyRunResult> {
  return new Promise((resolve) => {
    let w: Worker;
    try {
      w = getWorker();
    } catch {
      resolve({ stdout: "", loadFailed: true, ms: 0 });
      return;
    }
    const id = ++seq;
    const timeout = opts.timeoutMs ?? RUN_TIMEOUT_MS;
    let stdout = "";
    let trace: TraceData | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let t0 = 0;
    let settled = false;

    const finish = (r: Omit<PyRunResult, "ms"> & { ms?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve({ ...r, ms: r.ms ?? (t0 ? Math.round(performance.now() - t0) : 0) });
    };
    const fail = (extra: Partial<PyRunResult>) => {
      // Воркер в неизвестном состоянии (таймаут, сбой загрузки) — убиваем, следующий запуск создаст новый.
      if (worker === w) dropWorker();
      else w.terminate();
      finish({ stdout, trace, ...extra });
    };
    const onMessage = (ev: MessageEvent<WorkerMsg>) => {
      const m = ev.data;
      if (!m || (m.id !== undefined && m.id !== id)) return;
      switch (m.type) {
        case "loading":
          opts.onStatus?.("loading");
          break;
        case "start":
          opts.onStatus?.("running");
          t0 = performance.now();
          timer = setTimeout(() => fail({ timedOut: true, ms: timeout }), timeout);
          break;
        case "stdout":
          stdout += m.text ?? "";
          break;
        case "trace":
          trace = parseTrace(m.trace);
          break;
        case "done":
          finish({ stdout, trace, ms: m.ms, cut: m.cut });
          break;
        case "error":
          if (m.kind === "load") fail({ stdout: "", loadFailed: true });
          else finish({ stdout, trace, error: { line: m.line ?? null, text: m.text ?? "Error" }, ms: m.ms });
          break;
      }
    };
    const onError = () => fail({ loadFailed: true, stdout: "" });
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ type: "run", id, code: opts.code, stdin: opts.stdin ?? "", trace: !!opts.trace });
  });
}

/** Запустить программу (запуски идут по очереди, воркер один). */
export function runPython(opts: RunOptions): Promise<PyRunResult> {
  const p = chain.then(() => execute(opts));
  chain = p.catch(() => undefined);
  return p;
}

/** Остановить воркер (например, при выходе со страницы): следующий запуск создаст новый. */
export function stopPython() {
  dropWorker();
}
