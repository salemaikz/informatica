import type { L } from "@/lib/types";
import type { CheckResult, IdeCheck } from "../types";

// Проверка задач JavaScript: программа запускается в воркере, сравнивается вывод console.log.
// Сам запуск подставляется снаружи (runner.ts в браузере, node:vm в тестах) — здесь чистая логика.

/** Таймаут запуска, мс (бесконечный цикл → воркер убивается). */
export const RUN_TIMEOUT_MS = 3000;

/** Вывод без различий в хвосте: \r\n → \n, пробелы в конце строк и пустые строки в конце не важны. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export const sameOutput = (a: string, b: string) => normalizeOutput(a) === normalizeOutput(b);

/** Что вернул запуск программы. */
export interface JsRunLike {
  stdout: string;
  error?: { line: number | null; text: string } | null;
  /** Превышен таймаут (бесконечный цикл). */
  timedOut?: boolean;
  /** Не удалось запустить воркер. */
  loadFailed?: boolean;
}

export type JsRun = (code: string) => Promise<JsRunLike>;

export const MSG_TIMEOUT: L = {
  ru: "Программа работает слишком долго — возможно, бесконечный цикл.",
  kk: "Программа тым ұзақ жұмыс істеп тұр — мүмкін, шексіз цикл.",
};
export const MSG_LOAD: L = {
  ru: "Не удалось запустить JavaScript. Обновите страницу и попробуйте ещё раз.",
  kk: "JavaScript іске қосылмады. Бетті жаңартып, қайта көріңіз.",
};
export const MSG_EMPTY: L = { ru: "Сначала напишите программу.", kk: "Алдымен программа жазыңыз." };
export const MSG_WRONG: L = { ru: "Вывод не совпал с ожидаемым.", kk: "Шығыс күтілген нәтижемен сәйкес келмеді." };

/** Проверка задачи: запуск и сравнение вывода (хвостовые пробелы и пустые строки не важны). */
export async function checkJs(check: Extract<IdeCheck, { kind: "js" }>, code: string, run: JsRun): Promise<CheckResult> {
  if (!code.trim()) return { ok: false, passed: 0, total: 1, message: MSG_EMPTY };
  const res = await run(code);
  const sample = { expected: check.stdout, got: res.stdout };
  if (res.loadFailed) return { ok: false, passed: 0, total: 1, message: MSG_LOAD };
  if (res.timedOut) return { ok: false, passed: 0, total: 1, message: MSG_TIMEOUT, sample };
  if (res.error) {
    return {
      ok: false,
      passed: 0,
      total: 1,
      message: {
        ru: `Ошибка при запуске: ${res.error.line ? `строка ${res.error.line}, ` : ""}${res.error.text}`,
        kk: `Іске қосу кезінде қате: ${res.error.line ? `${res.error.line}-жол, ` : ""}${res.error.text}`,
      },
      sample,
    };
  }
  if (!sameOutput(res.stdout, check.stdout)) return { ok: false, passed: 0, total: 1, message: MSG_WRONG, sample };
  return { ok: true, passed: 1, total: 1 };
}
