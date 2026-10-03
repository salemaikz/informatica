import type { L, Level, SkillId } from "@/lib/types";

// Практикум кода (IDE для ЕНТ): общие типы для всех языков (решение #35).
// Каждый язык — своя папка: чистая логика и задачи в src/lib/ide/<lang>/, интерфейс — src/components/ide/<lang>/.
// Правильность ответа всегда определяет код (проверка), а не ИИ.

export type IdeLang = "python" | "sql" | "web" | "js" | "excel";

export const IDE_LANGS: IdeLang[] = ["python", "sql", "web", "js", "excel"];

/** Подсветка синтаксиса в редакторе. Excel редактора кода не имеет. */
export type EditorLanguage = "python" | "sql" | "html" | "javascript";

/** Одна проверка задачи: что запускается и что ожидается (форма зависит от языка). */
export type IdeCheck =
  /** Python: программа запускается с stdin, сравнивается вывод (без хвостовых пробелов и пустых строк в конце). */
  | { kind: "python"; tests: { stdin?: string; stdout: string }[] }
  /**
   * SQL: запрос выполняется на учебной базе (src/lib/ide/sql/db.ts); сравнивается результат с эталонным запросом.
   * ordered — важен ли порядок строк (если в задаче есть ORDER BY). mutation — задача на изменение данных:
   * сравнивается результат checkQuery после запроса ученика и после эталона.
   */
  | { kind: "sql"; reference: string; ordered?: boolean; checkQuery?: string }
  /** HTML/CSS: проверки структуры страницы и правил стиля (src/lib/ide/web/checks.ts). */
  | { kind: "web"; rules: WebRule[] }
  /** JavaScript: сравнивается вывод console.log. */
  | { kind: "js"; stdout: string }
  /** Excel: значения ячеек после пересчёта и (по желанию) что в ячейке именно формула. */
  | { kind: "excel"; cells: Record<string, string | number>; formulas?: string[] };

/** Правило проверки HTML/CSS. */
export type WebRule =
  /** Есть элементы по селектору (count — ровно столько, min — не меньше). */
  | { type: "exists"; selector: string; count?: number; min?: number; why: L }
  /** Текст элемента (без учёта регистра и крайних пробелов). */
  | { type: "text"; selector: string; equals: string; why: L }
  /** Атрибут элемента. */
  | { type: "attr"; selector: string; name: string; equals?: string; why: L }
  /** В CSS есть правило для селектора со свойством (и значением, без учёта регистра и пробелов). */
  | { type: "css"; selector: string; property: string; equals?: string; why: L };

export interface IdeTask {
  /** Уникальный id: «py-1-hello», «sql-3-order», «web-2-list», «js-1-log», «xl-4-abs». */
  id: string;
  lang: IdeLang;
  /** Сложность A/B/C — задачи в списке идут от лёгкой к сложной. */
  level: Level;
  /** Навык курса (освоение растёт при решении). */
  skill?: SkillId;
  title: L;
  /** Условие (markdown, коротко, как в ЕНТ). */
  prompt: L;
  /** Начальный код (Excel — JSON ячеек: {"A1":"5","B1":"=A1*2"}). */
  starter: string;
  /** Подсказка без ответа. */
  hint?: L;
  /** Эталонное решение — показывается после решения или по кнопке «Показать решение». */
  solution: string;
  check: IdeCheck;
}

/** Итог проверки задачи. */
export interface CheckResult {
  ok: boolean;
  /** Пройдено проверок из total (у Python — тестов, у веба — правил). */
  passed: number;
  total: number;
  /** Что не так (для первой непройденной проверки), на двух языках или текст ошибки как есть. */
  message?: L | string;
  /** Пример: вход, ожидаемый и полученный вывод (для подробного показа). */
  sample?: { input?: string; expected?: string; got?: string };
}

/** Итог запуска (без проверки): вывод и ошибка. */
export interface RunOutput {
  stdout: string;
  error?: string;
  /** Время выполнения, мс. */
  ms?: number;
}

/** Рабочая область языка: редактор, запуск, вывод, проверка. Оболочка (components/ide/IdeShell) хранит код и показывает итог. */
export interface WorkspaceProps {
  /** Задача или null — свободный режим («песочница»). */
  task: IdeTask | null;
  /** Текущий код (черновик хранит оболочка). */
  code: string;
  onCodeChange: (code: string) => void;
  /** Результат проверки задачи — оболочка покажет итог и начислит XP. */
  onCheck: (r: CheckResult) => void;
  /** Ошибка последнего запуска (null — без ошибки) — для кнопки «Объясни ошибку» с ИИ в оболочке. */
  onRunError?: (message: string | null) => void;
}

/** Освоение задач практикума в сторе. */
export interface CodeTaskStat {
  solved: boolean;
  attempts: number;
  /** Когда решена впервые (или последняя попытка). */
  at: number;
}

/** XP за первое решение задачи: A — 10, B — 15, C — 20. */
export const CODE_XP: Record<Level, number> = { 1: 10, 2: 15, 3: 20 };
