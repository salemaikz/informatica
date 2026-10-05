import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { ENT_TOPICS } from "@/content/ent-topics";
import {
  BASICS_MIN_ITEMS,
  DIAGNOSTIC_SIZE,
  basicsKnown,
  buildDiagnostic,
  scoreDiagnostic,
  topicStartHref,
  type ReadyLesson,
} from "@/lib/diagnostic";
import type { ExamAnswers, ExamPaper } from "@/lib/exam";
import type { EntItem, EntSingle, EntTopicId, Level } from "@/lib/types";

const L = (s: string) => ({ ru: s, kk: s });
const topicOf = (p: ExamPaper) => p.items.map((q) => q.item.topic);
const countTopic = (p: ExamPaper, t: EntTopicId) => topicOf(p).filter((x) => x === t).length;

/** Все верные ответы (для single/context — индекс верного варианта в уже перемешанном задании). */
function allCorrect(p: ExamPaper): ExamAnswers {
  const out: ExamAnswers = {};
  for (const q of p.items) if (q.item.kind === "single") out[q.key] = { choice: q.item.correct, timeMs: 0 };
  return out;
}
/** Все неверные (первый вариант, не равный верному). */
function allWrong(p: ExamPaper): ExamAnswers {
  const out: ExamAnswers = {};
  for (const q of p.items) if (q.item.kind === "single") out[q.key] = { choice: q.item.correct === 0 ? 1 : 0, timeMs: 0 };
  return out;
}
const answeredIf = (p: ExamPaper, right: (topic: EntTopicId) => boolean): ExamAnswers => {
  const out: ExamAnswers = {};
  for (const q of p.items) if (q.item.kind === "single") out[q.key] = { choice: right(q.item.topic) ? q.item.correct : q.item.correct === 0 ? 1 : 0, timeMs: 0 };
  return out;
};

function single(id: string, topic: EntTopicId, level: Level, skill = "ns.base"): EntSingle {
  return {
    id, kind: "single", topic, skill, level, prompt: L(id), explanation: L("e"),
    options: ["a", "b", "c", "d"], correct: 2, whyWrong: [L("w"), L("w"), null, L("w")],
  };
}
const TOPICS = ENT_TOPICS.map((t) => t.id);
/** Небольшой пул: по 4 single уровней A, A, B, C на каждую тему. */
function smallPool(): EntItem[] {
  return TOPICS.flatMap((t) => [single(`${t}:a0`, t, 1, `${t}.x`), single(`${t}:a1`, t, 1, `${t}.y`), single(`${t}:b0`, t, 2, `${t}.x`), single(`${t}:c0`, t, 3, `${t}.y`)]);
}

describe("buildDiagnostic: состав на реальном банке", () => {
  it("10 заданий «один верный», 10 баллов, уровни A × 6 и B × 4", () => {
    for (const seed of [1, 2, 3, 42, 999, 123456]) {
      const p = buildDiagnostic(ENT_POOL, seed);
      expect(p.items).toHaveLength(DIAGNOSTIC_SIZE);
      expect(p.maxPoints).toBe(10);
      expect(p.items.every((q) => q.item.kind === "single" && q.maxPoints === 1)).toBe(true);
      const levels = p.items.map((q) => q.item.level);
      expect(levels.filter((l) => l === 1)).toHaveLength(6);
      expect(levels.filter((l) => l === 2)).toHaveLength(4);
      expect(levels.includes(3)).toBe(false);
    }
  });

  it("раскладка тем: t03 ×2, t04 ×2, t05 ×2, t06 ×1, t07 ×1, по одной из {t01,t02,t08} и из {t09–t13}", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = buildDiagnostic(ENT_POOL, seed);
      expect(countTopic(p, "t03")).toBe(2);
      expect(countTopic(p, "t04")).toBe(2);
      expect(countTopic(p, "t05")).toBe(2);
      expect(countTopic(p, "t06")).toBe(1);
      expect(countTopic(p, "t07")).toBe(1);
      expect((["t01", "t02", "t08"] as const).reduce((s, t) => s + countTopic(p, t), 0)).toBe(1);
      expect((["t09", "t10", "t11", "t12", "t13"] as const).reduce((s, t) => s + countTopic(p, t), 0)).toBe(1);
      expect(p.notes).toEqual([]); // в реальном банке запасов хватает: добора нет
    }
  });

  it("в каждой теме — по паре A и B там, где так задумано: t03/t04/t05 — A + B", () => {
    const p = buildDiagnostic(ENT_POOL, 7);
    for (const t of ["t03", "t04", "t05"] as const) {
      expect(p.items.filter((q) => q.item.topic === t).map((q) => q.item.level).sort()).toEqual([1, 2]);
    }
    expect(p.items.find((q) => q.item.topic === "t06")!.item.level).toBe(1);
    expect(p.items.find((q) => q.item.topic === "t07")!.item.level).toBe(2);
  });

  it("группы раскладываются по seed: за много seed встречаются все темы групп", () => {
    const seen = new Set<EntTopicId>();
    for (let seed = 1; seed <= 200; seed++) for (const t of topicOf(buildDiagnostic(ENT_POOL, seed))) seen.add(t);
    for (const t of TOPICS) expect(seen.has(t), t).toBe(true);
  });

  it("без повторов: id заданий и ключи вопросов уникальны; навыки одной темы не повторяются, пока есть другие", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = buildDiagnostic(ENT_POOL, seed);
      expect(new Set(p.items.map((q) => q.key)).size).toBe(DIAGNOSTIC_SIZE);
      for (const t of ["t03", "t04", "t05"] as const) {
        const skills = p.items.filter((q) => q.item.topic === t).map((q) => q.item.skill);
        expect(new Set(skills).size, `${t} seed ${seed}`).toBe(skills.length);
      }
    }
  });

  it("лёгкие впереди: сначала все A, потом B", () => {
    const levels = buildDiagnostic(ENT_POOL, 5).items.map((q) => q.item.level);
    expect(levels).toEqual([...levels].sort());
  });
});

describe("buildDiagnostic: детерминизм", () => {
  const sig = (p: ExamPaper) => JSON.stringify(p.items.map((q) => [q.key, q.item.kind === "single" ? q.item.options : null, q.item.kind === "single" ? q.item.correct : null]));

  it("один seed — один вариант (включая порядок вариантов ответа)", () => {
    expect(sig(buildDiagnostic(ENT_POOL, 77))).toBe(sig(buildDiagnostic(ENT_POOL, 77)));
  });

  it("другой seed — другой вариант", () => {
    const sigs = new Set([1, 2, 3, 4, 5, 6].map((s) => sig(buildDiagnostic(ENT_POOL, s))));
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("порядок заданий в банке не влияет", () => {
    expect(sig(buildDiagnostic([...ENT_POOL].reverse(), 31))).toBe(sig(buildDiagnostic(ENT_POOL, 31)));
  });

  it("исходное задание банка не меняется (варианты перемешаны в копии)", () => {
    const before = JSON.stringify(ENT_POOL.slice(0, 50));
    buildDiagnostic(ENT_POOL, 9);
    expect(JSON.stringify(ENT_POOL.slice(0, 50))).toBe(before);
  });
});

describe("buildDiagnostic: добор", () => {
  it("нет нужного уровня в теме — берётся ближайший уровень той же темы, добора из других тем нет", () => {
    // У t06 только уровень B и C: слот A возьмёт B (ближайший).
    const pool = smallPool().filter((i) => !(i.topic === "t06" && i.level === 1));
    const p = buildDiagnostic(pool, 3);
    expect(p.items).toHaveLength(10);
    expect(countTopic(p, "t06")).toBe(1);
    expect(p.items.find((q) => q.item.topic === "t06")!.item.level).toBe(2);
    expect(p.notes).toEqual([]);
  });

  it("у темы A и C, а нужен B — берётся более лёгкий A", () => {
    const pool = smallPool().filter((i) => !(i.topic === "t07" && i.level === 2));
    const p = buildDiagnostic(pool, 3);
    expect(p.items.find((q) => q.item.topic === "t07")!.item.level).toBe(1);
  });

  it("в теме не осталось заданий — добор из соседней темы, запись в notes", () => {
    const pool = smallPool().filter((i) => i.topic !== "t07");
    const p = buildDiagnostic(pool, 3);
    expect(p.items).toHaveLength(10);
    expect(countTopic(p, "t07")).toBe(0);
    expect(countTopic(p, "t06")).toBe(2); // сосед t07 в своём разделе — t06
    const note = p.notes.find((n) => n.topic === "t07");
    expect(note).toMatchObject({ kind: "single", missing: 1, filledFrom: ["t06"], unfilled: 0 });
    expect(new Set(p.items.map((q) => q.key)).size).toBe(10);
  });

  it("темы мало заданий: пока они есть, повторов нет; потом добор у соседей", () => {
    // У t03 всего одно задание: вторая пара добирается из t04/t05 (соседи по разделу).
    const pool = smallPool().filter((i) => i.topic !== "t03" || i.id === "t03:a0");
    const p = buildDiagnostic(pool, 11);
    expect(p.items).toHaveLength(10);
    expect(countTopic(p, "t03")).toBe(1);
    expect(new Set(p.items.map((q) => q.key)).size).toBe(10);
    expect(p.notes.some((n) => n.topic === "t03" && n.missing === 1 && n.unfilled === 0)).toBe(true);
  });

  it("банк пуст — вариант пустой, а не падение; недобор в notes", () => {
    const p = buildDiagnostic([], 1);
    expect(p.items).toHaveLength(0);
    expect(p.maxPoints).toBe(0);
    expect(p.notes.reduce((s, n) => s + n.unfilled, 0)).toBe(10);
  });

  it("не «один верный» в банк не попадает", () => {
    const multi: EntItem = { id: "t03:m", kind: "multi", topic: "t03", skill: "ns.base", level: 1, prompt: L("m"), explanation: L("e"), options: ["a", "b", "c", "d", "e", "f"], correct: [0, 1] };
    const p = buildDiagnostic([multi, ...smallPool()], 1);
    expect(p.items.every((q) => q.item.kind === "single")).toBe(true);
  });
});

describe("scoreDiagnostic", () => {
  const NOW = 1_800_000_000_000;

  it("всё верно: 10 из 10, слабых тем нет, у каждого навыка только верные ответы", () => {
    const p = buildDiagnostic(ENT_POOL, 1);
    const r = scoreDiagnostic(p, allCorrect(p), NOW);
    expect(r.summary).toMatchObject({ at: NOW, points: 10, max: 10 });
    expect(r.weakTopics).toEqual([]);
    expect(r.answered).toBe(10);
    const flat = Object.values(r.skillAnswers).flat();
    expect(flat).toHaveLength(10);
    expect(flat.every(Boolean)).toBe(true);
  });

  it("ничего не отвечено («Не знаю»): 0 баллов, ответы по навыкам — неверно, 3 слабые темы по весу", () => {
    const p = buildDiagnostic(ENT_POOL, 1);
    const r = scoreDiagnostic(p, {}, NOW);
    expect(r.summary.points).toBe(0);
    expect(r.answered).toBe(0);
    expect(Object.values(r.skillAnswers).flat().every((x) => x === false)).toBe(true);
    // Все темы по 0 — вперёд самые весомые: Python и алгоритмы (равны, по номеру), затем t03 (4 задания в ЕНТ).
    expect(r.weakTopics).toEqual(["t06", "t07", "t03"]);
  });

  it("баллы по темам: только темы, которые были в варианте, max = числу заданий", () => {
    const p = buildDiagnostic(ENT_POOL, 4);
    const r = scoreDiagnostic(p, allCorrect(p), NOW);
    const present = new Set(topicOf(p));
    expect(Object.keys(r.summary.byTopic).sort()).toEqual([...present].sort());
    for (const t of present) expect(r.summary.byTopic[t]).toEqual({ points: countTopic(p, t), max: countTopic(p, t) });
  });

  it("слабые темы: от самой слабой по доле верных, не больше трёх, только те, где были ошибки", () => {
    const p = buildDiagnostic(ENT_POOL, 8);
    // Неверно только t03 (0 из 2) и t04 (первое из двух верно — 1 из 2): слабые — t03, затем t04.
    const answers = answeredIf(p, (t) => t !== "t03");
    const t04 = p.items.filter((q) => q.item.topic === "t04");
    const wrongOne = t04[0];
    if (wrongOne.item.kind === "single") answers[wrongOne.key] = { choice: wrongOne.item.correct === 0 ? 1 : 0, timeMs: 0 };
    const r = scoreDiagnostic(p, answers, NOW);
    expect(r.weakTopics).toEqual(["t03", "t04"]);
    expect(r.summary.points).toBe(10 - 2 - 1);
  });

  it("неверных тем больше трёх — берутся три самые слабые (при равенстве — вес темы)", () => {
    const p = buildDiagnostic(ENT_POOL, 8);
    const r = scoreDiagnostic(p, allWrong(p), NOW);
    expect(r.weakTopics).toHaveLength(3);
    expect(r.summary.points).toBe(0);
  });

  it("«Не знаю» (ответ снят) — неотвеченное, 0 баллов", () => {
    const p = buildDiagnostic(ENT_POOL, 2);
    const answers = allCorrect(p);
    const k = p.items[0].key;
    delete answers[k];
    const r = scoreDiagnostic(p, answers, NOW);
    expect(r.answered).toBe(9);
    expect(r.summary.points).toBe(9);
  });
});

describe("правило «основы знакомы» (skipBasics)", () => {
  it("t01/t03/t08: не меньше 3 заданий и верно не меньше 75%", () => {
    expect(BASICS_MIN_ITEMS).toBe(3);
    expect(basicsKnown({ t03: { points: 2, max: 2 }, t01: { points: 1, max: 1 } })).toEqual({ known: true, items: 3 });
    expect(basicsKnown({ t03: { points: 2, max: 2 }, t08: { points: 1, max: 1 } }).known).toBe(true);
    // 2 из 3 — 67%: мало
    expect(basicsKnown({ t03: { points: 2, max: 2 }, t01: { points: 0, max: 1 } }).known).toBe(false);
    // верно всё, но заданий только 2 — судить рано
    expect(basicsKnown({ t03: { points: 2, max: 2 } })).toEqual({ known: false, items: 2 });
    // другие темы в счёт не идут
    expect(basicsKnown({ t03: { points: 2, max: 2 }, t02: { points: 1, max: 1 }, t04: { points: 2, max: 2 } }).known).toBe(false);
    expect(basicsKnown({})).toEqual({ known: false, items: 0 });
  });

  it("ровно 75%: 3 из 4 (если заданий основ четыре) — достаточно", () => {
    expect(basicsKnown({ t03: { points: 2, max: 2 }, t01: { points: 1, max: 2 } }).known).toBe(true);
  });

  it("на варианте: все основы верно — «Старт» скрывается; ошибка по основам — нет; без t01/t08 (выпала t02) — вывода нет", () => {
    let withBasics: ExamPaper | null = null;
    let withoutBasics: ExamPaper | null = null;
    for (let seed = 1; seed <= 100 && !(withBasics && withoutBasics); seed++) {
      const p = buildDiagnostic(ENT_POOL, seed);
      const basic = p.items.filter((q) => ["t01", "t03", "t08"].includes(q.item.topic)).length;
      if (basic === 3) withBasics ??= p;
      if (basic === 2) withoutBasics ??= p;
    }
    expect(withBasics).not.toBeNull();
    expect(withoutBasics).not.toBeNull();

    const ok = scoreDiagnostic(withBasics!, allCorrect(withBasics!));
    expect(ok.skipBasics).toBe(true);
    expect(ok.basicsItems).toBe(3);

    const miss = scoreDiagnostic(withBasics!, answeredIf(withBasics!, (t) => t !== "t03"));
    expect(miss.skipBasics).toBe(false);

    const none = scoreDiagnostic(withoutBasics!, allCorrect(withoutBasics!));
    expect(none.skipBasics).toBe(false);
    expect(none.basicsItems).toBe(2);
  });
});

describe("topicStartHref", () => {
  const ready: ReadyLesson[] = [
    { id: "base-8-info", skills: ["base.info"] },
    { id: "ns-1-bits", skills: ["ns.base"], entTopics: ["t04"] },
    { id: "ns-2-read", skills: ["ns.bin2dec"] },
  ];
  it("первый ещё не пройденный урок темы в порядке курса", () => {
    expect(topicStartHref("t04", ready, {})).toBe("/lesson/ns-1-bits");
    expect(topicStartHref("t04", ready, { "ns-1-bits": { completions: 1 } })).toBe("/lesson/ns-2-read");
  });
  it("все уроки темы пройдены или их нет — тренировка по теме", () => {
    expect(topicStartHref("t04", ready, { "ns-1-bits": 1, "ns-2-read": 1 })).toBe("/drill?mode=topic&topic=t04");
    expect(topicStartHref("t13", ready, {})).toBe("/drill?mode=topic&topic=t13");
  });
});
