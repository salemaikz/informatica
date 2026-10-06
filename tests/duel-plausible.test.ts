import { describe, expect, it } from "vitest";
import { buildDeck, correctAnswer, optionCount } from "@/lib/duel/deck";
import { MIN_MS } from "@/lib/duel/modes";
import { cheatFlagCount, eventsOf, judgeAnswers } from "@/lib/duel/plausible";
import type { AnswerIn, DuelItem } from "@/lib/duel/types";

const blitz = buildDeck("blitz", 2024, 2);
const ten = buildDeck("ten", 2024, 2);
const truth = buildDeck("truth", 2024, 2);

const right = (d: DuelItem[], i: number) => correctAnswer(d[i]);
const wrong = (d: DuelItem[], i: number) => {
  const c = correctAnswer(d[i]);
  return typeof c === "boolean" ? !c : (c + 1) % optionCount(d[i]);
};

describe("judgeAnswers: верность и порядок", () => {
  it("сервер сам выставляет «верно» и очки; t — накопленное время с паузой после ошибки", () => {
    const answers: AnswerIn[] = [
      { i: 0, a: right(blitz, 0), ms: 3000 },
      { i: 1, a: wrong(blitz, 1), ms: 4000 },
      { i: 2, a: right(blitz, 2), ms: 2000 },
    ];
    const r = judgeAnswers("blitz", blitz, answers, 20_000);
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => [a.ok, a.pts, a.t])).toEqual([
      [true, 2, 3000],
      [false, -1, 7000],
      [true, 2, 10_500], // 7000 + пауза 1500 + 2000
    ]);
    expect(eventsOf(r.accepted)).toEqual([
      { i: 0, ok: true, t: 3000 },
      { i: 1, ok: false, t: 7000 },
      { i: 2, ok: true, t: 10_500 },
    ]);
    expect(r.cheatFlags).toBe(0);
  });

  it("дубль и пропуск вперёд отбрасываются; продолжение с уже принятых (prior)", () => {
    const first = judgeAnswers("ten", ten, [{ i: 0, a: right(ten, 0), ms: 5000 }], 6000);
    const r = judgeAnswers(
      "ten",
      ten,
      [
        { i: 0, a: wrong(ten, 0), ms: 5000 }, // дубль — не перезаписывает
        { i: 2, a: right(ten, 2), ms: 5000 }, // пропуск
        { i: 1, a: right(ten, 1), ms: 5000 },
      ],
      12_000,
      first.accepted,
    );
    expect(r.rejected).toEqual([
      { i: 0, reason: "dup" },
      { i: 2, reason: "order" },
    ]);
    expect(r.accepted.map((a) => [a.i, a.ok, a.t])).toEqual([[1, true, 10_000]]);
  });

  it("мусор: индекс вне набора, отрицательное или нечисловое время", () => {
    const r = judgeAnswers(
      "ten",
      ten,
      [
        { i: 99, a: 0, ms: 1000 },
        { i: 0, a: 0, ms: -5 },
        { i: 0, a: 0, ms: Number.NaN },
        { i: 1.5, a: 0, ms: 1000 },
      ] as AnswerIn[],
      10_000,
    );
    expect(r.accepted).toEqual([]);
    expect(r.rejected.every((x) => x.reason === "range")).toBe(true);
  });
});

describe("judgeAnswers: время", () => {
  it("быстрее MIN_MS — неверно и флаг fast, даже если ответ верный", () => {
    const r = judgeAnswers("blitz", blitz, [{ i: 0, a: right(blitz, 0), ms: MIN_MS.choice - 1 }], 5000);
    expect(r.accepted[0]).toMatchObject({ ok: false, pts: -1, flags: ["fast"] });
    expect(r.cheatFlags).toBe(1);
    const ok = judgeAnswers("truth", truth, [{ i: 0, a: right(truth, 0), ms: MIN_MS.statement }], 5000);
    expect(ok.accepted[0]).toMatchObject({ ok: true, flags: [] });
  });

  it("сумма времени клиента больше прошедшего по серверу + 1,5 с — флаг sum", () => {
    // Скрипт ответил на 5 заданий сразу после старта, а заявил по 800 мс: правдоподобны только первые 1,5 с.
    const answers = [0, 1, 2, 3, 4].map((i) => ({ i, a: right(blitz, i), ms: 800 }));
    const r = judgeAnswers("blitz", blitz, answers, 0);
    expect(r.accepted.map((a) => a.flags.includes("sum"))).toEqual([false, true, true, true, true]);
    expect(r.accepted.filter((a) => a.ok).length).toBe(1);
    expect(cheatFlagCount(r.accepted)).toBe(4);
    // Честно: прошло достаточно времени.
    expect(judgeAnswers("blitz", blitz, answers, 4000).cheatFlags).toBe(0);
  });

  it("пауза после ошибки входит в сумму: пропустить её нельзя", () => {
    const answers: AnswerIn[] = [
      { i: 0, a: wrong(blitz, 0), ms: 1000 },
      { i: 1, a: right(blitz, 1), ms: 1000 },
    ];
    // По серверу прошло 2 с, а с паузой нужно 3,5 с (+1,5 с допуска = 3,5) — ещё правдоподобно.
    expect(judgeAnswers("blitz", blitz, answers, 2000).accepted[1].flags).toEqual([]);
    // Прошла 1 с — слишком быстро.
    expect(judgeAnswers("blitz", blitz, answers, 1000).accepted[1].flags).toContain("sum");
  });

  it("блиц: ответ после общих часов не засчитывается", () => {
    const answers = Array.from({ length: 21 }, (_, i) => ({ i, a: right(blitz, i), ms: 3000 }));
    const r = judgeAnswers("blitz", blitz, answers, 62_000);
    expect(r.accepted.length).toBe(20); // 20 × 3 с = 60 с
    expect(r.rejected).toEqual([{ i: 20, reason: "late" }]);
  });

  it("пришло после конца матча + 3 с — отбрасывается целиком", () => {
    const r = judgeAnswers("blitz", blitz, [{ i: 0, a: right(blitz, 0), ms: 3000 }], 63_001);
    expect(r.accepted).toEqual([]);
    expect(r.rejected).toEqual([{ i: 0, reason: "late" }]);
  });

  it("«10 вопросов»: дольше лимита задания — тайм-аут (неверно, флаг late), время по лимиту", () => {
    const lim = ten[0].limitMs!;
    const r = judgeAnswers("ten", ten, [{ i: 0, a: right(ten, 0), ms: lim + 5000 }], lim + 6000);
    expect(r.accepted[0]).toMatchObject({ ok: false, pts: 0, ms: lim, t: lim, flags: ["late"] });
    expect(r.cheatFlags).toBe(0);
    // Тайм-аут без выбора (−1).
    expect(judgeAnswers("ten", ten, [{ i: 0, a: -1, ms: lim }], lim + 100).accepted[0].ok).toBe(false);
  });
});
