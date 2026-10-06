import { describe, expect, it } from "vitest";
import { TICK_CAP_MS } from "@/lib/active-time";
import {
  ACTION_MS,
  HELP_MAX_MS,
  HELP_MIN_MS,
  MAX_HELP_OFFERS,
  READ_WORDS_PER_SEC,
  actionMs,
  canOfferHelp,
  expectedStepMs,
  helpAfterMs,
  helpDue,
  helpKindFor,
  helpKindIn,
  helpWindowMs,
  isHeavyToken,
  levelFactor,
  readingMs,
  startHelpClock,
  stepHelpAfterMs,
  textWeight,
  tickHelpClock,
} from "@/lib/help-timer";
import { LESSONS } from "@/content/lessons/all";
import type { ChoiceStep, ClozeStep, CodeStep, InputStep, L, OrderStep, SolutionStep, Step, StoryStep, TheoryStep, VideoStep, WorkedStep } from "@/lib/types";

// «Нужна помощь?» по времени чтения (этап 16В, P8): оценка времени шага, порог плашки, правила показа, часы шага.

const same = (s: string): L => ({ ru: s, kk: s });
/** Текст из n обычных слов («слово слово …»). */
const words = (n: number): string => Array.from({ length: n }, () => "слово").join(" ");

const choice = (promptWords: number, options: string[], level?: 1 | 2 | 3): ChoiceStep => ({
  id: "c",
  type: "choice",
  prompt: same(words(promptWords)),
  options,
  correct: 0,
  explanation: same("."),
  level,
});
const theory = (bodyWords: number): TheoryStep => ({ id: "t", type: "theory", title: same("Заголовок"), body: same(words(bodyWords)) });

describe("textWeight: вес текста", () => {
  it("обычные слова весят по одному, разметка не считается", () => {
    expect(textWeight("один два три")).toBe(3);
    expect(textWeight("**один** _два_ `три`")).toBe(3);
    expect(textWeight("")).toBe(0);
  });
  it("числа, формулы и код — вдвое тяжелее", () => {
    expect(isHeavyToken("1011₂")).toBe(true);
    expect(isHeavyToken("2³")).toBe(true);
    expect(isHeavyToken("a=b+1")).toBe(true);
    expect(isHeavyToken("print(x)")).toBe(true);
    expect(isHeavyToken("слово")).toBe(false);
    expect(textWeight("переведи 1011₂ в десятичную")).toBe(1 + 2 + 1 + 1);
  });
});

describe("expectedStepMs: ожидаемое время шага", () => {
  it("выбор: чтение условия и вариантов при 3 словах в секунду + 6 с на выбор", () => {
    const step = choice(12, ["да", "нет", "может", "всегда"]); // 12 + 4 слова
    expect(readingMs(step, "ru")).toBe(Math.round((16 / 3) * 1000));
    expect(actionMs(step)).toBe(6_000);
    expect(expectedStepMs(step, "ru")).toBe(Math.round((16 / 3) * 1000) + 6_000);
  });
  it("казахский читается медленнее: 2,5 слова в секунду", () => {
    const step = choice(10, ["а", "б"]);
    expect(READ_WORDS_PER_SEC.kk).toBeLessThan(READ_WORDS_PER_SEC.ru);
    expect(readingMs(step, "kk")).toBeGreaterThan(readingMs(step, "ru"));
    expect(readingMs(step, "kk")).toBe(Math.round((12 / 2.5) * 1000));
  });
  it("шаг-рассказ — только чтение, действия нет", () => {
    const step = theory(60); // 60 слов + заголовок
    expect(actionMs(step)).toBe(0);
    expect(ACTION_MS.theory).toBe(0);
    expect(expectedStepMs(step, "ru")).toBe(Math.round((61 / 3) * 1000));
  });
  it("действие зависит от вида шага: выбор < ввод < порядок/пары < решение", () => {
    const input: InputStep = { id: "i", type: "input", prompt: same("?"), answers: ["1"], mode: "number", explanation: same(".") };
    const order: OrderStep = { id: "o", type: "order", prompt: same("?"), items: [same("а"), same("б")], explanation: same(".") };
    const solution: SolutionStep = { id: "s", type: "solution", prompt: same("?"), reference: same("."), answer: "1", answerMode: "number", explanation: same(".") };
    expect(actionMs(choice(1, ["a"]))).toBe(6_000);
    expect(actionMs(input)).toBe(12_000);
    expect(actionMs(order)).toBe(15_000);
    expect(actionMs(solution)).toBeGreaterThan(actionMs(order));
  });
  it("«решаем вместе»: время — по числу пропусков, от 10 до 40 с", () => {
    const blank = { blank: ["1"], mode: "number" as const };
    const make = (blanks: number): ClozeStep => ({
      id: "z",
      type: "cloze",
      prompt: same("Заполни"),
      lines: [Array.from({ length: blanks }, () => blank)],
      explanation: same("."),
    });
    expect(actionMs(make(1))).toBe(10_000);
    expect(actionMs(make(4))).toBe(20_000);
    expect(actionMs(make(30))).toBe(40_000);
  });
  it("задача с кодом: условие лежит в практикуме — на чтение закладывается фиксированное время", () => {
    const step: CodeStep = { id: "k", type: "code", task: "py-x", prompt: same("Напиши"), explanation: same(".") };
    expect(readingMs(step, "ru")).toBeGreaterThanOrEqual(20_000);
    expect(expectedStepMs(step, "ru")).toBeGreaterThan(80_000);
  });
  it("код в схеме читается медленнее текста", () => {
    const text = choice(6, ["a"]);
    const withCode: ChoiceStep = { ...text, scene: { kind: "code", lines: ["x = 5", "y = x + 2", "print(y)"] } };
    expect(readingMs(withCode, "ru")).toBeGreaterThan(readingMs(text, "ru") + 2_000);
  });
  it("картинка без текста — короткий взгляд, не нулевое время", () => {
    const text = choice(6, ["a"]);
    const withPicture: ChoiceStep = { ...text, scene: { kind: "lamps", states: "1011" } };
    expect(readingMs(withPicture, "ru")).toBeGreaterThan(readingMs(text, "ru"));
  });
  it("множитель уровня: A ×1, B ×1,3, C ×1,6; уровень шага берётся, если не задан явно", () => {
    expect(levelFactor(undefined)).toBe(1);
    expect(levelFactor(1)).toBe(1);
    expect(levelFactor(2)).toBe(1.3);
    expect(levelFactor(3)).toBe(1.6);
    const base = expectedStepMs(choice(12, ["да", "нет"]), "ru");
    expect(expectedStepMs(choice(12, ["да", "нет"], 2), "ru")).toBe(Math.round(base * 1.3));
    expect(expectedStepMs(choice(12, ["да", "нет"], 1), "ru", 3)).toBe(Math.round(base * 1.6));
  });
  it("порядок: условие и элементы читаются", () => {
    const short: OrderStep = { id: "o", type: "order", prompt: same("Расставь"), items: [same("а"), same("б")], explanation: same(".") };
    const long: OrderStep = { ...short, items: [same(words(10)), same(words(10)), same(words(10))] };
    expect(readingMs(long, "ru")).toBeGreaterThan(readingMs(short, "ru"));
  });
  it("видео: читается только название", () => {
    const step: VideoStep = { id: "v", type: "video", videoId: "x", title: same("Видео про биты") };
    expect(actionMs(step)).toBe(0);
    expect(readingMs(step, "ru")).toBe(Math.round((3 / 3) * 1000));
  });
});

describe("helpAfterMs: порог плашки", () => {
  it("expected × 1,75 в серединке", () => {
    expect(helpAfterMs(40_000)).toBe(70_000);
    expect(helpAfterMs(60_000)).toBe(105_000);
  });
  it("не раньше 20 секунд и не позже 3 минут", () => {
    expect(helpAfterMs(0)).toBe(HELP_MIN_MS);
    expect(helpAfterMs(5_000)).toBe(20_000);
    expect(helpAfterMs(10_000)).toBe(20_000);
    expect(helpAfterMs(500_000)).toBe(HELP_MAX_MS);
    expect(HELP_MIN_MS).toBe(20_000);
    expect(HELP_MAX_MS).toBe(180_000);
  });
  it("растёт вместе с объёмом шага и уровнем", () => {
    const small = stepHelpAfterMs(choice(10, ["да", "нет"]), "ru");
    const big = stepHelpAfterMs(choice(70, ["да", "нет"]), "ru");
    expect(big).toBeGreaterThan(small);
    expect(stepHelpAfterMs(choice(40, ["да", "нет"], 3), "ru")).toBeGreaterThan(stepHelpAfterMs(choice(40, ["да", "нет"], 1), "ru"));
  });
  it("для всех шагов всех уроков порог — конечное число в пределах 20–180 с на обоих языках", () => {
    let n = 0;
    for (const lesson of Object.values(LESSONS)) {
      for (const step of lesson.steps) {
        const ru = stepHelpAfterMs(step, "ru");
        const kk = stepHelpAfterMs(step, "kk");
        expect(Number.isFinite(ru) && Number.isFinite(kk), `${lesson.id}:${step.id}`).toBe(true);
        expect(ru).toBeGreaterThanOrEqual(HELP_MIN_MS);
        expect(ru).toBeLessThanOrEqual(HELP_MAX_MS);
        expect(kk).toBeGreaterThanOrEqual(HELP_MIN_MS);
        expect(kk).toBeLessThanOrEqual(HELP_MAX_MS);
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe("helpKindFor: что предлагает Бит", () => {
  it("задание — подсказка; рассказ — «объяснить проще»; видео — ничего", () => {
    expect(helpKindFor(choice(5, ["a"]))).toBe("hint");
    expect(helpKindFor(theory(5))).toBe("simpler");
    const story: StoryStep = { id: "s", type: "story", body: same("Текст"), scene: { kind: "lamps", states: "1" } };
    expect(helpKindFor(story)).toBe("simpler");
    const video: Step = { id: "v", type: "video", videoId: "x", title: same("Видео") };
    expect(helpKindFor(video)).toBeNull();
  });
});

describe("helpKindIn: где плашка есть", () => {
  it("в тесте (мини-тест) плашки нет, в уроке и тренировке — есть", () => {
    const step = choice(5, ["a"]);
    expect(helpKindIn(step, { testMode: false })).toBe("hint");
    expect(helpKindIn(step, { testMode: true })).toBeNull();
    expect(helpKindIn(theory(5), { testMode: true })).toBeNull();
    expect(helpKindIn(undefined, { testMode: false })).toBeNull();
  });
});

describe("helpWindowMs: пошаговый разбор считается по подшагам", () => {
  const worked = (n: number): WorkedStep => ({
    id: "w",
    type: "worked",
    title: same("Разбор"),
    steps: Array.from({ length: n }, () => ({ text: same(words(30)) })),
  });
  it("окно ожидания — время одного подшага: всего шага ÷ число подшагов", () => {
    const step = worked(4);
    expect(helpWindowMs(step, "ru")).toBe(Math.round(expectedStepMs(step, "ru") / 4));
    // Длинный разбор не откладывает плашку на несколько минут: 8 подшагов по ~10 с чтения — порог у нижней границы, а не 140 с.
    expect(expectedStepMs(worked(8), "ru") * 1.75).toBeGreaterThan(120_000);
    expect(stepHelpAfterMs(worked(8), "ru")).toBe(HELP_MIN_MS);
  });
  it("у остальных шагов окно — всё время шага", () => {
    const step = choice(12, ["да", "нет"]);
    expect(helpWindowMs(step, "ru")).toBe(expectedStepMs(step, "ru"));
  });
});

describe("canOfferHelp: один раз на шаг, не больше трёх за урок", () => {
  it("первый показ на шаге разрешён, повторный на том же шаге — нет", () => {
    expect(canOfferHelp([], "a", false)).toBe(true);
    expect(canOfferHelp(["a"], "a", false)).toBe(false);
    expect(canOfferHelp(["a"], "b", false)).toBe(true);
  });
  it("после трёх показов — больше нет", () => {
    expect(MAX_HELP_OFFERS).toBe(3);
    expect(canOfferHelp(["a", "b"], "c", false)).toBe(true);
    expect(canOfferHelp(["a", "b", "c"], "d", false)).toBe(false);
  });
  it("подсказка на шаге уже взята — не показываем", () => {
    expect(canOfferHelp([], "a", true)).toBe(false);
  });
});

describe("часы шага: активное время", () => {
  it("идут, пока running; на паузе (шторка, сцена проводника, вкладка скрыта) стоят", () => {
    let c = startHelpClock(1_000);
    c = tickHelpClock(c, 2_000, true);
    expect(c.elapsed).toBe(1_000);
    c = tickHelpClock(c, 3_000, false);
    expect(c.elapsed).toBe(1_000);
    c = tickHelpClock(c, 4_000, true);
    expect(c.elapsed).toBe(2_000);
  });
  it("долгий разрыв (спящий ноутбук) не даёт скачка: не больше TICK_CAP_MS за тик", () => {
    let c = startHelpClock(0);
    c = tickHelpClock(c, 10 * 60_000, true);
    expect(c.elapsed).toBe(TICK_CAP_MS);
  });
  it("часы, пошедшие назад, время не отнимают", () => {
    const c = tickHelpClock(startHelpClock(5_000), 4_000, true);
    expect(c.elapsed).toBe(0);
  });
  it("helpDue: порог достигнут — пора показывать", () => {
    let c = startHelpClock(0);
    for (let t = 1; t <= 19; t++) c = tickHelpClock(c, t * 1_000, true);
    expect(helpDue(c, 20_000)).toBe(false);
    c = tickHelpClock(c, 20_000, true);
    expect(helpDue(c, 20_000)).toBe(true);
  });
});
