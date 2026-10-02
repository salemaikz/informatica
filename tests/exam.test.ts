import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import {
  buildExam,
  examAdvice,
  scoreExam,
  scoreQuestion,
  shuffleEntItem,
  type ExamAnswers,
  type ExamPaper,
} from "@/lib/exam";
import type { EntContext, EntItem, EntMatch, EntMulti, EntSingle, EntTopicId, Level } from "@/lib/types";

const L = (s: string) => ({ ru: s, kk: s });
const TOPICS = ENT_TOPICS.map((t) => t.id);

function single(id: string, topic: EntTopicId, level: Level): EntSingle {
  return {
    id, kind: "single", topic, skill: "ns.base", level, prompt: L(id), explanation: L("e"),
    options: ["a", "b", "c", "d"], correct: 2,
    whyWrong: [L("w-a"), L("w-b"), null, L("w-d")],
  };
}
function multi(id: string, topic: EntTopicId, level: Level): EntMulti {
  return { id, kind: "multi", topic, skill: "ns.base", level, prompt: L(id), explanation: L("e"), options: ["a", "b", "c", "d", "e", "f"], correct: [1, 4] };
}
function match(id: string, topic: EntTopicId, level: Level): EntMatch {
  return { id, kind: "match", topic, skill: "ns.base", level, prompt: L(id), explanation: L("e"), items: ["A", "B"], choices: ["w", "x", "y", "z"], answer: [3, 0] };
}
function context(id: string): EntContext {
  return {
    id, kind: "context", topic: "t06", skill: "py.trace", level: 2, text: L("prog"),
    questions: [0, 1, 2, 3, 4].map((i) => ({ id: `${id}.${i}`, prompt: L("q"), options: ["a", "b", "c", "d"], correct: i % 4, explanation: L("e") })),
  };
}

/** Богатый пул: по 8 single, 4 multi, 4 match на тему + 2 контекстных. */
function richPool(): EntItem[] {
  const out: EntItem[] = [];
  for (const t of TOPICS) {
    for (let i = 0; i < 8; i++) out.push(single(`${t}:s${i}`, t, ((i % 3) + 1) as Level));
    for (let i = 0; i < 4; i++) out.push(multi(`${t}:m${i}`, t, ((i % 3) + 1) as Level));
    for (let i = 0; i < 4; i++) out.push(match(`${t}:x${i}`, t, ((i % 3) + 1) as Level));
  }
  out.push(context("ctx1"), context("ctx2"));
  return out;
}

const countKinds = (p: ExamPaper) => {
  const c = { single: 0, multi: 0, match: 0, context: 0 };
  for (const q of p.items) c[q.item.kind]++;
  return c;
};

describe("buildExam: состав", () => {
  it("full: 40 заданий, 50 баллов, 25/5/5/5", () => {
    const p = buildExam({ kind: "full", seed: 1, pool: richPool() });
    expect(p.items).toHaveLength(40);
    expect(p.maxPoints).toBe(50);
    expect(countKinds(p)).toEqual({ single: 25, multi: 5, match: 5, context: 5 });
    expect(p.timeLimitSec).toBe(80 * 60);
    expect(p.notes).toEqual([]);
    expect(new Set(p.items.map((q) => q.key)).size).toBe(40);
  });

  it("full: контекст из темы t06, остальные задания без повторов", () => {
    const p = buildExam({ kind: "full", seed: 7, pool: richPool() });
    const ctx = p.items.filter((q) => q.item.kind === "context");
    expect(ctx.every((q) => q.item.topic === "t06")).toBe(true);
    expect(ctx.map((q) => q.sub)).toEqual([0, 1, 2, 3, 4]);
    const ids = p.items.filter((q) => q.item.kind !== "context").map((q) => q.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("full: темы пропорциональны examCount (single + multi + match на тему)", () => {
    const p = buildExam({ kind: "full", seed: 3, pool: richPool() });
    for (const t of ENT_TOPICS) {
      const n = p.items.filter((q) => q.item.kind !== "context" && q.item.topic === t.id).length;
      expect(n).toBe(t.examCount);
    }
  });

  it("full: уровни ≈ 50/30/20 по single", () => {
    const p = buildExam({ kind: "full", seed: 5, pool: richPool() });
    const lv = [0, 0, 0, 0];
    for (const q of p.items) if (q.item.kind === "single") lv[q.item.level]++;
    expect(lv[1]).toBeGreaterThanOrEqual(11);
    expect(lv[1]).toBeLessThanOrEqual(15);
    expect(lv[3]).toBeGreaterThanOrEqual(3);
    expect(lv[3]).toBeLessThanOrEqual(7);
  });

  it("порядок как в ЕНТ: single, контекст, multi, match", () => {
    const p = buildExam({ kind: "full", seed: 2, pool: richPool() });
    const kinds = p.items.map((q) => q.item.kind);
    const rank = { single: 0, context: 1, multi: 2, match: 3 } as const;
    const ranks = kinds.map((k) => rank[k]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("mini: 15 заданий, 19 баллов, без контекста", () => {
    const p = buildExam({ kind: "mini", seed: 4, pool: richPool() });
    expect(p.items).toHaveLength(15);
    expect(p.maxPoints).toBe(19);
    expect(countKinds(p)).toEqual({ single: 11, multi: 2, match: 2, context: 0 });
    expect(p.timeLimitSec).toBe(30 * 60);
    expect(new Set(p.items.map((q) => q.item.topic)).size).toBeGreaterThanOrEqual(8);
  });

  it("mini: только темы, где есть задания", () => {
    const pool = richPool().filter((i) => i.topic === "t04" || i.topic === "t05");
    const p = buildExam({ kind: "mini", seed: 4, pool });
    expect(p.items).toHaveLength(15);
    expect(p.items.every((q) => q.item.topic === "t04" || q.item.topic === "t05")).toBe(true);
  });

  it("topic: 10 заданий по выбранным темам, 6/2/2", () => {
    const p = buildExam({ kind: "topic", seed: 9, pool: richPool(), topics: ["t03", "t04"] });
    expect(p.items).toHaveLength(10);
    expect(countKinds(p)).toEqual({ single: 6, multi: 2, match: 2, context: 0 });
    expect(p.items.every((q) => q.item.topic === "t03" || q.item.topic === "t04")).toBe(true);
    expect(p.timeLimitSec).toBe(20 * 60);
  });

  it("topic: нет multi в теме — добираем single, вариант не короче", () => {
    const pool = richPool().filter((i) => i.topic === "t03" && i.kind === "single");
    const p = buildExam({ kind: "topic", seed: 1, pool, topics: ["t03"] });
    expect(p.items).toHaveLength(8);
    expect(countKinds(p).single).toBe(8);
    expect(p.notes.some((n) => n.unfilled > 0)).toBe(true);
  });

  it("пустой пул: пустой вариант с записями в notes, без падения", () => {
    const p = buildExam({ kind: "full", seed: 1, pool: [] });
    expect(p.items).toHaveLength(0);
    expect(p.maxPoints).toBe(0);
    expect(p.notes.length).toBeGreaterThan(0);
    expect(p.notes.some((n) => n.kind === "context")).toBe(true);
  });
});

describe("buildExam: детерминизм", () => {
  it("один seed — один вариант, другой seed — другой", () => {
    const pool = richPool();
    const a = buildExam({ kind: "full", seed: 42, pool });
    const b = buildExam({ kind: "full", seed: 42, pool });
    const c = buildExam({ kind: "full", seed: 43, pool });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("исходный пул не изменяется", () => {
    const pool = richPool();
    const before = JSON.stringify(pool);
    buildExam({ kind: "full", seed: 1, pool });
    expect(JSON.stringify(pool)).toBe(before);
  });
});

describe("buildExam: добор из соседних тем", () => {
  it("нет заданий в теме — берём из того же раздела и пишем в notes", () => {
    const pool = richPool().filter((i) => i.topic !== "t04");
    const p = buildExam({ kind: "full", seed: 1, pool });
    expect(p.items).toHaveLength(40);
    expect(p.maxPoints).toBe(50);
    const note = p.notes.find((n) => n.topic === "t04" && n.kind === "single");
    expect(note).toBeDefined();
    expect(note!.missing).toBeGreaterThan(0);
    expect(note!.unfilled).toBe(0);
    // сначала соседи из раздела «Информационные процессы» (t03, t05)
    expect(note!.filledFrom.every((t) => t === "t03" || t === "t05")).toBe(true);
    expect(p.items.some((q) => q.item.topic === "t04")).toBe(false);
  });

  it("не хватает вообще — вариант короче и notes.unfilled > 0", () => {
    const pool = richPool().slice(0, 12);
    const p = buildExam({ kind: "full", seed: 1, pool });
    expect(p.items.length).toBeLessThan(40);
    expect(p.notes.reduce((s, n) => s + n.unfilled, 0)).toBeGreaterThan(0);
    expect(p.maxPoints).toBe(p.items.reduce((s, q) => s + q.maxPoints, 0));
  });
});

describe("перемешивание", () => {
  it("single: верный вариант и whyWrong остаются согласованы", () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = shuffleEntItem(single("x", "t01", 1), seed) as EntSingle;
      expect(s.options[s.correct]).toBe("c");
      expect(s.whyWrong![s.correct]).toBeNull();
      s.options.forEach((o, i) => {
        if (i !== s.correct) expect((s.whyWrong![i] as { ru: string }).ru).toBe(`w-${o}`);
      });
    }
  });

  it("multi: верные индексы пересчитываются", () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = shuffleEntItem(multi("m", "t01", 1), seed) as EntMulti;
      expect(s.correct.map((i) => s.options[i]).sort()).toEqual(["b", "e"]);
    }
  });

  it("match: answer указывает на те же описания", () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = shuffleEntItem(match("x", "t01", 1), seed) as EntMatch;
      expect(s.answer.map((i) => s.choices[i])).toEqual(["z", "w"]);
    }
  });

  it("контекст: верные ответы вопросов сохраняются", () => {
    const orig = context("c");
    for (let seed = 1; seed < 20; seed++) {
      const s = shuffleEntItem(orig, seed) as EntContext;
      s.questions.forEach((q, i) => expect(q.options[q.correct]).toBe(orig.questions[i].options[orig.questions[i].correct]));
    }
  });

  it("в собранном варианте верный ответ по-прежнему верный", () => {
    const p = buildExam({ kind: "full", seed: 11, pool: richPool() });
    for (const q of p.items) {
      if (q.item.kind === "single") expect(q.item.options[q.item.correct]).toBe("c");
    }
  });
});

describe("scoreQuestion", () => {
  const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });
  const find = (kind: string) => paper.items.find((q) => q.item.kind === kind)!;
  const t = 1000;

  it("single и context — 1 / 0", () => {
    const s = find("single");
    const si = s.item as EntSingle;
    expect(scoreQuestion(s, { choice: si.correct, timeMs: t })).toEqual({ points: 1, max: 1, correct: true });
    expect(scoreQuestion(s, { choice: (si.correct + 1) % 4, timeMs: t }).points).toBe(0);
    expect(scoreQuestion(s, undefined).points).toBe(0);
    const c = find("context");
    const cq = (c.item as EntContext).questions[c.sub!];
    expect(scoreQuestion(c, { choice: cq.correct, timeMs: t }).points).toBe(1);
    expect(scoreQuestion(c, { choice: (cq.correct + 1) % 4, timeMs: t }).points).toBe(0);
  });

  it("multi — по правилам ЕНТ", () => {
    const q = find("multi");
    const mi = q.item as EntMulti;
    const [a, b] = mi.correct;
    const wrong = [0, 1, 2, 3, 4, 5].filter((i) => !mi.correct.includes(i));
    const pts = (multiAns: number[]) => scoreQuestion(q, { multi: multiAns, timeMs: t }).points;
    expect(pts([a, b])).toBe(2);
    expect(pts([a, b, wrong[0]])).toBe(1); // лишний
    expect(pts([a, b, wrong[0], wrong[1]])).toBe(0); // два лишних
    expect(pts([a])).toBe(1); // часть верных
    expect(pts([wrong[0]])).toBe(0);
    expect(pts([])).toBe(0);
  });

  it("match — 2 / 1 / 0", () => {
    const q = find("match");
    const ans = (q.item as EntMatch).answer;
    const other = (x: number) => (x + 1) % 4;
    const pts = (m: (number | null)[]) => scoreQuestion(q, { match: m, timeMs: t }).points;
    expect(pts([...ans])).toBe(2);
    expect(pts([ans[0], other(ans[1])])).toBe(1);
    expect(pts([other(ans[0]), ans[1]])).toBe(1);
    expect(pts([other(ans[0]), other(ans[1])])).toBe(0);
    expect(pts([null, null])).toBe(0);
  });
});

function perfectAnswers(p: ExamPaper, timeMs = 60_000): ExamAnswers {
  const out: ExamAnswers = {};
  for (const q of p.items) {
    const it = q.item;
    if (it.kind === "single") out[q.key] = { choice: it.correct, timeMs };
    else if (it.kind === "context") out[q.key] = { choice: it.questions[q.sub!].correct, timeMs };
    else if (it.kind === "multi") out[q.key] = { multi: [...it.correct], timeMs };
    else out[q.key] = { match: [...it.answer], timeMs };
  }
  return out;
}

describe("scoreExam", () => {
  const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });

  it("идеальный результат — 50 из 50", () => {
    const r = scoreExam(paper, perfectAnswers(paper));
    expect(r.points).toBe(50);
    expect(r.maxPoints).toBe(50);
    expect(r.percent).toBe(100);
    expect(r.unanswered).toBe(0);
    expect(r.byKind.single).toEqual({ points: 25, max: 25 });
    expect(r.byKind.multi).toEqual({ points: 10, max: 10 });
    expect(r.byKind.match).toEqual({ points: 10, max: 10 });
    expect(r.byKind.context).toEqual({ points: 5, max: 5 });
    const topicSum = Object.values(r.byTopic).reduce((s, x) => s + x.points, 0);
    expect(topicSum).toBe(50);
    const lvSum = r.byLevel[1].max + r.byLevel[2].max + r.byLevel[3].max;
    expect(lvSum).toBe(50);
    expect(r.timeSec).toBe(40 * 60);
    expect(r.avgSecPerQuestion).toBe(60);
  });

  it("пустые ответы — 0, все не отвечены", () => {
    const r = scoreExam(paper, {});
    expect(r.points).toBe(0);
    expect(r.unanswered).toBe(40);
    expect(r.slowest).toEqual([]);
    expect(r.avgSecPerQuestion).toBe(0);
  });

  it("slowest — три самых долгих", () => {
    const a = perfectAnswers(paper, 1000);
    const k = paper.items.map((q) => q.key);
    a[k[3]]!.timeMs = 9000;
    a[k[7]]!.timeMs = 8000;
    a[k[1]]!.timeMs = 7000;
    expect(scoreExam(paper, a).slowest).toEqual([k[3], k[7], k[1]]);
  });

  it("multi: считает лишние и недобранные", () => {
    const a = perfectAnswers(paper);
    const multis = paper.items.filter((q) => q.item.kind === "multi");
    const m0 = multis[0].item as EntMulti;
    const wrong = [0, 1, 2, 3, 4, 5].filter((i) => !m0.correct.includes(i))[0];
    a[multis[0].key] = { multi: [...m0.correct, wrong], timeMs: 1000 };
    a[multis[1].key] = { multi: [(multis[1].item as EntMulti).correct[0]], timeMs: 1000 };
    const r = scoreExam(paper, a);
    expect(r.multi).toEqual({ extra: 1, missed: 1 });
    expect(r.points).toBe(50 - 2);
  });
});

describe("examAdvice", () => {
  const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });

  it("идеальный ответ при нормальном темпе — без советов, все темы сильные", () => {
    const adv = examAdvice(scoreExam(paper, perfectAnswers(paper, 90_000)));
    expect(adv.tips).toEqual([]);
    expect(adv.weakTopics).toEqual([]);
    expect(adv.pace).toBe("ok");
    expect(adv.strongTopics.length).toBe(13);
  });

  it("медленно, с пропусками и лишними в multi", () => {
    const a = perfectAnswers(paper, 150_000);
    const first = paper.items[0];
    delete a[first.key];
    const m = paper.items.find((q) => q.item.kind === "multi")!;
    const mi = m.item as EntMulti;
    const wrong = [0, 1, 2, 3, 4, 5].filter((i) => !mi.correct.includes(i))[0];
    a[m.key] = { multi: [...mi.correct, wrong], timeMs: 1000 };
    const adv = examAdvice(scoreExam(paper, a));
    expect(adv.pace).toBe("slow");
    expect(adv.tips).toContain("skip-and-return");
    expect(adv.tips).toContain("answer-everything");
    expect(adv.tips).toContain("no-doubtful-options");
  });

  it("быстро и с ошибками — «читай внимательно», слабые темы по возрастанию", () => {
    const a: ExamAnswers = {};
    for (const q of paper.items) a[q.key] = { choice: 3, multi: [0], match: [0, 0], timeMs: 20_000 };
    const adv = examAdvice(scoreExam(paper, a));
    expect(adv.pace).toBe("fast");
    expect(adv.tips).toContain("read-carefully");
    expect(adv.tips).toContain("trace-code");
    expect(adv.weakTopics.length).toBeGreaterThan(0);
  });
});

describe("ревью: граничные случаи", () => {
  it("добор у соседей — после своих тем: тема-сосед с ровно нужным числом заданий не попадает в notes", () => {
    const pool = richPool().filter((i) => !(i.kind === "single" && (i.topic === "t01" || (i.topic === "t02" && Number(i.id.slice(-1)) >= 5))));
    for (let seed = 1; seed <= 20; seed++) {
      const p = buildExam({ kind: "full", seed, pool });
      expect(p.notes.find((n) => n.topic === "t02")).toBeUndefined();
      // у t01 single-слотов может не быть, если все её задания этого варианта — multi/match
      expect(p.notes.find((n) => n.topic === "t01" && n.kind === "single")?.unfilled ?? 0).toBe(0);
      expect(p.items).toHaveLength(40);
    }
  });

  it("порядок банка не влияет на вариант", () => {
    const pool = richPool();
    const a = buildExam({ kind: "full", seed: 5, pool });
    const b = buildExam({ kind: "full", seed: 5, pool: [...pool].reverse() });
    expect(b.items.map((q) => q.key)).toEqual(a.items.map((q) => q.key));
  });

  it("контекст: берётся ровно 5 вопросов, полный t06 предпочтительнее неполного", () => {
    const long: EntContext = { ...context("long"), questions: [...context("long").questions, ...context("long2").questions] };
    const short: EntContext = { ...context("short"), questions: context("short").questions.slice(0, 3) };
    const base = richPool().filter((i) => i.kind !== "context");
    for (let seed = 1; seed <= 10; seed++) {
      const p = buildExam({ kind: "full", seed, pool: [...base, long, short] });
      const ctx = p.items.filter((q) => q.item.kind === "context");
      expect(ctx).toHaveLength(5);
      expect(ctx[0].item.id).toBe("long");
      expect((ctx[0].item as EntContext).questions).toHaveLength(5);
      expect(p.maxPoints).toBe(50);
    }
    const p = buildExam({ kind: "full", seed: 1, pool: [...base, short] });
    expect(p.items.filter((q) => q.item.kind === "context")).toHaveLength(3);
    expect(p.notes).toContainEqual({ topic: "t06", kind: "context", missing: 2, filledFrom: [], unfilled: 2 });
  });

  it("topic: нехватка вида записывается в notes, даже если заменили другим видом", () => {
    const pool: EntItem[] = Array.from({ length: 20 }, (_, i) => single(`t03:s${i}`, "t03", ((i % 3) + 1) as Level));
    const p = buildExam({ kind: "topic", seed: 2, pool, topics: ["t03"] });
    expect(p.items).toHaveLength(10);
    expect(p.notes).toContainEqual({ topic: null, kind: "multi", missing: 2, filledFrom: [], unfilled: 0 });
    expect(p.notes).toContainEqual({ topic: null, kind: "match", missing: 2, filledFrom: [], unfilled: 0 });
  });

  it("испорченные ответы из хранилища не ломают подсчёт", () => {
    const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });
    const junk = { choice: "1", multi: "abc", match: 5, timeMs: NaN } as unknown as ExamAnswers[string];
    const answers: ExamAnswers = Object.fromEntries(paper.items.map((q) => [q.key, junk]));
    const r = scoreExam(paper, answers);
    expect(r.points).toBe(0);
    expect(r.unanswered).toBe(40);
    expect(r.timeSec).toBe(0);
    expect(Number.isNaN(r.avgSecPerQuestion)).toBe(false);
    // индексы вне диапазона — не ответ и не «лишний» вариант
    const m = paper.items.find((q) => q.item.kind === "multi")!;
    const mi = m.item as EntMulti;
    expect(scoreQuestion(m, { multi: [...mi.correct, 99, -1, 1.5], timeMs: 1 }).points).toBe(2);
    const s = paper.items.find((q) => q.item.kind === "single")!;
    expect(scoreExam(paper, { [s.key]: { choice: 7, timeMs: 1 } }).unanswered).toBe(40);
  });

  it("темп считается по вопросам, где ученик был: не успел — значит медленно", () => {
    const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });
    const all = perfectAnswers(paper, 240_000);
    const half: ExamAnswers = Object.fromEntries(paper.items.slice(0, 20).map((q) => [q.key, all[q.key]]));
    const r = scoreExam(paper, half);
    expect(r.avgSecPerQuestion).toBe(240);
    const adv = examAdvice(r);
    expect(adv.pace).toBe("slow");
    expect(adv.tips).toContain("skip-and-return");
    expect(adv.tips).toContain("answer-everything");
  });

  it("«проверяй единицы» — только по теме t03, не по системам счисления", () => {
    const paper = buildExam({ kind: "full", seed: 1, pool: richPool() });
    const a = perfectAnswers(paper, 90_000);
    for (const q of paper.items) if (q.item.topic === "t04") delete a[q.key];
    expect(examAdvice(scoreExam(paper, a)).tips).not.toContain("check-units");
    const b = perfectAnswers(paper, 90_000);
    for (const q of paper.items) if (q.item.topic === "t03") delete b[q.key];
    expect(examAdvice(scoreExam(paper, b)).tips).toContain("check-units");
  });
});
