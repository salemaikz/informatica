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

/** Проверка задачи: код запускается на каждом тесте; результат — сколько тестов пройдено и что не так в первом провале. */
export async function checkPython(check: Extract<IdeCheck, { kind: "python" }>, code: string, run: PyRun): Promise<CheckResult> {
  const total = check.tests.length;
  if (!code.trim()) return { ok: false, passed: 0, total, message: MSG_EMPTY };
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
