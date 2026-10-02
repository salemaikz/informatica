import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY,
  MAX_WRONG_PER_ENTRY,
  entryFromSession,
  entryScore,
  filterHistory,
  historyTotals,
  markFixed,
  openWrong,
  pushHistory,
  sanitizeHistory,
  wrongFromAnswer,
  type HistoryEntry,
} from "@/lib/history";
import type { AnswerRecord, SessionResult } from "@/lib/types";

const ans = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.bin2dec",
  correct: true,
  score: 1,
  given: "5",
  expected: "5",
  prompt: "Сколько?",
  retry: false,
  timeMs: 1000,
  ...over,
});

const session = (over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "lesson",
  lessonId: "ns-1-binary",
  title: "Двоичная система",
  answers: [ans()],
  xp: 10,
  maxCombo: 1,
  durationSec: 61.6,
  accuracy: 1,
  ...over,
});

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "e1",
  at: 1000,
  kind: "lesson",
  title: "t",
  correct: 3,
  total: 4,
  durationSec: 60,
  xp: 10,
  wrong: [],
  fixed: [],
  ...over,
});

const wrongItem = (stepId: string) => ({ stepId, prompt: "p", given: "g", expected: "e" });

describe("entryFromSession", () => {
  it("считает только первые попытки", () => {
    const e = entryFromSession(
      session({
        answers: [ans({ stepId: "a" }), ans({ stepId: "b", correct: false, score: 0, given: "1", expected: "2" }), ans({ stepId: "b", retry: true })],
      }),
      "id1",
      5000,
    )!;
    expect(e.total).toBe(2);
    expect(e.correct).toBe(1);
    expect(e.wrong.map((w) => w.stepId)).toEqual(["b"]);
    expect(e.wrong[0]).toMatchObject({ given: "1", expected: "2", skill: "ns.bin2dec", lessonId: "ns-1-binary" });
    expect(e.fixed).toEqual([]);
  });

  it("поля записи: id, время, заголовок, урок, XP, длительность округлена", () => {
    const e = entryFromSession(session(), "id1", 5000)!;
    expect(e).toMatchObject({ id: "id1", at: 5000, title: "Двоичная система", lessonId: "ns-1-binary", xp: 10, durationSec: 62 });
  });

  it("вид: урок / проверка себя / тренировка", () => {
    expect(entryFromSession(session(), "i", 1)!.kind).toBe("lesson");
    expect(entryFromSession(session({ via: "check" }), "i", 1)!.kind).toBe("check");
    expect(entryFromSession(session({ via: "learn" }), "i", 1)!.kind).toBe("lesson");
    expect(entryFromSession(session({ kind: "drill", lessonId: undefined }), "i", 1)!.kind).toBe("drill");
    // у тренировки via игнорируется
    expect(entryFromSession(session({ kind: "drill", via: "check" }), "i", 1)!.kind).toBe("drill");
  });

  it("mode сохраняется только у тренировки", () => {
    expect(entryFromSession(session({ kind: "drill" }), "i", 1, "smart")!.mode).toBe("smart");
    expect(entryFromSession(session(), "i", 1, "smart")!.mode).toBeUndefined();
  });

  it("одна и та же ошибка не дублируется", () => {
    const e = entryFromSession(
      session({ answers: [ans({ stepId: "x", correct: false, score: 0 }), ans({ stepId: "x", correct: false, score: 0 })] }),
      "i",
      1,
    )!;
    expect(e.wrong).toHaveLength(1);
    expect(e.total).toBe(2);
  });

  it("null, если заданий не было или только повторные попытки", () => {
    expect(entryFromSession(session({ answers: [] }), "i", 1)).toBeNull();
    expect(entryFromSession(session({ answers: [ans({ retry: true })] }), "i", 1)).toBeNull();
  });

  it(`не больше ${MAX_WRONG_PER_ENTRY} ошибок`, () => {
    const answers = Array.from({ length: 40 }, (_, i) => ans({ stepId: `s${i}`, correct: false, score: 0 }));
    const e = entryFromSession(session({ answers }), "i", 1)!;
    expect(e.wrong).toHaveLength(MAX_WRONG_PER_ENTRY);
    expect(e.total).toBe(40);
  });

  it("длинные тексты обрезаются до 400 символов с многоточием", () => {
    const long = "я".repeat(1000);
    const w = wrongFromAnswer(ans({ correct: false, prompt: long, given: long, expected: "ok" }), "L");
    expect(w.prompt).toHaveLength(400);
    expect(w.prompt.endsWith("…")).toBe(true);
    expect(w.given).toHaveLength(400);
    expect(w.expected).toBe("ok");
    expect(w.lessonId).toBe("L");
  });

  it("отрицательная длительность — 0", () => {
    expect(entryFromSession(session({ durationSec: -5 }), "i", 1)!.durationSec).toBe(0);
  });
});

describe("pushHistory", () => {
  it("новые первыми", () => {
    expect(pushHistory([entry({ id: "a" })], entry({ id: "b" })).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it(`не больше ${MAX_HISTORY}, старые отбрасываются`, () => {
    let l: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 15; i++) l = pushHistory(l, entry({ id: `e${i}` }));
    expect(l).toHaveLength(MAX_HISTORY);
    expect(l[0].id).toBe(`e${MAX_HISTORY + 14}`);
    expect(l.some((e) => e.id === "e0")).toBe(false);
  });

  it("запись с тем же id заменяется и становится первой", () => {
    const l = pushHistory([entry({ id: "a", correct: 1 }), entry({ id: "b" })], entry({ id: "b", correct: 9 }));
    expect(l.map((e) => e.id)).toEqual(["b", "a"]);
    expect(l[0].correct).toBe(9);
  });
});

describe("markFixed / openWrong", () => {
  it("помечает во всех записях, где есть такая ошибка", () => {
    const list = [entry({ id: "a", wrong: [wrongItem("x"), wrongItem("y")] }), entry({ id: "b", wrong: [wrongItem("x")] }), entry({ id: "c", wrong: [wrongItem("z")] })];
    const r = markFixed(list, ["x"]);
    expect(r[0].fixed).toEqual(["x"]);
    expect(r[1].fixed).toEqual(["x"]);
    expect(r[2]).toBe(list[2]);
    expect(openWrong(r[0]).map((w) => w.stepId)).toEqual(["y"]);
    expect(openWrong(r[1])).toEqual([]);
  });

  it("не дублирует и не мутирует исходник", () => {
    const list = [entry({ wrong: [wrongItem("x")] })];
    const r1 = markFixed(list, ["x"]);
    const r2 = markFixed(r1, ["x"]);
    expect(r2).toBe(r1);
    expect(list[0].fixed).toEqual([]);
  });

  it("нет изменений — та же ссылка", () => {
    const list = [entry({ wrong: [wrongItem("x")] })];
    expect(markFixed(list, [])).toBe(list);
    expect(markFixed(list, ["nope"])).toBe(list);
  });

  it("несколько id за раз", () => {
    const r = markFixed([entry({ wrong: [wrongItem("x"), wrongItem("y"), wrongItem("z")] })], ["x", "z", "unknown"]);
    expect(r[0].fixed).toEqual(["x", "z"]);
  });

  it("openWrong: все ошибки, если ничего не исправлено", () => {
    expect(openWrong(entry({ wrong: [wrongItem("a"), wrongItem("b")] }))).toHaveLength(2);
  });
});

describe("entryScore", () => {
  it("урок — доля верных", () => {
    expect(entryScore(entry({ correct: 3, total: 4 }))).toBe(0.75);
    expect(entryScore(entry({ correct: 0, total: 0 }))).toBe(0);
  });

  it("пробный ЕНТ — по баллам", () => {
    expect(entryScore(entry({ kind: "exam", correct: 1, total: 40, points: 32, maxPoints: 50 }))).toBeCloseTo(0.64);
    expect(entryScore(entry({ kind: "exam", points: undefined, maxPoints: 50 }))).toBe(0);
  });

  it("результат зажат в 0..1", () => {
    expect(entryScore(entry({ points: 80, maxPoints: 50 }))).toBe(1);
    expect(entryScore(entry({ points: -5, maxPoints: 50 }))).toBe(0);
  });

  it("maxPoints = 0 — считаем по верным ответам", () => {
    expect(entryScore(entry({ points: 0, maxPoints: 0, correct: 1, total: 2 }))).toBe(0.5);
  });
});

describe("historyTotals", () => {
  it("пусто", () => {
    expect(historyTotals([])).toEqual({ tests: 0, avgScore: 0, openMistakes: 0 });
  });

  it("средний результат и ошибки без повторов одного задания", () => {
    const list = [
      entry({ id: "a", correct: 4, total: 4, wrong: [] }),
      entry({ id: "b", correct: 2, total: 4, wrong: [wrongItem("x"), wrongItem("y")] }),
      entry({ id: "c", kind: "exam", points: 25, maxPoints: 50, wrong: [wrongItem("x")] }),
    ];
    const t = historyTotals(list);
    expect(t.tests).toBe(3);
    expect(t.avgScore).toBeCloseTo((1 + 0.5 + 0.5) / 3);
    expect(t.openMistakes).toBe(2);
  });

  it("исправленные не считаются", () => {
    const list = [entry({ wrong: [wrongItem("x"), wrongItem("y")], fixed: ["x"] })];
    expect(historyTotals(list).openMistakes).toBe(1);
  });

  it("ошибка, исправленная в одной записи, но открытая в другой, остаётся открытой", () => {
    const list = [entry({ id: "a", wrong: [wrongItem("x")], fixed: ["x"] }), entry({ id: "b", wrong: [wrongItem("x")] })];
    expect(historyTotals(list).openMistakes).toBe(1);
  });
});

describe("filterHistory", () => {
  const list = [
    entry({ id: "l", kind: "lesson" }),
    entry({ id: "c", kind: "check" }),
    entry({ id: "d", kind: "drill", wrong: [wrongItem("x")] }),
    entry({ id: "x", kind: "exam", wrong: [wrongItem("y")], fixed: ["y"] }),
  ];
  const ids = (f: Parameters<typeof filterHistory>[1]) => filterHistory(list, f).map((e) => e.id);

  it("all — без изменений", () => expect(filterHistory(list, "all")).toBe(list));
  it("lessons — уроки и проверки себя", () => expect(ids("lessons")).toEqual(["l", "c"]));
  it("drills", () => expect(ids("drills")).toEqual(["d"]));
  it("exams", () => expect(ids("exams")).toEqual(["x"]));
  it("open — только с неисправленными ошибками", () => expect(ids("open")).toEqual(["d"]));
});

describe("sanitizeHistory", () => {
  it("не массив — пусто", () => {
    for (const g of [null, undefined, 5, "x", {}, true]) expect(sanitizeHistory(g)).toEqual([]);
  });

  it("мусорные записи пропускаются", () => {
    const r = sanitizeHistory([null, 5, "x", [], {}, { id: 1, kind: "lesson" }, { id: "a", kind: "bogus" }, { id: "ok", kind: "drill" }]);
    expect(r.map((e) => e.id)).toEqual(["ok"]);
  });

  it("поля нормализуются", () => {
    const [e] = sanitizeHistory([{ id: "a", kind: "exam", at: "x", correct: NaN, total: 5, title: 7, points: "9", maxPoints: 50, wrong: "no", fixed: [1, "k", null] }]);
    expect(e).toMatchObject({ id: "a", kind: "exam", at: 0, correct: 0, total: 5, title: "", durationSec: 0, xp: 0, wrong: [], fixed: ["k"], maxPoints: 50 });
    expect(e.points).toBeUndefined();
    expect(e.mode).toBeUndefined();
  });

  it("ошибки: без stepId отбрасываются, тексты обрезаются, лимит", () => {
    const wrong = [{ prompt: "no id" }, null, 7, { stepId: "s", prompt: "я".repeat(900), given: 5, expected: "e", lessonId: 3, skill: "k" }];
    for (let i = 0; i < 40; i++) wrong.push({ stepId: `w${i}` } as never);
    const [e] = sanitizeHistory([{ id: "a", kind: "lesson", wrong }]);
    expect(e.wrong).toHaveLength(MAX_WRONG_PER_ENTRY);
    expect(e.wrong[0].stepId).toBe("s");
    expect(e.wrong[0].prompt).toHaveLength(400);
    expect(e.wrong[0].given).toBe("");
    expect(e.wrong[0].lessonId).toBeUndefined();
    expect(e.wrong[0].skill).toBe("k");
  });

  it(`не больше ${MAX_HISTORY} записей`, () => {
    const raw = Array.from({ length: MAX_HISTORY + 30 }, (_, i) => ({ id: `e${i}`, kind: "lesson" }));
    expect(sanitizeHistory(raw)).toHaveLength(MAX_HISTORY);
  });

  it("корректная запись проходит без изменений", () => {
    const good = entry({ id: "g", kind: "drill", mode: "smart", lessonId: "L", examId: undefined, wrong: [{ stepId: "s", lessonId: "L", skill: "k", prompt: "p", given: "g", expected: "e" }], fixed: ["s"] });
    expect(sanitizeHistory([good])).toEqual([good]);
  });
});
