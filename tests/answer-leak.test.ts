import { describe, expect, it } from "vitest";
import { answerLeaks, clampSecrets, leakTokens } from "@/lib/answer-leak";
import { taskSecrets } from "@/lib/task-secrets";
import type { ClozeStep, QuestionStep } from "@/lib/types";

describe("answerLeaks: числа и слова", () => {
  it("число — отдельный токен: «10» не находится в «100», «1010» и «2010»", () => {
    expect(answerLeaks("Получится 100 или 1010", [["10"]])).toBe(false);
    expect(answerLeaks("Год 2010", [["10"]])).toBe(false);
    expect(answerLeaks("Получится 10, проверь", [["10"]])).toBe(true);
    expect(answerLeaks("Ответ: 10.", [["10"]])).toBe(true);
  });

  it("основание системы не мешает: 1011₂, 1011(2), 1011_2", () => {
    expect(answerLeaks("В двоичной это 1011₂", [["1011"]])).toBe(true);
    expect(answerLeaks("В двоичной это 1011", [["1011₂"]])).toBe(true);
    expect(answerLeaks("Это 1011(2)", [["1011"]])).toBe(true);
    expect(answerLeaks("Это 1011_2", [["1011"]])).toBe(true);
    expect(answerLeaks("Это 10110", [["1011₂"]])).toBe(false);
    expect(answerLeaks("Это 101", [["1011₂"]])).toBe(false);
  });

  it("регистр и ё/е", () => {
    expect(answerLeaks("Это ЗВЁЗДОЧКА", [["звездочка"]])).toBe(true);
    expect(answerLeaks("это звездочка", [["ЗВЁЗДОЧКА"]])).toBe(true);
  });

  it("формы слов: окончания не обманывают проверку", () => {
    expect(answerLeaks("Это устройство ввода информации", [["ввод"]])).toBe(true);
    expect(answerLeaks("Это двоичной системы", [["двоичная система"]])).toBe(true);
    expect(answerLeaks("Это вывода", [["ввод"]])).toBe(false);
    // слово, лишь начинающееся так же, но другое
    expect(answerLeaks("Это вводимое", [["ввод"]])).toBe(false);
  });

  it("слишком частые короткие ответы не ищем: буква, цифра, «да»", () => {
    expect(answerLeaks("Вариант A, потом B", [["A"]])).toBe(false);
    expect(answerLeaks("Шаг 3 и шаг 7", [["7"]])).toBe(false);
    expect(answerLeaks("Да, конечно", [["Да"]])).toBe(false);
  });

  it("однозначная цифра-ответ ловится после «=» и «ответ»", () => {
    expect(answerLeaks("Получится 2 + 5 = 7", [["7"]])).toBe(true);
    expect(answerLeaks("Ответ: 7", [["7"]])).toBe(true);
    expect(answerLeaks("Ответ: 17", [["7"]])).toBe(false);
  });

  it("сочетание слов (пары, порядок) — подряд", () => {
    expect(answerLeaks("Клавиатура — ввод, монитор — вывод", [["клавиатура ввод"]])).toBe(true);
    expect(answerLeaks("Клавиатура нужна, а ввод — это вообще другое", [["клавиатура ввод"]])).toBe(false);
  });

  it("разные записи одного ответа: достаточно любой", () => {
    expect(answerLeaks("Получится 12,5", [["12.5", "12,5"]])).toBe(true);
    expect(answerLeaks("Получится 12.5", [["12.5", "12,5"]])).toBe(true);
    expect(answerLeaks("Получится 125", [["12.5", "12,5"]])).toBe(false);
  });

  it("пробелы внутри числа: «1 011» = «1011»", () => {
    expect(answerLeaks("Это 1011", [["1 011"]])).toBe(true);
  });

  it("слова из условия задания ученик и так видит — утечкой не считаем", () => {
    expect(answerLeaks("Разберём ввод информации на другом примере", [["ввод"]], { known: "Клавиатура — устройство ___ информации (ввод/вывод)" })).toBe(false);
    expect(answerLeaks("Разберём ввод информации на другом примере", [["ввод"]], { known: "Что делает клавиатура?" })).toBe(true);
  });

  it("пусто: нет текста или ответов — нет утечки", () => {
    expect(answerLeaks("", [["ввод"]])).toBe(false);
    expect(answerLeaks("Любой текст", [])).toBe(false);
    expect(answerLeaks("Любой текст", [[""]])).toBe(false);
  });
});

describe("answerLeaks: несколько ответов (пропуски)", () => {
  const blanks = [["ввод"], ["вывод"], ["ввод-вывод"]];

  it("полный список пропусков — утечка (случай владельца: «Объясни проще»)", () => {
    const text = "Смотри так:\n* Ввод — это когда устройство передаёт информацию в компьютер\n* Вывод — это когда компьютер показывает информацию\n* Ввод-вывод — и туда, и обратно";
    expect(answerLeaks(text, blanks)).toBe(true);
  });

  it("общее объяснение на другом примере, где названо одно слово, — не утечка", () => {
    expect(answerLeaks("Подумай, куда идёт информация: в компьютер или из него. Например, принтер печатает документ.", blanks)).toBe(false);
    expect(answerLeaks("Подумай про ввод: устройство отправляет данные в компьютер.", blanks)).toBe(false);
  });

  it("два ответа из двух — утечка, один из двух — нет", () => {
    expect(answerLeaks("Нужны слова «ввод» и «вывод».", [["ввод"], ["вывод"]])).toBe(true);
    expect(answerLeaks("Нужно слово «ввод».", [["ввод"], ["вывод"]])).toBe(false);
  });

  it("больше половины из четырёх", () => {
    const four = [["alpha1"], ["beta22"], ["gamma3"], ["delta4"]];
    expect(answerLeaks("alpha1 beta22", four)).toBe(false);
    expect(answerLeaks("alpha1 beta22 gamma3", four)).toBe(true);
  });

  it("слова из условия не входят в счёт: остаётся один скрытый — он и решает", () => {
    expect(answerLeaks("Это вывод", [["ввод"], ["вывод"]], { known: "ввод — устройство" })).toBe(true);
  });
});

describe("taskSecrets: ответы из задания", () => {
  const base = { id: "q", skill: "s", level: 1 } as const;
  const L = (ru: string, kk = ru) => ({ ru, kk });

  it("choice — текст верного варианта; multi — каждый верный", () => {
    const choice = { ...base, type: "choice", prompt: L("?"), options: [L("Клавиатура", "Пернетақта"), L("Монитор", "Монитор")], correct: 0, explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(choice, "ru")).toEqual([["Клавиатура"]]);
    expect(taskSecrets(choice, "kk")).toEqual([["Пернетақта"]]);
    const multi = { ...base, type: "multi", prompt: L("?"), options: ["a1", "b2", "c3"], correct: [0, 2], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(multi, "ru")).toEqual([["a1"], ["c3"]]);
  });

  it("input — все допустимые записи; bits и ladder — двоичная запись", () => {
    const input = { ...base, type: "input", prompt: L("?"), answers: ["12.5", "12,5"], mode: "text", explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(input, "ru")).toEqual([["12.5", "12,5"]]);
    const bits = { ...base, type: "bits", prompt: L("?"), target: 11, bits: 8, explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(bits, "ru")).toEqual([["00001011"]]);
    const ladder = { ...base, type: "ladder", prompt: L("?"), number: 13, explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(ladder, "ru")).toEqual([["1101"]]);
  });

  it("cloze — по списку на каждый пропуск: подпись плашки и допустимые записи", () => {
    const cloze: ClozeStep = {
      ...base,
      type: "cloze",
      prompt: L("Заполни"),
      lines: [["Клавиатура —", { blank: ["ввод"], mode: "text", label: L("ввод", "енгізу") }, "информации;", { blank: ["вывод"], mode: "text" }]],
      explanation: L(""),
    } as unknown as ClozeStep;
    expect(taskSecrets(cloze, "ru")).toEqual([["ввод", "ввод"], ["вывод"]]);
    expect(taskSecrets(cloze, "kk")[0]).toEqual(["енгізу", "ввод"]);
  });

  it("match и order — только сочетание; entmatch — «пункт описание»", () => {
    const match = { ...base, type: "match", prompt: L("?"), pairs: [{ left: "RAM", right: L("жедел жад") }, { left: "ROM", right: L("тұрақты жад") }], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(match, "kk")).toEqual([["RAM жедел жад"], ["ROM тұрақты жад"]]);
    const order = { ...base, type: "order", prompt: L("?"), items: [L("один"), L("два"), L("три")], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(order, "ru")).toEqual([["один два три"]]);
    const ent = { ...base, type: "entmatch", prompt: L("?"), items: ["A1", "B1"], choices: ["w", "x", "y", "z"], answer: [2, 0], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(ent, "ru")).toEqual([["A1 y"], ["B1 w"]]);
  });

  it("секреты, собранные из задания, ловят утечку в ответе модели", () => {
    const cloze = {
      ...base,
      type: "cloze",
      prompt: L("Заполни"),
      lines: [[{ blank: ["ввод"], mode: "text", label: L("ввод") }, { blank: ["вывод"], mode: "text", label: L("вывод") }]],
      explanation: L(""),
    } as unknown as ClozeStep;
    const secrets = taskSecrets(cloze, "ru");
    expect(answerLeaks("Клавиатура — ввод, монитор — вывод", secrets, { known: "Заполни" })).toBe(true);
    expect(answerLeaks("Принтер печатает: информация идёт из компьютера наружу", secrets, { known: "Заполни" })).toBe(false);
  });
});

describe("clampSecrets и leakTokens", () => {
  it("клиентские данные обрезаются: число, формы, длина, типы", () => {
    const many = Array.from({ length: 30 }, (_, i) => [`ответ${i}`]);
    expect(clampSecrets(many)).toHaveLength(12);
    expect(clampSecrets([["a".repeat(500)]])[0][0]).toHaveLength(120);
    expect(clampSecrets([["1", "2", "3", "4", "5", "6", "7", "8"]])[0]).toHaveLength(6);
    expect(clampSecrets("мусор")).toEqual([]);
    expect(clampSecrets([null, 5, [], [""], ["  "], "строка"])).toEqual([["строка"]]);
  });

  it("токены: нижний регистр, ё, индексы, пунктуация", () => {
    expect(leakTokens("Ёлка, 1011₂!")).toEqual(["елка", "1011"]);
  });
});
