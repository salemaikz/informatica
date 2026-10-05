import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { UNITS } from "@/content/course";
import { ENT_POOL } from "@/content/ent";
import { buildContextDrill, contextItems, contextLessonId } from "@/lib/context-drill";
import { entRef } from "@/lib/ent-steps";
import { readsInput } from "@/lib/ide/python/source";
import { ideRunDict } from "@/i18n/parts/ide-run";
import type { EntContext } from "@/lib/types";

const poolContext = ENT_POOL.filter((i): i is EntContext => i.kind === "context");
const pythonItems = poolContext.filter((i) => i.scene?.kind === "code" && i.scene.lang === "python");

describe("contextItems", () => {
  const items = contextItems();

  it("все контекстные задания банка ЕНТ, без повторов", () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBe(poolContext.length);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.every((i) => i.kind === "context")).toBe(true);
  });

  it("в порядке курса: по порядку уроков в UNITS, внутри урока — как в банке", () => {
    const order = new Map<string, number>();
    let n = 0;
    for (const u of UNITS) for (const l of u.lessons) if (!order.has(l.id)) order.set(l.id, n++);
    const at = (id: string) => order.get(contextLessonId(id)) ?? Number.MAX_SAFE_INTEGER;
    for (let i = 1; i < items.length; i++) expect(at(items[i].id), `${items[i - 1].id} → ${items[i].id}`).toBeGreaterThanOrEqual(at(items[i - 1].id));
    // внутри урока порядок банка не нарушен
    const pos = new Map(poolContext.map((it, i) => [it.id, i]));
    for (let i = 1; i < items.length; i++) {
      if (contextLessonId(items[i].id) === contextLessonId(items[i - 1].id)) expect(pos.get(items[i].id)!).toBeGreaterThan(pos.get(items[i - 1].id)!);
    }
  });

  it("Python-урок раньше последующего: py-1-vars до py-8b-context", () => {
    const ids = items.map((i) => i.id);
    const first = ids.findIndex((id) => id.startsWith("py-1-vars:"));
    const last = ids.findIndex((id) => id.startsWith("py-8b-context:"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(last).toBeGreaterThan(first);
  });
});

describe("buildContextDrill", () => {
  it("неизвестный id и не-контекстное задание — пустая сессия", () => {
    expect(buildContextDrill("")).toEqual([]);
    expect(buildContextDrill("no-such:item")).toEqual([]);
    const single = ENT_POOL.find((i) => i.kind === "single")!;
    expect(buildContextDrill(single.id)).toEqual([]);
  });

  it("каждое задание — 5 шагов-вопросов со ссылками ent:<id>:<n>", () => {
    for (const item of poolContext) {
      const steps = buildContextDrill(item.id);
      expect(steps.length, item.id).toBe(5);
      expect(steps.length).toBe(item.questions.length);
      steps.forEach((s, n) => {
        expect(s.id).toBe(entRef(item.id, n));
        expect(s.type).toBe("choice");
        expect(s.ent).toBe(true);
        expect(s.skill).toBe(item.skill);
        expect(s.hint, s.id).toBeTruthy();
      });
    }
  });

  it("у сцены с программой на Python — run: true, у всех пяти шагов", () => {
    expect(pythonItems.length).toBeGreaterThan(0);
    for (const item of pythonItems) {
      for (const s of buildContextDrill(item.id)) {
        expect(s.scene?.kind, s.id).toBe("code");
        expect(s.scene && s.scene.kind === "code" && s.scene.run, s.id).toBe(true);
      }
    }
  });

  it("исходные задания банка не меняются (сцена копируется)", () => {
    const item = pythonItems[0];
    buildContextDrill(item.id);
    expect(item.scene && item.scene.kind === "code" && item.scene.run).toBeUndefined();
    // и повторная сборка не накапливает ничего лишнего
    expect(buildContextDrill(item.id)[0].scene).toEqual(buildContextDrill(item.id)[0].scene);
  });

  it("сцена не на Python (блок-схема) остаётся без запуска", () => {
    const flow = poolContext.find((i) => i.scene && i.scene.kind !== "code");
    if (!flow) return;
    for (const s of buildContextDrill(flow.id)) expect(s.scene && "run" in s.scene).toBeFalsy();
  });

  it("условие и вопрос — в тексте шага, верный вариант внутри диапазона", () => {
    for (const item of poolContext) {
      buildContextDrill(item.id).forEach((s, n) => {
        if (s.type !== "choice") throw new Error("ожидали choice");
        expect(s.options.length).toBe(item.questions[n].options.length);
        expect(s.correct).toBe(item.questions[n].correct);
        const prompt = typeof s.prompt === "string" ? s.prompt : s.prompt.ru;
        expect(prompt).toContain(item.questions[n].prompt.ru);
      });
    }
  });
});

describe("программы контекстных заданий можно запускать", () => {
  const hasPython = spawnSync("python3", ["--version"]).status === 0;

  it.skipIf(!hasPython)("код каждой сцены с run компилируется python3 (кнопка «Запустить» не даст SyntaxError)", () => {
    for (const item of pythonItems) {
      for (const s of buildContextDrill(item.id).slice(0, 1)) {
        if (s.scene?.kind !== "code") continue;
        const code = s.scene.lines.join("\n");
        const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), '<program>', 'exec')"], { input: code, encoding: "utf8" });
        expect(r.status, `${item.id}: ${r.stderr}`).toBe(0);
      }
    }
  });
});

describe("readsInput", () => {
  it("находит input( вне комментария", () => {
    expect(readsInput("a = int(input())")).toBe(true);
    expect(readsInput('name = input("Имя: ")')).toBe(true);
    expect(readsInput("x = 5\nprint(x)")).toBe(false);
    expect(readsInput("# input() здесь только в комментарии\nprint(1)")).toBe(false);
    expect(readsInput("my_input = 3")).toBe(false);
  });
});

describe("строки iderun", () => {
  it("у каждого ключа непустые ru и kk, в kk нет «ЕНТ»", () => {
    for (const [key, v] of Object.entries(ideRunDict)) {
      expect(v.ru.trim(), key).not.toBe("");
      expect(v.kk.trim(), key).not.toBe("");
      expect(v.kk, key).not.toMatch(/ЕНТ/);
    }
  });
});
