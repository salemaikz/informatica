import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { ENT_POOL } from "@/content/ent";
import { buildCheck } from "@/lib/drill";
import { entBossIndex, withEntBoss } from "@/lib/ent-boss";
import { entRef } from "@/lib/ent-steps";
import { evaluate } from "@/lib/evaluate";
import type { EntItem, EntMatch, EntMulti, EntSingle, EntMatchStep, Lesson, MultiStep, Step } from "@/lib/types";
import { validateStep } from "./validate";

const L = (s: string) => ({ ru: `${s} ru`, kk: `${s} kk` });

const match = (id: string, skill: EntMatch["skill"] = "ns.base"): EntMatch => ({
  id,
  kind: "match",
  topic: "t04",
  skill,
  level: 2,
  prompt: L("Соответствие"),
  items: [L("Пункт один"), L("Пункт два")],
  choices: [L("d0"), L("d1"), L("d2"), L("d3")],
  answer: [2, 0],
  explanation: L("разбор"),
  hint: L("подсказка"),
});
const multi = (id: string, skill: EntMulti["skill"] = "ns.base"): EntMulti => ({
  id,
  kind: "multi",
  topic: "t04",
  skill,
  level: 3,
  prompt: L("Несколько верных"),
  options: ["a", "b", "c", "d", "e", "f"],
  correct: [1, 4],
  explanation: L("разбор"),
});
const single = (id: string): EntSingle => ({
  id,
  kind: "single",
  topic: "t04",
  skill: "ns.base",
  level: 1,
  prompt: L("Один верный"),
  options: [L("a"), L("b"), L("c"), L("d")],
  correct: 0,
  explanation: L("разбор"),
});

const theory = (id: string): Step => ({ id, type: "theory", title: L(id), body: L(id) });
const choice = (id: string, ent = false): Step => ({
  id,
  type: "choice",
  skill: "ns.base",
  level: 1,
  ent: ent || undefined,
  prompt: L(id),
  options: [L("a"), L("b")],
  correct: 0,
  explanation: L(id),
});

const lessonOf = (id: string, steps: Step[], extra: Partial<Lesson> = {}): Lesson => ({
  id,
  unitId: "u1",
  title: L(id),
  description: L(id),
  skills: ["ns.base"],
  durationMin: 8,
  steps,
  conspect: L(id),
  ...extra,
});

/** Урок: теория, задания, два задания ЕНТ, финальная теория. */
const baseSteps = (): Step[] => [theory("t1"), choice("q1"), choice("q2"), choice("e1", true), choice("e2", true), theory("final")];

const POOL: EntItem[] = [match("demo:m1"), match("demo:m2"), match("other:m1"), multi("demo:x1"), multi("other:x1"), single("demo:s1")];

const ids = (l: Lesson) => l.steps.map((s) => s.id);

describe("withEntBoss: вставка и место", () => {
  it("«соответствие» и «несколько верных» встают сразу после последнего задания ЕНТ, в этом порядке", () => {
    const out = withEntBoss(lessonOf("demo", baseSteps()), POOL);
    const types = out.steps.map((s) => s.type);
    expect(types).toEqual(["theory", "choice", "choice", "choice", "choice", "entmatch", "multi", "theory"]);
    const entmatch = out.steps[5] as EntMatchStep;
    const m = out.steps[6] as MultiStep;
    expect(entmatch).toMatchObject({ ent: true, skill: "ns.base", level: 2 });
    expect(m).toMatchObject({ ent: true });
    expect(m.options).toHaveLength(6);
    // Варианты перемешаны (постоянно для урока), но верные описания и варианты — те же, что в банке.
    const srcMatch = POOL.find((i) => `ent:${i.id}` === entmatch.id) as EntMatch;
    expect(entmatch.answer.map((a) => entmatch.choices[a])).toEqual(srcMatch.answer.map((a) => srcMatch.choices[a]));
    const srcMulti = POOL.find((i) => `ent:${i.id}` === m.id) as EntMulti;
    expect(m.correct.map((c) => m.options[c]).sort()).toEqual(srcMulti.correct.map((c) => srcMulti.options[c]).sort());
    expect(withEntBoss(lessonOf("demo", baseSteps()), POOL).steps[5]).toEqual(entmatch);
    expect(entmatch.id).toMatch(/^ent:demo:m[12]$/);
    expect(m.id).toBe("ent:demo:x1");
  });

  it("без заданий ЕНТ — перед хвостом из шагов без ответа (финальная теория)", () => {
    const steps = [theory("t1"), choice("q1"), choice("q2"), theory("t2"), theory("final")];
    const out = withEntBoss(lessonOf("demo", steps), POOL);
    expect(out.steps.map((s) => s.type)).toEqual(["theory", "choice", "choice", "entmatch", "multi", "theory", "theory"]);
  });

  it("entBossIndex: после последнего ЕНТ; без ЕНТ — перед хвостом; без заданий — в конец", () => {
    expect(entBossIndex(baseSteps())).toBe(5);
    expect(entBossIndex([theory("a"), choice("q"), theory("b"), theory("c")])).toBe(2);
    expect(entBossIndex([choice("q1"), choice("q2")])).toBe(2);
    expect(entBossIndex([theory("a"), theory("b")])).toBe(2);
  });

  it("нет «несколько верных» с ЕНТ на 6 вариантов — вставляется (multi без ЕНТ и с 4 вариантами не считается)", () => {
    const plain: Step = { id: "m-plain", type: "multi", prompt: L("m"), options: ["a", "b", "c", "d", "e", "f"], correct: [0, 1], explanation: L("m") };
    const four: Step = { id: "m-four", type: "multi", ent: true, prompt: L("m"), options: ["a", "b", "c", "d"], correct: [0, 1], explanation: L("m") };
    const out = withEntBoss(lessonOf("demo", [...baseSteps(), plain, four]), POOL);
    expect(out.steps.filter((s) => s.type === "multi" && s.ent && s.options.length === 6)).toHaveLength(1);
    expect(out.steps.some((s) => s.type === "entmatch")).toBe(true);
  });

  it("исходный урок не меняется", () => {
    const lesson = lessonOf("demo", baseSteps());
    const before = JSON.stringify(lesson);
    const out = withEntBoss(lesson, POOL);
    expect(out).not.toBe(lesson);
    expect(out.steps).not.toBe(lesson.steps);
    expect(JSON.stringify(lesson)).toBe(before);
    expect(lesson.steps).toHaveLength(6);
    // Прочие поля урока сохраняются.
    expect(out).toMatchObject({ id: "demo", skills: ["ns.base"], durationMin: 8 });
  });
});

describe("withEntBoss: выбор задания", () => {
  it("сначала собственные задания урока (<урок>:…), иначе любое с навыком урока", () => {
    for (const id of ["demo", "other"]) {
      const out = withEntBoss(lessonOf(id, baseSteps()), POOL);
      const picked = out.steps.filter((s) => s.id.startsWith("ent:")).map((s) => s.id);
      expect(picked.every((p) => p.startsWith(`ent:${id}:`))).toBe(true);
    }
    // Своих заданий у урока нет — берём по навыку из всего банка.
    const out = withEntBoss(lessonOf("elsewhere", baseSteps()), POOL);
    const picked = out.steps.filter((s) => s.id.startsWith("ent:"));
    expect(picked).toHaveLength(2);
    expect(picked.every((s) => (s as { skill?: string }).skill === "ns.base")).toBe(true);
  });

  it("навык урока не совпал — ничего не вставляется, урок возвращается как есть", () => {
    const lesson = lessonOf("elsewhere", baseSteps(), { skills: ["py.for"] });
    expect(withEntBoss(lesson, POOL)).toBe(lesson);
  });

  it("выбор детерминирован: тот же урок — то же задание, а разные уроки разбирают банк по-разному", () => {
    const pool: EntItem[] = Array.from({ length: 8 }, (_, i) => match(`bank:m${i}`));
    const pick = (id: string) => withEntBoss(lessonOf(id, baseSteps()), pool).steps.find((s) => s.type === "entmatch")!.id;
    expect(pick("lesson-a")).toBe(pick("lesson-a"));
    expect(pick("lesson-a")).toBe(withEntBoss(lessonOf("lesson-a", baseSteps()), [...pool].reverse()).steps.find((s) => s.type === "entmatch")!.id);
    const picked = new Set(Array.from({ length: 30 }, (_, i) => pick(`lesson-${i}`)));
    expect(picked.size).toBeGreaterThan(3);
  });
});

describe("withEntBoss: без дублей", () => {
  it("в уроке уже есть шаг entmatch — второй не добавляется", () => {
    const first = withEntBoss(lessonOf("demo", baseSteps()), POOL);
    const again = withEntBoss(first, POOL);
    expect(again).toBe(first);
    expect(ids(again).filter((id) => id.startsWith("ent:"))).toHaveLength(2);
  });

  it("повторный вызов даёт тот же набор шагов (идемпотентность)", () => {
    const once = withEntBoss(lessonOf("demo", baseSteps()), POOL);
    expect(ids(withEntBoss(once, POOL))).toEqual(ids(once));
  });

  it("задание, которое уже стоит в уроке по ссылке, не берётся второй раз", () => {
    // В банке два «соответствия» урока; одно уже есть в уроке как choice по ссылке ent:… (пункт соответствия).
    const pool: EntItem[] = [match("demo:m1"), match("demo:m2")];
    const used: Step = { ...choice(entRef("demo:m1"), true) };
    const lesson = lessonOf("demo", [theory("t1"), used, theory("final")]);
    const out = withEntBoss(lesson, pool);
    const em = out.steps.find((s) => s.type === "entmatch");
    expect(em?.id).toBe("ent:demo:m2");
    expect(new Set(ids(out)).size).toBe(ids(out).length);
  });

  it("единственное задание уже в уроке — вставлять нечего", () => {
    const pool: EntItem[] = [match("demo:m1")];
    const lesson = lessonOf("demo", [theory("t1"), choice(entRef("demo:m1"), true), theory("final")]);
    expect(withEntBoss(lesson, pool)).toBe(lesson);
  });
});

describe("withEntBoss: микроурок", () => {
  it("микроурок возвращается без изменений (тот же объект)", () => {
    const lesson = lessonOf("demo-micro", baseSteps(), { micro: true });
    expect(withEntBoss(lesson, POOL)).toBe(lesson);
  });
});

describe("withEntBoss: вставленные шаги проверяются как в ЕНТ", () => {
  it("«соответствие» из банка оценивается 2 / 1 / 0 (частично — 0,5)", () => {
    const out = withEntBoss(lessonOf("demo", baseSteps()), POOL);
    const em = out.steps.find((s) => s.type === "entmatch") as EntMatchStep;
    const [a0, a1] = em.answer;
    const wrong = (x: number, not: number[]) => [0, 1, 2, 3].find((i) => !not.includes(i) && i !== x)!;
    expect(evaluate(em, { type: "entmatch", picks: [a0, a1] }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(em, { type: "entmatch", picks: [a0, wrong(a1, [a0])] }, "ru")).toMatchObject({ correct: false, score: 0.5, partial: true });
    expect(evaluate(em, { type: "entmatch", picks: [wrong(a0, [a1]), wrong(a1, [a0])] }, "ru")).toMatchObject({ correct: false, score: 0 });
    // Один номер у обоих пунктов — допустимо, как на ЕНТ.
    expect(evaluate(em, { type: "entmatch", picks: [a0, a0] }, "ru")).toMatchObject({ score: 0.5, partial: true });
  });
});

describe("withEntBoss: все уроки карты (реальный банк ЕНТ)", () => {
  const lessons = Object.values(LESSONS);
  const has = (l: Lesson, kind: EntItem["kind"]) =>
    ENT_POOL.some((i) => i.kind === kind && (i.id.startsWith(`${l.id}:`) || l.skills.includes(i.skill)));
  const isEntMultiStep = (s: Step) => s.type === "multi" && !!s.ent && s.options.length === 6;

  it("в банке есть уроки для проверки, а исходные уроки не меняются", () => {
    expect(lessons.length).toBeGreaterThan(100);
    const before = lessons.map((l) => l.steps.length);
    for (const l of lessons) withEntBoss(l);
    expect(lessons.map((l) => l.steps.length)).toEqual(before);
  });

  it("у каждого не-микро урока с «соответствием» в банке есть ≥ 1 шаг entmatch", () => {
    const missing: string[] = [];
    for (const l of lessons) {
      if (l.micro || !has(l, "match")) continue;
      const out = withEntBoss(l);
      if (out.steps.filter((s) => s.type === "entmatch").length < 1) missing.push(l.id);
    }
    expect(missing).toEqual([]);
  });

  it("и ≥ 1 «несколько верных» на 6 вариантов с ЕНТ (если в банке есть такие)", () => {
    const missing: string[] = [];
    for (const l of lessons) {
      if (l.micro || !has(l, "match") || !has(l, "multi")) continue;
      if (!withEntBoss(l).steps.some(isEntMultiStep)) missing.push(l.id);
    }
    expect(missing).toEqual([]);
  });

  it("вставленные шаги проходят validateStep, id уникальны, вставка стоит после последнего задания ЕНТ урока", () => {
    const problems: string[] = [];
    for (const l of lessons) {
      const out = withEntBoss(l);
      if (out === l) continue;
      const own = new Set(l.steps.map((s) => s.id));
      const added = out.steps.filter((s) => !own.has(s.id));
      expect(added.length).toBeGreaterThan(0);
      expect(added.length).toBeLessThanOrEqual(2);
      for (const s of added) {
        problems.push(...validateStep(s));
        if (!s.id.startsWith("ent:")) problems.push(`${l.id}: вставлен не ent-шаг ${s.id}`);
      }
      if (new Set(ids(out)).size !== out.steps.length) problems.push(`${l.id}: повторяются id шагов`);
      // Исходный порядок сохранён, вставка — одним куском сразу после последнего ЕНТ-задания.
      expect(out.steps.filter((s) => own.has(s.id)).map((s) => s.id)).toEqual(ids(l));
      const at = entBossIndex(l.steps);
      expect(out.steps.slice(at, at + added.length).map((s) => s.id)).toEqual(added.map((s) => s.id));
    }
    expect(problems).toEqual([]);
  });

  it("«Проверить себя»: buildCheck(withEntBoss(урок)) включает «соответствие» и «несколько верных»", () => {
    const withBoss: string[] = [];
    for (const id of ["ns-1-bits", "py-3-loops", "db-2-select"]) {
      const lesson = LESSONS[id];
      if (!lesson) continue;
      const check = buildCheck(withEntBoss(lesson), 1);
      if (!check.some((s) => s.type === "entmatch")) withBoss.push(`${id}: нет entmatch`);
      if (!check.some(isEntMultiStep)) withBoss.push(`${id}: нет multi на 6`);
    }
    expect(withBoss).toEqual([]);
  });

  it("микроуроки карты не меняются", () => {
    for (const l of lessons.filter((x) => x.micro)) expect(withEntBoss(l)).toBe(l);
  });

  it("повторный вызов на любом уроке ничего не добавляет", () => {
    for (const l of lessons) {
      const once = withEntBoss(l);
      expect(withEntBoss(once)).toBe(once);
    }
  });
});

describe("lessonStepCount — подпись «N шагов» на карте без банка ЕНТ", () => {
  it("совпадает с числом шагов после withEntBoss у всех уроков карты, кроме стратегии ЕНТ", async () => {
    const { lessonStepCount } = await import("@/lib/lesson-size");
    const { LESSONS, UNITS } = await import("@/content/course");
    const { withEntBoss } = await import("@/lib/ent-boss");
    const off = UNITS.flatMap((u) => u.lessons)
      .map((r) => LESSONS[r.id])
      .filter((l) => !!l && lessonStepCount(l) !== withEntBoss(l).steps.length)
      .map((l) => l.id);
    expect(off).toEqual(["ent-1-strategy"]);
  });
});

describe("shuffleOptions: «соответствие» в работе над ошибками перемешивается с пересчётом ключа", () => {
  it("описания переставлены, верные описания пунктов — те же", async () => {
    const { shuffleOptions } = await import("@/lib/bank/pool");
    const step: EntMatchStep = {
      id: "ent:x:m",
      type: "entmatch",
      prompt: { ru: "?", kk: "?" },
      items: ["A", "B"],
      choices: ["c0", "c1", "c2", "c3"],
      answer: [0, 1],
      explanation: { ru: "x", kk: "x" },
    };
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const out = shuffleOptions(step, seed) as EntMatchStep;
      expect(out.answer.map((a) => out.choices[a])).toEqual(["c0", "c1"]);
      seen.add(out.answer.join(","));
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
