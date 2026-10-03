import type { L } from "@/lib/types";
import type { CheckResult, IdeCheck } from "../types";

// Проверка задач Python: программа запускается на каждом тесте, вывод сравнивается с ожидаемым.
// Сам запуск (Pyodide в воркере) подставляется снаружи — здесь чистая логика, её можно проверить тестами.

/** Таймаут одного запуска, мс (бесконечный цикл → воркер убивается). */
export const RUN_TIMEOUT_MS = 5000;

/** Вывод без различий в хвосте: переводы строк \r\n → \n, пробелы в конце строк и пустые строки в конце не важны. */
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
export interface PyRunLike {
  stdout: string;
  error?: { line: number | null; text: string } | null;
  /** Превышен таймаут (бесконечный цикл). */
  timedOut?: boolean;
  /** Не удалось загрузить Python (нет сети). */
  loadFailed?: boolean;
}

export type PyRun = (code: string, stdin: string) => Promise<PyRunLike>;

export const MSG_TIMEOUT: L = {
  ru: "Программа работает слишком долго — возможно, бесконечный цикл.",
  kk: "Бағдарлама тым ұзақ жұмыс істеп тұр — мүмкін, шексіз цикл.",
};
export const MSG_LOAD: L = {
  ru: "Не удалось загрузить Python. Проверьте интернет и попробуйте ещё раз.",
  kk: "Python жүктелмеді. Интернетті тексеріп, қайта көріңіз.",
};
const MSG_EMPTY: L = { ru: "Сначала напишите программу.", kk: "Алдымен бағдарлама жазыңыз." };

/** Запрещённая конструкция (ограничение из условия задачи): regexp по коду без комментариев и (если inStrings не задан) без строк. */
export interface PyForbid {
  re: string;
  why: L;
  /** Искать и внутри строковых литералов (для f-строк вида f"{n:b}"). */
  inStrings?: boolean;
}

/** Код без комментариев и (если strings = false) без содержимого строк — чтобы запрет не срабатывал на тексте. */
export function scrubCode(code: string, strings: boolean): string {
  let out = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "#") {
      while (i < code.length && code[i] !== "\n") i++;
    } else if (c === '"' || c === "'") {
      const triple = code.startsWith(c.repeat(3), i);
      const q = triple ? c.repeat(3) : c;
      let j = i + q.length;
      while (j < code.length && !code.startsWith(q, j) && (triple || code[j] !== "\n")) j += code[j] === "\\" ? 2 : 1;
      const end = Math.min(code.length, code.startsWith(q, j) ? j + q.length : j);
      out += strings ? code.slice(i, end) : '""' + code.slice(i, end).replace(/[^\n]/g, "");
      i = end;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Первое нарушенное ограничение или null. */
export function findForbidden(code: string, forbid: PyForbid[] | undefined): PyForbid | null {
  if (!forbid?.length) return null;
  const withStrings = scrubCode(code, true);
  const noStrings = scrubCode(code, false);
  return forbid.find((f) => new RegExp(f.re).test(f.inStrings ? withStrings : noStrings)) ?? null;
}

/** Проверка задачи: код запускается на каждом тесте; результат — сколько тестов пройдено и что не так в первом провале. */
export async function checkPython(check: Extract<IdeCheck, { kind: "python" }>, code: string, run: PyRun, forbid?: PyForbid[]): Promise<CheckResult> {
  const total = check.tests.length;
  if (!code.trim()) return { ok: false, passed: 0, total, message: MSG_EMPTY };
  const banned = findForbidden(code, forbid);
  if (banned) return { ok: false, passed: 0, total, message: banned.why };
  let passed = 0;
  let firstFail: Pick<CheckResult, "message" | "sample"> | null = null;
  for (let i = 0; i < total; i++) {
    const test = check.tests[i];
    const stdin = test.stdin ?? "";
    const n = i + 1;
    const res = await run(code, stdin);
    if (res.loadFailed) return { ok: false, passed, total, message: MSG_LOAD };
    if (res.timedOut) return { ok: false, passed, total, message: MSG_TIMEOUT, sample: { input: stdin, expected: test.stdout, got: res.stdout } };
    if (res.error) {
      firstFail ??= {
        message: {
          ru: `Ошибка при запуске (тест ${n} из ${total}): ${res.error.line ? `строка ${res.error.line}, ` : ""}${res.error.text}`,
          kk: `Іске қосу кезінде қате (${n}-тест, барлығы ${total}): ${res.error.line ? `${res.error.line}-жол, ` : ""}${res.error.text}`,
        },
        sample: { input: stdin, expected: test.stdout, got: res.stdout },
      };
    } else if (!sameOutput(res.stdout, test.stdout)) {
      firstFail ??= {
        message: {
          ru: `Вывод не совпал с ожидаемым (тест ${n} из ${total}).`,
          kk: `Шығыс нәтиже күтілгенмен сәйкес келмеді (${n}-тест, барлығы ${total}).`,
        },
        sample: { input: stdin, expected: test.stdout, got: res.stdout },
      };
    } else passed++;
  }
  return firstFail ? { ok: false, passed, total, ...firstFail } : { ok: true, passed, total };
}
