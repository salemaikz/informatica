// Типы исполнителя Python (воркер public/py-worker.js ↔ клиент runner.ts). Без React.

/** Переменная на шаге: имя, repr значения (≤ 120 символов), имя типа Python. */
export interface PyVar {
  name: string;
  value: string;
  type: string;
}

/** Шаг пошагового выполнения: строка, которая сейчас выполнится (0 — программа завершена). */
export interface PyStep {
  line: number;
  vars: PyVar[];
  /** Вывод программы на этот момент. */
  stdout: string;
  /** Имя функции, если шаг внутри неё. */
  scope?: string;
}

/**
 * Ошибка выполнения. `type` — имя исключения Python (`NameError`, `SyntaxError`…) или служебное:
 * `Timeout` (дольше 5 с), `TooManySteps` (больше 1000 шагов), `LoadError` (Python не загрузился), `InternalError`.
 */
export interface PyError {
  type: string;
  message: string;
  line: number | null;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  error: PyError | null;
  /** Шаги — только в пошаговом режиме. */
  steps: PyStep[] | null;
  timedOut: boolean;
}

export type LoadState = "idle" | "loading" | "ready" | "error";

/** Ограничения исполнителя (совпадают с воркером). */
export const PY_LIMITS = {
  /** Сколько можно выполняться коду ученика. */
  runMs: 5000,
  /** Первая загрузка Pyodide. */
  loadMs: 30000,
  maxSteps: 1000,
} as const;
