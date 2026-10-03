import { RUN_TIMEOUT_MS, type JsRunLike } from "./check";

// Запуск JavaScript в браузере: на каждый запуск — новый Web Worker (public/ide/js-worker.js).
// Таймаут 3 с → worker.terminate(). Только в браузере (Worker). Чистая логика проверки — в check.ts.

const WORKER_URL = "/ide/js-worker.js";

export interface JsLine {
  level: "log" | "warn" | "error";
  text: string;
}

export interface JsRunResult extends JsRunLike {
  /** Построчный вывод (уровень нужен для цвета: warn / error). */
  lines: JsLine[];
  /** Время выполнения, мс. */
  ms: number;
  /** Вывод был обрезан (слишком длинный). */
  cut?: boolean;
}

interface WorkerMsg {
  type: string;
  id?: number;
  level?: string;
  text?: string;
  line?: number | null;
  ms?: number;
  cut?: boolean;
}

let seq = 0;
let active: Worker | null = null;

/** Остановить текущий запуск (например, при выходе со страницы). */
export function stopJs() {
  active?.terminate();
  active = null;
}

/** Запустить программу. Не бросает исключений: ошибки и таймаут — в результате. */
export function runJs(code: string, timeoutMs: number = RUN_TIMEOUT_MS): Promise<JsRunResult> {
  return new Promise((resolve) => {
    stopJs();
    let w: Worker;
    try {
      w = new Worker(WORKER_URL);
    } catch {
      resolve({ stdout: "", lines: [], loadFailed: true, ms: 0 });
      return;
    }
    active = w;
    const id = ++seq;
    const lines: JsLine[] = [];
    let error: JsRunResult["error"] = null;
    const t0 = performance.now();
    let settled = false;

    const finish = (extra: Partial<JsRunResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.terminate();
      if (active === w) active = null;
      resolve({ stdout: lines.map((l) => l.text).join("\n"), lines, error, ms: Math.round(performance.now() - t0), ...extra });
    };
    const timer = setTimeout(() => finish({ timedOut: true, ms: timeoutMs }), timeoutMs);

    let ready = false;
    w.onmessage = (ev: MessageEvent<WorkerMsg>) => {
      const m = ev.data;
      if (!m) return;
      if (m.type === "ready") ready = true;
      if (m.id !== id) return;
      if (m.type === "log") {
        const level = m.level === "warn" || m.level === "error" ? m.level : "log";
        lines.push({ level, text: m.text ?? "" });
      } else if (m.type === "error") error = { line: m.line ?? null, text: m.text ?? "Error" };
      else if (m.type === "done") finish({ ms: m.ms, cut: m.cut });
    };
    // Воркер не загрузился или упал до перехвата ошибок.
    w.onerror = (ev) => {
      ev.preventDefault();
      if (!ready) finish({ loadFailed: true });
      else finish({ error: error ?? { line: null, text: ev.message || "Error" } });
    };
    w.postMessage({ type: "run", id, code });
  });
}
