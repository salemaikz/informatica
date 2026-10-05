import { describe, expect, it } from "vitest";
import {
  breakdownOf,
  eventMode,
  eventVia,
  examFinishEvent,
  finishEvent,
  gameFinishEvent,
  playerHeartsWhere,
  quitEvent,
  sessionTotals,
  skipRecord,
  startEvent,
  taskEvent,
} from "@/lib/player-events";
import type { AnswerRecord } from "@/lib/types";

// Помощники плеера (этап 12, P4): запись-пропуск, честные итоги, события статистики.

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({ stepId: "q-1", correct: true, score: 1, given: "1", expected: "1", prompt: "?", retry: false, timeMs: 1000, ...o });
const STABLE = new Set(["q-1", "q-2", "q-3"]);

describe("skipRecord", () => {
  it("пропуск — предъявленное задание со счётом 0: skipped, не верно, не повтор", () => {
    const r = skipRecord({ stepId: "q-sol", skill: "ns.dec2bin", expected: "101101", prompt: "Переведи 45", timeMs: 4321.7 });
    expect(r).toEqual({
      stepId: "q-sol",
      skill: "ns.dec2bin",
      correct: false,
      score: 0,
      given: "",
      expected: "101101",
      prompt: "Переведи 45",
      retry: false,
      timeMs: 4322,
      skipped: true,
    });
  });
  it("без навыка поля skill нет; время приводится к целому ≥ 0", () => {
    const r = skipRecord({ stepId: "q", expected: "", prompt: "", timeMs: -5 });
    expect("skill" in r).toBe(false);
    expect(r.timeMs).toBe(0);
    expect(skipRecord({ stepId: "q", expected: "", prompt: "", timeMs: Number.NaN }).timeMs).toBe(0);
  });
});

describe("sessionTotals", () => {
  it("пропуск снижает точность и входит в «предъявлено»", () => {
    const t = sessionTotals([rec(), rec({ stepId: "q-2" }), skipRecord({ stepId: "q-3", expected: "", prompt: "", timeMs: 1 })], 1);
    expect(t).toMatchObject({ asked: 3, hinted: 0, skipped: 1 });
    expect(t.accuracy).toBeCloseTo(2 / 3);
  });
  it("с подсказкой считается отдельно и в точность входит, повтор ошибки — нет", () => {
    const t = sessionTotals([rec({ hinted: true }), rec({ stepId: "q-2", correct: false, score: 0 }), rec({ stepId: "q-2", retry: true })]);
    expect(t).toMatchObject({ asked: 2, hinted: 1, skipped: 0 });
    expect(t.accuracy).toBeCloseTo(0.5);
  });
  it("частичный балл — как есть", () => {
    expect(sessionTotals([rec({ score: 0.5, correct: false }), rec({ stepId: "q-2" })]).accuracy).toBeCloseTo(0.75);
  });
  it("заданий не было — точность 1 (как раньше), предъявлено 0", () => {
    expect(sessionTotals([])).toEqual({ accuracy: 1, asked: 0, hinted: 0, skipped: 0 });
  });
  it("счётчик пропусков плеера (старое сохранение без записи пропуска) не теряется: пропуски — предъявленные задания со счётом 0 (C16)", () => {
    const t = sessionTotals([rec()], 2);
    expect(t).toMatchObject({ asked: 3, skipped: 2 });
    expect(t.accuracy).toBeCloseTo(1 / 3);
  });
  it("C16: 4 верных и один пропуск из старого сохранения (записи нет): точность 0,8, предъявлено 5 — а не «100%»", () => {
    const four = [rec(), rec({ stepId: "q-2" }), rec({ stepId: "q-3" }), rec({ stepId: "q-4" })];
    expect(sessionTotals(four, 1)).toEqual({ accuracy: 0.8, asked: 5, hinted: 0, skipped: 1 });
    // «сам» в разбивке итога: 4 из 5, пропущено 1
    const totals = sessionTotals(four, 1);
    expect(breakdownOf({ answers: four, ...totals })).toEqual({ asked: 5, self: 4, hinted: 0, skipped: 1 });
  });
  it("C16: пропуск есть и в записях, и в счётчике — считается один раз", () => {
    const sk = skipRecord({ stepId: "q-3", expected: "", prompt: "", timeMs: 1 });
    expect(sessionTotals([rec(), sk], 1)).toMatchObject({ asked: 2, skipped: 1 });
    // Счётчик меньше записей (записей больше) — берутся записи
    expect(sessionTotals([rec(), sk], 0)).toMatchObject({ asked: 2, skipped: 1 });
  });
});

describe("breakdownOf", () => {
  it("сам + с подсказкой + пропущено = предъявлено", () => {
    const answers = [rec(), rec({ stepId: "q-2", hinted: true }), skipRecord({ stepId: "q-3", expected: "", prompt: "", timeMs: 0 })];
    expect(breakdownOf({ answers, ...sessionTotals(answers, 1) })).toEqual({ asked: 3, self: 1, hinted: 1, skipped: 1 });
  });
  it("итог без новых полей (сохранён до этой версии) считается по ответам", () => {
    const answers = [rec(), rec({ stepId: "q-2", hinted: true })];
    expect(breakdownOf({ answers })).toEqual({ asked: 2, self: 1, hinted: 1, skipped: 0 });
  });
  it("не уходит в минус", () => {
    expect(breakdownOf({ answers: [], asked: 1, hinted: 1, skipped: 2 }).self).toBe(0);
  });
});

describe("режимы для событий", () => {
  it("«Проверить себя» — check, остальное — learn", () => {
    expect(eventVia("check")).toBe("check");
    expect(eventVia("learn")).toBe("learn");
    expect(eventVia(undefined)).toBe("learn");
    expect(eventVia("extern")).toBe("learn");
  });
  it("режим тренировки по умолчанию — smart; мусор отбрасывается", () => {
    expect(eventMode(undefined)).toBe("smart");
    expect(eventMode("extern")).toBe("extern");
    expect(eventMode("a b")).toBe("smart");
    expect(eventMode("x".repeat(81))).toBe("smart");
  });
});

describe("startEvent", () => {
  it("урок: resume 0 / 1 и via", () => {
    expect(startEvent({ kind: "lesson", lessonId: "ns-1-bits", resumed: false })).toEqual({ e: "lesson_start", lesson: "ns-1-bits", via: "learn", resume: 0 });
    expect(startEvent({ kind: "lesson", lessonId: "ns-1-bits", via: "check", resumed: true })).toEqual({ e: "lesson_start", lesson: "ns-1-bits", via: "check", resume: 1 });
  });
  it("тренировка и экстерн — drill_start, без lesson_*", () => {
    expect(startEvent({ kind: "drill", mode: "mistakes", resumed: false })).toEqual({ e: "drill_start", mode: "mistakes" });
    expect(startEvent({ kind: "drill", mode: "extern", resumed: false })).toEqual({ e: "drill_start", mode: "extern" });
    expect(startEvent({ kind: "drill", resumed: false })).toEqual({ e: "drill_start", mode: "smart" });
  });
  it("у урока без id события нет", () => {
    expect(startEvent({ kind: "lesson", resumed: false })).toBeNull();
    expect(startEvent({ kind: "lesson", lessonId: "плохой id", resumed: false })).toBeNull();
  });
});

describe("finishEvent", () => {
  it("урок: точность в целых процентах и активные секунды", () => {
    expect(finishEvent({ kind: "lesson", lessonId: "ns-1-bits", accuracy: 2 / 3, durationSec: 95 })).toEqual({ e: "lesson_finish", lesson: "ns-1-bits", via: "learn", acc: 67, sec: 95 });
    expect(finishEvent({ kind: "lesson", lessonId: "l", via: "check", accuracy: 1, durationSec: 5 })).toMatchObject({ via: "check", acc: 100 });
  });
  it("секунды в пределах схемы (≤ 7200), точность 0–100", () => {
    expect(finishEvent({ kind: "lesson", lessonId: "l", accuracy: 5, durationSec: 99_999 })).toMatchObject({ acc: 100, sec: 7200 });
    expect(finishEvent({ kind: "lesson", lessonId: "l", accuracy: -1, durationSec: -3 })).toMatchObject({ acc: 0, sec: 0 });
  });
  it("тренировка и экстерн — drill_finish", () => {
    expect(finishEvent({ kind: "drill", mode: "extern", accuracy: 0.856, durationSec: 100 })).toEqual({ e: "drill_finish", mode: "extern", acc: 86 });
    expect(finishEvent({ kind: "drill", accuracy: 1, durationSec: 1 })).toEqual({ e: "drill_finish", mode: "smart", acc: 100 });
  });
});

describe("quitEvent", () => {
  it("выход из урока: пройдено шагов из всех", () => {
    expect(quitEvent({ kind: "lesson", lessonId: "ns-1-bits", done: 7, total: 17 })).toEqual({ e: "lesson_quit", lesson: "ns-1-bits", via: "learn", step: 7, of: 17 });
    expect(quitEvent({ kind: "lesson", lessonId: "l", via: "check", done: 2, total: 9 })).toMatchObject({ via: "check", step: 2, of: 9 });
  });
  it("у тренировки выхода нет; числа в пределах схемы", () => {
    expect(quitEvent({ kind: "drill", mode: "smart", done: 3, total: 10 })).toBeNull();
    expect(quitEvent({ kind: "lesson", lessonId: "l", done: 999, total: 999 })).toMatchObject({ step: 200, of: 200 });
    expect(quitEvent({ kind: "lesson", lessonId: "l", done: -4, total: Number.NaN })).toMatchObject({ step: 0, of: 0 });
  });
});

describe("taskEvent", () => {
  const L = "ns-1-bits";
  it("верно самому — ok 1; ключ задания — `<урок>:<шаг>` (C9)", () => {
    expect(taskEvent(rec(), STABLE, L)).toEqual({ e: "task", step: `${L}:q-1`, ok: 1, skip: 0, hint: 0 });
  });
  it("C9: одинаковые id шагов в разных уроках дают разные ключи — их статистика не сливается", () => {
    const a = taskEvent(rec({ stepId: "q-1" }), STABLE, "base-5-cpu") as { step: string };
    const b = taskEvent(rec({ stepId: "q-1" }), STABLE, "pc-2-cpu") as { step: string };
    expect(a.step).toBe("base-5-cpu:q-1");
    expect(b.step).toBe("pc-2-cpu:q-1");
    expect(a.step).not.toBe(b.step);
  });
  it("неверно и частичный балл — ok 0", () => {
    expect(taskEvent(rec({ correct: false, score: 0 }), STABLE, L)).toMatchObject({ ok: 0, skip: 0 });
    expect(taskEvent(rec({ correct: false, score: 0.5 }), STABLE, L)).toMatchObject({ ok: 0 });
  });
  it("с подсказкой — hint 1, пропуск — skip 1 и ok 0", () => {
    expect(taskEvent(rec({ hinted: true }), STABLE, L)).toMatchObject({ ok: 1, hint: 1 });
    const skip = skipRecord({ stepId: "q-2", expected: "", prompt: "", timeMs: 0 });
    expect(taskEvent(skip, STABLE, L)).toEqual({ e: "task", step: `${L}:q-2`, ok: 0, skip: 1, hint: 0 });
  });
  it("повтор ошибки — не событие", () => {
    expect(taskEvent(rec({ retry: true }), STABLE, L)).toBeNull();
  });
  it("не шаг урока (тренировка, банк), урок неизвестен или id урока не передан — события нет", () => {
    expect(taskEvent(rec({ stepId: "g:ns.bin2dec:easy:5:77" }), STABLE, L)).toBeNull();
    expect(taskEvent(rec(), null, L)).toBeNull();
    expect(taskEvent(rec(), STABLE)).toBeNull();
    expect(taskEvent(rec(), STABLE, "")).toBeNull();
  });
  it("id вне белого списка сервера — события нет (в том числе слишком длинный составной и «отравленный»)", () => {
    expect(taskEvent(rec({ stepId: "q 1#2" }), new Set(["q 1#2"]), L)).toBeNull();
    expect(taskEvent(rec({ stepId: "s".repeat(78) }), new Set(["s".repeat(78)]), L)).toBeNull();
    expect(taskEvent(rec(), STABLE, "constructor")).toBeNull();
  });
});

describe("playerHeartsWhere", () => {
  it("урок, проверка, экстерн", () => {
    expect(playerHeartsWhere({})).toBe("lesson");
    expect(playerHeartsWhere({ via: "check" })).toBe("check");
    expect(playerHeartsWhere({ mode: "extern" })).toBe("extern");
    expect(playerHeartsWhere({ via: "check", mode: "extern" })).toBe("extern");
  });
});

describe("игры и пробник", () => {
  it("игра: доля верных в процентах, без раундов — 0", () => {
    expect(gameFinishEvent("bit-rush", 4, 5)).toEqual({ e: "game_finish", game: "bit-rush", acc: 80 });
    expect(gameFinishEvent("bit-rush", 0, 0)).toEqual({ e: "game_finish", game: "bit-rush", acc: 0 });
    expect(gameFinishEvent("плохой id", 1, 1)).toBeNull();
  });
  it("пробник: баллы от максимума", () => {
    expect(examFinishEvent("full", 35, 50)).toEqual({ e: "exam_finish", kind: "full", pct: 70 });
    expect(examFinishEvent("unit", 0, 0)).toEqual({ e: "exam_finish", kind: "unit", pct: 0 });
    expect(examFinishEvent("mini", 99, 50).pct).toBe(100);
  });
});
