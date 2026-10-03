// Пошаговое выполнение Python (трассировка sys.settrace в воркере): типы и чистые помощники для Tracer.

/** Один шаг: строка, которая СЕЙЧАС будет выполнена, и состояние переменных до неё. */
export interface TraceStep {
  /** Номер строки (1-based). null — программа завершилась (последний шаг, итоговое состояние). */
  line: number | null;
  /** Имя функции (null — основная программа). */
  fn: string | null;
  /** Простые переменные кадра: [имя, значение как в Python]. */
  vars: [string, string][];
  /** Сколько символов вывода уже напечатано к этому моменту. */
  out: number;
}

export interface TraceData {
  steps: TraceStep[];
  /** Программа длиннее лимита шагов — остальное не показано. */
  truncated: boolean;
  /** Весь вывод программы (шаг берёт из него первые `out` символов). */
  out: string;
  /** Ошибка программы, если она случилась (показывается на последнем шаге). */
  error: { line: number | null; text: string } | null;
}

export const TRACE_STEP_LIMIT = 300;

/** Вывод программы к шагу i. */
export function outputAt(trace: TraceData, i: number): string {
  const step = trace.steps[i];
  if (!step) return "";
  return trace.out.slice(0, step.out);
}

/** Имена переменных, изменившихся на шаге i по сравнению с предыдущим (в том же кадре). */
export function changedVars(trace: TraceData, i: number): Set<string> {
  const cur = trace.steps[i];
  const prev = trace.steps[i - 1];
  const res = new Set<string>();
  if (!cur || !prev || prev.fn !== cur.fn) return res;
  const before = new Map(prev.vars);
  for (const [name, value] of cur.vars) if (before.get(name) !== value) res.add(name);
  return res;
}

/** Текст строки кода (1-based) — для подписи «Сейчас выполняется». */
export function codeLine(code: string, line: number | null): string {
  if (line === null || line < 1) return "";
  return (code.split("\n")[line - 1] ?? "").trim();
}

/** Строка для подсветки в редакторе: последний шаг (конец программы) — без подсветки, при ошибке — строка ошибки. */
export function highlightFor(trace: TraceData, i: number): number | undefined {
  const step = trace.steps[i];
  if (!step) return undefined;
  if (step.line !== null) return step.line;
  return i === trace.steps.length - 1 && trace.error?.line ? trace.error.line : undefined;
}

/** Разбор ответа воркера: защита от неожиданной формы. */
export function parseTrace(raw: unknown): TraceData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<TraceData>;
  if (!Array.isArray(r.steps)) return undefined;
  return { steps: r.steps, truncated: !!r.truncated, out: typeof r.out === "string" ? r.out : "", error: r.error ?? null };
}
