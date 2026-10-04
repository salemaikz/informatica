import { describe, expect, it } from "vitest";
import {
  BIG,
  FULL_BONUS,
  LINE_BONUS,
  MAX_ANSWER_LEN,
  SMALL,
  applyAnswer,
  buildCard,
  cellAnswer,
  isAmbiguousPrompt,
  collectCells,
  completedLines,
  currentCell,
  initialState,
  isDone,
  linesOf,
  resolveSkills,
  taskBudgetMs,
  toResult,
  type BingoCard,
} from "@/games/bingo/logic";
import { plainText } from "@/lib/text";
import type { ChoiceStep } from "@/lib/types";

const choice = (correctText: string): ChoiceStep => ({
  id: "t:x:1:1",
  type: "choice",
  prompt: { ru: "q", kk: "q" },
  options: [correctText, "z"],
  correct: 0,
  explanation: { ru: "e", kk: "e" },
});

const SKILLS = resolveSkills(["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props", "ns.oct", "ns.hex"]);

function fakeCard(size: number): BingoCard {
  return {
    size,
    cells: Array.from({ length: size * size }, (_, i) => ({ answer: String(i), step: choice(String(i)), skill: "ns.base", level: 1 as const })),
  };
}

describe("бинго: клетки", () => {
  it("длинные и пустые ответы не годятся, markdown очищается", () => {
    expect(cellAnswer(choice("1011"), "ru")).toBe("1011");
    expect(cellAnswer(choice("`1011`"), "ru")).toBe("1011");
    expect(cellAnswer(choice("x".repeat(MAX_ANSWER_LEN + 1)), "ru")).toBeNull();
    expect(cellAnswer(choice("x".repeat(MAX_ANSWER_LEN)), "ru")).not.toBeNull();
    expect(cellAnswer(choice("  "), "ru")).toBeNull();
  });
  it("не choice-задание не годится", () => {
    expect(cellAnswer({ ...choice("1"), type: "input" } as never, "ru")).toBeNull();
  });
});

describe("бинго: неоднозначные вопросы", () => {
  const p = (ru: string, kk: string): ChoiceStep => ({ ...choice("1"), prompt: { ru, kk } });
  it("«НЕ …», «лишнее» отсеиваются", () => {
    expect(isAmbiguousPrompt(p("Какая запись НЕ может быть числом?", "Қай жазба сан бола алмайды"))).toBe(true);
    expect(isAmbiguousPrompt(p("Какое слово лишнее?", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("Q", "Қайсысы екілік жүйе емес?"))).toBe(true);
    expect(isAmbiguousPrompt(p("Чему равно 101₂?", "101₂ неге тең?"))).toBe(false);
  });
  it("вопросы-выбор «какое из …», «подходит», «остальные скрыты» отсеиваются", () => {
    expect(isAmbiguousPrompt(p("Какое из чисел наибольшее?", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("A = 0, B = 1. Какое из выражений ложно?", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("Что из перечисленного — примитив?", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("Какое имя файла подходит под маску ?.doc", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("В таблице три строки (остальные скрыты). Какое выражение?", "x"))).toBe(true);
    expect(isAmbiguousPrompt(p("Q", "Төмендегілердің қайсысы — примитив?"))).toBe(true);
    // «әрқайсысы» («каждый») — не вопрос-выбор
    expect(isAmbiguousPrompt(p("Сколько нужно кабелей?", "Әрқайсысы әрқайсысымен жалғанған. Неше кабель қажет?"))).toBe(false);
    expect(isAmbiguousPrompt(p("Для какого набора значений (A, B) выражение A → B ложно?", "x"))).toBe(false);
  });
  it("в карточке таких вопросов нет", () => {
    const card = buildCard(SKILLS, "ru", 9)!;
    for (const c of card.cells) expect(isAmbiguousPrompt(c.step)).toBe(false);
  });
});

describe("бинго: сборка карточки", () => {
  it("детерминирована по seed", () => {
    const a = buildCard(SKILLS, "ru", 42);
    const b = buildCard(SKILLS, "ru", 42);
    expect(a?.cells.map((c) => c.answer)).toEqual(b?.cells.map((c) => c.answer));
  });
  it("ответы разные и короткие, у каждой клетки свой вопрос", () => {
    for (const lang of ["ru", "kk"] as const) {
      const card = buildCard(SKILLS, lang, 7);
      expect(card).not.toBeNull();
      const answers = card!.cells.map((c) => c.answer.toLowerCase());
      expect(new Set(answers).size).toBe(answers.length);
      expect(card!.cells.length).toBe(card!.size * card!.size);
      for (const c of card!.cells) {
        expect(c.answer.length).toBeLessThanOrEqual(MAX_ANSWER_LEN);
        expect(c.answer).toBe(plainText(c.answer));
      }
      const ids = card!.cells.map((c) => c.step.id.split("#")[0]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("клетка = верный ответ своего вопроса", () => {
    const card = buildCard(SKILLS, "ru", 3)!;
    for (const c of card.cells) expect(cellAnswer(c.step, "ru")).toBe(c.answer);
  });
  it("размер карточки: 4 × 4 или 3 × 3", () => {
    expect([BIG, SMALL]).toContain(buildCard(SKILLS, "ru", 11)!.size);
  });
  it("нет навыков с вопросами — нет карточки", () => {
    expect(buildCard([], "ru", 1)).toBeNull();
    expect(buildCard(["no.such"], "ru", 1)).toBeNull();
    expect(collectCells([], "ru", 1)).toEqual([]);
  });
  it("мало ответов — меньше клеток, чем нужно для 3 × 3, даёт null (узкий навык с короткими ответами)", () => {
    const card = buildCard(resolveSkills(["ns.props"]), "ru", 5);
    if (card) expect(card.cells.length).toBeGreaterThanOrEqual(SMALL * SMALL);
    else expect(card).toBeNull();
  });
  it("9…15 пригодных ответов — карточка 3 × 3; меньше 9 — null", () => {
    // ns.bin2dec даёт 9–15 разных коротких ответов, it.trends — меньше 9 (проверено на seed 11: после переезда вида «включи биты»
    // в ns.dec2bin у ns.bin2dec больше заданий с выбором, и на seed 7 карточка уже 4 × 4).
    expect(collectCells(["ns.bin2dec"], "ru", 11).length).toBeGreaterThanOrEqual(SMALL * SMALL);
    expect(collectCells(["ns.bin2dec"], "ru", 11).length).toBeLessThan(BIG * BIG);
    const small = buildCard(["ns.bin2dec"], "ru", 11)!;
    expect(small.size).toBe(SMALL);
    expect(small.cells).toHaveLength(SMALL * SMALL);
    expect(collectCells(["it.trends"], "ru", 7).length).toBeLessThan(SMALL * SMALL);
    expect(buildCard(["it.trends"], "ru", 7)).toBeNull();
  });
  it("одинаковые условия без сцены не повторяются на одной карточке", () => {
    for (const seed of [1, 2, 3]) {
      const cells = collectCells(SKILLS, "ru", seed).filter((c) => !c.step.scene);
      const prompts = cells.map((c) => plainText(c.step.prompt.ru).toLowerCase());
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });
});

describe("бинго: линии", () => {
  it("4 × 4: 4 строки + 4 столбца + 2 диагонали", () => {
    const l = linesOf(4);
    expect(l).toHaveLength(10);
    expect(l[0]).toEqual([0, 1, 2, 3]);
    expect(l[4]).toEqual([0, 4, 8, 12]);
    expect(l[8]).toEqual([0, 5, 10, 15]);
    expect(l[9]).toEqual([3, 6, 9, 12]);
  });
  it("3 × 3: 8 линий", () => {
    expect(linesOf(3)).toHaveLength(8);
  });
  it("completedLines находит заполненные", () => {
    const m = Array(9).fill(false);
    [0, 4, 8].forEach((i) => (m[i] = true));
    expect(completedLines(m, 3)).toEqual([6]);
    [1, 2].forEach((i) => (m[i] = true));
    expect(completedLines(m, 3)).toEqual([0, 6]);
  });
});

describe("бинго: очки и ход игры", () => {
  it("очередь — перестановка всех клеток", () => {
    const st = initialState(fakeCard(3), 1);
    expect([...st.queue].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("верный ответ отмечает клетку и даёт 10 очков", () => {
    const st = initialState(fakeCard(3), 1);
    const cur = currentCell(st)!;
    const out = applyAnswer(st, cur);
    expect(out.correct).toBe(true);
    expect(out.state.marked[cur]).toBe(true);
    expect(out.gained).toBe(10);
    expect(out.state.pos).toBe(1);
  });
  it("неверный: клетка не отмечена, вопрос потрачен, очков нет", () => {
    const st = initialState(fakeCard(3), 1);
    const cur = currentCell(st)!;
    const other = (cur + 1) % 9;
    const out = applyAnswer(st, other);
    expect(out.correct).toBe(false);
    expect(out.state.marked.some(Boolean)).toBe(false);
    expect(out.state.missed[cur]).toBe(true);
    expect(out.gained).toBe(0);
    expect(out.state.total).toBe(1);
    expect(applyAnswer(st, null).correct).toBe(false);
  });
  it("все верно: все линии и бонус за карточку, игра закончена", () => {
    let st = initialState(fakeCard(3), 2);
    let bonus = 0;
    let full = false;
    while (!isDone(st)) {
      const out = applyAnswer(st, currentCell(st));
      bonus += out.bonus;
      full = out.full;
      st = out.state;
    }
    expect(full).toBe(true);
    expect(st.lines).toHaveLength(8);
    expect(bonus).toBe(8 * LINE_BONUS + FULL_BONUS);
    expect(st.score).toBe(9 * 10 + bonus);
    expect(toResult(st)).toMatchObject({ correct: 9, total: 9 });
    expect(st.attempts).toHaveLength(9);
  });
  it("после конца ответы игнорируются", () => {
    let st = initialState(fakeCard(3), 2);
    while (!isDone(st)) st = applyAnswer(st, currentCell(st)).state;
    const out = applyAnswer(st, 0);
    expect(out.state).toBe(st);
    expect(currentCell(st)).toBeNull();
  });
  it("время на вопрос — только в обычном темпе", () => {
    expect(taskBudgetMs("normal", 1)).toBe(30_000);
    expect(taskBudgetMs("calm", 1)).toBeNull();
    expect(taskBudgetMs("blitz", 3)).toBeNull();
  });
});
