import type { TaskContext } from "@/lib/ai-types";
import { IDE_LANGS, type CodeTaskStat, type IdeLang, type IdeTask } from "@/lib/ide/types";
import type { L, Lang, Level } from "@/lib/types";

// Чистые помощники оболочки «Практикума» (без React) — покрыты tests/ide-shell.test.ts.

export type CodeTasks = Record<string, CodeTaskStat>;

export const LEVEL_LETTER: Record<Level, "A" | "B" | "C"> = { 1: "A", 2: "B", 3: "C" };

/** Задачи от лёгкой к сложной; внутри уровня сохраняется порядок авторов. */
export function sortTasks(tasks: readonly IdeTask[]): IdeTask[] {
  return tasks.map((t, i) => ({ t, i })).sort((a, b) => a.t.level - b.t.level || a.i - b.i).map((x) => x.t);
}

/** Задачи, сгруппированные по уровням (пустые уровни пропускаются). */
export function groupByLevel(tasks: readonly IdeTask[]): { level: Level; tasks: IdeTask[] }[] {
  const sorted = sortTasks(tasks);
  const out: { level: Level; tasks: IdeTask[] }[] = [];
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (last && last.level === t.level) last.tasks.push(t);
    else out.push({ level: t.level, tasks: [t] });
  }
  return out;
}

/** Сколько задач решено из всех. */
export function langProgress(tasks: readonly IdeTask[], codeTasks: CodeTasks): { solved: number; total: number } {
  let solved = 0;
  for (const t of tasks) if (codeTasks[t.id]?.solved) solved++;
  return { solved, total: tasks.length };
}

/** Следующая нерешённая задача после текущей (по кругу). null — нерешённых больше нет. */
export function nextUnsolved(tasks: readonly IdeTask[], currentId: string | null, codeTasks: CodeTasks): IdeTask | null {
  const sorted = sortTasks(tasks);
  const at = currentId ? sorted.findIndex((t) => t.id === currentId) : -1;
  for (let k = 1; k <= sorted.length; k++) {
    const t = sorted[(at + k + sorted.length) % sorted.length];
    if (t && t.id !== currentId && !codeTasks[t.id]?.solved) return t;
  }
  return null;
}

/** «Продолжить»: последняя тронутая задача, если не решена; иначе следующая нерешённая; иначе первая нерешённая. */
export function continueTarget(
  byLang: Record<IdeLang, readonly IdeTask[]>,
  codeTasks: CodeTasks,
): { task: IdeTask; started: boolean } | null {
  const all = IDE_LANGS.flatMap((l) => byLang[l] ?? []);
  const known = new Map(all.map((t) => [t.id, t]));
  let last: IdeTask | null = null;
  let lastAt = -Infinity;
  for (const [id, stat] of Object.entries(codeTasks)) {
    const t = known.get(id);
    if (t && stat.at > lastAt) {
      last = t;
      lastAt = stat.at;
    }
  }
  if (last) {
    if (!codeTasks[last.id]?.solved) return { task: last, started: true };
    const next = nextUnsolved(byLang[last.lang] ?? [], last.id, codeTasks);
    if (next) return { task: next, started: true };
  }
  for (const l of IDE_LANGS) {
    const first = nextUnsolved(byLang[l] ?? [], null, codeTasks);
    if (first) return { task: first, started: !!last };
  }
  return null;
}

/** Решение открывается после решения или после двух неудачных проверок (у нерешённой задачи попытки — это неудачи). */
export function canShowSolution(stat: CodeTaskStat | undefined): boolean {
  return !!stat && (stat.solved || stat.attempts >= 2);
}

/** Текст сообщения проверки: строка как есть, двуязычный текст — на языке ученика. */
export function messageText(m: L | string | undefined, lang: Lang): string | undefined {
  if (m === undefined) return undefined;
  return typeof m === "string" ? m : m[lang];
}

export function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`;
}

/**
 * Контекст для ИИ-помощника. Сервер режет `prompt` до 600 знаков, `theory` — до 1500, поэтому условие, код и ошибку
 * кладём в `theory` (общий бюджет ≈ 1400 знаков), а в `prompt` — короткий заголовок.
 */
export function buildAiTask(p: {
  langTitle: string;
  title?: string;
  statement?: string;
  code: string;
  error?: string | null;
  solved?: boolean;
  stepKey?: string;
}): TaskContext {
  const parts: string[] = [`Язык: ${p.langTitle}.`];
  if (p.statement) parts.push(`Условие: ${clip(p.statement.trim(), 450)}`);
  const code = p.code.trim();
  parts.push(code ? `Код ученика:\n${clip(code, 700)}` : "Код ученика пока пустой.");
  if (p.error) parts.push(`Ошибка при запуске:\n${clip(p.error.trim(), 250)}`);
  return {
    prompt: clip(p.title ?? `Свободная практика (${p.langTitle})`, 120),
    theory: parts.join("\n\n"),
    answered: !!p.solved,
    stepKey: p.stepKey,
  };
}

/** Пример кода для песочницы каждого языка (SQL — таблица students учебной базы). */
export const SANDBOX_CODE: Record<IdeLang, string> = {
  python: 'name = input("Name: ")\nprint("Hello,", name)\n\nfor i in range(1, 4):\n    print(i, i * i)\n',
  sql: "SELECT * FROM students;\n",
  web: "<h1>Hello, world!</h1>\n<p>This is <b>my</b> page.</p>\n<style>\n  h1 { color: #1a91d6; }\n</style>\n",
  js: 'const name = "world";\nconsole.log("Hello, " + name);\n\nfor (let i = 1; i <= 3; i++) {\n  console.log(i * i);\n}\n',
  excel: '{"A1":"5","A2":"7","A3":"=A1+A2","B1":"=A1*2"}',
};
