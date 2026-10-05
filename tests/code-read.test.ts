import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { ENT_TOPICS } from "@/content/ent-topics";
import { inferReadKind, isReadItem, leastUsedRead, readKindOf, readStats, readTarget, READ_SHARE } from "@/lib/code-read";
import { buildExam } from "@/lib/exam";
import type { EntContext, EntItem, EntSingle, EntTopicId, Level, ReadKind } from "@/lib/types";

// «Чтение кода» (#87): вид задания и квота в пробном ЕНТ.

const w = (ru: string) => ({ ru, kk: ru });

function single(id: string, topic: EntTopicId, level: Level, opts: { read?: ReadKind; prompt?: string; code?: boolean } = {}): EntSingle {
  return {
    id,
    kind: "single",
    topic,
    skill: "py.vars",
    level,
    prompt: w(opts.prompt ?? "Что выведет программа?"),
    ...(opts.code === false ? {} : { scene: { kind: "code", lang: "python", lines: ["print(1)"] } }),
    options: ["1", "2", "3", "4"],
    correct: 0,
    explanation: w("Разбор"),
    ...(opts.read ? { read: opts.read } : {}),
  };
}

describe("inferReadKind — вид по тексту условия", () => {
  it("узнаёт ошибку, исправление, пропуск, назначение, ключи и вывод", () => {
    expect(inferReadKind("В какой строке допущена ошибка?", "t06")).toBe("bug");
    expect(inferReadKind("Какая ошибка возникнет при запуске программы?", "t06")).toBe("bug");
    expect(inferReadKind("Что нужно изменить в строке 3, чтобы программа вывела 10?", "t06")).toBe("fix");
    expect(inferReadKind("Какое условие нужно вставить вместо пропуска?", "t07")).toBe("fill");
    expect(inferReadKind("Зачем в программе нужна команда continue?", "t06")).toBe("purpose");
    expect(inferReadKind("Какое поле является первичным ключом?", "t09")).toBe("schema");
    expect(inferReadKind("Что выведет программа?", "t06")).toBe("output");
    expect(inferReadKind("Сколько записей выведет запрос?", "t10")).toBe("output");
  });
  it("«ключ» и «связь» вне БД — не схема", () => {
    expect(inferReadKind("Какой ключ словаря выведет программа?", "t07")).toBe("output");
  });
  it("в t09 по умолчанию — чтение схемы", () => {
    expect(inferReadKind("Сколько таблиц на рисунке?", "t09")).toBe("schema");
  });
});

describe("readKindOf — задание целиком", () => {
  it("явное поле read главнее текста", () => {
    expect(readKindOf(single("a:x", "t06", 1, { read: "fix" }))).toBe("fix");
  });
  it("без материала (кода, таблицы, формулы) задание не «на чтение»", () => {
    expect(readKindOf(single("a:x", "t07", 1, { code: false, prompt: "Что такое алгоритм?" }))).toBeNull();
    expect(isReadItem(single("a:x", "t07", 1, { code: false, prompt: "Что такое алгоритм?" }))).toBe(false);
  });
  it("короткий код в тексте условия — тоже материал в практических темах", () => {
    expect(readKindOf(single("a:x", "t12", 1, { code: false, prompt: "Какое значение вернёт формула `=СУММ(A1:A3)`?" }))).toBe("output");
    expect(readKindOf(single("a:x", "t01", 1, { code: false, prompt: "Что делает клавиша `Ctrl`?" }))).toBeNull();
  });
  it("вопросы контекстного задания — по номеру", () => {
    const ctx: EntContext = {
      id: "a:ctx",
      kind: "context",
      topic: "t06",
      skill: "py.vars",
      level: 2,
      text: w("Программа"),
      questions: [
        { id: "q1", prompt: w("Что выведет программа при вводе 5?"), options: ["1", "2", "3", "4"], correct: 0, explanation: w("Разбор") },
        { id: "q2", prompt: w("Зачем нужна строка 4?"), options: ["1", "2", "3", "4"], correct: 0, explanation: w("Разбор") },
        { id: "q3", prompt: w("Вопрос"), options: ["1", "2", "3", "4"], correct: 0, explanation: w("Разбор"), read: "fill" },
      ],
    };
    expect([0, 1, 2].map((n) => readKindOf(ctx, n))).toEqual(["output", "purpose", "fill"]);
    expect(isReadItem(ctx)).toBe(false);
  });
});

describe("readTarget — квота темы", () => {
  it("в полном варианте: 12 из 35 обычных заданий", () => {
    const total = ENT_TOPICS.reduce((s, t) => s + readTarget(t.id, t.examCount), 0);
    expect(total).toBe(12);
    expect(readTarget("t06", 3)).toBe(3);
    expect(readTarget("t07", 3)).toBe(2);
    expect(readTarget("t09", 2)).toBe(1);
    expect(readTarget("t12", 4)).toBe(2);
    expect(readTarget("t01", 2)).toBe(0);
  });
  it("одно задание практической темы в мини-варианте — «на чтение»", () => {
    for (const t of Object.keys(READ_SHARE) as EntTopicId[]) expect(readTarget(t, 1)).toBe(1);
    expect(readTarget("t06", 0)).toBe(0);
  });
});

describe("leastUsedRead — разнообразие видов", () => {
  it("оставляет виды, которые встречались реже", () => {
    const a = single("a:1", "t06", 1, { read: "output" });
    const b = single("a:2", "t06", 1, { read: "bug" });
    const c = single("a:3", "t06", 1, { read: "fix" });
    const used = new Map<ReadKind, number>([["output", 2], ["bug", 1]]);
    expect(leastUsedRead([a, b, c], used).map((x) => x.id)).toEqual(["a:3"]);
  });
});

describe("пробный ЕНТ — квота «чтения кода»", () => {
  const readByTopic = (items: EntItem[]) => {
    const m = new Map<EntTopicId, number>();
    for (const it of items) if (isReadItem(it)) m.set(it.topic, (m.get(it.topic) ?? 0) + 1);
    return m;
  };

  it("полный вариант: в практических темах не меньше квоты (банк большой — добирать не нужно)", () => {
    for (const seed of [1, 7, 42, 1000, 31337]) {
      const paper = buildExam({ kind: "full", seed, pool: ENT_POOL });
      const plain = [...new Map(paper.items.filter((q) => q.item.kind !== "context").map((q) => [q.item.id, q.item])).values()];
      const got = readByTopic(plain);
      for (const t of ENT_TOPICS) {
        const need = readTarget(t.id, t.examCount);
        expect(got.get(t.id) ?? 0, `seed ${seed}, ${t.id}`).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it("вид «чтения» разнообразится: при равных уровнях не три одинаковых вида подряд", () => {
    const pool: EntItem[] = [];
    const kinds: ReadKind[] = ["output", "bug", "fix"];
    for (const lv of [1, 2, 3] as Level[]) for (const k of kinds) for (let i = 0; i < 4; i++) pool.push(single(`p:${k}-${lv}-${i}`, "t06", lv, { read: k }));
    const paper = buildExam({ kind: "topic", seed: 5, pool, topics: ["t06"] });
    const stats = readStats(paper.items.map((q) => q.item));
    expect(paper.items.length).toBe(10);
    for (const k of kinds) expect(stats[k], k).toBeGreaterThanOrEqual(3);
  });

  it("слот «на чтение» берёт задание с кодом, даже если без кода их больше", () => {
    const pool: EntItem[] = [];
    for (let i = 0; i < 20; i++) pool.push(single(`p:plain-${i}`, "t06", 1, { code: false, prompt: "Что такое переменная?" }));
    pool.push(single("p:code-0", "t06", 1, { read: "bug" }));
    const paper = buildExam({ kind: "topic", seed: 3, pool, topics: ["t06"] });
    expect(paper.items.some((q) => q.item.id === "p:code-0")).toBe(true);
  });

  it("контрольная практического раздела: не меньше половины single — «на чтение»", () => {
    const skills = [...new Set(ENT_POOL.filter((i) => i.id.startsWith("db-")).map((i) => i.skill))];
    for (const seed of [2, 9, 77]) {
      const paper = buildExam({ kind: "unit", seed, pool: ENT_POOL, skillIds: skills });
      const singles = paper.items.filter((q) => q.item.kind === "single").map((q) => q.item);
      expect(singles.filter(isReadItem).length, `seed ${seed}`).toBeGreaterThanOrEqual(Math.ceil(singles.length / 2));
    }
  });

  it("один seed — один вариант (детерминированность сохранена)", () => {
    const a = buildExam({ kind: "full", seed: 11, pool: ENT_POOL }).items.map((q) => q.key);
    const b = buildExam({ kind: "full", seed: 11, pool: ENT_POOL }).items.map((q) => q.key);
    expect(a).toEqual(b);
  });
});
