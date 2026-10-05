import { describe, expect, it } from "vitest";
import { answerLeaks, clampSecrets, leakTokens } from "@/lib/answer-leak";
import { taskSecrets } from "@/lib/task-secrets";
import { lesson as devicesLesson } from "@/content/lessons/base-3-devices";
import { promptText } from "@/lib/evaluate";
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
    // все верные — один секрет: названа любая запись — утечка
    expect(taskSecrets(multi, "ru")).toEqual([["a1", "c3"]]);
  });

  it("input — все допустимые записи; bits и ladder — двоичная запись", () => {
    const input = { ...base, type: "input", prompt: L("?"), answers: ["12.5", "12,5"], mode: "text", explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(input, "ru")).toEqual([["12.5", "12,5"]]);
    const bits = { ...base, type: "bits", prompt: L("?"), target: 11, bits: 8, explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(bits, "ru")).toEqual([["00001011", "1011"]]);
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
    // только записи языка урока (+ связка с предметом строки)
    expect(taskSecrets(cloze, "ru")).toEqual([["ввод", "клавиатура ~ ввод"], ["вывод", "клавиатура ~ вывод"]]);
    expect(taskSecrets(cloze, "kk")[0]).toEqual(["енгізу", "клавиатура ~ енгізу"]);
  });

  it("match и order — только сочетание; entmatch — «пункт описание»", () => {
    const match = { ...base, type: "match", prompt: L("?"), pairs: [{ left: "RAM", right: L("жедел жад") }, { left: "ROM", right: L("тұрақты жад") }], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(match, "kk")).toEqual([["RAM жедел жад"], ["ROM тұрақты жад"]]);
    const order = { ...base, type: "order", prompt: L("?"), items: [L("один"), L("два"), L("три")], explanation: L("") } as unknown as QuestionStep;
    expect(taskSecrets(order, "ru")).toEqual([["один ~ два"], ["два ~ три"]]);
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

describe("настоящий шаг «Устройства»: слова ответа есть в условии (случай владельца)", () => {
  const step = devicesLesson.steps.find((x) => x.id === "dev3-q-cloze-groups")! as QuestionStep;
  const trap = devicesLesson.steps.find((x) => x.id === "dev3-q-trap-scanner")! as QuestionStep;
  const ownerRu =
    "Конечно.\nСмотри так:\n* Ввод — это когда устройство передаёт информацию в компьютер\n* Вывод — это когда компьютер показывает информацию тебе\n* Ввод-вывод — и туда, и обратно\n\nПримеры:\n* Клавиатура — ввод: ты нажимаешь, компьютер получает символы\n* Монитор — вывод: он просто показывает картинку\n* Сенсорный экран — ввод-вывод: ты касаешься, и он ещё показывает изображение\n* Микрофон — ввод: звук идёт в компьютер";
  const ownerKk =
    "Былай қарайық:\n* Пернетақта — енгізу: сен басасың, компьютер таңбаларды алады\n* Монитор — шығару: ол суретті көрсетеді\n* Сенсорлық экран — енгізу-шығару: сен тиесің, ол сурет те көрсетеді\n* Микрофон — енгізу: дыбыс компьютерге барады";

  it("ru: дословный ответ ИИ из жалобы — утечка", () => {
    const secrets = taskSecrets(step, "ru");
    expect(answerLeaks(ownerRu, secrets, { known: promptText(step, "ru") })).toBe(true);
  });

  it("kk: тот же ответ по-казахски — утечка", () => {
    const secrets = taskSecrets(step, "kk");
    expect(answerLeaks(ownerKk, secrets, { known: promptText(step, "kk") })).toBe(true);
  });

  it("секреты без чужого языка и без дублей", () => {
    const ru = taskSecrets(step, "ru");
    expect(ru.flat().some((f) => /енгізу|шығару/.test(f))).toBe(false);
    const kk = taskSecrets(step, "kk");
    expect(kk.flat().some((f) => /\b(ввода?|вывода?)\b/.test(f))).toBe(false);
  });

  it("общее объяснение без перечисления ответов — не утечка", () => {
    const secrets = taskSecrets(step, "ru");
    const ok = "Подумай, куда идёт информация: в компьютер, из него или в обе стороны. Спроси себя это про каждое устройство по очереди.";
    expect(answerLeaks(ok, secrets, { known: promptText(step, "ru") })).toBe(false);
    expect(answerLeaks("Принтер печатает документ: информация идёт из компьютера наружу.", secrets, { known: promptText(step, "ru") })).toBe(false);
  });

  it("вариант, чьё слово есть в условии (сканер): связка «слово условия ~ вариант»", () => {
    const secrets = taskSecrets(trap, "ru");
    const known = promptText(trap, "ru");
    expect(answerLeaks("Сканер отправляет в компьютер картинку — это ввод.", secrets, { known })).toBe(true);
    expect(answerLeaks("Подумай, куда идёт информация: в компьютер или из него.", secrets, { known })).toBe(false);
  });
});

describe("answerLeaks: связки, варианты и записи", () => {
  it("связка «предмет ~ ответ»: рядом в одном предложении", () => {
    const s = [["клавиатура ~ ввод"]];
    expect(answerLeaks("Клавиатура — это устройство ввода.", s)).toBe(true);
    expect(answerLeaks("Клавиатура нужна для печати текста на компьютере. Про ввод поговорим позже.", s)).toBe(false);
  });

  it("одинаковые секреты считаются один раз (taskSecrets убирает дубли)", () => {
    const cloze = {
      id: "q", skill: "s", level: 1, type: "cloze", prompt: { ru: "?", kk: "?" },
      lines: [[{ blank: ["ввод"], mode: "text" }], [{ blank: ["ввод"], mode: "text" }]],
      explanation: { ru: "", kk: "" },
    } as unknown as ClozeStep;
    expect(taskSecrets(cloze, "ru")).toEqual([["ввод"]]);
  });

  it("multi: названа любая верная запись — утечка", () => {
    const secrets = [["Монитор", "Принтер"]];
    expect(answerLeaks("Монитор как раз показывает информацию.", secrets)).toBe(true);
    expect(answerLeaks("Подумай, что показывает информацию человеку.", secrets)).toBe(false);
  });

  it("bits: двоичная запись без ведущих нулей", () => {
    const bits = { id: "q", skill: "s", level: 1, type: "bits", prompt: { ru: "?", kk: "?" }, target: 11, bits: 8, explanation: { ru: "", kk: "" } } as unknown as QuestionStep;
    expect(answerLeaks("11 = 1011₂", taskSecrets(bits, "ru"))).toBe(true);
    expect(answerLeaks("Разложи 11 на степени двойки", taskSecrets(bits, "ru"))).toBe(false);
  });

  it("order: названа цепочка соседних пунктов — утечка, один пункт — нет", () => {
    const order = { id: "q", skill: "s", level: 1, type: "order", prompt: { ru: "?", kk: "?" }, items: [{ ru: "Нагреть воду", kk: "" }, { ru: "Заварить чай", kk: "" }, { ru: "Налить чашку", kk: "" }], explanation: { ru: "", kk: "" } } as unknown as QuestionStep;
    const s = taskSecrets(order, "ru");
    expect(answerLeaks("1) Нагреть воду 2) Заварить чай 3) Налить чашку", s)).toBe(true);
    expect(answerLeaks("Начни с того, что нужно нагреть воду.", s)).toBe(false);
  });
});

describe("clampSecrets и leakTokens", () => {
  it("клиентские данные обрезаются: число, формы, длина, типы", () => {
    const many = Array.from({ length: 30 }, (_, i) => [`ответ${i}`]);
    expect(clampSecrets(many)).toHaveLength(12);
    expect(clampSecrets([["a".repeat(500)]])[0][0]).toHaveLength(120);
    expect(clampSecrets([["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]])[0]).toHaveLength(8);
    expect(clampSecrets("мусор")).toEqual([]);
    expect(clampSecrets([null, 5, [], [""], ["  "], "строка"])).toEqual([["строка"]]);
  });

  it("токены: нижний регистр, ё, индексы, пунктуация", () => {
    expect(leakTokens("Ёлка, 1011₂!")).toEqual(["елка", "1011"]);
  });
});
