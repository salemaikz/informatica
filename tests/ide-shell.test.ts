import { describe, expect, it } from "vitest";
import {
  buildAiTask,
  canShowSolution,
  clip,
  continueTarget,
  groupByLevel,
  langProgress,
  messageText,
  nextUnsolved,
  SANDBOX_CODE,
  sortTasks,
} from "@/components/ide/shell-helpers";
import { IDE_LANGS, type CodeTaskStat, type IdeLang, type IdeTask } from "@/lib/ide/types";
import { ideDict } from "@/i18n/parts/ide";
import type { Level } from "@/lib/types";

const mk = (id: string, lang: IdeLang, level: Level): IdeTask => ({
  id,
  lang,
  level,
  title: { ru: id, kk: id },
  prompt: { ru: "p", kk: "p" },
  starter: "",
  solution: "",
  check: { kind: "js", stdout: "" },
});

const stat = (solved: boolean, attempts = 1, at = 1): CodeTaskStat => ({ solved, attempts, at });

const empty = (): Record<IdeLang, IdeTask[]> => ({ python: [], sql: [], web: [], js: [], excel: [] });

describe("порядок и группы задач", () => {
  it("sortTasks: от A к C, внутри уровня порядок авторов", () => {
    const tasks = [mk("c1", "js", 3), mk("a1", "js", 1), mk("b1", "js", 2), mk("a2", "js", 1)];
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["a1", "a2", "b1", "c1"]);
    expect(tasks[0].id).toBe("c1"); // исходный массив не меняется
  });

  it("groupByLevel пропускает пустые уровни и пустой список", () => {
    expect(groupByLevel([])).toEqual([]);
    const g = groupByLevel([mk("c1", "js", 3), mk("a1", "js", 1)]);
    expect(g.map((x) => [x.level, x.tasks.map((t) => t.id)])).toEqual([
      [1, ["a1"]],
      [3, ["c1"]],
    ]);
  });
});

describe("прогресс", () => {
  it("langProgress считает решённые", () => {
    const tasks = [mk("a", "js", 1), mk("b", "js", 1), mk("c", "js", 2)];
    expect(langProgress(tasks, { a: stat(true), b: stat(false, 2) })).toEqual({ solved: 1, total: 3 });
    expect(langProgress([], {})).toEqual({ solved: 0, total: 0 });
  });

  it("nextUnsolved идёт по кругу и пропускает решённые", () => {
    const tasks = [mk("a", "js", 1), mk("b", "js", 1), mk("c", "js", 2)];
    expect(nextUnsolved(tasks, "a", {})?.id).toBe("b");
    expect(nextUnsolved(tasks, "c", { b: stat(true) })?.id).toBe("a");
    expect(nextUnsolved(tasks, "a", { b: stat(true), c: stat(true) })).toBeNull();
    expect(nextUnsolved(tasks, null, { a: stat(true) })?.id).toBe("b");
    expect(nextUnsolved([], "a", {})).toBeNull();
  });
});

describe("«Продолжить»", () => {
  const byLang = { ...empty(), python: [mk("py1", "python", 1), mk("py2", "python", 1)], sql: [mk("sq1", "sql", 1)] };

  it("без истории — первая задача, started=false", () => {
    expect(continueTarget(byLang, {})).toEqual({ task: byLang.python[0], started: false });
  });

  it("последняя тронутая нерешённая — её и продолжаем", () => {
    const r = continueTarget(byLang, { py1: stat(true, 1, 10), sq1: stat(false, 1, 20) });
    expect(r?.task.id).toBe("sq1");
    expect(r?.started).toBe(true);
  });

  it("последняя решена — следующая нерешённая того же языка", () => {
    const r = continueTarget(byLang, { py1: stat(true, 1, 30) });
    expect(r?.task.id).toBe("py2");
  });

  it("всё решено — null; пустой реестр — null", () => {
    expect(continueTarget(byLang, { py1: stat(true), py2: stat(true), sq1: stat(true) })).toBeNull();
    expect(continueTarget(empty(), {})).toBeNull();
  });

  it("id из старых сохранений (задачи нет в реестре) игнорируются", () => {
    expect(continueTarget(byLang, { ghost: stat(true, 1, 99) })?.task.id).toBe("py1");
  });
});

describe("решение и сообщения", () => {
  it("решение открывается после решения или двух неудач", () => {
    expect(canShowSolution(undefined)).toBe(false);
    expect(canShowSolution(stat(false, 1))).toBe(false);
    expect(canShowSolution(stat(false, 2))).toBe(true);
    expect(canShowSolution(stat(true, 1))).toBe(true);
  });

  it("messageText: строка как есть, L — по языку", () => {
    expect(messageText(undefined, "ru")).toBeUndefined();
    expect(messageText("SyntaxError", "kk")).toBe("SyntaxError");
    expect(messageText({ ru: "Нет h1", kk: "h1 жоқ" }, "kk")).toBe("h1 жоқ");
  });
});

describe("контекст для ИИ", () => {
  it("clip режет с многоточием", () => {
    expect(clip("abc", 5)).toBe("abc");
    expect(clip("abcdef", 4)).toBe("abc…");
  });

  it("условие, код и ошибка укладываются в лимит theory сервера (1500)", () => {
    const ctx = buildAiTask({ langTitle: "Python", title: "T", statement: "s".repeat(5000), code: "c".repeat(5000), error: "e".repeat(5000) });
    expect(ctx.theory!.length).toBeLessThanOrEqual(1500);
    expect(ctx.prompt.length).toBeLessThanOrEqual(600);
    expect(ctx.theory).toContain("Ошибка при запуске");
  });

  it("без задачи (песочница) и с пустым кодом", () => {
    const ctx = buildAiTask({ langTitle: "SQL", code: "  " });
    expect(ctx.prompt).toContain("SQL");
    expect(ctx.theory).toContain("пока пустой");
    expect(ctx.answered).toBe(false);
  });
});

describe("песочница и словарь", () => {
  it("пример кода есть у каждого языка, Excel — корректный JSON", () => {
    for (const l of IDE_LANGS) expect(SANDBOX_CODE[l].trim().length, l).toBeGreaterThan(0);
    expect(() => JSON.parse(SANDBOX_CODE.excel)).not.toThrow();
  });

  it("словарь: ru и kk заполнены, ключи с префиксом ide., нет казахских окончаний сразу после плейсхолдера", () => {
    for (const [key, v] of Object.entries(ideDict)) {
      expect(key.startsWith("ide."), key).toBe(true);
      expect(v.ru.trim() && v.kk.trim(), key).toBeTruthy();
      expect(/\}[а-яәіңғүұқөһ]/i.test(v.kk), key).toBe(false);
      expect(/[{}]/.test(v.ru.replace(/\{\w+\}/g, "")), key).toBe(false);
    }
  });
});
