import type { ChoiceStep, InputStep, L, Level, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.trace («Что выведет программа»): генератор небольших программ с циклами, break/continue,
// цифрами числа и т. п. Правильный ответ всегда считает код (функции ниже повторяют логику программы),
// неверные варианты — типичные ошибки трассировки: конец range включён, перепутаны // и %, лишний или пропущенный круг,
// print внутри/после цикла, > вместо >=. Тексты после переменных — без падежных окончаний
// (в казахском окончание зависит от числа), поэтому формулы и двоеточия.
//
// traceChecks(level, seed) — для проверки: отдаёт те же программы с ожидаемым выводом; скрипт сверки
// запускает их в python3 и сравнивает с тем, что насчитал TypeScript.

const SKILL = "py.trace";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const codeScene = (lines: string[], marks?: number[]): Scene => ({ kind: "code", lang: "python", lines, ...(marks ? { marks } : {}) });
const tf = (b: boolean) => (b ? "True" : "False");

const range = (a: number, b: number, st = 1): number[] => {
  const r: number[] = [];
  if (st > 0) for (let i = a; i < b; i += st) r.push(i);
  else for (let i = a; i > b; i += st) r.push(i);
  return r;
};
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const digitsOf = (n: number) => String(n).split("").map(Number);
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const PRINT_Q: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };
const LINES_Q: L = { ru: "Сколько строк выведет программа?", kk: "Программа неше жол шығарады?" };

const HINT_TABLE: L = {
  ru: "Заведи таблицу: столбец на каждую переменную, строка на каждый круг цикла. Выполняй строки по порядку и записывай новые значения.",
  kk: "Кесте жаса: әр айнымалыға бір баған, циклдің әр айналымына бір жол. Жолдарды ретімен орындап, жаңа мәндерді жаз.",
};
const GENERIC_WHY: L = {
  ru: "Такое значение не получается при аккуратной трассировке: пройди таблицу по кругам ещё раз.",
  kk: "Мұндай мән мұқият трассировкада шықпайды: кестені айналымдар бойынша қайта өт.",
};

// ---------- проверка программ в python3 ----------

export interface TraceCheck {
  lines: string[];
  stdin?: string;
  /** Что программа реально выводит (то, что насчитал TypeScript). */
  stdout: string;
  /** Ответ, который задание считает верным; сверяется с реальным выводом (answerOf = "stdout") или с числом строк вывода. */
  answer?: string;
  answerOf?: "stdout" | "lines";
  /** Для заданий «какое изменение / какое значение»: вариант ответа и верный ли он. */
  option?: Text;
  correct?: boolean;
}

interface Built {
  step: ChoiceStep | InputStep;
  checks: TraceCheck[];
}

// ---------- сборка заданий ----------

interface Base {
  id: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  hint: L;
  explanation: L;
}

interface Wrong {
  text: string;
  why: L;
}

/** choice: правильный вариант + три неверных (с разбором ошибки), варианты перемешаны, whyWrong выровнен. */
function choiceStep(rand: Rand, base: Base, right: Text, wrong: { text: Text; why: L }[]): ChoiceStep {
  const seen = new Set<string>([JSON.stringify(right)]);
  const uniq: { text: Text; why: L }[] = [];
  for (const w of wrong) {
    const key = JSON.stringify(w.text);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(w);
    if (uniq.length === 3) break;
  }
  const all: { text: Text; why: L | null }[] = shuffle([{ text: right, why: null }, ...uniq], rand);
  return {
    type: "choice",
    skill: SKILL,
    ...base,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
  };
}

function inputStep(base: Base, answer: string, mode: "number" | "text"): InputStep {
  return { type: "input", skill: SKILL, ...base, answers: [answer], mode };
}

/**
 * Задание с коротким ответом: либо выбор из 4 (если нашлось 3 разных неверных варианта), либо ввод.
 * Для чисел недостающие неверные варианты добираются «рядом» (±1, ±2, ×2).
 */
function ask(rand: Rand, base: Base, right: string, wrongs: Wrong[], mode: "number" | "text", pChoice = 0.55): ChoiceStep | InputStep {
  const list: Wrong[] = [...wrongs];
  if (mode === "number") {
    const n = Number(right);
    for (const v of [n + 1, n - 1, n + 2, n - 2, n * 2]) if (v >= 0) list.push({ text: String(v), why: GENERIC_WHY });
  }
  const uniq = new Set(list.map((w) => w.text).filter((t) => t !== right));
  if (uniq.size >= 3 && rand() < pChoice) return choiceStep(rand, base, right, list);
  return inputStep(base, right, mode);
}

/** Подпись «0, 1, 2» для объяснений. */
const listText = (xs: number[]) => xs.join(", ");

// ======================================================================
// Уровень A: применить правило по образцу
// ======================================================================

// --- сумма по range ---

const SUM_VARIANTS: { src: string; text: string; f: (i: number) => number }[] = [
  { src: "s += i", text: "i", f: (i) => i },
  { src: "s += i * 2", text: "i * 2", f: (i) => i * 2 },
  { src: "s = s + i", text: "i", f: (i) => i },
  { src: "s += i + 1", text: "i + 1", f: (i) => i + 1 },
];

function genSumRange(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 1, 3);
  const b = a + int(rand, 3, 6);
  const vi = int(rand, 0, SUM_VARIANTS.length - 1);
  const v = SUM_VARIANTS[vi];
  const is = range(a, b);
  const terms = is.map(v.f);
  const ans = sum(terms);
  const lines = ["s = 0", `for i in range(${a}, ${b}):`, `    ${v.src}`, "print(s)"];
  const wrongs: Wrong[] = [
    {
      text: String(sum(range(a, b + 1).map(v.f))),
      why: {
        ru: `Лишнее слагаемое: i = ${b} не входит в range(${a}, ${b}), конец не берётся.`,
        kk: `Артық қосылғыш: i = ${b} мәні range(${a}, ${b}) ішіне кірмейді, соңы алынбайды.`,
      },
    },
  ];
  if (a > 0) {
    wrongs.push({
      text: String(sum(range(0, b).map(v.f))),
      why: { ru: `range начинается с ${a}, а не с 0: нулевой круг не выполняется.`, kk: `range 0 мәнінен емес, ${a} мәнінен басталады: нөлінші айналым орындалмайды.` },
    });
  }
  if (v.text !== "i") {
    wrongs.push({
      text: String(sum(is)),
      why: { ru: "Выражение в теле цикла не учтено: сложены только сами значения i.", kk: "Цикл денесіндегі өрнек ескерілмеген: тек i мәндерінің өзі қосылған." },
    });
  }
  const base: Base = {
    id: `g:${SKILL}:sumrange:${a}-${b}-${vi}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выпиши числа, которые принимает i (конец range не входит), и сложи значения выражения для каждого из них.",
      kk: "i қабылдайтын сандарды жаз (range соңы кірмейді) да, әрқайсысы үшін өрнектің мәнін қос.",
    },
    explanation: {
      ru: `range(${a}, ${b}) даёт i = ${listText(is)}. Складываем значения выражения ${v.text}: ${terms.join(" + ")} = ${ans}.`,
      kk: `range(${a}, ${b}) i = ${listText(is)} береді. ${v.text} өрнегінің мәндерін қосамыз: ${terms.join(" + ")} = ${ans}.`,
    },
  };
  return { step: ask(rand, base, String(ans), wrongs, "number"), checks: [{ lines, stdout: String(ans), answer: String(ans) }] };
}

// --- сколько строк выведет цикл ---

function genCountPrints(rand: Rand, level: Level, seed: number): Built {
  const st = pick(rand, [1, 1, 2, 3] as const);
  const a = int(rand, 0, 5);
  const b = a + int(rand, 5, 12);
  const is = range(a, b, st);
  const n = is.length;
  const lines = [st === 1 ? `for i in range(${a}, ${b}):` : `for i in range(${a}, ${b}, ${st}):`, "    print(i)"];
  const wrongs: Wrong[] = [
    {
      text: String(range(a, b + 1, st).length),
      why: { ru: `Конец range не входит: число ${b} не печатается.`, kk: `range соңы кірмейді: ${b} саны басылмайды.` },
    },
  ];
  if (st > 1) {
    wrongs.push({
      text: String(b - a),
      why: { ru: `Это разность b − a. Но i растёт с шагом ${st}, поэтому чисел меньше.`, kk: `Бұл b − a айырмасы. Бірақ i ${st} қадаммен өседі, сондықтан сандар аз.` },
    });
  }
  const base: Base = {
    id: `g:${SKILL}:countprints:${a}-${b}-${st}:${seed}`,
    level,
    prompt: LINES_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выпиши все значения i: начни с первого числа и прибавляй шаг, пока не дойдёшь до конца (само конечное число не берём).",
      kk: "Барлық i мәндерін жаз: бірінші саннан бастап қадамды қоса бер, соңына жеткенше (соңғы санның өзін алмаймыз).",
    },
    explanation: {
      ru: `i принимает значения ${listText(is)} — это ${n} чисел. На каждом круге печатается одна строка, значит, строк ${n}.`,
      kk: `i мына мәндерді қабылдайды: ${listText(is)} — бұл ${n} сан. Әр айналымда бір жол басылады, демек жол саны: ${n}.`,
    },
  };
  return { step: ask(rand, base, String(n), wrongs, "number"), checks: [{ lines, stdout: is.join("\n"), answer: String(n), answerOf: "lines" }] };
}

// --- обмен значений ---

function genSwap(rand: Rand, level: Level, seed: number): Built {
  const p = int(rand, 2, 9);
  let q = int(rand, 2, 9);
  if (q === p) q = p + 1;
  const variant = int(rand, 0, 1);
  let lines: string[];
  let ans: string;
  let wrongs: Wrong[];
  let explanation: L;
  if (variant === 0) {
    lines = [`a = ${p}`, `b = ${q}`, "c = a", "a = b", "b = c", "print(a, b)"];
    ans = `${q} ${p}`;
    wrongs = [
      { text: `${p} ${q}`, why: { ru: "Значения не остались на местах: после c = a, a = b, b = c переменные обменялись.", kk: "Мәндер орнында қалмайды: c = a, a = b, b = c жолдарынан кейін айнымалылар алмасады." } },
      { text: `${q} ${q}`, why: { ru: "Старое значение a потеряно: оно сохранено в c, и в последней строке b получает его из c.", kk: "a-ның ескі мәні жоғалған: ол c-ға сақталған, ал соңғы жолда b оны c-дан алады." } },
      { text: `${p} ${p}`, why: { ru: "Строка a = b меняет a, значит, a уже не равно прежнему значению.", kk: "a = b жолы a мәнін өзгертеді, демек, a бұрынғы мәнде қалмайды." } },
    ];
    explanation = {
      ru: `Сначала c = ${p} (запомнили a). Затем a = b = ${q}, потом b = c = ${p}. Выводится a и b: ${q} ${p}. Переменные поменялись местами.`,
      kk: `Алдымен c = ${p} (a мәні сақталды). Содан кейін a = b = ${q}, одан кейін b = c = ${p}. a және b шығады: ${q} ${p}. Айнымалылар орындарын ауыстырды.`,
    };
  } else {
    lines = [`a = ${p}`, `b = ${q}`, "a = a + b", "b = a - b", "print(a, b)"];
    ans = `${p + q} ${p}`;
    wrongs = [
      { text: `${p + q} ${q}`, why: { ru: "Строка b = a - b тоже выполняется: b становится равным новому a минус старое b.", kk: "b = a - b жолы да орындалады: b жаңа a мен ескі b айырмасына тең болады." } },
      { text: `${p} ${q}`, why: { ru: "Значения изменились: a = a + b заменяет a суммой.", kk: "Мәндер өзгерген: a = a + b жолы a мәнін қосындымен ауыстырады." } },
      { text: `${q} ${p}`, why: { ru: "Это обмен значений, но здесь a сначала становится суммой a + b, а не просто b.", kk: "Бұл мәндердің алмасуы, бірақ мұнда a алдымен жай b емес, a + b қосындысы болады." } },
    ];
    explanation = {
      ru: `a = ${p} + ${q} = ${p + q}. Затем b = ${p + q} − ${q} = ${p}. Выводится ${p + q} ${p}: в b теперь старое a.`,
      kk: `a = ${p} + ${q} = ${p + q}. Содан кейін b = ${p + q} − ${q} = ${p}. ${p + q} ${p} шығады: b-да енді a-ның ескі мәні.`,
    };
  }
  const base: Base = {
    id: `g:${SKILL}:swap:${p}-${q}-${variant}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "После каждой строки записывай значения a и b (и c, если она есть). Новое значение считается по текущим значениям.",
      kk: "Әр жолдан кейін a және b мәндерін (бар болса, c мәнін де) жаз. Жаңа мән ағымдағы мәндер бойынша есептеледі.",
    },
    explanation,
  };
  return { step: ask(rand, base, ans, wrongs, "text"), checks: [{ lines, stdout: ans, answer: ans }] };
}

// --- удвоение в while ---

function genWhileDouble(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 2, 5);
  const lim = int(rand, 40, 100);
  let x = a;
  const seq = [x];
  while (x < lim) {
    x *= 2;
    seq.push(x);
  }
  const lines = [`x = ${a}`, `while x < ${lim}:`, "    x = x * 2", "print(x)"];
  const wrongs: Wrong[] = [
    {
      text: String(x / 2),
      why: {
        ru: `Это значение до последнего удвоения: при нём условие x < ${lim} ещё верно, значит, цикл продолжается.`,
        kk: `Бұл соңғы екі еселеуге дейінгі мән: онда x < ${lim} шарты әлі ақиқат, демек, цикл жалғасады.`,
      },
    },
    {
      text: String(x * 2),
      why: {
        ru: `Лишнее удвоение: при x = ${x} условие x < ${lim} уже ложно, и цикл остановился.`,
        kk: `Артық екі еселеу: x = ${x} болғанда x < ${lim} шарты жалған, цикл тоқтайды.`,
      },
    },
    { text: String(lim), why: { ru: `Выводится значение x, а не граница ${lim} из условия.`, kk: `x мәні шығады, шарттағы ${lim} шекарасы емес.` } },
  ];
  const base: Base = {
    id: `g:${SKILL}:whiledouble:${a}-${lim}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выписывай x после каждого удвоения и каждый раз проверяй условие цикла. Когда оно станет ложным?",
      kk: "Әр екі еселеуден кейін x мәнін жаз да, цикл шартын тексер. Ол қашан жалған болады?",
    },
    explanation: {
      ru: `x по кругам: ${seq.join(" → ")}. Цикл остановился, когда условие x < ${lim} стало ложным: ${x} ≥ ${lim}. Выводится ${x}.`,
      kk: `x айналымдар бойынша: ${seq.join(" → ")}. x < ${lim} шарты жалған болғанда цикл тоқтады: ${x} ≥ ${lim}. ${x} шығады.`,
    },
  };
  return { step: ask(rand, base, String(x), wrongs, "number"), checks: [{ lines, stdout: String(x), answer: String(x) }] };
}

// --- произведение по range ---

function genProduct(rand: Rand, level: Level, seed: number): Built {
  const n = int(rand, 4, 7);
  const ans = factorial(n - 1);
  const lines = ["p = 1", `for i in range(1, ${n}):`, "    p = p * i", "print(p)"];
  const wrongs: Wrong[] = [
    { text: String(factorial(n)), why: { ru: `Число ${n} в range(1, ${n}) не входит, поэтому на ${n} умножения нет.`, kk: `${n} саны range(1, ${n}) ішіне кірмейді, сондықтан ${n} санына көбейту болмайды.` } },
    { text: String(sum(range(1, n))), why: { ru: "В цикле числа перемножаются, а не складываются.", kk: "Циклде сандар қосылмайды, көбейтіледі." } },
    { text: String(factorial(n - 2)), why: { ru: "Потерян последний круг: i = " + String(n - 1) + " тоже входит в цикл.", kk: "Соңғы айналым жоғалған: i = " + String(n - 1) + " мәні де циклге кіреді." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:product:${n}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Начальное значение p равно 1. Выпиши i (конец range не входит) и умножай p на каждое из них по очереди.",
      kk: "p-ның бастапқы мәні 1. i мәндерін жаз (range соңы кірмейді) да, p-ны оларға кезекпен көбейт.",
    },
    explanation: {
      ru: `range(1, ${n}) даёт i = ${listText(range(1, n))}. p = ${["1", ...range(1, n).map(String)].join(" · ")} = ${ans}.`,
      kk: `range(1, ${n}) i = ${listText(range(1, n))} береді. p = ${["1", ...range(1, n).map(String)].join(" · ")} = ${ans}.`,
    },
  };
  return { step: ask(rand, base, String(ans), wrongs, "number"), checks: [{ lines, stdout: String(ans), answer: String(ans) }] };
}

// --- строка из цифр ---

function genStrBuild(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 3, 6);
  const digits = (xs: number[]) => xs.join("");
  const ans = digits(range(0, a));
  const lines = ['s = ""', `for i in range(${a}):`, "    s = s + str(i)", "print(s)"];
  const wrongs: Wrong[] = [
    { text: digits(range(0, a + 1)), why: { ru: `Конец range не входит: цифры ${a} в строке нет.`, kk: `range соңы кірмейді: жолда ${a} цифры жоқ.` } },
    { text: digits(range(1, a + 1)), why: { ru: "range(n) начинается с 0, а не с 1: первая цифра в строке — 0.", kk: "range(n) 1-ден емес, 0-ден басталады: жолдағы бірінші цифр — 0." } },
    { text: String(sum(range(0, a))), why: { ru: "Это сумма. Но str(i) превращает число в текст, и строки приписываются друг к другу.", kk: "Бұл қосынды. Бірақ str(i) санды мәтінге айналдырады, ал жолдар бір-біріне жалғасып жазылады." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:strbuild:${a}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Строка s растёт: на каждом круге к ней дописывается символ — цифра i. Выпиши, что получается после каждого круга.",
      kk: "s жолы өседі: әр айналымда оған i цифры қосып жазылады. Әр айналымнан кейін не шығатынын жаз.",
    },
    explanation: {
      ru: `range(${a}) даёт i = ${listText(range(0, a))}. Строка s по кругам: ${range(0, a).map((_, k) => `«${digits(range(0, k + 1))}»`).join(" → ")}. Выводится ${ans}.`,
      kk: `range(${a}) i = ${listText(range(0, a))} береді. s жолы айналымдар бойынша: ${range(0, a).map((_, k) => `«${digits(range(0, k + 1))}»`).join(" → ")}. ${ans} шығады.`,
    },
  };
  return { step: ask(rand, base, ans, wrongs, "text"), checks: [{ lines, stdout: ans, answer: ans }] };
}

// --- print внутри цикла или после ---

function genIndentCount(rand: Rand, level: Level, seed: number): Built {
  const n = int(rand, 3, 8);
  const inside = rand() < 0.5;
  const lines = ["s = 0", `for i in range(${n}):`, "    s += i", inside ? "    print(s)" : "print(s)"];
  const out: number[] = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += i;
    if (inside) out.push(s);
  }
  if (!inside) out.push(s);
  const count = out.length;
  const wrongs: Wrong[] = inside
    ? [
        { text: "1", why: { ru: "print сдвинут вправо: он внутри цикла и выполняется на каждом круге, а не один раз.", kk: "print оңға жылжытылған: ол циклдің ішінде және бір рет емес, әр айналымда орындалады." } },
        { text: String(n + 1), why: { ru: `Кругов ${n}, а не ${n + 1}: конец range не входит.`, kk: `Айналым саны ${n}, ${n + 1} емес: range соңы кірмейді.` } },
      ]
    : [
        { text: String(n), why: { ru: "print стоит без отступа: он после цикла и выполняется один раз.", kk: "print шегінісіз тұр: ол циклден кейін және бір рет орындалады." } },
        { text: String(n + 1), why: { ru: "print стоит после цикла: он не повторяется на каждом круге.", kk: "print циклден кейін тұр: ол әр айналымда қайталанбайды." } },
      ];
  const base: Base = {
    id: `g:${SKILL}:indentcount:${n}-${inside ? "in" : "out"}:${seed}`,
    level,
    prompt: LINES_Q,
    scene: codeScene(lines, [3]),
    hint: {
      ru: "Посмотри на отступ у print: есть он или нет? От этого зависит, выполняется print на каждом круге или один раз.",
      kk: "print алдындағы шегіністі қара: бар ма, жоқ па? Соған қарай print әр айналымда немесе бір рет орындалады.",
    },
    explanation: inside
      ? {
          ru: `У print есть отступ — он внутри цикла и срабатывает на каждом из ${n} кругов. Строк вывода ${n}.`,
          kk: `print-тің шегінісі бар — ол циклдің ішінде және ${n} айналымның әрқайсысында орындалады. Шығару жолдары: ${n}.`,
        }
      : {
          ru: "У print нет отступа — он после цикла и срабатывает один раз. Строк вывода 1.",
          kk: "print-тің шегінісі жоқ — ол циклден кейін тұр және бір рет орындалады. Шығару жолы: 1.",
        },
  };
  return { step: ask(rand, base, String(count), wrongs, "number"), checks: [{ lines, stdout: out.join("\n"), answer: String(count), answerOf: "lines" }] };
}

// ======================================================================
// Уровень B: распознать модель, несколько переменных
// ======================================================================

// --- continue ---

function genContinueSum(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 1, 3);
  const b = a + int(rand, 8, 12);
  const m = int(rand, 2, 4);
  const is = range(a, b);
  const kept = is.filter((i) => i % m !== 0);
  const ans = sum(kept);
  const lines = ["s = 0", `for i in range(${a}, ${b}):`, `    if i % ${m} == 0:`, "        continue", "    s += i", "print(s)"];
  const wrongs: Wrong[] = [
    { text: String(sum(is.filter((i) => i % m === 0))), why: { ru: `Это сумма как раз кратных ${m}, а continue их пропускает.`, kk: `Бұл дәл ${m} санына еселілердің қосындысы, ал continue оларды өткізіп жібереді.` } },
    { text: String(sum(is)), why: { ru: "Это сумма всех i: команда continue не учтена.", kk: "Бұл барлық i қосындысы: continue командасы ескерілмеген." } },
    { text: String(sum(kept) + b), why: { ru: `Лишнее слагаемое ${b}: конец range не входит.`, kk: `Артық қосылғыш ${b}: range соңы кірмейді.` } },
  ];
  const base: Base = {
    id: `g:${SKILL}:continuesum:${a}-${b}-${m}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выпиши i по порядку и отметь те, для которых условие верно: на них срабатывает continue и сложения не будет.",
      kk: "i мәндерін ретімен жаз да, шарты ақиқат болатындарын белгіле: оларда continue орындалып, қосу болмайды.",
    },
    explanation: {
      ru: `i = ${listText(is)}. Числа, кратные ${m}, пропускаются через continue. Складываем остальные: ${kept.join(" + ")} = ${ans}.`,
      kk: `i = ${listText(is)}. ${m} санына еселі сандар continue арқылы өткізіледі. Қалғандарын қосамыз: ${kept.join(" + ")} = ${ans}.`,
    },
  };
  return { step: ask(rand, base, String(ans), wrongs, "number"), checks: [{ lines, stdout: String(ans), answer: String(ans) }] };
}

// --- цифры числа: сумма / количество чётных ---

function genDigits(rand: Rand, level: Level, seed: number): Built {
  const n = int(rand, 100, 9999);
  const ds = digitsOf(n);
  const variant = int(rand, 0, 1);
  if (variant === 0) {
    const ans = sum(ds);
    const lines = [`n = ${n}`, "s = 0", "while n > 0:", "    s += n % 10", "    n //= 10", "print(s)"];
    const wrongs: Wrong[] = [
      { text: String(ds.length), why: { ru: "Это число кругов цикла (столько в числе цифр), а выводится сумма s.", kk: "Бұл циклдің айналым саны (санда сонша цифр бар), ал s қосындысы шығады." } },
      { text: String(ds[ds.length - 1]), why: { ru: "Это последняя цифра, то есть результат только первого круга. Цикл идёт, пока n не станет 0.", kk: "Бұл соңғы цифр, яғни тек бірінші айналымның нәтижесі. Цикл n 0 болғанша жүреді." } },
      { text: String(sum(ds.slice(0, -1))), why: { ru: "Потеряна последняя цифра: на первом круге n % 10 тоже прибавляется к s.", kk: "Соңғы цифр жоғалған: бірінші айналымда n % 10 да s-ке қосылады." } },
    ];
    const base: Base = {
      id: `g:${SKILL}:digitsum:${n}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "На каждом круге: n % 10 — последняя цифра, она идёт в сумму; n //= 10 отбрасывает её. Веди таблицу n и s.",
        kk: "Әр айналымда: n % 10 — соңғы цифр, ол қосындыға түседі; n //= 10 оны алып тастайды. n және s кестесін жүргіз.",
      },
      explanation: {
        ru: `Цифры берутся с конца: ${ds.slice().reverse().join(", ")}. s = ${ds.slice().reverse().join(" + ")} = ${ans}. Это сумма цифр числа ${n}.`,
        kk: `Цифрлар соңынан алынады: ${ds.slice().reverse().join(", ")}. s = ${ds.slice().reverse().join(" + ")} = ${ans}. Бұл ${n} санының цифрлар қосындысы.`,
      },
    };
    return { step: ask(rand, base, String(ans), wrongs, "number"), checks: [{ lines, stdout: String(ans), answer: String(ans) }] };
  }
  const evens = ds.filter((d) => d % 2 === 0).length;
  const lines = [`n = ${n}`, "k = 0", "while n > 0:", "    if n % 2 == 0:", "        k += 1", "    n //= 10", "print(k)"];
  const wrongs: Wrong[] = [
    { text: String(ds.length - evens), why: { ru: "Это количество нечётных цифр, а условие n % 2 == 0 отбирает чётные.", kk: "Бұл тақ цифрлардың саны, ал n % 2 == 0 шарты жұптарын таңдайды." } },
    { text: String(ds.length), why: { ru: "Это число всех кругов цикла, а k растёт только когда условие верно.", kk: "Бұл циклдің барлық айналымдарының саны, ал k тек шарт ақиқат болғанда өседі." } },
    { text: String(sum(ds.filter((d) => d % 2 === 0))), why: { ru: "Это сумма чётных цифр, а k увеличивается на 1, а не на цифру.", kk: "Бұл жұп цифрлардың қосындысы, ал k цифрға емес, 1-ге артады." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:evendigits:${n}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Число чётное, если оно оканчивается на чётную цифру. Выписывай n на каждом круге и проверяй условие.",
      kk: "Сан жұп цифрмен аяқталса, ол жұп. Әр айналымда n мәнін жазып, шартты тексер.",
    },
    explanation: {
      ru: `n по кругам: ${(() => {
        const seq: number[] = [];
        for (let x = n; x > 0; x = Math.floor(x / 10)) seq.push(x);
        return seq.join(", ");
      })()}. Число чётное, когда его последняя цифра чётная, поэтому k считает чётные цифры числа ${n}: ${evens}.`,
      kk: `n айналымдар бойынша: ${(() => {
        const seq: number[] = [];
        for (let x = n; x > 0; x = Math.floor(x / 10)) seq.push(x);
        return seq.join(", ");
      })()}. Соңғы цифры жұп болса, сан жұп, сондықтан k ${n} санының жұп цифрларын санайды: ${evens}.`,
    },
  };
  return { step: ask(rand, base, String(evens), wrongs, "number"), checks: [{ lines, stdout: String(evens), answer: String(evens) }] };
}

// --- переворот числа ---

function genReverse(rand: Rand, level: Level, seed: number): Built {
  let n = int(rand, 100, 9999);
  // Чтобы переворот не совпал с исходным числом и не содержал ведущих нулей, избегаем нулей на конце и палиндромов.
  while (n % 10 === 0 || String(n) === String(n).split("").reverse().join("")) n = int(rand, 100, 9999);
  const ds = digitsOf(n);
  const rev = Number(ds.slice().reverse().join(""));
  const chain: number[] = [];
  let m = 0;
  for (const d of ds.slice().reverse()) {
    m = m * 10 + d;
    chain.push(m);
  }
  const lines = [`n = ${n}`, "m = 0", "while n > 0:", "    m = m * 10 + n % 10", "    n = n // 10", "print(m)"];
  const wrongs: Wrong[] = [
    { text: String(n), why: { ru: "Это исходное число. Цифры не остаются на своих местах: m собирается с конца, с последней цифры.", kk: "Бұл бастапқы сан. Цифрлар өз орнында қалмайды: m соңынан, соңғы цифрдан жиналады." } },
    { text: String(sum(ds)), why: { ru: "Это сумма цифр. Но программа не складывает цифры, а дописывает их справа к m.", kk: "Бұл цифрлар қосындысы. Бірақ программа цифрларды қоспайды, m-нің оң жағына жазады." } },
    { text: String(ds.length), why: { ru: "Это число кругов цикла, а выводится значение m.", kk: "Бұл циклдің айналым саны, ал m мәні шығады." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:reverse:${n}:${seed}`,
    level,
    prompt: { ru: "Что выведет программа?", kk: "Программа не шығарады?" },
    scene: codeScene(lines),
    hint: {
      ru: "Нарисуй таблицу n и m. На каждом круге возьми последнюю цифру n и допиши её справа к m (m * 10 сдвигает m на разряд).",
      kk: "n және m кестесін сыз. Әр айналымда n-нің соңғы цифрын алып, m-нің оң жағына жаз (m * 10 m-ді бір разрядқа жылжытады).",
    },
    explanation: {
      ru: `Цифры берутся с конца и дописываются в m: ${chain.join(" → ")}. Программа переворачивает число ${n}: выводится ${rev}.`,
      kk: `Цифрлар соңынан алынып, m-ге жазылады: ${chain.join(" → ")}. Программа ${n} санын төңкереді: ${rev} шығады.`,
    },
  };
  return { step: ask(rand, base, String(rev), wrongs, "number"), checks: [{ lines, stdout: String(rev), answer: String(rev) }] };
}

// --- максимум и его место (> или >=) ---

function genMaxPos(rand: Rand, level: Level, seed: number): Built {
  const len = int(rand, 5, 6);
  const mx = int(rand, 6, 9);
  const p1 = int(rand, 0, len - 3);
  const p2 = int(rand, p1 + 2, len - 1);
  const a: number[] = [];
  for (let i = 0; i < len; i++) a.push(i === p1 || i === p2 ? mx : int(rand, 1, mx - 1));
  const op = pick(rand, [">", ">="] as const);
  let pos = 0;
  for (let i = 1; i < len; i++) if (op === ">" ? a[i] > a[pos] : a[i] >= a[pos]) pos = i;
  const lines = [`a = [${a.join(", ")}]`, "pos = 0", `for i in range(1, ${len}):`, `    if a[i] ${op} a[pos]:`, "        pos = i", "print(pos)"];
  const other = pos === p1 ? p2 : p1;
  const wrongs: Wrong[] = [
    {
      text: String(other),
      why:
        op === ">"
          ? { ru: "Строгое > не заменяет pos на равное число, поэтому остаётся первое место максимума.", kk: "Қатаң > pos-ты тең санға ауыстырмайды, сондықтан максимумның бірінші орны қалады." }
          : { ru: "Нестрогое >= заменяет pos и на равное число, поэтому в конце остаётся последнее место максимума.", kk: "Қатаң емес >= pos-ты тең санға да ауыстырады, сондықтан соңында максимумның соңғы орны қалады." },
    },
    { text: String(mx), why: { ru: "Это само наибольшее число, а print(pos) выводит его номер (нумерация с 0).", kk: "Бұл ең үлкен санның өзі, ал print(pos) оның нөмірін шығарады (нөмірлеу 0-ден басталады)." } },
    { text: String(len - 1), why: { ru: "Это номер последнего элемента, а не места максимума.", kk: "Бұл соңғы элементтің нөмірі, максимум орны емес." } },
    { text: "0", why: { ru: "pos меняется, когда встречается число больше (или равное) текущего лучшего.", kk: "Ағымдағы ең жақсыдан үлкен (немесе тең) сан кездескенде pos өзгереді." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:maxpos:${a.join("")}-${op === ">" ? "gt" : "ge"}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Нумерация в списке с 0. Веди таблицу i, a[i] и pos и внимательно проверяй знак сравнения на равных числах.",
      kk: "Тізімдегі нөмірлеу 0-ден басталады. i, a[i] және pos кестесін жүргіз де, тең сандарда салыстыру белгісін мұқият тексер.",
    },
    explanation: {
      ru: `Наибольшее число ${mx} стоит на местах ${p1} и ${p2} (нумерация с 0). pos обновляется, когда a[i] ${op} a[pos]. ${op === ">" ? "Равное число не заменяет pos, остаётся первое место" : "Равное число заменяет pos, получается последнее место"}: ${pos}.`,
      kk: `Ең үлкен сан ${mx} ${p1} және ${p2} орындарында тұр (нөмірлеу 0-ден). pos a[i] ${op} a[pos] болғанда жаңарады. ${op === ">" ? "Тең сан pos-ты ауыстырмайды, бірінші орын қалады" : "Тең сан pos-ты ауыстырады, соңғы орын шығады"}: ${pos}.`,
    },
  };
  return { step: ask(rand, base, String(pos), wrongs, "number"), checks: [{ lines, stdout: String(pos), answer: String(pos) }] };
}

// --- считаем числа с условием or ---

function genCountCond(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 1, 5);
  const b = a + int(rand, 12, 22);
  const p = pick(rand, [2, 3] as const);
  const q = pick(rand, [5, 7] as const);
  const is = range(a, b);
  const count = is.filter((i) => i % p === 0 || i % q === 0).length;
  const lines = ["k = 0", `for i in range(${a}, ${b}):`, `    if i % ${p} == 0 or i % ${q} == 0:`, "        k += 1", "print(k)"];
  const wrongs: Wrong[] = [
    { text: String(is.filter((i) => i % p === 0 && i % q === 0).length), why: { ru: "Так считались бы числа, кратные обоим сразу (and). Но условие с or верно, если выполняется хотя бы одна часть.", kk: "Бұлай екеуіне бірдей еселі сандар (and) саналар еді. Бірақ or шарты кемінде бір бөлігі орындалса ақиқат." } },
    { text: String(range(a, b + 1).filter((i) => i % p === 0 || i % q === 0).length), why: { ru: `Лишнее число i = ${b}: конец range не входит.`, kk: `Артық сан i = ${b}: range соңы кірмейді.` } },
    { text: String(is.filter((i) => i % p === 0).length), why: { ru: `Учтены только числа, кратные ${p}. Кратные ${q} тоже считаются.`, kk: `Тек ${p} санына еселі сандар ескерілген. ${q} санына еселілері де саналады.` } },
  ];
  const base: Base = {
    id: `g:${SKILL}:countcond:${a}-${b}-${p}-${q}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Для каждого i проверь обе части условия: or срабатывает, если верна хотя бы одна. Не забудь про границу range.",
      kk: "Әр i үшін шарттың екі бөлігін тексер: or кемінде біреуі ақиқат болса орындалады. range шекарасын ұмытпа.",
    },
    explanation: {
      ru: `Среди i = ${a}…${b - 1} подходят числа, кратные ${p} или ${q}: ${is.filter((i) => i % p === 0 || i % q === 0).join(", ")}. Их ${count}.`,
      kk: `i = ${a}…${b - 1} ішінен ${p} немесе ${q} санына еселі сандар қолайлы: ${is.filter((i) => i % p === 0 || i % q === 0).join(", ")}. Олар ${count}.`,
    },
  };
  return { step: ask(rand, base, String(count), wrongs, "number"), checks: [{ lines, stdout: String(count), answer: String(count) }] };
}

// --- while с вычитанием ---

function genWhileDec(rand: Rand, level: Level, seed: number): Built {
  const d = int(rand, 3, 7);
  const t = int(rand, 0, 5);
  const x0 = t + d * int(rand, 4, 9);
  // x0 − t делится на d: так «>» и «>=» дают разное число кругов
  let x = x0;
  let n = 0;
  while (x > t) {
    x -= d;
    n++;
  }
  const nGe = (x0 - t) / d + 1;
  const lines = [`x = ${x0}`, "n = 0", `while x > ${t}:`, `    x = x - ${d}`, "    n += 1", "print(n)"];
  const wrongs: Wrong[] = [
    { text: String(nGe), why: { ru: `Условие строгое: при x = ${t} оно уже ложно, и этот круг не выполняется.`, kk: `Шарт қатаң: x = ${t} болғанда ол жалған, сондықтан бұл айналым орындалмайды.` } },
    { text: String(x), why: { ru: "Это итоговое значение x, а выводится счётчик n.", kk: "Бұл x-тің қорытынды мәні, ал n санауышы шығады." } },
    { text: String(Math.floor(x0 / d)), why: { ru: `Это ${x0} // ${d}: порог ${t} в расчёте не учтён.`, kk: `Бұл ${x0} // ${d}: ${t} шегі есептеуде ескерілмеген.` } },
  ];
  const seq: number[] = [];
  for (let v = x0; ; v -= d) {
    seq.push(v);
    if (v <= t) break;
  }
  const base: Base = {
    id: `g:${SKILL}:whiledec:${x0}-${d}-${t}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выписывай x после каждого вычитания и каждый раз проверяй условие в заголовке цикла: оно строгое.",
      kk: "Әр азайтудан кейін x мәнін жаз да, цикл тақырыбындағы шартты тексер: ол қатаң.",
    },
    explanation: {
      ru: `x по кругам: ${seq.join(" → ")}. Условие x > ${t} стало ложным на значении ${x}, всего выполнено кругов: ${n}.`,
      kk: `x айналымдар бойынша: ${seq.join(" → ")}. x > ${t} шарты ${x} мәнінде жалған болды, барлығы орындалған айналым: ${n}.`,
    },
  };
  return { step: ask(rand, base, String(n), wrongs, "number"), checks: [{ lines, stdout: String(n), answer: String(n) }] };
}

// --- порядок elif ---

function genElifOrder(rand: Rand, level: Level, seed: number): Built {
  const trap = rand() < 0.6;
  const t1 = int(rand, 5, 12);
  const t2 = trap ? t1 + int(rand, 3, 8) : t1 - int(rand, 3, 4);
  const x = trap ? t2 + int(rand, 1, 8) : int(rand, t2 - 3, t1 + 6);
  const ifTrue = x > t1;
  const elifTrue = x > t2;
  const out = ifTrue ? "A" : elifTrue ? "B" : "C";
  const lines = [`x = ${x}`, `if x > ${t1}:`, '    print("A")', `elif x > ${t2}:`, '    print("B")', "else:", '    print("C")'];
  const both: L = { ru: "A и B", kk: "A және B" };
  const whyOf = (o: string): L => {
    if (o === "A")
      return { ru: `Условие x > ${t1} ложно (${x} не больше ${t1}), ветка A не выполняется.`, kk: `x > ${t1} шарты жалған (${x} саны ${t1} санынан үлкен емес), A тармағы орындалмайды.` };
    if (o === "B")
      return ifTrue
        ? { ru: `Раз x > ${t1} верно, выполнилась ветка if; elif даже не проверяется.`, kk: `x > ${t1} ақиқат болғандықтан, if тармағы орындалды; elif тексерілмейді де.` }
        : { ru: `Условие x > ${t2} тоже ложно, ветка B не выполняется.`, kk: `x > ${t2} шарты да жалған, B тармағы орындалмайды.` };
    if (o === "C") return { ru: "Ветка else выполняется, только когда все условия выше ложны.", kk: "else тармағы жоғарыдағы барлық шарт жалған болғанда ғана орындалады." };
    return { ru: "В цепочке if / elif выполняется только одна ветка — первая с верным условием.", kk: "if / elif тізбегінде тек бір тармақ орындалады — шарты ақиқат бірінші тармақ." };
  };
  const wrong: { text: Text; why: L }[] = ["A", "B", "C"].filter((o) => o !== out).map((o) => ({ text: o, why: whyOf(o) }));
  wrong.push({ text: both, why: whyOf("both") });
  const step = choiceStep(
    rand,
    {
      id: `g:${SKILL}:elifOrder:${x}-${t1}-${t2}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Условия проверяются сверху вниз. Как только одно оказалось верным, остальные ветки пропускаются.",
        kk: "Шарттар жоғарыдан төмен қарай тексеріледі. Біреуі ақиқат болғанда, қалған тармақтар өткізіледі.",
      },
      explanation: {
        ru: `x = ${x}. Сначала проверяется x > ${t1}: ${tf(ifTrue)}.${ifTrue ? " Ветка if выполнена, elif пропускается." : ` Затем x > ${t2}: ${tf(elifTrue)}.${elifTrue ? " Выполняется ветка B." : " Выполняется else."}`} Выводится ${out}.`,
        kk: `x = ${x}. Алдымен x > ${t1} тексеріледі: ${tf(ifTrue)}.${ifTrue ? " if тармағы орындалды, elif өткізіледі." : ` Содан кейін x > ${t2}: ${tf(elifTrue)}.${elifTrue ? " B тармағы орындалады." : " else орындалады."}`} ${out} шығады.`,
      },
    },
    out,
    wrong,
  );
  return { step, checks: [{ lines, stdout: out, answer: out }] };
}

// --- числа Фибоначчи: одновременное присваивание ---

function genFib(rand: Rand, level: Level, seed: number): Built {
  const n = int(rand, 5, 9);
  let a = 0;
  let b = 1;
  const seq = [a];
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
    seq.push(a);
  }
  let sa = 0;
  let sb = 1;
  for (let i = 0; i < n; i++) {
    sa = sb;
    sb = sa + sb;
  }
  const lines = ["a = 0", "b = 1", `for i in range(${n}):`, "    a, b = b, a + b", "print(a)"];
  const wrongs: Wrong[] = [
    { text: String(sa), why: { ru: "Так получится, если читать присваивания по очереди. Но в записи a, b = b, a + b правая часть вычисляется целиком до записи.", kk: "Тапсырмаларды кезекпен оқысаң, осылай шығады. Бірақ a, b = b, a + b жазбасында оң жағы жазуға дейін толық есептеледі." } },
    { text: String(b), why: { ru: "Это значение b, а выводится a: на круг позже.", kk: "Бұл b мәні, ал a шығады: ол бір айналым кешірек." } },
    { text: String(seq[n - 1]), why: { ru: "Потерян последний круг: range считает все круги от 0 до конца.", kk: "Соңғы айналым жоғалған: range барлық айналымды санайды." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:fib:${n}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "В строке a, b = b, a + b сначала вычисляются обе правые части по старым a и b, и только потом записываются.",
      kk: "a, b = b, a + b жолында алдымен екі оң жақ ескі a және b бойынша есептеледі, содан кейін ғана жазылады.",
    },
    explanation: {
      ru: `Пары (a, b) по кругам: ${(() => {
        let x = 0;
        let y = 1;
        const out: string[] = [`(${x}, ${y})`];
        for (let i = 0; i < n; i++) {
          [x, y] = [y, x + y];
          out.push(`(${x}, ${y})`);
        }
        return out.join(" → ");
      })()}. Выводится a = ${a}.`,
      kk: `(a, b) жұптары айналымдар бойынша: ${(() => {
        let x = 0;
        let y = 1;
        const out: string[] = [`(${x}, ${y})`];
        for (let i = 0; i < n; i++) {
          [x, y] = [y, x + y];
          out.push(`(${x}, ${y})`);
        }
        return out.join(" → ");
      })()}. a = ${a} шығады.`,
    },
  };
  return { step: ask(rand, base, String(a), wrongs, "number"), checks: [{ lines, stdout: String(a), answer: String(a) }] };
}

// ======================================================================
// Уровень C: несколько шагов, обратные задачи
// ======================================================================

// --- break: что выведет / сколько раз выполнится ---

function genBreakCount(rand: Rand, level: Level, seed: number): Built {
  const i0 = int(rand, 1, 3);
  const step = int(rand, 2, 4);
  const lim = int(rand, 20, 40);
  let s = 0;
  let i = i0;
  let count = 0;
  const rows: string[] = [];
  for (;;) {
    s += i;
    count++;
    rows.push(`${i}→${s}`);
    if (s > lim) break;
    i += step;
  }
  const lines = ["s = 0", `i = ${i0}`, "while True:", "    s += i", `    if s > ${lim}:`, "        break", `    i += ${step}`, "print(i)"];
  const counted = ["s = 0", `i = ${i0}`, "cnt = 0", "while True:", "    s += i", "    cnt += 1", `    if s > ${lim}:`, "        break", `    i += ${step}`, "print(cnt)"];
  const askCount = rand() < 0.5;
  const table: L = {
    ru: `Пары «i → s после сложения»: ${rows.join(", ")}.`,
    kk: `«i → қосудан кейінгі s» жұптары: ${rows.join(", ")}.`,
  };
  if (askCount) {
    const wrongs: Wrong[] = [
      { text: String(count - 1), why: { ru: `На круге, где s стало больше ${lim}, строка s += i уже выполнилась — её тоже нужно посчитать.`, kk: `s ${lim} мәнінен асқан айналымда s += i жолы орындалып үлгерген — оны да санау керек.` } },
      { text: String(count + 1), why: { ru: "break выходит из цикла сразу, до строки i += step: ещё одного круга нет.", kk: "break циклден бірден шығады, i += step жолына дейін: тағы бір айналым болмайды." } },
    ];
    const base: Base = {
      id: `g:${SKILL}:breakcount:${i0}-${step}-${lim}-c:${seed}`,
      level,
      prompt: { ru: "Сколько раз выполнится строка 4 (s += i)?", kk: "4-жол (s += i) неше рет орындалады?" },
      scene: codeScene(lines, [3]),
      hint: {
        ru: "Веди таблицу i и s. Остановись, когда s станет больше границы: на этом круге s += i ещё выполняется, а i += step — уже нет.",
        kk: "i және s кестесін жүргіз. s шектен асқанда тоқта: сол айналымда s += i әлі орындалады, ал i += step — енді жоқ.",
      },
      explanation: {
        ru: `${table.ru} Условие s > ${lim} впервые верно на ${count}-м круге, там срабатывает break. Строка s += i выполнилась ${count} раз.`,
        kk: `${table.kk} s > ${lim} шарты алғаш рет ${count}-ші айналымда ақиқат болады, сонда break орындалады. s += i жолы ${count} рет орындалды.`,
      },
    };
    return { step: ask(rand, base, String(count), wrongs, "number", 0.35), checks: [{ lines: counted, stdout: String(count), answer: String(count) }] };
  }
  const wrongs: Wrong[] = [
    { text: String(i + step), why: { ru: "break срабатывает до строки i += step, поэтому на последнем круге i не увеличивается.", kk: "break i += step жолына дейін орындалады, сондықтан соңғы айналымда i өспейді." } },
    { text: String(i - step), why: { ru: `Это значение i на предыдущем круге. А s > ${lim} стало верно на следующем.`, kk: `Бұл алдыңғы айналымдағы i мәні. Ал s > ${lim} келесі айналымда ақиқат болды.` } },
    { text: String(s), why: { ru: "Это s, а выводится i.", kk: "Бұл s, ал i шығады." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:breakcount:${i0}-${step}-${lim}-p:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Веди таблицу i и s. Остановись, когда s станет больше границы: break выходит из цикла до строки i += step.",
      kk: "i және s кестесін жүргіз. s шектен асқанда тоқта: break циклден i += step жолына дейін шығады.",
    },
    explanation: {
      ru: `${table.ru} Условие s > ${lim} впервые верно при i = ${i}: break выходит из цикла, не увеличив i. Выводится ${i}.`,
      kk: `${table.kk} s > ${lim} шарты алғаш рет i = ${i} болғанда ақиқат: break i-ді арттырмай, циклден шығады. ${i} шығады.`,
    },
  };
  return { step: ask(rand, base, String(i), wrongs, "number", 0.4), checks: [{ lines, stdout: String(i), answer: String(i) }] };
}

// --- вложенные циклы ---

function genNested(rand: Rand, level: Level, seed: number): Built {
  const a = int(rand, 4, 8);
  const variant = int(rand, 0, 2);
  let lines: string[];
  let k = 0;
  let hint: L;
  let wrongsList: Wrong[];
  let explanation: L;
  if (variant === 0) {
    lines = ["k = 0", `for i in range(1, ${a}):`, "    for j in range(i):", "        k += 1", "print(k)"];
    for (let i = 1; i < a; i++) for (let j = 0; j < i; j++) k++;
    const terms = range(1, a);
    hint = {
      ru: "Внутренний цикл повторяется для каждого i заново. Выпиши, сколько кругов он делает при каждом i, и сложи.",
      kk: "Ішкі цикл әр i үшін қайтадан жүреді. Әр i кезінде оның неше айналым жасайтынын жазып, қос.",
    };
    explanation = {
      ru: `При i = ${listText(terms)} внутренний цикл range(i) делает ${listText(terms)} кругов. Всего k = ${terms.join(" + ")} = ${k}.`,
      kk: `i = ${listText(terms)} болғанда ішкі range(i) цикл ${listText(terms)} айналым жасайды. Барлығы k = ${terms.join(" + ")} = ${k}.`,
    };
    wrongsList = [
      { text: String((a - 1) * (a - 1)), why: { ru: "Так считается, если внутренний цикл всегда делает столько же кругов, сколько внешний. Но range(i) растёт вместе с i.", kk: "Ішкі цикл әрқашан сыртқы цикл сияқты айналым жасаса, осылай саналады. Бірақ range(i) i-мен бірге өседі." } },
      { text: String(((a - 1) * a) / 2 + a), why: { ru: `Лишний круг: внешний цикл range(1, ${a}) не доходит до ${a}.`, kk: `Артық айналым: сыртқы range(1, ${a}) цикл ${a} санына жетпейді.` } },
    ];
  } else if (variant === 1) {
    lines = ["k = 0", `for i in range(${a}):`, `    for j in range(i, ${a}):`, "        k += 1", "print(k)"];
    for (let i = 0; i < a; i++) for (let j = i; j < a; j++) k++;
    const terms = range(0, a).map((i) => a - i);
    hint = {
      ru: "Внутренний цикл начинается с j = i и идёт до конца. Для каждого i посчитай, сколько значений j получается.",
      kk: "Ішкі цикл j = i мәнінен басталып, соңына дейін жүреді. Әр i үшін j-нің неше мәні шығатынын сана.",
    };
    explanation = {
      ru: `Для i = 0…${a - 1} внутренний цикл делает ${terms.join(", ")} кругов. Всего k = ${terms.join(" + ")} = ${k}.`,
      kk: `i = 0…${a - 1} үшін ішкі цикл ${terms.join(", ")} айналым жасайды. Барлығы k = ${terms.join(" + ")} = ${k}.`,
    };
    wrongsList = [
      { text: String(a * a), why: { ru: "Так считается, если внутренний цикл всегда делает a кругов. Но он начинается с j = i и укорачивается.", kk: "Ішкі цикл әрқашан a айналым жасаса, осылай саналады. Бірақ ол j = i мәнінен басталып, қысқара береді." } },
      { text: String(((a - 1) * a) / 2), why: { ru: "Не хватает кругов: при каждом i значение j = i тоже входит в range(i, a).", kk: "Айналымдар жеткіліксіз: әр i кезінде j = i мәні де range(i, a) ішіне кіреді." } },
    ];
  } else {
    lines = ["k = 0", `for i in range(1, ${a}):`, `    for j in range(1, ${a}):`, "        if i < j:", "            k += 1", "print(k)"];
    for (let i = 1; i < a; i++) for (let j = 1; j < a; j++) if (i < j) k++;
    hint = {
      ru: "Нужны пары (i, j), где i меньше j. Для каждого i посчитай подходящие j.",
      kk: "i саны j санынан кіші болатын (i, j) жұптары керек. Әр i үшін қолайлы j мәндерін сана.",
    };
    const terms = range(1, a).map((i) => a - 1 - i);
    explanation = {
      ru: `Для каждого i подходят j > i из диапазона 1…${a - 1}: ${terms.join(", ")} штук. Всего k = ${terms.join(" + ")} = ${k}.`,
      kk: `Әр i үшін 1…${a - 1} аралығынан j > i мәндері қолайлы: ${terms.join(", ")} дана. Барлығы k = ${terms.join(" + ")} = ${k}.`,
    };
    wrongsList = [
      { text: String((a - 1) * (a - 1)), why: { ru: "Это число всех пар (i, j), а if отбирает только те, где i < j.", kk: "Бұл барлық (i, j) жұптарының саны, ал if тек i < j болатындарын таңдайды." } },
      { text: String((a - 1) * (a - 2) / 2 + (a - 1)), why: { ru: "Учтены ещё и пары с i = j, а условие i < j их не пропускает.", kk: "i = j жұптары да ескерілген, ал i < j шарты оларды өткізбейді." } },
    ];
  }
  const base: Base = {
    id: `g:${SKILL}:nested:${a}-${variant}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint,
    explanation,
  };
  return { step: ask(rand, base, String(k), wrongsList, "number"), checks: [{ lines, stdout: String(k), answer: String(k) }] };
}

// --- какое изменение даст нужный вывод ---

interface Cand {
  option: L;
  lines: string[];
  out: number;
}

function runTotal(e: number, m: number, r: number, mul = 1, add = 0): number {
  let t = 0;
  for (let i = 1; i < e; i++) if (i % m === r) t += i * mul + add;
  return t;
}

function genModifyLine(rand: Rand, level: Level, seed: number): Built {
  for (let attempt = 0; attempt < 80; attempt++) {
    const e = int(rand, 8, 14);
    const m = int(rand, 2, 4);
    const r = int(rand, 0, m - 1);
    const baseLines = ["total = 0", `for i in range(1, ${e}):`, `    if i % ${m} == ${r}:`, "        total += i", "print(total)"];
    const baseOut = runTotal(e, m, r);
    const e2 = e + int(rand, 2, 4);
    const r2 = (r + 1) % m;
    const m2 = m + 1;
    const cond = (mm: number, rr: number): L => ({
      ru: `В строке 3 заменить условие на i % ${mm} == ${rr}`,
      kk: `3-жолда шартты i % ${mm} == ${rr} өрнегімен ауыстыру`,
    });
    const all: Cand[] = [
      {
        option: { ru: `В строке 2 заменить range(1, ${e}) на range(1, ${e2})`, kk: `2-жолда range(1, ${e}) өрнегін range(1, ${e2}) өрнегімен ауыстыру` },
        lines: [baseLines[0], `for i in range(1, ${e2}):`, baseLines[2], baseLines[3], baseLines[4]],
        out: runTotal(e2, m, r),
      },
      { option: cond(m, r2), lines: [baseLines[0], baseLines[1], `    if i % ${m} == ${r2}:`, baseLines[3], baseLines[4]], out: runTotal(e, m, r2) },
      { option: cond(m2, r), lines: [baseLines[0], baseLines[1], `    if i % ${m2} == ${r}:`, baseLines[3], baseLines[4]], out: runTotal(e, m2, r) },
      {
        option: { ru: "В строке 4 заменить total += i на total += i * 2", kk: "4-жолда total += i өрнегін total += i * 2 өрнегімен ауыстыру" },
        lines: [baseLines[0], baseLines[1], baseLines[2], "        total += i * 2", baseLines[4]],
        out: runTotal(e, m, r, 2),
      },
      {
        option: { ru: "В строке 4 заменить total += i на total += i + 1", kk: "4-жолда total += i өрнегін total += i + 1 өрнегімен ауыстыру" },
        lines: [baseLines[0], baseLines[1], baseLines[2], "        total += i + 1", baseLines[4]],
        out: runTotal(e, m, r, 1, 1),
      },
    ];
    const chosen = shuffle(all, rand).slice(0, 4);
    const outs = chosen.map((c) => c.out);
    if (new Set(outs).size !== 4 || outs.includes(baseOut) || outs.includes(0)) continue;
    const right = chosen[0];
    const wrong = chosen.slice(1).map((c) => ({
      text: c.option as Text,
      why: {
        ru: `Так программа выведет ${c.out}, а не ${right.out}.`,
        kk: `Бұлай программа ${c.out} шығарады, ${right.out} емес.`,
      } as L,
    }));
    const seqOf = (mm: number, rr: number, ee: number) => range(1, ee).filter((i) => i % mm === rr);
    const step = choiceStep(
      rand,
      {
        id: `g:${SKILL}:modify:${e}-${m}-${r}-${right.out}:${seed}`,
        level,
        prompt: {
          ru: `Программа выводит ${baseOut}. Какое изменение сделает так, чтобы она вывела ${right.out}?`,
          kk: `Программа ${baseOut} шығарады. Қандай өзгеріс оның ${right.out} шығаруына әкеледі?`,
        },
        scene: codeScene(baseLines),
        hint: {
          ru: "Для каждого варианта пересчитай, какие i попадут в сумму и что прибавится. Сравни результат с нужным числом.",
          kk: "Әр нұсқа үшін қандай i сомаға түсетінін және не қосылатынын қайта есепте. Нәтижені керек санмен салыстыр.",
        },
        explanation: {
          ru: `Сейчас в сумму попадают i = ${seqOf(m, r, e).join(", ") || "—"}: итог ${baseOut}. Нужное изменение даёт ${right.out}. Остальные варианты: ${chosen
            .slice(1)
            .map((c) => c.out)
            .join(", ")}.`,
          kk: `Қазір сомаға i = ${seqOf(m, r, e).join(", ") || "—"} түседі: нәтиже ${baseOut}. Керекті өзгеріс ${right.out} береді. Қалған нұсқалар: ${chosen
            .slice(1)
            .map((c) => c.out)
            .join(", ")}.`,
        },
      },
      right.option,
      wrong,
    );
    const checks: TraceCheck[] = [
      { lines: baseLines, stdout: String(baseOut) },
      ...chosen.map((c, k) => ({ lines: c.lines, stdout: String(c.out), option: c.option as Text, correct: k === 0 })),
    ];
    return { step, checks };
  }
  throw new Error("genModifyLine: не удалось подобрать варианты");
}

// --- при каком вводе выведет X ---

interface InProg {
  key: string;
  lines: string[];
  run: (n: number) => number;
  correct: (rand: Rand) => number;
  near: (c: number, rand: Rand) => number[];
  explain: (c: number, t: number) => L;
  hint: L;
}

const IN_PROGS: InProg[] = [
  {
    key: "bitlen",
    lines: ["n = int(input())", "k = 0", "while n > 0:", "    n = n // 2", "    k += 1", "print(k)"],
    run: (n) => n.toString(2).length,
    correct: (rand) => int(rand, 8, 100),
    near: (c, rand) => [c * 2, Math.floor(c / 2), c + int(rand, 1, 6), c * 2 + 1, Math.max(1, c - int(rand, 1, 6))],
    explain: (c, t) => ({
      ru: `Цикл делит n на 2, пока n не станет 0, и считает круги: k — число двоичных цифр n. Выведет ${t} то n, в двоичной записи которого ${t} цифр: ${c} = ${c.toString(2)}₂.`,
      kk: `Цикл n-ді n 0 болғанша 2-ге бөліп, айналымдарды санайды: k — n санының екілік цифрлар саны. ${t} шығару үшін n-нің екілік жазбасында ${t} цифр болуы керек: ${c} = ${c.toString(2)}₂.`,
    }),
    hint: {
      ru: "Посмотри, что делает цикл с числом на каждом круге, и что считает k. Проверь, сколько кругов получится у каждого варианта.",
      kk: "Цикл әр айналымда санмен не істейтінін және k нені санайтынын қара. Әр нұсқада неше айналым шығатынын тексер.",
    },
  },
  {
    key: "digsum",
    lines: ["n = int(input())", "s = 0", "while n > 0:", "    s += n % 10", "    n //= 10", "print(s)"],
    run: (n) => sum(digitsOf(n)),
    correct: (rand) => int(rand, 20, 999),
    near: (c, rand) => [c + 1, c - 1, c + 10, c * 2, c + int(rand, 2, 9), c + 100],
    explain: (c, t) => ({
      ru: `Программа печатает сумму цифр n. Нужна сумма ${t}: у числа ${c} она равна ${digitsOf(c).join(" + ")} = ${t}. У остальных вариантов сумма цифр другая.`,
      kk: `Программа n санының цифрлар қосындысын басады. Қосынды ${t} болуы керек: ${c} санында ол ${digitsOf(c).join(" + ")} = ${t}. Қалған нұсқаларда цифрлар қосындысы басқа.`,
    }),
    hint: {
      ru: "Программа складывает цифры числа. Найди сумму цифр каждого варианта и сравни с нужным числом.",
      kk: "Программа санның цифрларын қосады. Әр нұсқаның цифрлар қосындысын тауып, керек санмен салыстыр.",
    },
  },
  {
    key: "steps",
    lines: ["n = int(input())", "k = 0", "while n != 1:", "    if n % 2 == 0:", "        n = n // 2", "    else:", "        n = 3 * n + 1", "    k += 1", "print(k)"],
    run: (n) => {
      let k = 0;
      let x = n;
      while (x !== 1) {
        x = x % 2 === 0 ? x / 2 : 3 * x + 1;
        k++;
      }
      return k;
    },
    correct: (rand) => int(rand, 3, 27),
    near: (c, rand) => [c + 1, c - 1, c * 2, c + 2, c + int(rand, 3, 8)].filter((v) => v >= 2),
    explain: (c, t) => ({
      ru: `Цикл повторяется, пока n не станет 1: чётное n делится на 2, нечётное заменяется на 3n + 1; k считает шаги. При n = ${c} получается ровно ${t} шагов, у остальных вариантов — другое число шагов.`,
      kk: `Цикл n 1 болғанша қайталанады: жұп n 2-ге бөлінеді, тақ n 3n + 1 өрнегімен ауыстырылады; k қадамдарды санайды. n = ${c} болғанда дәл ${t} қадам шығады, қалған нұсқаларда қадам саны басқа.`,
    }),
    hint: {
      ru: "Для каждого варианта пройди цепочку: чётное делим на 2, нечётное заменяем на 3n + 1 — и считай шаги до единицы.",
      kk: "Әр нұсқа үшін тізбекті өт: жұпты 2-ге бөлеміз, тақты 3n + 1 өрнегімен ауыстырамыз — және бірге дейінгі қадамдарды сана.",
    },
  },
];

function genFindInput(rand: Rand, level: Level, seed: number): Built {
  const prog = pick(rand, IN_PROGS);
  for (let attempt = 0; attempt < 60; attempt++) {
    const c = prog.correct(rand);
    const t = prog.run(c);
    const cands = [...new Set(prog.near(c, rand))].filter((v) => v > 0 && v !== c && prog.run(v) !== t);
    if (cands.length < 3) continue;
    const wrong = shuffle(cands, rand).slice(0, 3);
    const step = choiceStep(
      rand,
      {
        id: `g:${SKILL}:findinput:${prog.key}-${c}:${seed}`,
        level,
        prompt: { ru: `При каком значении n программа выведет ${t}?`, kk: `n-нің қандай мәнінде программа ${t} шығарады?` },
        scene: codeScene(prog.lines),
        hint: prog.hint,
        explanation: prog.explain(c, t),
      },
      String(c),
      wrong.map((x) => ({
        text: String(x),
        why: {
          ru: `При n = ${x} программа выведет ${prog.run(x)}, а не ${t}.`,
          kk: `n = ${x} болғанда программа ${prog.run(x)} шығарады, ${t} емес.`,
        },
      })),
    );
    const checks: TraceCheck[] = [c, ...wrong].map((x, k) => ({
      lines: prog.lines,
      stdin: String(x),
      stdout: String(prog.run(x)),
      option: String(x),
      correct: k === 0,
    }));
    return { step, checks };
  }
  throw new Error("genFindInput: не удалось подобрать варианты");
}

// --- наименьший делитель ---

function genDivisor(rand: Rand, level: Level, seed: number): Built {
  const n = int(rand, 20, 120);
  let d = 2;
  while (d * d <= n) {
    if (n % d === 0) break;
    d++;
  }
  const composite = d * d <= n;
  const lines = [`n = ${n}`, "d = 2", "while d * d <= n:", "    if n % d == 0:", "        break", "    d += 1", "print(d)"];
  const wrongs: Wrong[] = composite
    ? [
        { text: String(n / d), why: { ru: `Это второй множитель ${n} / ${d}, а выводится сам d.`, kk: `Бұл ${n} / ${d} екінші көбейткіші, ал d-ның өзі шығады.` } },
        { text: String(d + 1), why: { ru: "break срабатывает до строки d += 1, поэтому d не увеличивается.", kk: "break d += 1 жолына дейін орындалады, сондықтан d өспейді." } },
        { text: String(n), why: { ru: "Программа выводит d, а не исходное n.", kk: "Программа d шығарады, бастапқы n емес." } },
      ]
    : [
        { text: String(n), why: { ru: "Программа выводит d, а не n. Число простое, но цикл печатает значение d, на котором остановился.", kk: "Программа d шығарады, n емес. Сан жай, бірақ цикл тоқтаған d мәнін басады." } },
        { text: String(d - 1), why: { ru: `Цикл остановился не на ${d - 1}, а на следующем значении: условие d * d <= ${n} стало ложным.`, kk: `Цикл ${d - 1} мәнінде емес, келесі мәнде тоқтады: d * d <= ${n} шарты жалған болды.` } },
        { text: "1", why: { ru: "d начинается с 2 и только растёт, до 1 оно не дойдёт.", kk: "d 2-ден басталып, тек өседі, 1 болмайды." } },
      ];
  const base: Base = {
    id: `g:${SKILL}:divisor:${n}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Перебирай d = 2, 3, 4… и на каждом значении проверяй сначала условие цикла (d * d <= n), потом остаток от деления.",
      kk: "d = 2, 3, 4… мәндерін аралап, әр мәнде алдымен цикл шартын (d * d <= n), содан кейін бөлудің қалдығын тексер.",
    },
    explanation: composite
      ? {
          ru: `d = 2, 3, … Первое d, на которое ${n} делится без остатка, — ${d}. На нём срабатывает break, и выводится ${d}.`,
          kk: `d = 2, 3, … ${n} қалдықсыз бөлінетін бірінші d — ${d}. Онда break орындалып, ${d} шығады.`,
        }
      : {
          ru: `Делителей до корня нет, break не срабатывает. Цикл идёт, пока d * d <= ${n}, и заканчивается при d = ${d}: ${d} * ${d} = ${d * d} > ${n}. Выводится ${d}.`,
          kk: `Түбірге дейін бөлгіштер жоқ, break орындалмайды. Цикл d * d <= ${n} болғанша жүреді және d = ${d} болғанда аяқталады: ${d} * ${d} = ${d * d} > ${n}. ${d} шығады.`,
        },
  };
  return { step: ask(rand, base, String(d), wrongs, "number"), checks: [{ lines, stdout: String(d), answer: String(d) }] };
}

// --- break вместе с continue ---

function genBreakContinue(rand: Rand, level: Level, seed: number): Built {
  const e = int(rand, 14, 22);
  const m = int(rand, 5, 11);
  const kept: number[] = [];
  for (let i = 1; i < e; i++) {
    if (i % 2 === 0) continue;
    if (i > m) break;
    kept.push(i);
  }
  const s = sum(kept);
  const lines = ["s = 0", `for i in range(1, ${e}):`, "    if i % 2 == 0:", "        continue", `    if i > ${m}:`, "        break", "    s += i", "print(s)"];
  const allOdd = range(1, e).filter((i) => i % 2 === 1);
  const wrongs: Wrong[] = [
    { text: String(sum(allOdd)), why: { ru: `Так считается, если забыть про break: он останавливает цикл при первом нечётном i > ${m}.`, kk: `break туралы ұмытсаң, осылай саналады: ол ${m} санынан үлкен бірінші тақ i кезінде циклді тоқтатады.` } },
    { text: String(sum(range(1, e).filter((i) => i % 2 === 0 && i <= m))), why: { ru: "Это сумма чётных чисел, а continue как раз пропускает чётные.", kk: "Бұл жұп сандардың қосындысы, ал continue дәл жұптарды өткізіп жібереді." } },
    { text: String(sum(range(1, Math.min(e, m + 2)))), why: { ru: "Это сумма всех чисел подряд: continue пропускает чётные i, их складывать нельзя.", kk: "Бұл бәрін қатар қосқандағы қосынды: continue жұп i мәндерін өткізіп жібереді, оларды қосуға болмайды." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:breakcont:${e}-${m}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Для каждого i по порядку: чётное — continue (к следующему кругу), потом проверка break, и только потом сложение.",
      kk: "Әр i үшін ретімен: жұп болса — continue (келесі айналымға), содан кейін break тексеруі, ең соңында ғана қосу.",
    },
    explanation: {
      ru: `Нечётные i складываются, пока i не больше ${m}. Первое нечётное i > ${m} вызывает break. Складываем ${kept.join(" + ")} = ${s}.`,
      kk: `Тақ i мәндері i саны ${m} санынан аспағанша қосылады. ${m} санынан үлкен бірінші тақ i break шақырады. ${kept.join(" + ")} = ${s} қосамыз.`,
    },
  };
  return { step: ask(rand, base, String(s), wrongs, "number"), checks: [{ lines, stdout: String(s), answer: String(s) }] };
}

// --- алгоритм Евклида ---

function genGcd(rand: Rand, level: Level, seed: number): Built {
  let a: number;
  let b: number;
  do {
    const g = int(rand, 2, 9);
    a = g * int(rand, 2, 9);
    b = g * int(rand, 2, 9);
  } while (a === b || gcd(a, b) < 2);
  const g = gcd(a, b);
  const rows: string[] = [];
  let x = a;
  let y = b;
  while (y !== 0) {
    [x, y] = [y, x % y];
    rows.push(`(${x}, ${y})`);
  }
  const lines = [`a = ${a}`, `b = ${b}`, "while b != 0:", "    a, b = b, a % b", "print(a)"];
  const lcm = (a * b) / g;
  const wrongs: Wrong[] = [
    { text: String(lcm), why: { ru: "Это наименьшее общее кратное. Алгоритм вычисляет наибольший общий делитель.", kk: "Бұл ең кіші ортақ еселік. Алгоритм ең үлкен ортақ бөлгішті есептейді." } },
    { text: String(Math.min(a, b)), why: { ru: "Это меньшее из чисел: оно лишь иногда равно ответу. Нужно пройти цикл до b = 0.", kk: "Бұл екі санның кішісі: ол жауапқа тек кейде тең. Циклді b = 0 болғанша өту керек." } },
    { text: String(g * 2 > Math.min(a, b) ? Math.max(1, g - 1) : g * 2), why: { ru: "Такое число не получается: пройди цепочку пар (a, b) до нуля.", kk: "Мұндай сан шықпайды: (a, b) жұптарының тізбегін нөлге дейін өт." } },
  ];
  const base: Base = {
    id: `g:${SKILL}:gcd:${a}-${b}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    hint: {
      ru: "Выписывай пары (a, b) после каждого круга. В строке a, b = b, a % b обе правые части считаются по старым значениям.",
      kk: "Әр айналымнан кейін (a, b) жұптарын жаз. a, b = b, a % b жолында екі оң жақ та ескі мәндер бойынша есептеледі.",
    },
    explanation: {
      ru: `Пары (a, b) по кругам: (${a}, ${b}) → ${rows.join(" → ")}. Цикл заканчивается при b = 0, и выводится a = ${g}: это наибольший общий делитель ${a} и ${b}.`,
      kk: `(a, b) жұптары айналымдар бойынша: (${a}, ${b}) → ${rows.join(" → ")}. Цикл b = 0 болғанда аяқталады, a = ${g} шығады: бұл ${a} және ${b} сандарының ең үлкен ортақ бөлгіші.`,
    },
  };
  return { step: ask(rand, base, String(g), wrongs, "number", 0.4), checks: [{ lines, stdout: String(g), answer: String(g) }] };
}

// ======================================================================
// Утверждения «верно / неверно»
// ======================================================================

interface StatementBuilt {
  item: Statement;
  checks: TraceCheck[];
}

interface Fact {
  level: Level;
  id: string;
  ru: string;
  kk: string;
  value: boolean;
  exp: L;
  checks?: TraceCheck[];
}

const FACTS: Fact[] = [
  {
    level: 1,
    id: "continue-stops",
    ru: "Команда continue завершает работу всего цикла",
    kk: "continue командасы бүкіл циклдің жұмысын аяқтайды",
    value: false,
    exp: { ru: "continue пропускает только остаток текущего круга, цикл продолжается со следующего круга. Выход из цикла — это break.", kk: "continue тек ағымдағы айналымның қалған бөлігін өткізіп жібереді, цикл келесі айналымнан жалғасады. Циклден шығу — бұл break." },
  },
  {
    level: 1,
    id: "break-exits",
    ru: "Команда break выходит из цикла",
    kk: "break командасы циклден шығады",
    value: true,
    exp: { ru: "break немедленно прекращает цикл; программа продолжается со строки после цикла.", kk: "break циклді бірден тоқтатады; программа циклден кейінгі жолдан жалғасады." },
  },
  {
    level: 1,
    id: "range-end",
    ru: "В range(1, 6) число 6 входит в перебор",
    kk: "range(1, 6) ішінде 6 саны да аралаудан өтеді",
    value: false,
    exp: { ru: "Конец range не входит: range(1, 6) — это 1, 2, 3, 4, 5.", kk: "range соңы кірмейді: range(1, 6) — бұл 1, 2, 3, 4, 5.", },
    checks: [{ lines: ["print(list(range(1, 6)))"], stdout: "[1, 2, 3, 4, 5]" }],
  },
  {
    level: 1,
    id: "print-inside",
    ru: "print с отступом внутри цикла выполняется на каждом круге",
    kk: "Цикл ішіндегі шегінісі бар print әр айналымда орындалады",
    value: true,
    exp: { ru: "Всё, что с отступом, — тело цикла: оно повторяется на каждом круге.", kk: "Шегінісі барлығы — цикл денесі: ол әр айналымда қайталанады." },
  },
  {
    level: 1,
    id: "print-outside",
    ru: "print без отступа после цикла выполняется на каждом круге",
    kk: "Циклден кейінгі шегінісіз print әр айналымда орындалады",
    value: false,
    exp: { ru: "Строка без отступа не входит в тело цикла и выполняется один раз — после цикла.", kk: "Шегінісіз жол цикл денесіне кірмейді және циклден кейін бір рет орындалады." },
  },
  {
    level: 2,
    id: "elif-skip",
    ru: "Если условие if верно, то условия elif после него не проверяются",
    kk: "if шарты ақиқат болса, одан кейінгі elif шарттары тексерілмейді",
    value: true,
    exp: { ru: "В цепочке if / elif / else выполняется одна ветка — первая с верным условием; остальные пропускаются.", kk: "if / elif / else тізбегінде бір тармақ орындалады — шарты ақиқат бірінші тармақ; қалғаны өткізіледі." },
  },
  {
    level: 2,
    id: "break-rest",
    ru: "После команды break остальные строки текущего круга всё равно выполняются",
    kk: "break командасынан кейін ағымдағы айналымның қалған жолдары бәрібір орындалады",
    value: false,
    exp: { ru: "break сразу выходит из цикла: строки ниже него в этом круге не выполняются.", kk: "break циклден бірден шығады: ол жолдан төмендегі жолдар бұл айналымда орындалмайды." },
  },
  {
    level: 2,
    id: "floor10",
    ru: "Выражение n // 10 отбрасывает последнюю цифру числа n",
    kk: "n // 10 өрнегі n санының соңғы цифрын алып тастайды",
    value: true,
    exp: { ru: "n // 10 — целая часть от деления на 10: 4072 // 10 = 407.", kk: "n // 10 — 10-ға бөлудің бүтін бөлігі: 4072 // 10 = 407." },
    checks: [{ lines: ["print(4072 // 10)"], stdout: "407" }],
  },
  {
    level: 2,
    id: "plus-eq",
    ru: "Запись x += 1 делает то же, что x = x + 1",
    kk: "x += 1 жазбасы x = x + 1 жазбасымен бірдей әрекет жасайды",
    value: true,
    exp: { ru: "x += 1 — краткая запись x = x + 1: значение x увеличивается на 1.", kk: "x += 1 — x = x + 1 жазбасының қысқа түрі: x мәні 1-ге артады." },
  },
  {
    level: 2,
    id: "loopvar-after",
    ru: "После цикла for переменная цикла хранит своё последнее значение",
    kk: "for циклінен кейін цикл айнымалысы өзінің соңғы мәнін сақтайды",
    value: true,
    exp: { ru: "Переменная for остаётся после цикла: после for i in range(3) значение i равно 2.", kk: "for айнымалысы циклден кейін де қалады: for i in range(3) циклінен кейін i мәні 2 болады." },
    checks: [{ lines: ["for i in range(3):", "    pass", "print(i)"], stdout: "2" }],
  },
  {
    level: 3,
    id: "while-true",
    ru: "Цикл while True без команды break никогда не заканчивается",
    kk: "break командасы жоқ while True циклі ешқашан аяқталмайды",
    value: true,
    exp: { ru: "Условие True всегда верно, поэтому выйти из цикла можно только командой break (или ошибкой).", kk: "True шарты әрқашан ақиқат, сондықтан циклден тек break командасымен (немесе қатемен) шығуға болады." },
  },
  {
    level: 3,
    id: "tuple-assign",
    ru: "В записи a, b = b, a + b сначала a получает значение b, а затем b считается с уже новым a",
    kk: "a, b = b, a + b жазбасында алдымен a b мәнін алады, содан кейін b жаңа a бойынша есептеледі",
    value: false,
    exp: { ru: "Обе правые части вычисляются по старым значениям, и только потом записываются. Из a = 1, b = 2 получится a = 2, b = 3.", kk: "Екі оң жақ та ескі мәндер бойынша есептеліп, содан кейін ғана жазылады. a = 1, b = 2 болса, a = 2, b = 3 шығады." },
    checks: [{ lines: ["a, b = 1, 2", "a, b = b, a + b", "print(a, b)"], stdout: "2 3" }],
  },
  {
    level: 3,
    id: "mod10",
    ru: "Выражение n % 10 даёт последнюю цифру числа n",
    kk: "n % 10 өрнегі n санының соңғы цифрын береді",
    value: true,
    exp: { ru: "n % 10 — остаток от деления на 10, то есть последняя цифра: 4072 % 10 = 2.", kk: "n % 10 — 10-ға бөлгендегі қалдық, яғни соңғы цифр: 4072 % 10 = 2." },
    checks: [{ lines: ["print(4072 % 10)"], stdout: "2" }],
  },
  {
    level: 3,
    id: "continue-while",
    ru: "Если в цикле while поставить continue до строки, меняющей переменную условия, цикл может стать бесконечным",
    kk: "while циклінде continue шарт айнымалысын өзгертетін жолдан бұрын тұрса, цикл шексіз болуы мүмкін",
    value: true,
    exp: { ru: "continue пропускает остаток круга, в том числе строку, меняющую переменную условия: условие остаётся верным, и цикл повторяется вечно.", kk: "continue айналымның қалған бөлігін, соның ішінде шарт айнымалысын өзгертетін жолды да өткізіп жібереді: шарт ақиқат күйінде қалады, цикл мәңгі қайталанады." },
  },
];

function genStatement(rand: Rand, level: Level): StatementBuilt {
  const kind = int(rand, 0, 3);
  if (kind === 0) {
    // факт из списка
    const facts = FACTS.filter((f) => f.level === level);
    const f = pick(rand, facts);
    return {
      item: { id: `s:${SKILL}:fact:${f.id}`, skill: SKILL, level, text: { ru: f.ru, kk: f.kk }, value: f.value, explanation: f.exp, hint: { ru: "Вспомни, что именно делает эта команда или запись, и проверь на маленьком примере.", kk: "Бұл команданың немесе жазбаның нақты не істейтінін еске түсіріп, шағын мысалда тексер." } },
      checks: f.checks ?? [],
    };
  }
  if (level === 1) {
    if (kind === 1) {
      const b = int(rand, 3, 9);
      const q = int(rand, 2, 9);
      const r = int(rand, 0, b - 1);
      const n = b * q + r;
      const useMod = rand() < 0.5;
      const truth = useMod ? r : q;
      const value = rand() < 0.5;
      const claim = value ? truth : Math.max(0, truth + pick(rand, [-1, 1, useMod ? q : r]));
      const op = useMod ? "%" : "//";
      return {
        item: {
          id: `s:${SKILL}:divmod:${n}:${b}:${op}:${claim}`,
          skill: SKILL,
          level,
          text: same(`${n} ${op} ${b} = ${claim}`),
          value: claim === truth,
          explanation: same(`${n} = ${b} * ${q} + ${r}: ${n} // ${b} = ${q}, ${n} % ${b} = ${r}`),
          hint: { ru: "Раздели с остатком: сколько раз b целиком помещается в n и что остаётся?", kk: "Қалдықпен бөл: n ішіне b бүтін неше рет сияды және не қалады?" },
        },
        checks: [{ lines: [`print(${n} ${op} ${b})`], stdout: String(truth) }],
      };
    }
    if (kind === 2) {
      const a = int(rand, 0, 5);
      const b = a + int(rand, 3, 8);
      const n = b - a;
      const value = rand() < 0.5;
      const claim = value ? n : n + pick(rand, [-1, 1]);
      return {
        item: {
          id: `s:${SKILL}:loopcount:${a}:${b}:${claim}`,
          skill: SKILL,
          level,
          text: { ru: `Цикл for i in range(${a}, ${b}) выполнится ${claim} раз`, kk: `for i in range(${a}, ${b}) циклі ${claim} рет орындалады` },
          value: claim === n,
          explanation: {
            ru: `range(${a}, ${b}) — это ${listText(range(a, b))}: ${n} чисел, конец не входит.`,
            kk: `range(${a}, ${b}) — бұл ${listText(range(a, b))}: ${n} сан, соңы кірмейді.`,
          },
          hint: { ru: "Выпиши числа, которые даёт range, и посчитай их. Конец не входит.", kk: "range беретін сандарды жазып, санап шық. Соңы кірмейді." },
        },
        checks: [{ lines: [`print(len(range(${a}, ${b})))`], stdout: String(n) }],
      };
    }
    const a = int(rand, 1, 5);
    const b = a + int(rand, 3, 8);
    const value = rand() < 0.5;
    const claim = value ? b - 1 : b;
    return {
      item: {
        id: `s:${SKILL}:rangelast:${a}:${b}:${claim}`,
        skill: SKILL,
        level,
        text: { ru: `Последнее число в range(${a}, ${b}) — ${claim}`, kk: `range(${a}, ${b}) ішіндегі соңғы сан: ${claim}` },
        value: claim === b - 1,
        explanation: {
          ru: `range(${a}, ${b}) кончается числом ${b - 1}: само ${b} не входит.`,
          kk: `range(${a}, ${b}) ${b - 1} санымен аяқталады: ${b} санының өзі кірмейді.`,
        },
        hint: { ru: "Вспомни: конечное число в range не входит. Какое число идёт перед ним?", kk: "Есіңе түсір: range-дегі соңғы сан кірмейді. Одан бұрын қай сан тұр?" },
      },
      checks: [{ lines: [`print(list(range(${a}, ${b}))[-1])`], stdout: String(b - 1) }],
    };
  }
  if (level === 2) {
    if (kind === 1) {
      const a = int(rand, 1, 4);
      const b = a + int(rand, 3, 6);
      const truth = sum(range(a, b));
      const value = rand() < 0.5;
      const claim = value ? truth : pick(rand, [sum(range(a, b + 1)), truth + 1, truth - 1]);
      return {
        item: {
          id: `s:${SKILL}:sumloop:${a}:${b}:${claim}`,
          skill: SKILL,
          level,
          text: {
            ru: `После цикла for i in range(${a}, ${b}): s += i (начальное s = 0) значение s равно ${claim}`,
            kk: `for i in range(${a}, ${b}): s += i циклінен кейін (бастапқы s = 0) s мәні: ${claim}`,
          },
          value: claim === truth,
          explanation: same(`${range(a, b).join(" + ")} = ${truth}`),
          hint: HINT_TABLE,
        },
        checks: [{ lines: ["s = 0", `for i in range(${a}, ${b}):`, "    s += i", "print(s)"], stdout: String(truth) }],
      };
    }
    if (kind === 2) {
      const n = int(rand, 1000, 9999);
      const truth = Math.floor(n / 10) % 10;
      const value = rand() < 0.5;
      const claim = value ? truth : pick(rand, [n % 10, Math.floor(n / 100) % 10, Math.floor(n / 1000)].filter((v) => v !== truth).concat([(truth + 1) % 10]));
      return {
        item: {
          id: `s:${SKILL}:tens:${n}:${claim}`,
          skill: SKILL,
          level,
          text: same(`${n} // 10 % 10 = ${claim}`),
          value: claim === truth,
          explanation: same(`${n} // 10 = ${Math.floor(n / 10)}, ${Math.floor(n / 10)} % 10 = ${truth}`),
          hint: { ru: "Выполняй слева направо: сначала // 10 (отбрасывает последнюю цифру), затем % 10 (берёт последнюю цифру результата).", kk: "Солдан оңға қарай орында: алдымен // 10 (соңғы цифрды алып тастайды), содан кейін % 10 (нәтиженің соңғы цифрын алады)." },
        },
        checks: [{ lines: [`print(${n} // 10 % 10)`], stdout: String(truth) }],
      };
    }
    const n = int(rand, 20, 99);
    const d = pick(rand, [3, 4, 5, 6, 7] as const);
    const k = Math.floor(n / d);
    const value = rand() < 0.5;
    const claim = value ? k : k + pick(rand, [-1, 1]);
    // число кругов при x -= d, пока x >= d
    return {
      item: {
        id: `s:${SKILL}:whilecount:${n}:${d}:${claim}`,
        skill: SKILL,
        level,
        text: {
          ru: `При x = ${n} цикл while x >= ${d}: x = x - ${d} выполнится ${claim} раз`,
          kk: `x = ${n} болғанда while x >= ${d}: x = x - ${d} циклі ${claim} рет орындалады`,
        },
        value: claim === k,
        explanation: {
          ru: `Из x вычитают ${d}, пока x не станет меньше ${d}: кругов ${n} // ${d} = ${k}.`,
          kk: `x-тен ${d} саны x ${d} санынан кіші болғанша азайтылады: айналым саны ${n} // ${d} = ${k}.`,
        },
        hint: HINT_TABLE,
      },
      checks: [{ lines: [`x = ${n}`, "k = 0", `while x >= ${d}:`, `    x = x - ${d}`, "    k += 1", "print(k)"], stdout: String(k) }],
    };
  }
  // level 3
  if (kind === 1) {
    const n = int(rand, 10, 99999);
    const truth = String(n).length;
    const value = rand() < 0.5;
    const claim = value ? truth : truth + pick(rand, [-1, 1]);
    return {
      item: {
        id: `s:${SKILL}:digitsloop:${n}:${claim}`,
        skill: SKILL,
        level,
        text: {
          ru: `При n = ${n} цикл while n > 0: n //= 10 выполнится ${claim} раз`,
          kk: `n = ${n} болғанда while n > 0: n //= 10 циклі ${claim} рет орындалады`,
        },
        value: claim === truth,
        explanation: {
          ru: `Каждый круг отбрасывает одну цифру, пока n не станет 0: кругов столько, сколько цифр в числе ${n}, то есть ${truth}.`,
          kk: `Әр айналым n 0 болғанша бір цифрды алып тастайды: айналым саны ${n} санындағы цифрлар санындай, яғни ${truth}.`,
        },
        hint: { ru: "Сколько раз нужно отбросить последнюю цифру, чтобы число стало равным 0?", kk: "Сан 0 болу үшін соңғы цифрды неше рет алып тастау керек?" },
      },
      checks: [{ lines: [`n = ${n}`, "k = 0", "while n > 0:", "    n //= 10", "    k += 1", "print(k)"], stdout: String(truth) }],
    };
  }
  if (kind === 2) {
    const e = int(rand, 8, 20);
    const lim = int(rand, 10, 60);
    let i = 1;
    for (; i < e; i++) if (i * i > lim) break;
    const truth = Math.min(i, e - 1);
    const value = rand() < 0.5;
    const claim = value ? truth : truth + pick(rand, [-1, 1]);
    return {
      item: {
        id: `s:${SKILL}:breaksq:${e}:${lim}:${claim}`,
        skill: SKILL,
        level,
        text: {
          ru: `После цикла for i in range(1, ${e}) с командой if i * i > ${lim}: break значение i равно ${claim}`,
          kk: `if i * i > ${lim}: break командасы бар for i in range(1, ${e}) циклінен кейін i мәні: ${claim}`,
        },
        value: claim === truth,
        explanation: {
          ru: `Цикл останавливается на первом i, где i * i > ${lim}, и i остаётся на этом значении: ${truth} * ${truth} = ${truth * truth}. Если такого i нет, цикл доходит до последнего значения ${e - 1}.`,
          kk: `Цикл i * i > ${lim} болатын бірінші i кезінде тоқтайды да, i сол мәнде қалады: ${truth} * ${truth} = ${truth * truth}. Мұндай i болмаса, цикл соңғы ${e - 1} мәніне дейін жетеді.`,
        },
        hint: { ru: "Найди первое i, при котором i * i становится больше границы. break останавливает цикл на нём.", kk: "i * i шектен асатын бірінші i-ді тап. break циклді сол кезде тоқтатады." },
      },
      checks: [{ lines: [`for i in range(1, ${e}):`, `    if i * i > ${lim}:`, "        break", "print(i)"], stdout: String(truth) }],
    };
  }
  const a = int(rand, 20, 60);
  const b = a + int(rand, 6, 30);
  const g = gcd(a, b);
  const value = rand() < 0.5;
  const claim = value ? g : pick(rand, [Math.min(a, b), (a * b) / g, Math.max(1, g + 1)].filter((v) => v !== g));
  return {
    item: {
      id: `s:${SKILL}:gcdstat:${a}:${b}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Цикл while b != 0: a, b = b, a % b при a = ${a}, b = ${b} закончится с a = ${claim}`,
        kk: `a = ${a}, b = ${b} болғанда while b != 0: a, b = b, a % b циклі a = ${claim} мәнімен аяқталады`,
      },
      value: claim === g,
      explanation: {
        ru: `Это алгоритм Евклида: в конце a равно наибольшему общему делителю чисел ${a} и ${b}, то есть ${g}.`,
        kk: `Бұл Евклид алгоритмі: соңында a ${a} және ${b} сандарының ең үлкен ортақ бөлгішіне тең, яғни ${g}.`,
      },
      hint: HINT_TABLE,
    },
    checks: [{ lines: [`a = ${a}`, `b = ${b}`, "while b != 0:", "    a, b = b, a % b", "print(a)"], stdout: String(g) }],
  };
}

// ======================================================================
// Пары «выражение ↔ значение / смысл»
// ======================================================================

interface PairBuilt {
  item: Pair;
  checks: TraceCheck[];
}

const CONCEPT_PAIRS: { level: Level; id: string; left: Text; right: Text }[] = [
  { level: 1, id: "continue", left: "continue", right: { ru: "к следующему кругу цикла", kk: "циклдің келесі айналымына өту" } },
  { level: 1, id: "break", left: "break", right: { ru: "выход из цикла", kk: "циклден шығу" } },
  { level: 1, id: "print-in", left: { ru: "print с отступом", kk: "Шегінісі бар print" }, right: { ru: "на каждом круге", kk: "әр айналымда" } },
  { level: 1, id: "print-out", left: { ru: "print без отступа после цикла", kk: "Циклден кейінгі шегінісіз print" }, right: { ru: "один раз", kk: "бір рет" } },
  { level: 2, id: "floor10", left: "n // 10", right: { ru: "число без последней цифры", kk: "соңғы цифрсыз сан" } },
  { level: 2, id: "mod10", left: "n % 10", right: { ru: "последняя цифра", kk: "соңғы цифр" } },
  { level: 2, id: "table", left: { ru: "трассировочная таблица", kk: "трассировка кестесі" }, right: { ru: "столбец на переменную, строка на круг", kk: "әр айнымалыға баған, әр айналымға жол" } },
  { level: 3, id: "gcd", left: "a, b = b, a % b", right: { ru: "шаг алгоритма Евклида", kk: "Евклид алгоритмінің қадамы" } },
  { level: 3, id: "while-true", left: "while True", right: { ru: "цикл без конца, пока нет break", kk: "break болмайынша аяқталмайтын цикл" } },
];

function genPair(rand: Rand, level: Level): PairBuilt {
  const kind = int(rand, 0, 2);
  if (kind === 0) {
    const cps = CONCEPT_PAIRS.filter((p) => p.level === level);
    const c = pick(rand, cps);
    return { item: { id: `p:${SKILL}:${c.id}`, skill: SKILL, level, left: c.left, right: c.right }, checks: [] };
  }
  if (level === 1) {
    const b = int(rand, 3, 9);
    const q = int(rand, 2, 9);
    const r = int(rand, 0, b - 1);
    const n = b * q + r;
    const useMod = kind === 2;
    const op = useMod ? "%" : "//";
    const v = useMod ? r : q;
    return { item: { id: `p:${SKILL}:divmod:${n}:${b}:${op}`, skill: SKILL, level, left: `${n} ${op} ${b}`, right: String(v) }, checks: [{ lines: [`print(${n} ${op} ${b})`], stdout: String(v) }] };
  }
  if (level === 2) {
    const a = int(rand, 0, 5);
    const b = a + int(rand, 3, 5);
    const st = kind === 1 ? 1 : 2;
    const xs = range(a, b, st);
    return {
      item: { id: `p:${SKILL}:range:${a}:${b}:${st}`, skill: SKILL, level, left: st === 1 ? `range(${a}, ${b})` : `range(${a}, ${b}, ${st})`, right: xs.join(" ") },
      checks: [{ lines: [st === 1 ? `print(*range(${a}, ${b}))` : `print(*range(${a}, ${b}, ${st}))`], stdout: xs.join(" ") }],
    };
  }
  const n = int(rand, 1000, 9999);
  const place = kind === 1 ? 10 : 100;
  const v = Math.floor(n / place) % 10;
  return { item: { id: `p:${SKILL}:digit:${n}:${place}`, skill: SKILL, level, left: `${n} // ${place} % 10`, right: String(v) }, checks: [{ lines: [`print(${n} // ${place} % 10)`], stdout: String(v) }] };
}

// ======================================================================
// Короткие вопросы
// ======================================================================

interface ShortBuilt {
  item: ShortQuestion;
  checks: TraceCheck[];
}

function genShort(rand: Rand, level: Level): ShortBuilt {
  const kind = int(rand, 0, 2);
  if (level === 1) {
    if (kind === 2) {
      const a = int(rand, 0, 5);
      const b = a + int(rand, 3, 9);
      return {
        item: {
          id: `q:${SKILL}:rangelen:${a}:${b}`,
          skill: SKILL,
          level,
          prompt: { ru: `Сколько кругов сделает цикл for i in range(${a}, ${b})?`, kk: `for i in range(${a}, ${b}) циклі неше айналым жасайды?` },
          answer: String(b - a),
          mode: "number",
          explanation: same(`${b} − ${a} = ${b - a}`),
          hint: { ru: "Конец range не входит: кругов столько, сколько чисел от начала до конца (без конца).", kk: "range соңы кірмейді: айналым саны басынан соңына дейінгі (соңын санамағанда) сандар санындай." },
        },
        checks: [{ lines: [`print(len(range(${a}, ${b})))`], stdout: String(b - a) }],
      };
    }
    const b = int(rand, 3, 9);
    const q = int(rand, 2, 12);
    const r = int(rand, 0, b - 1);
    const n = b * q + r;
    const useMod = kind === 1;
    const op = useMod ? "%" : "//";
    const v = useMod ? r : q;
    return {
      item: {
        id: `q:${SKILL}:divmod:${n}:${b}:${op}`,
        skill: SKILL,
        level,
        prompt: { ru: `Чему равно ${n} ${op} ${b}?`, kk: `${n} ${op} ${b} неге тең?` },
        answer: String(v),
        mode: "number",
        explanation: same(`${n} = ${b} * ${q} + ${r}: ${n} // ${b} = ${q}, ${n} % ${b} = ${r}`),
        hint: { ru: "Раздели с остатком: сколько раз b целиком помещается в n и что остаётся?", kk: "Қалдықпен бөл: n ішіне b бүтін неше рет сияды және не қалады?" },
      },
      checks: [{ lines: [`print(${n} ${op} ${b})`], stdout: String(v) }],
    };
  }
  if (level === 2) {
    if (kind === 0) {
      const a = int(rand, 1, 4);
      const b = a + int(rand, 3, 7);
      const v = sum(range(a, b));
      return {
        item: {
          id: `q:${SKILL}:sum:${a}:${b}`,
          skill: SKILL,
          level,
          prompt: {
            ru: `s = 0, затем for i in range(${a}, ${b}): s += i. Чему равно s?`,
            kk: `s = 0, содан кейін for i in range(${a}, ${b}): s += i. s неге тең?`,
          },
          answer: String(v),
          mode: "number",
          explanation: same(`${range(a, b).join(" + ")} = ${v}`),
          hint: HINT_TABLE,
        },
        checks: [{ lines: ["s = 0", `for i in range(${a}, ${b}):`, "    s += i", "print(s)"], stdout: String(v) }],
      };
    }
    if (kind === 1) {
      const n = int(rand, 1000, 9999);
      const place = pick(rand, [10, 100, 1000] as const);
      const v = Math.floor(n / place) % 10;
      return {
        item: {
          id: `q:${SKILL}:digit:${n}:${place}`,
          skill: SKILL,
          level,
          prompt: { ru: `Чему равно ${n} // ${place} % 10?`, kk: `${n} // ${place} % 10 неге тең?` },
          answer: String(v),
          mode: "number",
          explanation: same(`${n} // ${place} = ${Math.floor(n / place)}, ${Math.floor(n / place)} % 10 = ${v}`),
          hint: { ru: "Выполняй слева направо: сначала целочисленное деление, потом остаток от деления на 10.", kk: "Солдан оңға қарай орында: алдымен бүтін бөлу, содан кейін 10-ға бөлгендегі қалдық." },
        },
        checks: [{ lines: [`print(${n} // ${place} % 10)`], stdout: String(v) }],
      };
    }
    const n = int(rand, 100, 9999);
    const v = sum(digitsOf(n));
    return {
      item: {
        id: `q:${SKILL}:digsum:${n}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Цикл while n > 0: s += n % 10; n //= 10 при n = ${n}, s = 0. Чему равно s после цикла?`,
          kk: `n = ${n}, s = 0 болғанда while n > 0: s += n % 10; n //= 10 циклінен кейін s неге тең?`,
        },
        answer: String(v),
        mode: "number",
        explanation: same(`${digitsOf(n).join(" + ")} = ${v}`),
        hint: { ru: "Цикл берёт цифры числа с конца и складывает их.", kk: "Цикл санның цифрларын соңынан алып, қосады." },
      },
      checks: [{ lines: [`n = ${n}`, "s = 0", "while n > 0:", "    s += n % 10", "    n //= 10", "print(s)"], stdout: String(v) }],
    };
  }
  if (kind === 0) {
    const n = int(rand, 10, 999999);
    const v = String(n).length;
    return {
      item: {
        id: `q:${SKILL}:digitsloop:${n}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Сколько раз выполнится тело цикла while n > 0: n //= 10 при n = ${n}?`,
          kk: `n = ${n} болғанда while n > 0: n //= 10 цикл денесі неше рет орындалады?`,
        },
        answer: String(v),
        mode: "number",
        explanation: same(`${n} → … → 0: ${v}`),
        hint: { ru: "Каждый круг отбрасывает одну цифру. Сколько цифр нужно отбросить, чтобы число стало 0?", kk: "Әр айналым бір цифрды алып тастайды. Сан 0 болу үшін неше цифрды алып тастау керек?" },
      },
      checks: [{ lines: [`n = ${n}`, "k = 0", "while n > 0:", "    n //= 10", "    k += 1", "print(k)"], stdout: String(v) }],
    };
  }
  if (kind === 1) {
    const a = int(rand, 4, 9);
    let k = 0;
    for (let i = 1; i < a; i++) for (let j = 0; j < i; j++) k++;
    return {
      item: {
        id: `q:${SKILL}:nested:${a}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Сколько раз выполнится k += 1: for i in range(1, ${a}): for j in range(i): k += 1?`,
          kk: `k += 1 неше рет орындалады: for i in range(1, ${a}): for j in range(i): k += 1?`,
        },
        answer: String(k),
        mode: "number",
        explanation: same(`${range(1, a).join(" + ")} = ${k}`),
        hint: { ru: "Внутренний цикл range(i) делает i кругов. Сложи по всем i.", kk: "Ішкі range(i) цикл i айналым жасайды. Барлық i бойынша қос." },
      },
      checks: [{ lines: ["k = 0", `for i in range(1, ${a}):`, "    for j in range(i):", "        k += 1", "print(k)"], stdout: String(k) }],
    };
  }
  const n = int(rand, 1000, 9999);
  const m = pick(rand, [100, 1000] as const);
  const kdiv = pick(rand, [3, 5, 7] as const);
  const v = Math.floor((n % m) / kdiv);
  return {
    item: {
      id: `q:${SKILL}:expr:${n}:${m}:${kdiv}`,
      skill: SKILL,
      level,
      prompt: { ru: `Чему равно ${n} % ${m} // ${kdiv}?`, kk: `${n} % ${m} // ${kdiv} неге тең?` },
      answer: String(v),
      mode: "number",
      explanation: same(`${n} % ${m} = ${n % m}, ${n % m} // ${kdiv} = ${v}`),
      hint: { ru: "Операции % и // равноправны: выполняй слева направо.", kk: "% және // амалдары тең құқылы: солдан оңға қарай орында." },
    },
    checks: [{ lines: [`print(${n} % ${m} // ${kdiv})`], stdout: String(v) }],
  };
}

// ======================================================================
// Банк навыка
// ======================================================================

type Gen = (rand: Rand, level: Level, seed: number) => Built;

const KINDS: Record<Level, Gen[]> = {
  1: [genSumRange, genCountPrints, genSwap, genWhileDouble, genProduct, genStrBuild, genIndentCount],
  2: [genContinueSum, genDigits, genReverse, genMaxPos, genCountCond, genWhileDec, genElifOrder, genFib],
  3: [genBreakCount, genNested, genModifyLine, genFindInput, genDivisor, genBreakContinue, genGcd],
};

function buildQuestion(level: Level, seed: number): Built {
  const rand = seeded(seed);
  return pick(rand, KINDS[level])(rand, level, seed);
}

const traceBank: SkillBank = {
  skill: SKILL,
  question: (level, seed) => buildQuestion(level, seed).step,
  statement: (level, seed) => genStatement(seeded(seed), level).item,
  pair: (level, seed) => genPair(seeded(seed), level).item,
  short: (level, seed) => genShort(seeded(seed), level).item,
};

export const BANKS: SkillBank[] = [traceBank];

/** Для проверки в python3: программы вопроса, утверждения, пары и короткого вопроса с ожидаемым выводом. */
export function traceChecks(level: Level, seed: number): { question: TraceCheck[]; statement: TraceCheck[]; pair: TraceCheck[]; short: TraceCheck[]; step: ChoiceStep | InputStep } {
  const q = buildQuestion(level, seed);
  return {
    question: q.checks,
    statement: genStatement(seeded(seed), level).checks,
    pair: genPair(seeded(seed), level).checks,
    short: genShort(seeded(seed), level).checks,
    step: q.step,
  };
}
