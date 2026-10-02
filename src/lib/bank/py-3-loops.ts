import type { ChoiceStep, InputStep, L, Level, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.loops («Циклы»): генератор программ с for / while, накопителями, break / continue, цифрами числа.
// Правильный ответ всегда считает код (функции ниже повторяют логику программы шаг за шагом), неверные варианты —
// типичные ошибки: правая граница range включена, счёт от 1 вместо 0, потерян последний круг, забыт continue.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа): формулы и двоеточия.

const SKILL = "py.loops";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const codeScene = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });

const PRINT_Q: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };
const COUNT_Q: L = { ru: "Сколько раз выполнится тело цикла?", kk: "Цикл денесі неше рет орындалады?" };

// ---------- симуляция: повторяет логику программ на Python ----------

/** Значения, которые принимает i в `for i in range(a, b, s)`. */
function rangeVals(a: number, b: number, s = 1): number[] {
  const out: number[] = [];
  if (s > 0) for (let i = a; i < b; i += s) out.push(i);
  else for (let i = a; i > b; i += s) out.push(i);
  return out;
}

const sum = (xs: number[]) => xs.reduce((p, c) => p + c, 0);
const list = (xs: number[]) => xs.join(", ");
/** Список значений для объяснения: длинный — с многоточием. */
const listShort = (xs: number[]) => (xs.length <= 8 ? list(xs) : `${xs[0]}, ${xs[1]}, …, ${xs[xs.length - 1]}`);
const rangeSrc = (a: number, b: number, s = 1) => (s === 1 ? `range(${a}, ${b})` : `range(${a}, ${b}, ${s})`);
const digitsOf = (n: number) => String(n).split("").map(Number);

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
  text: Text;
  why: L;
}

/** choice: правильный вариант + неверные (с разбором ошибки), варианты перемешаны, whyWrong выровнен. */
function choice(rand: Rand, base: Base, right: Text, wrong: Wrong[]): ChoiceStep {
  const seen = new Set<string>([JSON.stringify(right)]);
  const uniq: Wrong[] = [];
  for (const w of shuffle(wrong, rand)) {
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

/** choice с числовыми вариантами: если типичных ошибок не хватило — добиваем соседними числами. */
function numChoice(rand: Rand, base: Base, right: number, wrong: { v: number; why: L }[]): ChoiceStep {
  const seen = new Set<number>([right]);
  const ws: Wrong[] = [];
  for (const x of wrong) {
    if (x.v < 0 || seen.has(x.v)) continue;
    seen.add(x.v);
    ws.push({ text: String(x.v), why: x.why });
  }
  for (let d = 1; ws.length < 3 && d < 20; d++) {
    for (const v of [right + d, right - d]) {
      if (ws.length < 3 && v >= 0 && !seen.has(v)) {
        seen.add(v);
        ws.push({ text: String(v), why: { ru: "Неверный счёт: проверь значения по шагам, не пропуская ни одного круга.", kk: "Санау қате: мәндерді қадам-қадаммен тексер, бірде-бір айналымды өткізбе." } });
      }
    }
  }
  return choice(rand, base, String(right), ws);
}

function numberInput(base: Base, answer: number): InputStep {
  return { type: "input", skill: SKILL, ...base, answers: [String(answer)], mode: "number" };
}

// ======================================================================
// Уровень A: применить правило по образцу
// ======================================================================

// --- сколько раз выполнится цикл: range(b) и range(a, b) ---

function genCount(rand: Rand, level: Level, seed: number): ChoiceStep {
  const zero = rand() < 0.35;
  const a = zero ? 0 : int(rand, 1, 6);
  const b = zero ? int(rand, 3, 9) : a + int(rand, 3, 7);
  const src = zero ? `range(${b})` : `range(${a}, ${b})`;
  const vals = rangeVals(a, b);
  const cnt = vals.length;
  const wrong: { v: number; why: L }[] = zero
    ? [
        { v: cnt + 1, why: { ru: `Это на одно больше: счёт идёт от 0 до ${b - 1}, числа ${b} в диапазоне нет.`, kk: `Бұл бірге артық: санау 0-ден ${b - 1} санына дейін жүреді, ${b} саны диапазонда жоқ.` } },
        { v: cnt - 1, why: { ru: `Потеряно значение 0: счёт начинается с нуля, поэтому значений ровно ${b}.`, kk: `0 мәні жоғалған: санау нөлден басталады, сондықтан мәндер дәл ${b}.` } },
      ]
    : [
        { v: cnt + 1, why: { ru: `Это ${b} − ${a} + 1: правую границу ${b} включили, а она не входит.`, kk: `Бұл ${b} − ${a} + 1: оң жақ шек ${b} қосылған, ал ол кірмейді.` } },
        { v: b, why: { ru: `${b} — правая граница, а не количество повторений.`, kk: `${b} — оң жақ шек, қайталану саны емес.` } },
        { v: cnt - 1, why: { ru: `Потеряно одно значение: i = ${list(vals)} — их ${cnt}.`, kk: `Бір мән жоғалған: i = ${list(vals)} — олар ${cnt}.` } },
      ];
  return numChoice(
    rand,
    {
      id: `g:${SKILL}:count:${a}-${b}:${seed}`,
      level,
      prompt: COUNT_Q,
      scene: codeScene([`for i in ${src}:`, "    print(i)"]),
      hint: {
        ru: "Выпиши значения i по порядку, начиная с первого. Правая граница в диапазон не входит.",
        kk: "i мәндерін бірінші мәннен бастап ретімен жаз. Оң жақ шек диапазонға кірмейді.",
      },
      explanation: zero
        ? {
            ru: `range(${b}) даёт i = ${list(vals)} — счёт с нуля, числа ${b} нет. Повторений ${cnt}.`,
            kk: `range(${b}) i = ${list(vals)} мәндерін береді — санау нөлден басталады, ${b} саны жоқ. Қайталану саны ${cnt}.`,
          }
        : {
            ru: `${src} даёт i = ${list(vals)} — правая граница ${b} не входит. Повторений ${b} − ${a} = ${cnt}.`,
            kk: `${src} i = ${list(vals)} мәндерін береді — оң жақ шек ${b} кірмейді. Қайталану саны ${b} − ${a} = ${cnt}.`,
          },
    },
    cnt,
    wrong,
  );
}

// --- последнее выведенное число ---

function genLast(rand: Rand, level: Level, seed: number): InputStep {
  const a = int(rand, 1, 9);
  const b = a + int(rand, 3, 12);
  const vals = rangeVals(a, b);
  return numberInput(
    {
      id: `g:${SKILL}:last:${a}-${b}:${seed}`,
      level,
      prompt: { ru: "Какое последнее число выведет программа?", kk: "Программа соңғы болып қай санды шығарады?" },
      scene: codeScene([`for i in range(${a}, ${b}):`, "    print(i)"]),
      hint: {
        ru: "Правая граница range в диапазон не входит: последнее значение i на единицу меньше неё.",
        kk: "range-дің оң жақ шегі диапазонға кірмейді: i-дің соңғы мәні одан бірге кем.",
      },
      explanation: {
        ru: `range(${a}, ${b}) даёт i = ${listShort(vals)}. Число ${b} не входит, последнее значение — ${b - 1}.`,
        kk: `range(${a}, ${b}) i = ${listShort(vals)} мәндерін береді. ${b} саны кірмейді, соңғы мән: ${b - 1}.`,
      },
    },
    b - 1,
  );
}

// --- сумма в цикле ---

function genSum(rand: Rand, level: Level, seed: number): InputStep {
  const a = int(rand, 1, 3);
  const b = a + int(rand, 3, 6);
  const vals = rangeVals(a, b);
  const total = sum(vals);
  return numberInput(
    {
      id: `g:${SKILL}:sum:${a}-${b}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["s = 0", `for i in range(${a}, ${b}):`, "    s = s + i", "print(s)"]),
      hint: {
        ru: "Выпиши значения i (правая граница не входит) и прибавляй их к s по одному, начиная с нуля.",
        kk: "i мәндерін жаз (оң жақ шек кірмейді) да, оларды s мәніне нөлден бастап бір-бірден қос.",
      },
      explanation: {
        ru: `i = ${list(vals)}. s = ${vals.join(" + ")} = ${total}.`,
        kk: `i = ${list(vals)}. s = ${vals.join(" + ")} = ${total}.`,
      },
    },
    total,
  );
}

// --- счётчик: k = k + m ---

function genCounter(rand: Rand, level: Level, seed: number): InputStep {
  const n = int(rand, 3, 9);
  const m = int(rand, 2, 5);
  return numberInput(
    {
      id: `g:${SKILL}:counter:${n}-${m}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["k = 0", `for i in range(${n}):`, `    k = k + ${m}`, "print(k)"]),
      hint: {
        ru: "Сколько раз выполнится тело цикла? Каждый круг прибавляет к k одно и то же число.",
        kk: "Цикл денесі неше рет орындалады? Әр айналым k мәніне бір сан қосады.",
      },
      explanation: {
        ru: `range(${n}) — ${n} повторений (i = 0 … ${n - 1}). Каждое прибавляет ${m}: ${n} · ${m} = ${n * m}.`,
        kk: `range(${n}) — ${n} қайталану (i = 0 … ${n - 1}). Әрқайсысы ${m} қосады: ${n} · ${m} = ${n * m}.`,
      },
    },
    n * m,
  );
}

// --- какая строка перебирает от a до b включительно ---

function genRangeLine(rand: Rand, level: Level, seed: number): ChoiceStep {
  const a = int(rand, 1, 6);
  const b = a + int(rand, 3, 9);
  return choice(
    rand,
    {
      id: `g:${SKILL}:rangeline:${a}-${b}:${seed}`,
      level,
      prompt: {
        ru: `Нужно перебрать числа от ${a} до ${b} включительно. Какая строка подходит?`,
        kk: `${a} санынан ${b} санына дейінгі сандарды (шеттерін қоса) аралап шығу керек. Қай жол сәйкес келеді?`,
      },
      hint: {
        ru: "Правая граница range не входит в диапазон. Что нужно сделать с числом, которое должно оказаться последним?",
        kk: "range-дің оң жақ шегі диапазонға кірмейді. Соңғы болуы тиіс санмен не істеу керек?",
      },
      explanation: {
        ru: `Правая граница не входит, поэтому последнее нужное число увеличиваем на 1: for i in range(${a}, ${b + 1}): даёт i = ${a} … ${b}.`,
        kk: `Оң жақ шек кірмейді, сондықтан соңғы қажет санға 1 қосамыз: for i in range(${a}, ${b + 1}): i = ${a} … ${b} мәндерін береді.`,
      },
    },
    `for i in range(${a}, ${b + 1}):`,
    [
      { text: `for i in range(${a}, ${b}):`, why: { ru: `Правая граница ${b} не входит: цикл остановится на ${b - 1}.`, kk: `Оң жақ шек ${b} кірмейді: соңғы мән: ${b - 1}.` } },
      { text: `for i in range(${b + 1}):`, why: { ru: `Счёт начнётся с 0, а не с ${a}.`, kk: `Санау ${a} мәнінен емес, 0-ден басталады.` } },
      { text: `for i in range(${a - 1}, ${b}):`, why: { ru: `Начало сдвинуто на ${a - 1}, а конец ${b} не входит — диапазон неверный с обоих краёв.`, kk: `Басы ${a - 1} мәніне жылжыған, ал соңы ${b} кірмейді — диапазон екі шетінен де қате.` } },
      { text: `for i in range(${a}, ${b + 2}):`, why: { ru: `Лишний круг: цикл дойдёт до ${b + 1}.`, kk: `Артық айналым: цикл ${b + 1} мәніне дейін жетеді.` } },
    ],
  );
}

// ======================================================================
// Уровень B: распознать модель, проанализировать
// ======================================================================

// --- range с шагом (в том числе отрицательным): сколько раз ---

function stepRange(rand: Rand, maxCount: number): { a: number; b: number; st: number; vals: number[] } {
  for (let k = 0; k < 100; k++) {
    const st = pick(rand, [2, 3, 4, -1, -2, -3] as const);
    const a = st > 0 ? int(rand, 0, 6) : int(rand, 12, 30);
    const len = int(rand, 3, maxCount);
    const last = a + st * (len - 1);
    // правая граница не входит: она в 1…|шаг| от последнего значения (при gap = |шаг| это «следующее» число — ловушка)
    const b = last + Math.sign(st) * int(rand, 1, Math.abs(st));
    if (b >= 0) return { a, b, st, vals: rangeVals(a, b, st) };
  }
  return { a: 1, b: 10, st: 3, vals: rangeVals(1, 10, 3) };
}

function genStepCount(rand: Rand, level: Level, seed: number): InputStep {
  const { a, b, st, vals } = stepRange(rand, 9);
  return numberInput(
    {
      id: `g:${SKILL}:stepcount:${a}-${b}-${st}:${seed}`,
      level,
      prompt: COUNT_Q,
      scene: codeScene([`for i in ${rangeSrc(a, b, st)}:`, "    print(i)"]),
      hint: {
        ru: "Выпиши значения i: начни с первого числа и прибавляй шаг, пока не дойдёшь до правой границы (её саму не берём).",
        kk: "i мәндерін жаз: бірінші саннан баста да, қадам қосып отыр, оң жақ шекке жеткенше (шектің өзін алмаймыз).",
      },
      explanation: {
        ru: `${rangeSrc(a, b, st)} даёт i = ${listShort(vals)}. Правая граница ${b} не входит. Значений ${vals.length}, значит и повторений ${vals.length}.`,
        kk: `${rangeSrc(a, b, st)} i = ${listShort(vals)} мәндерін береді. Оң жақ шек ${b} кірмейді. Мәндер ${vals.length}, демек қайталану саны да ${vals.length}.`,
      },
    },
    vals.length,
  );
}

// --- сумма по range с шагом ---

function genStepSum(rand: Rand, level: Level, seed: number): InputStep {
  const { a, b, st, vals } = stepRange(rand, 6);
  const total = sum(vals);
  return numberInput(
    {
      id: `g:${SKILL}:stepsum:${a}-${b}-${st}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["s = 0", `for i in ${rangeSrc(a, b, st)}:`, "    s = s + i", "print(s)"]),
      hint: {
        ru: "Выпиши все значения i (шаг может быть отрицательным; правая граница не входит) и сложи их.",
        kk: "i мәндерінің бәрін жаз (қадам теріс болуы мүмкін; оң жақ шек кірмейді) да, оларды қос.",
      },
      explanation: {
        ru: `i = ${list(vals)}. s = ${vals.join(" + ")} = ${total}.`,
        kk: `i = ${list(vals)}. s = ${vals.join(" + ")} = ${total}.`,
      },
    },
    total,
  );
}

// --- while: удвоение / утроение, считаем круги или значение ---

function genWhileDouble(rand: Rand, level: Level, seed: number): InputStep {
  let a = 1;
  let m = 2;
  let t = 20;
  let n = a;
  let k = 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    a = int(rand, 1, 5);
    m = pick(rand, [2, 3] as const);
    t = int(rand, 20, 150);
    n = a;
    k = 0;
    while (n < t) {
      n *= m;
      k++;
    }
    if (k >= 3 && k <= 6) break;
  }
  const askCount = rand() < 0.5;
  const trail: number[] = [a];
  for (let v = a; v < t; ) {
    v *= m;
    trail.push(v);
  }
  return numberInput(
    {
      id: `g:${SKILL}:whiledouble:${a}-${m}-${t}-${askCount ? "k" : "n"}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene([`n = ${a}`, "k = 0", `while n < ${t}:`, `    n = n * ${m}`, "    k = k + 1", `print(${askCount ? "k" : "n"})`]),
      hint: {
        ru: "Веди трассировочную таблицу: после каждого круга записывай n и k. Остановись, когда условие перестанет быть верным.",
        kk: "Трассировка кестесін жүргіз: әр айналымнан кейін n және k мәндерін жаз. Шарт ақиқат болмай қалғанда тоқта.",
      },
      explanation: {
        ru: `n: ${trail.join(" → ")}. Кругов ${k} (k = ${k}), после последнего условие n < ${t} неверно: n = ${n}. Выводится ${askCount ? k : n}.`,
        kk: `n: ${trail.join(" → ")}. Айналым ${k} (k = ${k}), соңғысынан кейін n < ${t} шарты жалған: n = ${n}. ${askCount ? k : n} шығады.`,
      },
    },
    askCount ? k : n,
  );
}

// --- while: сумма 1..n и значение счётчика после цикла ---

function genWhileSum(rand: Rand, level: Level, seed: number): InputStep {
  const n = int(rand, 4, 9);
  const askI = rand() < 0.4;
  const total = (n * (n + 1)) / 2;
  return numberInput(
    {
      id: `g:${SKILL}:whilesum:${n}-${askI ? "i" : "s"}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["i = 1", "s = 0", `while i <= ${n}:`, "    s = s + i", "    i = i + 1", `print(${askI ? "i" : "s"})`]),
      hint: askI
        ? {
            ru: "Спроси себя: при каком значении i условие впервые станет неверным? Именно с этим значением цикл и закончится.",
            kk: "Өзіңнен сұра: i-дің қай мәнінде шарт алғаш рет жалған болады? Цикл дәл сол мәнмен аяқталады.",
          }
        : {
            ru: "Условие с <= включает n. Выпиши значения i и сложи их.",
            kk: "<= белгісі бар шарт n санын қосады. i мәндерін жазып, қос.",
          },
      explanation: askI
        ? {
            ru: `Цикл работает, пока i <= ${n}. Когда i становится ${n + 1}, условие неверно и цикл заканчивается. После цикла i = ${n + 1}.`,
            kk: `Цикл i <= ${n} болғанша жұмыс істейді. i мәні ${n + 1} болғанда шарт жалған, цикл аяқталады. Циклден кейін i = ${n + 1}.`,
          }
        : {
            ru: `i = 1, 2, …, ${n} (граница ${n} входит из-за <=). s = 1 + 2 + … + ${n} = ${total}.`,
            kk: `i = 1, 2, …, ${n} (<= болғандықтан шек ${n} кіреді). s = 1 + 2 + … + ${n} = ${total}.`,
          },
    },
    askI ? n + 1 : total,
  );
}

// --- счётчик кратных ---

function genCondCount(rand: Rand, level: Level, seed: number): InputStep {
  const m = int(rand, 2, 7);
  const a = int(rand, 1, 10);
  const b = a + int(rand, 10, 25);
  const vals = rangeVals(a, b).filter((i) => i % m === 0);
  return numberInput(
    {
      id: `g:${SKILL}:condcount:${a}-${b}-${m}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["k = 0", `for i in range(${a}, ${b}):`, `    if i % ${m} == 0:`, "        k = k + 1", "print(k)"]),
      hint: {
        ru: "k растёт только на тех кругах, где условие верно. Найди, какие значения i из диапазона делятся без остатка (правая граница не входит).",
        kk: "k тек шарт ақиқат болатын айналымдарда ғана өседі. Диапазондағы қай i мәндері қалдықсыз бөлінетінін тап (оң жақ шек кірмейді).",
      },
      explanation: {
        ru: `Условие i % ${m} == 0 верно для кратных ${m} среди i = ${a} … ${b - 1}: ${vals.length ? list(vals) : "таких нет"}. Всего ${vals.length}, значит k = ${vals.length}.`,
        kk: `i % ${m} == 0 шарты i = ${a} … ${b - 1} ішіндегі ${m} саны еселілері үшін ақиқат: ${vals.length ? list(vals) : "олар жоқ"}. Барлығы ${vals.length}, демек k = ${vals.length}.`,
      },
    },
    vals.length,
  );
}

// --- какие числа выведет программа ---

function genListVals(rand: Rand, level: Level, seed: number): ChoiceStep {
  const neg = rand() < 0.35;
  const st = neg ? pick(rand, [-1, -2] as const) : pick(rand, [2, 3] as const);
  const a = neg ? int(rand, 8, 14) : int(rand, 0, 5);
  const len = int(rand, 3, 5);
  const last = a + st * (len - 1);
  const b = last + Math.sign(st) * int(rand, 1, Math.abs(st));
  const vals = rangeVals(a, b, st);
  const key = (xs: number[]) => xs.join(", ");
  const over = [...vals, vals[vals.length - 1] + st];
  const wrong: Wrong[] = [
    {
      text: key(over),
      why:
        over[over.length - 1] === b
          ? { ru: `Лишнее число ${b}: это сама правая граница, она в диапазон не входит.`, kk: `Артық сан ${b}: бұл оң жақ шектің өзі, ол диапазонға кірмейді.` }
          : { ru: `Лишнее число ${over[over.length - 1]}: оно уже за правой границей ${b}.`, kk: `Артық сан ${over[over.length - 1]}: ол оң жақ шек ${b} мәнінен әрі кеткен.` },
    },
    { text: key(vals.slice(1)), why: { ru: `Потеряно первое значение ${a}: цикл начинается именно с него.`, kk: `Бірінші мән ${a} жоғалған: цикл дәл содан басталады.` } },
    { text: key(vals.slice(0, -1)), why: { ru: `Потеряно последнее значение ${vals[vals.length - 1]}: оно меньше правой границы и входит в диапазон.`, kk: `Соңғы мән ${vals[vals.length - 1]} жоғалған: ол оң жақ шектен кіші, диапазонға кіреді.` } },
  ];
  const stepOne = rangeVals(a, b, neg ? -1 : 1);
  if (stepOne.length <= 8 && key(stepOne) !== key(vals)) {
    wrong.push({ text: key(stepOne), why: { ru: `Шаг ${st} проигнорирован: числа идут не подряд, а с шагом ${st}.`, kk: `Қадам ${st} ескерілмеген: сандар қатар емес, ${st} қадаммен жүреді.` } });
  }
  return choice(
    rand,
    {
      id: `g:${SKILL}:listvals:${a}-${b}-${st}:${seed}`,
      level,
      prompt: {
        ru: `Какие числа (в порядке вывода) выведет программа?`,
        kk: `Программа қай сандарды (шығару ретімен) шығарады?`,
      },
      scene: codeScene([`for i in ${rangeSrc(a, b, st)}:`, "    print(i)"]),
      hint: {
        ru: "Начни с первого числа, прибавляй шаг и остановись перед правой границей (её саму не берём).",
        kk: "Бірінші саннан баста, қадам қосып отыр да, оң жақ шекке жетпей тоқта (шектің өзін алмаймыз).",
      },
      explanation: {
        ru: `${rangeSrc(a, b, st)}: начинаем с ${a}, шаг ${st}. Получаем ${key(vals)}; следующее число уже вышло бы за границу ${b}.`,
        kk: `${rangeSrc(a, b, st)}: ${a} мәнінен бастаймыз, қадам ${st}. ${key(vals)} шығады; келесі сан ${b} шегінен асып кетер еді.`,
      },
    },
    key(vals),
    wrong,
  );
}

// --- цифры числа: сумма и количество ---

function genDigits2(rand: Rand, level: Level, seed: number): InputStep {
  const count = rand() < 0.4;
  const n = count ? int(rand, 1000, 99999) : int(rand, 100, 999);
  const ds = digitsOf(n);
  if (count) {
    return numberInput(
      {
        id: `g:${SKILL}:digitcount:${n}:${seed}`,
        level,
        prompt: PRINT_Q,
        scene: codeScene([`n = ${n}`, "k = 0", "while n > 0:", "    k = k + 1", "    n = n // 10", "print(k)"]),
        hint: {
          ru: "Каждый круг отбрасывает у n последнюю цифру. Сколько кругов пройдёт, пока n не станет нулём?",
          kk: "Әр айналым n санының соңғы цифрын алып тастайды. n нөл болғанша қанша айналым өтеді?",
        },
        explanation: {
          ru: `Каждый круг убирает одну цифру: n = ${n} → ${[...Array(ds.length)].map((_, i) => Math.floor(n / 10 ** (i + 1))).join(" → ")}. Кругов столько же, сколько цифр: ${ds.length}.`,
          kk: `Әр айналым бір цифрды алып тастайды: n = ${n} → ${[...Array(ds.length)].map((_, i) => Math.floor(n / 10 ** (i + 1))).join(" → ")}. Айналым саны цифрлар санымен бірдей: ${ds.length}.`,
        },
      },
      ds.length,
    );
  }
  return numberInput(
    {
      id: `g:${SKILL}:digitsum:${n}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene([`n = ${n}`, "s = 0", "while n > 0:", "    s = s + n % 10", "    n = n // 10", "print(s)"]),
      hint: {
        ru: "n % 10 — последняя цифра числа, n // 10 — число без неё. Цикл по очереди берёт цифры с конца и складывает.",
        kk: "n % 10 — санның соңғы цифры, n // 10 — онсыз сан. Цикл цифрларды соңынан бастап кезекпен алып, қосады.",
      },
      explanation: {
        ru: `Цикл берёт цифры с конца: ${[...ds].reverse().join(", ")}. s = ${[...ds].reverse().join(" + ")} = ${sum(ds)}.`,
        kk: `Цикл цифрларды соңынан бастап алады: ${[...ds].reverse().join(", ")}. s = ${[...ds].reverse().join(" + ")} = ${sum(ds)}.`,
      },
    },
    sum(ds),
  );
}

// ======================================================================
// Уровень C: несколько шагов, обратная задача
// ======================================================================

// --- число наоборот ---

function genRev(rand: Rand, level: Level, seed: number): InputStep {
  const len = int(rand, 3, 4);
  let n = int(rand, 10 ** (len - 1), 10 ** len - 1);
  if (rand() < 0.5) n -= n % 10; // чаще с нулём на конце: ловушка ведущего нуля
  let r = 0;
  let m = n;
  const trail: number[] = [];
  while (m > 0) {
    r = r * 10 + (m % 10);
    m = Math.floor(m / 10);
    trail.push(r);
  }
  const zeroEnd = n % 10 === 0;
  return numberInput(
    {
      id: `g:${SKILL}:rev:${n}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene([`n = ${n}`, "r = 0", "while n > 0:", "    r = r * 10 + n % 10", "    n = n // 10", "print(r)"]),
      hint: {
        ru: "Веди таблицу n и r. Каждый круг дописывает к r справа последнюю цифру n. Помни: число в Python не хранит ведущие нули.",
        kk: "n және r кестесін жүргіз. Әр айналым n санының соңғы цифрын r санының оң жағына жазады. Есіңде болсын: Python-да санның алдындағы нөлдер сақталмайды.",
      },
      explanation: {
        ru: `r по кругам: ${trail.join(" → ")}. Цифры n собираются в обратном порядке${zeroEnd ? ", а нуль на конце n становится ведущим нулём и пропадает" : ""}. Выводится ${r}.`,
        kk: `r айналымдар бойынша: ${trail.join(" → ")}. n цифрлары кері ретпен жиналады${zeroEnd ? ", ал n соңындағы нөл алдыңғы нөлге айналып, жоғалады" : ""}. ${r} шығады.`,
      },
    },
    r,
  );
}

// --- наибольшая цифра ---

function genMaxDigit(rand: Rand, level: Level, seed: number): InputStep {
  const n = int(rand, 1000, 99999);
  const ds = digitsOf(n);
  const mx = Math.max(...ds);
  return numberInput(
    {
      id: `g:${SKILL}:maxdigit:${n}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene([`n = ${n}`, "m = 0", "while n > 0:", "    d = n % 10", "    if d > m:", "        m = d", "    n = n // 10", "print(m)"]),
      hint: {
        ru: "m хранит лучшую цифру на данный момент. Просматривай цифры с конца и меняй m, только когда встретилась цифра больше.",
        kk: "m айнымалысы әзірге ең жақсы цифрды сақтайды. Цифрларды соңынан бастап қарап шық та, m мәнін тек үлкенірек цифр кездескенде ғана өзгерт.",
      },
      explanation: {
        ru: `Цикл просматривает цифры числа с конца: ${[...ds].reverse().join(", ")}. Переменная m запоминает наибольшую — это ${mx}.`,
        kk: `Цикл санның цифрларын соңынан бастап қарайды: ${[...ds].reverse().join(", ")}. m айнымалысы ең үлкенін есте сақтайды — ол ${mx}.`,
      },
    },
    mx,
  );
}

// --- сумма чётных (нечётных) цифр ---

function genEvenDigits(rand: Rand, level: Level, seed: number): InputStep {
  const n = int(rand, 1000, 99999);
  const even = rand() < 0.5;
  const ds = digitsOf(n);
  const picked = ds.filter((d) => (even ? d % 2 === 0 : d % 2 === 1));
  const total = sum(picked);
  return numberInput(
    {
      id: `g:${SKILL}:evendigits:${n}-${even ? "e" : "o"}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene([`n = ${n}`, "s = 0", "while n > 0:", "    d = n % 10", `    if d % 2 == ${even ? 0 : 1}:`, "        s = s + d", "    n = n // 10", "print(s)"]),
      hint: {
        ru: "Разбери число на цифры и отметь те, для которых условие с остатком от деления на 2 верно. Сложи только их.",
        kk: "Санды цифрларға жікте де, 2-ге бөлгендегі қалдығы бар шарт ақиқат болатындарын белгіле. Тек соларды қос.",
      },
      explanation: {
        ru: `Цифры числа: ${ds.join(", ")}. Условие d % 2 == ${even ? 0 : 1} верно для ${even ? "чётных" : "нечётных"}: ${picked.length ? picked.join(", ") : "таких цифр нет"}. s = ${picked.length ? picked.join(" + ") : "0"} = ${total}.`,
        kk: `Санның цифрлары: ${ds.join(", ")}. d % 2 == ${even ? 0 : 1} шарты ${even ? "жұп" : "тақ"} цифрлар үшін ақиқат: ${picked.length ? picked.join(", ") : "олар жоқ"}. s = ${picked.length ? picked.join(" + ") : "0"} = ${total}.`,
      },
    },
    total,
  );
}

// --- continue: сумма без кратных ---

function genContinueSum(rand: Rand, level: Level, seed: number): InputStep {
  const m = int(rand, 2, 4);
  const a = int(rand, 1, 5);
  const b = a + int(rand, 8, 13);
  const vals = rangeVals(a, b);
  const kept = vals.filter((i) => i % m !== 0);
  const total = sum(kept);
  return numberInput(
    {
      id: `g:${SKILL}:continuesum:${a}-${b}-${m}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["s = 0", `for i in range(${a}, ${b}):`, `    if i % ${m} == 0:`, "        continue", "    s = s + i", "print(s)"]),
      hint: {
        ru: "continue пропускает остаток тела: числа, кратные делителю из условия, в сумму не попадают. Выпиши оставшиеся и сложи.",
        kk: "continue дененің қалған бөлігін өткізіп жібереді: шарттағы бөлгішке еселі сандар қосындыға кірмейді. Қалғандарын жазып, қос.",
      },
      explanation: {
        ru: `i = ${list(vals)}. Числа, кратные ${m}, пропускаются через continue. В сумму идут: ${list(kept)}. s = ${kept.join(" + ")} = ${total}.`,
        kk: `i = ${list(vals)}. ${m} санына еселі сандар continue арқылы өткізіледі. Қосындыға кіретіндері: ${list(kept)}. s = ${kept.join(" + ")} = ${total}.`,
      },
    },
    total,
  );
}

// --- break: на каком i остановимся ---

function genBreakSum(rand: Rand, level: Level, seed: number): InputStep {
  const t = int(rand, 15, 60);
  let s = 0;
  let stop = 1;
  const trail: number[] = [];
  for (let i = 1; i < 50; i++) {
    s += i;
    trail.push(s);
    if (s > t) {
      stop = i;
      break;
    }
  }
  return numberInput(
    {
      id: `g:${SKILL}:breaksum:${t}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(["s = 0", "for i in range(1, 50):", "    s = s + i", `    if s > ${t}:`, "        break", "print(i)"]),
      hint: {
        ru: "Веди таблицу i и s. Цикл прерывается, как только s станет больше порога; i после цикла сохраняет последнее значение.",
        kk: "i және s кестесін жүргіз. s шектен асысымен цикл үзіледі; циклден кейін i соңғы мәнін сақтайды.",
      },
      explanation: {
        ru: `s по кругам: ${trail.join(", ")}. Условие s > ${t} впервые верно при s = ${s}, тогда i = ${stop}: break прерывает цикл, и print(i) выводит ${stop}.`,
        kk: `s айналымдар бойынша: ${trail.join(", ")}. s > ${t} шарты алғаш рет s = ${s} болғанда ақиқат, сонда i = ${stop}: break циклді үзеді, print(i) ${stop} шығарады.`,
      },
    },
    stop,
  );
}

// --- обратная задача: найти n ---

function genInverse(rand: Rand, level: Level, seed: number): ChoiceStep {
  const n = int(rand, 4, 12);
  const tri = (k: number) => (k * (k + 1)) / 2;
  const total = tri(n);
  const why = (k: number): L => ({
    ru: `При n = ${k} сумма 1 + 2 + … + ${k} равна ${tri(k)}, а не ${total}.`,
    kk: `n = ${k} болғанда 1 + 2 + … + ${k} қосындысы ${tri(k)} болады, ${total} емес.`,
  });
  return numChoice(
    rand,
    {
      id: `g:${SKILL}:inverse:${n}:${seed}`,
      level,
      prompt: { ru: `При каком значении n программа выведет ${total}?`, kk: `n-нің қай мәнінде программа ${total} шығарады?` },
      scene: codeScene(["n = int(input())", "s = 0", "for i in range(1, n + 1):", "    s = s + i", "print(s)"]),
      hint: {
        ru: "Программа складывает числа от 1 до n. Прибавляй 1, 2, 3, … по очереди, пока сумма не достигнет нужного значения.",
        kk: "Программа 1-ден n-ге дейінгі сандарды қосады. Қосынды керекті мәнге жеткенше 1, 2, 3, … сандарын кезекпен қоса бер.",
      },
      explanation: {
        ru: `Нужна сумма 1 + 2 + … + n = ${total}. Частичные суммы: ${[...Array(n)].map((_, i) => tri(i + 1)).join(", ")}. Сумма ${total} получается при n = ${n} (граница входит из-за n + 1 в range).`,
        kk: `1 + 2 + … + n = ${total} қосындысы керек. Жартылай қосындылар: ${[...Array(n)].map((_, i) => tri(i + 1)).join(", ")}. ${total} қосындысы n = ${n} болғанда шығады (range ішіндегі n + 1 арқасында шек кіреді).`,
      },
    },
    n,
    [
      { v: n - 1, why: why(n - 1) },
      { v: n + 1, why: why(n + 1) },
      { v: total, why: { ru: `n — это количество слагаемых, а не сама сумма. При n = ${total} сумма была бы ${tri(total)}.`, kk: `n — қосылғыштар саны, қосындының өзі емес. n = ${total} болғанда қосынды ${tri(total)} болар еді.` } },
    ],
  );
}

// --- что изменится, если < заменить на <= ---

function genLtLe(rand: Rand, level: Level, seed: number): InputStep {
  const st = pick(rand, [1, 1, 2, 3] as const);
  const a = int(rand, 1, 4);
  const n = a + st * int(rand, 2, 5) + (rand() < 0.5 ? 0 : int(rand, 1, st));
  const run = (le: boolean) => {
    let i = a;
    let s = 0;
    while (le ? i <= n : i < n) {
      s += i;
      i += st;
    }
    return s;
  };
  const before = run(false);
  const after = run(true);
  const diff = after - before;
  return numberInput(
    {
      id: `g:${SKILL}:ltle:${a}-${n}-${st}:${seed}`,
      level,
      prompt: {
        ru: "Программа выводит s. На сколько увеличится выведенное значение, если в условии заменить < на <=?",
        kk: "Программа s шығарады. Шартта < белгісін <= белгісіне ауыстырса, шығатын мән қаншаға артады?",
      },
      scene: codeScene([`i = ${a}`, "s = 0", `while i < ${n}:`, "    s = s + i", `    i = i + ${st}`, "print(s)"]),
      hint: {
        ru: "Замена даёт ещё один круг только в том случае, если i когда-нибудь станет в точности равным границе. Проверь, попадает ли i в границу с таким шагом.",
        kk: "Ауыстыру тағы бір айналым тек i мәні шекке дәл тең болғанда ғана береді. i осындай қадаммен шекке тура келе ме, тексер.",
      },
      explanation: {
        ru: `Со знаком < выводится ${before}, со знаком <= — ${after}. Разница ${diff}${diff === 0 ? `: i = ${list(rangeVals(a, n + 1, st))} никогда не равно ${n}, лишнего круга нет` : `: добавляется круг при i = ${n}`}.`,
        kk: `< белгісімен ${before} шығады, <= белгісімен — ${after}. Айырма ${diff}${diff === 0 ? `: i = ${list(rangeVals(a, n + 1, st))} мәндері ешқашан ${n} мәніне тең емес, артық айналым жоқ` : `: i = ${n} болғанда бір айналым қосылады`}.`,
      },
    },
    diff,
  );
}

// ======================================================================
// Утверждения «верно / неверно»
// ======================================================================

interface StaticStatement {
  level: Level;
  ru: string;
  kk: string;
  value: boolean;
  why: L;
}

const STATIC_STATEMENTS: StaticStatement[] = [
  { level: 1, ru: "Цикл for i in range(5) выполняется 5 раз", kk: "for i in range(5) циклі 5 рет орындалады", value: true, why: { ru: "Да: i = 0, 1, 2, 3, 4 — пять значений.", kk: "Иә: i = 0, 1, 2, 3, 4 — бес мән." } },
  { level: 1, ru: "В range(1, 6) число 6 входит в диапазон", kk: "range(1, 6) диапазонына 6 саны кіреді", value: false, why: { ru: "Нет: правая граница не входит, диапазон — 1, 2, 3, 4, 5.", kk: "Жоқ: оң жақ шек кірмейді, диапазон — 1, 2, 3, 4, 5." } },
  { level: 1, ru: "Строка for … in range(…) заканчивается двоеточием", kk: "for … in range(…) жолы қос нүктемен аяқталады", value: true, why: { ru: "Да: после заголовка цикла ставится двоеточие.", kk: "Иә: цикл тақырыбынан кейін қос нүкте қойылады." } },
  { level: 1, ru: "range(5) начинается с числа 1", kk: "range(5) 1 санынан басталады", value: false, why: { ru: "Нет: с одним числом счёт идёт с нуля — 0, 1, 2, 3, 4.", kk: "Жоқ: бір санмен санау нөлден басталады — 0, 1, 2, 3, 4." } },
  { level: 1, ru: "Тело цикла записывают с отступом в 4 пробела", kk: "Цикл денесі 4 бос орын шегінісімен жазылады", value: true, why: { ru: "Да: по отступу Python понимает, какие строки повторяются.", kk: "Иә: шегініс арқылы Python қай жолдардың қайталанатынын түсінеді." } },
  { level: 1, ru: "Переменная i в цикле for получает новое значение на каждом круге", kk: "for циклінде i айнымалысы әр айналымда жаңа мән алады", value: true, why: { ru: "Да: i — счётчик, его значения берутся из range.", kk: "Иә: i — санауыш, оның мәндері range ішінен алынады." } },
  { level: 2, ru: "Цикл while выполняется, пока его условие верно", kk: "while циклі шарты ақиқат болғанша орындалады", value: true, why: { ru: "Да: перед каждым кругом условие проверяется заново.", kk: "Иә: әр айналымның алдында шарт қайта тексеріледі." } },
  { level: 2, ru: "Если в теле while не менять переменную из условия, цикл может стать бесконечным", kk: "while денесінде шарттағы айнымалы өзгермесе, цикл шексіз болуы мүмкін", value: true, why: { ru: "Да: условие всё время остаётся верным, и программа зависает.", kk: "Иә: шарт үнемі ақиқат күйінде қалады, программа қатып қалады." } },
  { level: 2, ru: "Оператор break переходит к следующему шагу цикла", kk: "break операторы циклдің келесі қадамына өтеді", value: false, why: { ru: "Нет: так работает continue, а break выходит из цикла совсем.", kk: "Жоқ: бұлай continue жұмыс істейді, ал break циклден мүлде шығады." } },
  { level: 2, ru: "Оператор continue пропускает остаток тела на текущем круге", kk: "continue операторы ағымдағы айналымда дененің қалған бөлігін өткізіп жібереді", value: true, why: { ru: "Да: цикл сразу переходит к следующему значению.", kk: "Иә: цикл бірден келесі мәнге өтеді." } },
  { level: 2, ru: "range(10, 0, -2) даёт числа 10, 8, 6, 4, 2, 0", kk: "range(10, 0, -2) 10, 8, 6, 4, 2, 0 сандарын береді", value: false, why: { ru: "Нет: правая граница 0 не входит, последнее число — 2.", kk: "Жоқ: оң жақ шек 0 кірмейді, соңғы сан — 2." } },
  { level: 2, ru: "Перед накоплением суммы переменную s нужно обнулить: s = 0", kk: "Қосындыны жинау алдында s айнымалысын нөлдеу керек: s = 0", value: true, why: { ru: "Да: иначе в s окажется случайное или неопределённое значение.", kk: "Иә: әйтпесе s ішінде кездейсоқ немесе анықталмаған мән болады." } },
  { level: 3, ru: "Выражение n % 10 даёт последнюю цифру числа n", kk: "n % 10 өрнегі n санының соңғы цифрын береді", value: true, why: { ru: "Да: остаток от деления на 10 — это цифра единиц.", kk: "Иә: 10-ға бөлгендегі қалдық — бірліктер цифры." } },
  { level: 3, ru: "Выражение n // 10 отбрасывает последнюю цифру числа n", kk: "n // 10 өрнегі n санының соңғы цифрын алып тастайды", value: true, why: { ru: "Да: целая часть от деления на 10 — число без последней цифры.", kk: "Иә: 10-ға бөлгендегі бүтін бөлік — соңғы цифрсыз сан." } },
  { level: 3, ru: "Цикл for i in range(5, 0) выполнится 5 раз", kk: "for i in range(5, 0) циклі 5 рет орындалады", value: false, why: { ru: "Нет: шаг по умолчанию +1, а начало больше конца, поэтому значений нет и цикл не выполнится ни разу.", kk: "Жоқ: әдепкі қадам +1, ал басы соңынан үлкен, сондықтан мәндер жоқ, цикл бірде-бір рет орындалмайды." } },
  { level: 3, ru: "После цикла for i in range(5) переменная i равна 5", kk: "for i in range(5) циклінен кейін i айнымалысы 5-ке тең", value: false, why: { ru: "Нет: последнее значение i равно 4, пятёрка в range(5) не входит.", kk: "Жоқ: i-дің соңғы мәні 4-ке тең, 5 саны range(5) ішіне кірмейді." } },
  { level: 3, ru: "Замена < на <= в условии while не может уменьшить число кругов", kk: "while шартында < белгісін <= белгісіне ауыстыру айналым санын азайта алмайды", value: true, why: { ru: "Да: условие с <= верно во всех случаях, где верно условие с <, и ещё в одном.", kk: "Иә: <= шарты < шарты ақиқат болатын барлық жағдайда ақиқат, және тағы бір жағдайда да." } },
  { level: 3, ru: "Цикл while n > 0: n = n // 10 выполняется столько раз, сколько цифр в записи n", kk: "while n > 0: n = n // 10 циклі n жазбасындағы цифрлар санындай рет орындалады", value: true, why: { ru: "Да: каждый круг убирает ровно одну цифру.", kk: "Иә: әр айналым дәл бір цифрды алып тастайды." } },
];

function genStatement(rand: Rand, level: Level): Statement {
  const r = rand();
  if (r < 0.4) {
    const pool = STATIC_STATEMENTS.filter((s) => s.level === level);
    const s = pick(rand, pool);
    return { id: `s:${SKILL}:static:${s.ru.slice(0, 28)}`, skill: SKILL, level, text: { ru: s.ru, kk: s.kk }, value: s.value, explanation: s.why };
  }
  if (level === 1) {
    const a = int(rand, 0, 6);
    const b = a + int(rand, 3, 8);
    const cnt = b - a;
    const claim = rand() < 0.5 ? cnt : cnt + pick(rand, [-1, 1] as const);
    return {
      id: `s:${SKILL}:count:${a}:${b}:${claim}`,
      skill: SKILL,
      level,
      text: { ru: `Цикл for i in range(${a}, ${b}) выполняется ${claim} раз`, kk: `for i in range(${a}, ${b}) циклі ${claim} рет орындалады` },
      value: claim === cnt,
      explanation: {
        ru: `range(${a}, ${b}) даёт ${list(rangeVals(a, b))}: правая граница ${b} не входит. Повторений ${b} − ${a} = ${cnt}.`,
        kk: `range(${a}, ${b}) ${list(rangeVals(a, b))} мәндерін береді: оң жақ шек ${b} кірмейді. Қайталану саны ${b} − ${a} = ${cnt}.`,
      },
      hint: {
        ru: "Выпиши значения i. Правая граница в диапазон не входит.",
        kk: "i мәндерін жаз. Оң жақ шек диапазонға кірмейді.",
      },
    };
  }
  if (level === 2) {
    const { a, b, st, vals } = stepRange(rand, 6);
    let claimVals = vals;
    let ok = true;
    if (rand() < 0.5) {
      ok = false;
      const kind = int(rand, 0, 2);
      claimVals = kind === 0 ? [...vals, vals[vals.length - 1] + st] : kind === 1 ? vals.slice(1) : vals.slice(0, -1);
    }
    return {
      id: `s:${SKILL}:vals:${a}:${b}:${st}:${ok ? 1 : 0}:${claimVals.length}`,
      skill: SKILL,
      level,
      text: { ru: `range(${a}, ${b}, ${st}) даёт числа ${list(claimVals)}`, kk: `range(${a}, ${b}, ${st}) ${list(claimVals)} сандарын береді` },
      value: ok,
      explanation: {
        ru: `Начинаем с ${a}, шаг ${st}, правая граница ${b} не входит: ${list(vals)}.`,
        kk: `${a} мәнінен бастаймыз, қадам ${st}, оң жақ шек ${b} кірмейді: ${list(vals)}.`,
      },
      hint: {
        ru: "Начни с первого числа, прибавляй шаг и остановись перед правой границей.",
        kk: "Бірінші саннан баста, қадам қосып отыр да, оң жақ шекке жетпей тоқта.",
      },
    };
  }
  const n = int(rand, 100, 99999);
  const kind = rand() < 0.5 ? "cnt" : "div";
  if (kind === "cnt") {
    const real = String(n).length;
    const claim = rand() < 0.5 ? real : real + pick(rand, [-1, 1] as const);
    return {
      id: `s:${SKILL}:digits:${n}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `При n = ${n} цикл while n > 0: n = n // 10 выполнится ${claim} раз`,
        kk: `n = ${n} болғанда while n > 0: n = n // 10 циклі ${claim} рет орындалады`,
      },
      value: claim === real,
      explanation: {
        ru: `Каждый круг убирает одну цифру, а в ${n} цифр: ${real}. Значит, кругов ${real}.`,
        kk: `Әр айналым бір цифрды алып тастайды, ал ${n} санында цифр ${real}. Демек, айналым ${real}.`,
      },
      hint: {
        ru: "Что делает n // 10 с числом? Сколько раз можно так сократить число до нуля?",
        kk: "n // 10 санмен не істейді? Санды осылай нөлге дейін қанша рет қысқартуға болады?",
      },
    };
  }
  const real = Math.floor(n / 10);
  const claim = rand() < 0.5 ? real : n % 10;
  return {
    id: `s:${SKILL}:div10:${n}:${claim}`,
    skill: SKILL,
    level,
    text: { ru: `При n = ${n} значение n // 10 равно ${claim}`, kk: `n = ${n} болғанда n // 10 өрнегінің мәні мынаған тең: ${claim}` },
    value: claim === real,
    explanation: {
      ru: `n // 10 — число без последней цифры: ${real}. Последняя цифра — это n % 10 = ${n % 10}.`,
      kk: `n // 10 — соңғы цифрсыз сан: ${real}. Соңғы цифр — бұл n % 10 = ${n % 10}.`,
    },
    hint: {
      ru: "Не путай: // отбрасывает последнюю цифру, а % выдаёт её.",
      kk: "Шатастырма: // соңғы цифрды алып тастайды, ал % оны береді.",
    },
  };
}

// ======================================================================
// Пары «запись ↔ смысл»
// ======================================================================

const CONCEPT_PAIRS: { level: Level; id: string; left: Text; right: L }[] = [
  { level: 1, id: "for", left: "for i in range(n)", right: { ru: "повторить n раз", kk: "n рет қайталау" } },
  { level: 1, id: "while", left: "while условие:", right: { ru: "повторять, пока условие верно", kk: "шарт ақиқат болғанша қайталау" } },
  { level: 2, id: "break", left: "break", right: { ru: "выйти из цикла совсем", kk: "циклден мүлде шығу" } },
  { level: 2, id: "continue", left: "continue", right: { ru: "перейти к следующему шагу", kk: "келесі қадамға өту" } },
  { level: 2, id: "acc-sum", left: "s = s + i", right: { ru: "накопить сумму", kk: "қосындыны жинау" } },
  { level: 2, id: "acc-count", left: "k = k + 1", right: { ru: "посчитать повторения", kk: "қайталануды санау" } },
  { level: 2, id: "acc-prod", left: "p = p * i", right: { ru: "накопить произведение", kk: "көбейтіндіні жинау" } },
  { level: 3, id: "mod10", left: "n % 10", right: { ru: "последняя цифра числа", kk: "санның соңғы цифры" } },
  { level: 3, id: "div10", left: "n // 10", right: { ru: "число без последней цифры", kk: "соңғы цифрсыз сан" } },
  { level: 3, id: "while-n", left: "while n > 0:", right: { ru: "пока в числе есть цифры", kk: "санда цифрлар бар болғанша" } },
];

function genPair(rand: Rand, level: Level): Pair {
  const stat = CONCEPT_PAIRS.filter((p) => p.level === level);
  if (level === 1 && rand() < 0.6) {
    const a = int(rand, 0, 6);
    const b = a + int(rand, 2, 5);
    return { id: `p:${SKILL}:r:${a}:${b}`, skill: SKILL, level, left: `range(${a}, ${b})`, right: list(rangeVals(a, b)) };
  }
  if (level === 2 && rand() < 0.5) {
    const { a, b, st, vals } = stepRange(rand, 5);
    return { id: `p:${SKILL}:rs:${a}:${b}:${st}`, skill: SKILL, level, left: rangeSrc(a, b, st), right: list(vals) };
  }
  if (level === 3 && rand() < 0.5) {
    const n = int(rand, 100, 99999);
    return rand() < 0.5
      ? { id: `p:${SKILL}:m10:${n}`, skill: SKILL, level, left: `${n} % 10`, right: String(n % 10) }
      : { id: `p:${SKILL}:d10:${n}`, skill: SKILL, level, left: `${n} // 10`, right: String(Math.floor(n / 10)) };
  }
  const p = pick(rand, stat);
  return { id: `p:${SKILL}:c:${p.id}`, skill: SKILL, level, left: p.left, right: p.right };
}

// ======================================================================
// Короткие вопросы
// ======================================================================

function genShort(rand: Rand, level: Level): ShortQuestion {
  if (level === 1) {
    const a = int(rand, 0, 8);
    const b = a + int(rand, 3, 12);
    return {
      id: `q:${SKILL}:count:${a}:${b}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Сколько раз выполнится цикл for i in range(${a}, ${b})?`,
        kk: `for i in range(${a}, ${b}) циклі неше рет орындалады?`,
      },
      answer: String(b - a),
      mode: "number",
      explanation: {
        ru: `Значения i: ${listShort(rangeVals(a, b))}. Правая граница не входит: ${b} − ${a} = ${b - a}.`,
        kk: `i мәндері: ${listShort(rangeVals(a, b))}. Оң жақ шек кірмейді: ${b} − ${a} = ${b - a}.`,
      },
      hint: { ru: "Правая граница в диапазон не входит.", kk: "Оң жақ шек диапазонға кірмейді." },
    };
  }
  if (level === 2) {
    const { a, b, st, vals } = stepRange(rand, 9);
    if (rand() < 0.5) {
      return {
        id: `q:${SKILL}:stepcount:${a}:${b}:${st}`,
        skill: SKILL,
        level,
        prompt: { ru: `Сколько чисел выдаёт ${rangeSrc(a, b, st)}?`, kk: `${rangeSrc(a, b, st)} қанша сан береді?` },
        answer: String(vals.length),
        mode: "number",
        explanation: { ru: `Значения: ${listShort(vals)}. Всего ${vals.length}.`, kk: `Мәндер: ${listShort(vals)}. Барлығы ${vals.length}.` },
        hint: { ru: "Начни с первого числа, прибавляй шаг и остановись перед правой границей.", kk: "Бірінші саннан баста, қадам қосып отыр да, оң жақ шекке жетпей тоқта." },
      };
    }
    const last = vals[vals.length - 1];
    return {
      id: `q:${SKILL}:steplast:${a}:${b}:${st}`,
      skill: SKILL,
      level,
      prompt: { ru: `Какое последнее число выдаёт ${rangeSrc(a, b, st)}?`, kk: `${rangeSrc(a, b, st)} соңғы болып қай санды береді?` },
      answer: String(last),
      mode: "number",
      explanation: { ru: `Значения: ${listShort(vals)}. Последнее — ${last}.`, kk: `Мәндер: ${listShort(vals)}. Соңғысы: ${last}.` },
      hint: { ru: "Прибавляй шаг к первому числу, пока не дойдёшь до правой границы (её саму не берём).", kk: "Бірінші санға қадам қосып отыр, оң жақ шекке жеткенше (шектің өзін алмаймыз)." },
    };
  }
  const n = int(rand, 100, 99999);
  const ds = digitsOf(n);
  const kind = int(rand, 0, 2);
  if (kind === 0) {
    return {
      id: `q:${SKILL}:digitsum:${n}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Цикл while n > 0 берёт n % 10 и n // 10. Что он накопит в s как сумму цифр числа n = ${n}?`,
        kk: `while n > 0 циклі n % 10 және n // 10 өрнектерін алады. n = ${n} санының цифрларының қосындысы ретінде s ішінде не жиналады?`,
      },
      answer: String(sum(ds)),
      mode: "number",
      explanation: { ru: `${ds.join(" + ")} = ${sum(ds)}.`, kk: `${ds.join(" + ")} = ${sum(ds)}.` },
      hint: { ru: "Каждый круг прибавляет к s последнюю цифру числа, потом число сокращается.", kk: "Әр айналым s мәніне санның соңғы цифрын қосады, содан кейін сан қысқарады." },
    };
  }
  if (kind === 1) {
    return {
      id: `q:${SKILL}:digitcount:${n}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Сколько раз выполнится цикл while n > 0: n = n // 10 при n = ${n}?`,
        kk: `n = ${n} болғанда while n > 0: n = n // 10 циклі неше рет орындалады?`,
      },
      answer: String(ds.length),
      mode: "number",
      explanation: { ru: `Каждый круг убирает одну цифру; цифр ${ds.length}.`, kk: `Әр айналым бір цифрды алып тастайды; цифр ${ds.length}.` },
      hint: { ru: "Что делает n // 10 с числом? Сколько раз так можно сокращать, пока не получится нуль?", kk: "n // 10 санмен не істейді? Нөл шыққанша осылай қанша рет қысқартуға болады?" },
    };
  }
  let r = 0;
  for (let m = n; m > 0; m = Math.floor(m / 10)) r = r * 10 + (m % 10);
  return {
    id: `q:${SKILL}:rev:${n}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `Цикл while n > 0: r = r * 10 + n % 10; n = n // 10 при n = ${n} и r = 0. Чему равно r после цикла?`,
      kk: `n = ${n} және r = 0 болғанда while n > 0: r = r * 10 + n % 10; n = n // 10 циклі орындалды. Циклден кейін r неге тең?`,
    },
    answer: String(r),
    mode: "number",
    explanation: { ru: `Цифры собираются в обратном порядке: ${[...ds].reverse().join("")}${String(r) !== [...ds].reverse().join("") ? ` — ведущие нули в числе пропадают: ${r}` : ""}.`, kk: `Цифрлар кері ретпен жиналады: ${[...ds].reverse().join("")}${String(r) !== [...ds].reverse().join("") ? ` — санның алдындағы нөлдер жоғалады: ${r}` : ""}.` },
    hint: { ru: "Каждый круг дописывает к r справа последнюю цифру n. Число не хранит ведущие нули.", kk: "Әр айналым n санының соңғы цифрын r санының оң жағына жазады. Сан алдыңғы нөлдерді сақтамайды." },
  };
}

// ======================================================================
// Банк навыка
// ======================================================================

type Gen = (rand: Rand, level: Level, seed: number) => ChoiceStep | InputStep;

const KINDS: Record<Level, Gen[]> = {
  1: [genCount, genLast, genSum, genCounter, genRangeLine],
  2: [genStepCount, genStepSum, genWhileDouble, genWhileSum, genCondCount, genListVals, genDigits2],
  3: [genRev, genMaxDigit, genEvenDigits, genContinueSum, genBreakSum, genInverse, genLtLe],
};

const loopsBank: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    return pick(rand, KINDS[level])(rand, level, seed);
  },
  statement: (level, seed) => genStatement(seeded(seed), level),
  pair: (level, seed) => genPair(seeded(seed), level),
  short: (level, seed) => genShort(seeded(seed), level),
};

export const BANKS: SkillBank[] = [loopsBank];
