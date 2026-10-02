import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import {
  aiMistakes,
  chartBars,
  correctText,
  EXAM_FORMAT,
  examLink,
  formatClock,
  givenText,
  historyPoints,
  lessonsForTopic,
  MAX_TOPIC_PICK,
  noteVariant,
  onlyMistakes,
  parseRunParams,
  parseTopics,
  remainingSec,
  reviewRows,
  slowestRows,
  toggleTopic,
  toneOf,
  whyWrongOf,
} from "@/components/exam/logic";
import { buildExam, scoreExam, type ExamAnswers, type ExamPaper } from "@/lib/exam";
import {
  addTime,
  buildSummary,
  isAttemptId,
  newAttemptId,
  patchAnswer,
  pickMatch,
  pickSingle,
  progressOf,
  pruneIndex,
  sanitizeAnswer,
  sanitizeAnswers,
  sanitizeAttempt,
  sanitizePaper,
  sanitizeReview,
  skillScoresOf,
  toggleFlag,
  toggleMulti,
  type ExamAttempt,
} from "@/lib/exam-store";
import type { ExamSummary } from "@/lib/store";
import type { EntContext, EntItem, EntMatch, EntMulti, EntSingle, EntTopicId, Lesson, Level } from "@/lib/types";

const L = (s: string) => ({ ru: s, kk: `${s}-kk` });
const TOPICS = ENT_TOPICS.map((t) => t.id);

function single(id: string, topic: EntTopicId, level: Level = 1): EntSingle {
  return {
    id, kind: "single", topic, skill: "ns.base", level, prompt: L(`Вопрос ${id}`), explanation: L("объяснение"),
    options: ["a", "b", "c", "d"], correct: 2, whyWrong: [L("w-a"), L("w-b"), null, L("w-d")],
  };
}
function multi(id: string, topic: EntTopicId): EntMulti {
  return { id, kind: "multi", topic, skill: "ns.mul", level: 2, prompt: L(id), explanation: L("e"), options: ["a", "b", "c", "d", "e", "f"], correct: [1, 4] };
}
function match(id: string, topic: EntTopicId): EntMatch {
  return { id, kind: "match", topic, skill: "ns.mat", level: 2, prompt: L(id), explanation: L("e"), items: ["A", "B"], choices: ["w", "x", "y", "z"], answer: [3, 0] };
}
function context(id: string): EntContext {
  return {
    id, kind: "context", topic: "t06", skill: "py.trace", level: 2, text: L("prog"),
    questions: [0, 1, 2, 3, 4].map((i) => ({ id: `${id}.${i}`, prompt: L("q"), options: ["a", "b", "c", "d"], correct: i % 4, explanation: L("e") })),
  };
}
function pool(): EntItem[] {
  const out: EntItem[] = [];
  for (const t of TOPICS) {
    for (let i = 0; i < 6; i++) out.push(single(`${t}:s${i}`, t, ((i % 3) + 1) as Level));
    for (let i = 0; i < 3; i++) out.push(multi(`${t}:m${i}`, t));
    for (let i = 0; i < 3; i++) out.push(match(`${t}:x${i}`, t));
  }
  out.push(context("ctx1"));
  return out;
}

const mini = () => buildExam({ kind: "mini", seed: 7, pool: pool() });
const full = () => buildExam({ kind: "full", seed: 7, pool: pool() });

/** Копия через JSON — как после IndexedDB (structured clone). */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("параметры адреса и ссылки", () => {
  it("parseRunParams: вид, seed, темы", () => {
    expect(parseRunParams({})).toBeNull();
    expect(parseRunParams({ kind: "hack" })).toBeNull();
    expect(parseRunParams({ kind: "mini", seed: "123" })).toEqual({ kind: "mini", seed: 123, topics: [] });
    expect(parseRunParams({ kind: "mini", seed: "abc" })?.seed).toBeNull();
    expect(parseRunParams({ kind: "mini", seed: "99999999999" })?.seed).toBeNull();
    expect(parseRunParams({ kind: ["full", "mini"], seed: ["5"] })).toEqual({ kind: "full", seed: 5, topics: [] });
    expect(parseRunParams({ kind: "topic", seed: "1", topics: "t04,t05" })?.topics).toEqual(["t04", "t05"]);
    // темы у других видов игнорируются
    expect(parseRunParams({ kind: "mini", seed: "1", topics: "t04" })?.topics).toEqual([]);
  });

  it("parseTopics: только известные, без повторов, не больше трёх", () => {
    expect(parseTopics("t04,x99,t04,t05")).toEqual(["t04", "t05"]);
    expect(parseTopics("t01,t02,t03,t04,t05")).toHaveLength(MAX_TOPIC_PICK);
    expect(parseTopics(undefined)).toEqual([]);
  });

  it("examLink и разбор обратно", () => {
    const link = examLink("topic", 42, ["t04", "t05"]);
    expect(link).toBe("/exam/run?kind=topic&seed=42&topics=t04%2Ct05");
    const sp = Object.fromEntries(new URL(link, "http://x").searchParams);
    expect(parseRunParams(sp)).toEqual({ kind: "topic", seed: 42, topics: ["t04", "t05"] });
    expect(examLink("mini", 5)).toBe("/exam/run?kind=mini&seed=5");
  });

  it("toggleTopic: 1–3 темы", () => {
    let s: EntTopicId[] = [];
    s = toggleTopic(s, "t01");
    s = toggleTopic(s, "t02");
    s = toggleTopic(s, "t03");
    expect(toggleTopic(s, "t04")).toEqual(["t01", "t02", "t03"]);
    expect(toggleTopic(s, "t02")).toEqual(["t01", "t03"]);
  });

  it("формат карточек совпадает с форматом ЕНТ", () => {
    expect(EXAM_FORMAT.mini).toMatchObject({ questions: 15, minutes: 30 });
    expect(EXAM_FORMAT.full).toMatchObject({ questions: 40, minutes: 80, points: 50 });
    expect(EXAM_FORMAT.topic).toMatchObject({ questions: 10, minutes: 20 });
  });
});

describe("время и цвет", () => {
  it("formatClock и remainingSec", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(4800)).toBe("1:20:00");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(NaN)).toBe("0:00");
    expect(remainingSec(1800, 0)).toBe(1800);
    expect(remainingSec(1800, 1_799_100)).toBe(1);
    expect(remainingSec(1800, 9_999_999)).toBe(0);
  });

  it("toneOf: слабо — danger, в процессе — warning, освоено — success", () => {
    expect(toneOf(0)).toBe("danger");
    expect(toneOf(0.49)).toBe("danger");
    expect(toneOf(0.5)).toBe("warning");
    expect(toneOf(0.79)).toBe("warning");
    expect(toneOf(0.8)).toBe("success");
    expect(toneOf(NaN)).toBe("danger");
  });
});

describe("история и график", () => {
  const ex = (id: string, at: number, kind: ExamSummary["kind"], points: number, maxPoints: number): ExamSummary => ({
    id, at, kind, seed: 1, points, maxPoints, durationSec: 60, byTopic: {},
  });

  it("берёт мини/полные, последние 10, от старых к новым", () => {
    const list: ExamSummary[] = [];
    for (let i = 0; i < 12; i++) list.push(ex(`e${i}`, 1000 + i, "mini", 10, 20));
    list.push(ex("topic", 5000, "topic", 5, 10));
    const h = historyPoints(list);
    expect(h).toHaveLength(10);
    expect(h[0].id).toBe("e2");
    expect(h[9].id).toBe("e11");
    expect(h.every((p) => p.percent === 50)).toBe(true);
    expect(h.some((p) => p.id === "topic")).toBe(false);
  });

  it("баллы обрезаются до 0..max, нулевой максимум пропускается", () => {
    const h = historyPoints([ex("a", 1, "full", 99, 50), ex("b", 2, "full", -3, 50), ex("c", 3, "mini", 1, 0)]);
    expect(h.map((p) => p.percent)).toEqual([100, 0]);
  });

  it("chartBars: столбцы в пределах области", () => {
    const pts = historyPoints([ex("a", 1, "mini", 20, 20), ex("b", 2, "mini", 0, 20)]);
    const bars = chartBars(pts, 320, 100);
    expect(bars).toHaveLength(2);
    expect(bars[0].h).toBe(100);
    expect(bars[1].h).toBeGreaterThan(0);
    expect(bars[1].x).toBeGreaterThan(bars[0].x);
    for (const b of bars) expect(b.x + b.w).toBeLessThanOrEqual(320);
  });
});

describe("ответы: чистые обновления", () => {
  it("pickSingle: выбор, смена, снятие; время сохраняется", () => {
    let a: ExamAnswers = { q: { timeMs: 500 } };
    a = pickSingle(a, "q", 2);
    expect(a.q).toEqual({ timeMs: 500, choice: 2 });
    a = pickSingle(a, "q", 1);
    expect(a.q?.choice).toBe(1);
    a = pickSingle(a, "q", 1);
    expect(a.q?.choice).toBeUndefined();
    expect(a.q?.timeMs).toBe(500);
  });

  it("toggleMulti: набор отсортирован, повтор снимает", () => {
    let a: ExamAnswers = {};
    a = toggleMulti(a, "q", 4);
    a = toggleMulti(a, "q", 1);
    expect(a.q?.multi).toEqual([1, 4]);
    a = toggleMulti(a, "q", 4);
    expect(a.q?.multi).toEqual([1]);
  });

  it("pickMatch: по пунктам, повтор снимает", () => {
    let a: ExamAnswers = {};
    a = pickMatch(a, "q", 1, 3, 2);
    expect(a.q?.match).toEqual([null, 3]);
    a = pickMatch(a, "q", 0, 2, 2);
    expect(a.q?.match).toEqual([2, 3]);
    a = pickMatch(a, "q", 1, 3, 2);
    expect(a.q?.match).toEqual([2, null]);
  });

  it("toggleFlag, addTime, patchAnswer не мутируют исходный объект", () => {
    const a: ExamAnswers = { q: { timeMs: 100, choice: 1 } };
    const f = toggleFlag(a, "q");
    expect(f.q?.flagged).toBe(true);
    expect(a.q?.flagged).toBeUndefined();
    expect(toggleFlag(f, "q").q?.flagged).toBeUndefined();
    expect(addTime(a, "q", 250).q?.timeMs).toBe(350);
    expect(addTime(a, "q", -5)).toBe(a);
    expect(addTime(a, "q", NaN)).toBe(a);
    expect(addTime({}, "z", 10).z?.timeMs).toBe(10);
    expect(patchAnswer(a, "q", { choice: 3 }).q?.choice).toBe(3);
  });
});

describe("недоверенные данные из хранилища", () => {
  it("sanitizeAnswer: мусор отбрасывается", () => {
    expect(sanitizeAnswer(null)).toBeUndefined();
    expect(sanitizeAnswer("x")).toBeUndefined();
    const a = sanitizeAnswer({ timeMs: -5, choice: 99, multi: [1, 1, "x", 2.5, 3], match: [0, "a", null, 2], flagged: "yes" });
    expect(a).toEqual({ timeMs: 0, multi: [1, 3], match: [0, null, null, 2] });
    expect(sanitizeAnswer({ timeMs: 1200, choice: 2, flagged: true })).toEqual({ timeMs: 1200, choice: 2, flagged: true });
  });

  it("sanitizeAnswers: только ключи вопросов бумаги", () => {
    const paper = mini();
    const key = paper.items[0].key;
    const out = sanitizeAnswers({ [key]: { timeMs: 10, choice: 1 }, чужой: { timeMs: 1 } }, paper);
    expect(Object.keys(out)).toEqual([key]);
  });

  it("sanitizePaper: переживает JSON и отбрасывает битые вопросы", () => {
    const paper = mini();
    const copy = sanitizePaper(clone(paper));
    expect(copy?.items).toHaveLength(paper.items.length);
    expect(copy?.timeLimitSec).toBe(1800);

    expect(sanitizePaper(null)).toBeNull();
    expect(sanitizePaper({ kind: "x", seed: 1, items: [] })).toBeNull();
    const broken = clone(paper) as unknown as { items: unknown[] };
    broken.items.push({ key: "bad", item: { kind: "wat", topic: "t01" }, maxPoints: 1 }, null, { key: paper.items[0].key, item: paper.items[0].item, maxPoints: 1 });
    expect(sanitizePaper(broken)?.items).toHaveLength(paper.items.length);
    // нет заданий — нет бумаги
    expect(sanitizePaper({ ...clone(paper), items: [] })).toBeNull();
  });

  it("sanitizeAttempt: целая попытка, текущий вопрос в пределах, битое состояние — null", () => {
    const paper = mini();
    const state = { id: "ex-abc", answers: { [paper.items[0].key]: { timeMs: 5, choice: 1 } }, current: 9999, startedAt: 10, elapsedMs: -1 };
    const a = sanitizeAttempt(clone(paper), state);
    expect(a?.current).toBe(paper.items.length - 1);
    expect(a?.elapsedMs).toBe(0);
    expect(a?.kind).toBe("mini");
    expect(a?.finishedAt).toBeUndefined();
    expect(sanitizeAttempt(clone(paper), { answers: {} })).toBeNull();
    expect(sanitizeAttempt(null, state)).toBeNull();
    expect(sanitizeAttempt(clone(paper), null)).toBeNull();
  });

  it("sanitizeReview: непустой текст, ограниченные списки", () => {
    expect(sanitizeReview({ feedback: "  " })).toBeUndefined();
    expect(sanitizeReview({ feedback: "Хорошо", focus: ["a", 1, "b"], at: 5 })).toEqual({ feedback: "Хорошо", focus: ["a", "b"], at: 5 });
  });

  it("идентификаторы попыток", () => {
    const id = newAttemptId(1_700_000_000_000, () => 0.5);
    expect(isAttemptId(id)).toBe(true);
    expect(isAttemptId("../x")).toBe(false);
    expect(isAttemptId("")).toBe(false);
    expect(isAttemptId(42)).toBe(false);
    expect(newAttemptId(1, () => 0.1)).not.toBe(newAttemptId(2, () => 0.1));
  });

  it("pruneIndex: новая первая, повторов нет, лишние — на удаление", () => {
    expect(pruneIndex(["a", "b"], "c", 5)).toEqual({ keep: ["c", "a", "b"], drop: [] });
    expect(pruneIndex(["a", "b", "c"], "b", 5).keep).toEqual(["b", "a", "c"]);
    expect(pruneIndex(["a", "b", "c"], "d", 3)).toEqual({ keep: ["d", "a", "b"], drop: ["c"] });
  });
});

describe("итог попытки", () => {
  /** Ответ, дающий максимум по вопросу. */
  function perfect(paper: ExamPaper): ExamAnswers {
    const a: ExamAnswers = {};
    for (const q of paper.items) {
      const it = q.item;
      if (it.kind === "single") a[q.key] = { timeMs: 30_000, choice: it.correct };
      else if (it.kind === "multi") a[q.key] = { timeMs: 30_000, multi: [...it.correct] };
      else if (it.kind === "match") a[q.key] = { timeMs: 30_000, match: [...it.answer] };
      else a[q.key] = { timeMs: 30_000, choice: it.questions[q.sub!].correct };
    }
    return a;
  }

  it("полное прохождение даёт максимум; summary согласован с scoreExam", () => {
    const paper = full();
    const answers = perfect(paper);
    const attempt: ExamAttempt = { id: "ex-1", kind: "full", seed: 7, paper, answers, current: 0, startedAt: 0, elapsedMs: 600_000 };
    const s = buildSummary(attempt, 12345);
    expect(s.points).toBe(50);
    expect(s.maxPoints).toBe(50);
    expect(s.durationSec).toBe(600);
    expect(s.at).toBe(12345);
    expect(s.topics).toBeUndefined();
    const byTopic = Object.values(s.byTopic);
    expect(byTopic.every((v) => v!.points === v!.max)).toBe(true);
    expect(byTopic.reduce((a, v) => a + v!.max, 0)).toBe(50);
  });

  it("topic: темы попадают в summary", () => {
    const paper = buildExam({ kind: "topic", seed: 1, pool: pool(), topics: ["t04"] });
    const s = buildSummary({ id: "ex-2", kind: "topic", seed: 1, topics: ["t04"], paper, answers: {}, current: 0, startedAt: 0, elapsedMs: 0 }, 1);
    expect(s.topics).toEqual(["t04"]);
    expect(Object.keys(s.byTopic)).toEqual(["t04"]);
    expect(s.points).toBe(0);
  });

  it("skillScoresOf: по оценке на каждое задание, доля баллов", () => {
    const paper = mini();
    const all = skillScoresOf(paper, perfect(paper));
    expect(Object.values(all).flat().every((x) => x === 1)).toBe(true);
    expect(Object.values(all).flat()).toHaveLength(paper.items.length);
    const none = skillScoresOf(paper, {});
    expect(Object.values(none).flat().every((x) => x === 0)).toBe(true);
    // частичный балл matcha: одно соответствие из двух = 0.5
    const m = paper.items.find((q) => q.item.kind === "match")!;
    const it = m.item as EntMatch;
    const part = skillScoresOf(paper, { [m.key]: { timeMs: 0, match: [it.answer[0], null] } });
    expect(part["ns.mat"]).toContain(0.5);
  });

  it("progressOf: без ответа и с флажком", () => {
    const paper = mini();
    const [q0, q1] = paper.items;
    const answers: ExamAnswers = {
      [q0.key]: { timeMs: 0, ...(q0.item.kind === "single" ? { choice: 0 } : { multi: [0] }), flagged: true },
      [q1.key]: { timeMs: 5000 },
    };
    const p = progressOf(paper, answers);
    expect(p.flagged).toBe(1);
    expect(p.answered).toBeGreaterThanOrEqual(1);
    expect(p.answered + p.unanswered).toBe(paper.items.length);
  });
});

describe("разбор и данные для ИИ", () => {
  it("reviewRows: статусы верно / частично / неверно / пропущено", () => {
    const paper = full();
    const byKind = (k: string) => paper.items.find((q) => q.item.kind === k)!;
    const s = byKind("single");
    const mm = byKind("match");
    const mu = byKind("multi");
    const sItem = s.item as EntSingle;
    const mItem = mm.item as EntMatch;
    const answers: ExamAnswers = {
      [s.key]: { timeMs: 1, choice: sItem.correct },
      [mm.key]: { timeMs: 1, match: [mItem.answer[0], null] },
      [mu.key]: { timeMs: 1, multi: [0] },
    };
    const rows = reviewRows(paper, answers);
    const st = (key: string) => rows.find((r) => r.q.key === key)!.status;
    expect(st(s.key)).toBe("correct");
    expect(st(mm.key)).toBe("partial");
    expect(st(mu.key)).toBe("wrong");
    const other = paper.items.find((q) => !answers[q.key])!;
    expect(st(other.key)).toBe("skipped");
    expect(onlyMistakes(rows).some((r) => r.status === "correct")).toBe(false);
    expect(onlyMistakes(rows)).toHaveLength(rows.length - 1);
  });

  it("givenText / correctText для single, multi, match", () => {
    const paper = full();
    const s = paper.items.find((q) => q.item.kind === "single")!;
    const sItem = s.item as EntSingle;
    expect(givenText(s, undefined, "ru")).toBe("—");
    expect(givenText(s, { timeMs: 0, choice: 1 }, "ru")).toBe(`B) ${sItem.options[1]}`);
    expect(correctText(s, "ru")).toBe(`${"ABCD"[sItem.correct]}) ${sItem.options[sItem.correct]}`);
    const mu = paper.items.find((q) => q.item.kind === "multi")!;
    expect(givenText(mu, { timeMs: 0, multi: [3, 0] }, "ru")).toBe("A, D");
    expect(correctText(mu, "ru")).toMatch(/^[A-F], [A-F]$/);
    const mm = paper.items.find((q) => q.item.kind === "match")!;
    expect(givenText(mm, { timeMs: 0, match: [2, null] }, "ru")).toBe("A–3, B–?");
    expect(correctText(mm, "ru")).toMatch(/^A–\d, B–\d$/);
    const cx = paper.items.find((q) => q.item.kind === "context")!;
    expect(correctText(cx, "ru")).toMatch(/^[A-D]\) a|b|c|d/);
  });

  it("whyWrongOf: только для неверного выбранного single", () => {
    const paper = mini();
    const s = paper.items.find((q) => q.item.kind === "single")!;
    const it = s.item as EntSingle;
    const wrongIdx = it.options.findIndex((_, i) => i !== it.correct && it.whyWrong?.[i]);
    expect(wrongIdx).toBeGreaterThanOrEqual(0);
    expect(whyWrongOf(s, { timeMs: 0, choice: wrongIdx }, "ru")).toMatch(/^w-/);
    expect(whyWrongOf(s, { timeMs: 0, choice: wrongIdx }, "kk")).toMatch(/-kk$/);
    expect(whyWrongOf(s, { timeMs: 0, choice: it.correct }, "ru")).toBeNull();
    expect(whyWrongOf(s, undefined, "ru")).toBeNull();
  });

  it("aiMistakes: не больше 8, сначала с большей потерей, тексты обрезаны", () => {
    const paper = full();
    const rows = reviewRows(paper, {});
    const list = aiMistakes(rows, {}, "ru", 8);
    expect(list).toHaveLength(8);
    for (const m of list) {
      expect(m.q.length).toBeLessThanOrEqual(200);
      expect(m.given).toBe("—");
      expect(m.expected.length).toBeLessThanOrEqual(60);
    }
    // первые — задания на 2 балла (multi/match), потом 1 балл
    const firstQ = rows.filter((r) => r.max === 2).length >= 8;
    expect(firstQ).toBe(true);
    // без ошибок — пусто
    const perfectAnswers: ExamAnswers = {};
    for (const q of paper.items) {
      const it = q.item;
      perfectAnswers[q.key] =
        it.kind === "single" ? { timeMs: 1, choice: it.correct }
        : it.kind === "multi" ? { timeMs: 1, multi: [...it.correct] }
        : it.kind === "match" ? { timeMs: 1, match: [...it.answer] }
        : { timeMs: 1, choice: it.questions[q.sub!].correct };
    }
    expect(aiMistakes(reviewRows(paper, perfectAnswers), perfectAnswers, "ru")).toEqual([]);
  });

  it("slowestRows: номера 1-based по ключам", () => {
    const paper = mini();
    const k = paper.items[3].key;
    expect(slowestRows(paper, { [k]: { timeMs: 95_400 } }, [k, "нет-такого"])).toEqual([{ number: 4, key: k, sec: 95 }]);
  });

  it("совет по результату и разбор согласованы: scoreExam не падает на пустых ответах", () => {
    const paper = mini();
    expect(scoreExam(paper, {}).unanswered).toBe(paper.items.length);
  });
});

describe("заметки о нехватке заданий", () => {
  it("варианты текста", () => {
    expect(noteVariant({ topic: null, kind: "match", missing: 2, filledFrom: [], unfilled: 0 }, true)).toBe("kind-replaced");
    expect(noteVariant({ topic: null, kind: "match", missing: 2, filledFrom: [], unfilled: 1 }, true)).toBe("kind-short");
    expect(noteVariant({ topic: "t04", kind: "single", missing: 2, filledFrom: ["t05"], unfilled: 0 }, true)).toBe("topic-filled");
    expect(noteVariant({ topic: "t04", kind: "single", missing: 2, filledFrom: ["t05"], unfilled: 1 }, true)).toBe("topic-short");
    expect(noteVariant({ topic: "t06", kind: "context", missing: 1, filledFrom: [], unfilled: 1 }, false)).toBe("context-none");
    expect(noteVariant({ topic: "t06", kind: "context", missing: 1, filledFrom: ["t07"], unfilled: 0 }, true)).toBe("context-other");
    // Python-задание с 4 вопросами: запись похожа на «нет задания», но задание в варианте есть
    expect(noteVariant({ topic: "t06", kind: "context", missing: 1, filledFrom: [], unfilled: 1 }, true)).toBe("context-fewer");
  });

  it("реальные записи из пустого и скудного банка получают понятный вариант", () => {
    const empty = buildExam({ kind: "full", seed: 1, pool: [] });
    expect(empty.items).toHaveLength(0);
    expect(empty.notes.length).toBeGreaterThan(0);
    for (const n of empty.notes) expect(noteVariant(n, false)).toBeTruthy();
    const scarce = buildExam({ kind: "mini", seed: 1, pool: [single("t04:a", "t04"), single("t04:b", "t04")] });
    expect(scarce.items.length).toBe(2);
    expect(scarce.notes.length).toBeGreaterThan(0);
  });
});

describe("уроки по теме", () => {
  const lesson = (id: string, skills: string[], entTopics?: EntTopicId[]) => ({ id, skills, entTopics }) as unknown as Lesson;
  it("сначала явная тема, затем по навыкам", () => {
    const ls = [lesson("a", ["s1"]), lesson("b", ["s2"], ["t05"]), lesson("c", ["s3"])];
    const skillTopic = (s: string) => (s === "s1" ? ("t05" as const) : undefined);
    expect(lessonsForTopic(ls, "t05", skillTopic).map((l) => l.id)).toEqual(["b", "a"]);
    expect(lessonsForTopic(ls, "t09", skillTopic)).toEqual([]);
  });
});
