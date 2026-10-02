import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene } from "../types";
import { toSubscriptBase } from "../check";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка ns.anybase: системы счисления с любым основанием (2…16).
// Правильный ответ всегда вычисляет код (digitsValue / toBase), неверные варианты — типичные ошибки.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа).
// Основание неизвестного числа записываем как 42(x): подстрочная «ₓ» есть не во всех шрифтах.

const SKILL = "ns.anybase";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

// ---------- Арифметика систем счисления ----------

const DIGITS = "0123456789ABCDEF";
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUPS[Number(d)]);
const sub = (b: number) => toSubscriptBase(b);
const rec = (s: string, b: number) => `${s}${sub(b)}`;

/** Значение цифры (A = 10 … F = 15). */
const digitValue = (ch: string) => DIGITS.indexOf(ch);

/** Значение записи в системе с основанием b — по развёрнутой форме (схема Горнера). */
function fromBase(s: string, b: number): number {
  let v = 0;
  for (const ch of s) v = v * b + digitValue(ch);
  return v;
}

/** Запись числа n в системе с основанием b — делением с остатком. */
function toBase(n: number, b: number): string {
  if (n === 0) return "0";
  let out = "";
  let v = n;
  while (v > 0) {
    out = DIGITS[v % b] + out;
    v = Math.floor(v / b);
  }
  return out;
}

/** Развёрнутая форма со степенями: 2·4² + 1·4¹ + 3·4⁰. */
function expandPow(s: string, b: number): string {
  return s
    .split("")
    .map((ch, i) => `${digitValue(ch)}·${b}${sup(s.length - 1 - i)}`)
    .join(" + ");
}

/** Развёрнутая форма с числами: 2·16 + 1·4 + 3·1 = 39. */
function expandNum(s: string, b: number): string {
  const parts = s.split("").map((ch, i) => `${digitValue(ch)}·${b ** (s.length - 1 - i)}`);
  return `${parts.join(" + ")} = ${fromBase(s, b)}`;
}

/** Цепочка делений лесенки: «77 : 5 = 15 (остаток 2)». */
function ladderChain(n: number, b: number, lang: "ru" | "kk"): string {
  const word = lang === "ru" ? "остаток" : "қалдығы";
  const parts: string[] = [];
  let v = n;
  while (v > 0) {
    const r = v % b;
    parts.push(`${v} : ${b} = ${Math.floor(v / b)} (${word} ${r}${r >= 10 ? ` = ${DIGITS[r]}` : ""})`);
    v = Math.floor(v / b);
  }
  return parts.join("; ");
}

const hasLetter = (s: string) => /[A-F]/.test(s);
/** Запись, прочитанная наоборот (без ведущих нулей): так выглядит ошибка «остатки сверху вниз». */
const reverseStr = (s: string) => s.split("").reverse().join("").replace(/^0+(?=.)/, "");

/** Запись без старшей цифры (потерян последний остаток); пустая строка, если остались одни нули. */
const dropFirst = (s: string) => {
  const rest = s.slice(1).replace(/^0+/, "");
  return rest;
};

/** Случайная запись из len цифр в системе b: старшая цифра не нуль, не все цифры нули. */
function randomRecord(rand: Rand, b: number, len: number, opts: { letter?: boolean } = {}): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let s = DIGITS[int(rand, 1, b - 1)];
    for (let i = 1; i < len; i++) s += DIGITS[int(rand, 0, b - 1)];
    if (opts.letter && !hasLetter(s)) continue;
    if (!opts.letter && hasLetter(s)) continue;
    return s;
  }
  // Запасной вариант (недостижим при b ≥ 11): буква на последнем месте.
  return opts.letter ? `1${"0".repeat(len - 2)}${DIGITS[b - 1]}` : "1".repeat(len);
}

// ---------- Варианты ответа с разбором ошибок ----------

interface Wrong {
  v: string;
  why: L;
}

const WHY = {
  reversed: {
    ru: "Цифры прочитаны в обратном порядке: веса подписывают справа налево.",
    kk: "Цифрлар кері ретпен оқылған: салмақтар оңнан солға қарай жазылады.",
  },
  shifted: {
    ru: "Степени начаты не с нуля: у правой цифры вес 1, а не основание.",
    kk: "Дәрежелер нөлден басталмаған: оң жақ цифрдың салмағы — 1, негіз емес.",
  },
  asDecimal: {
    ru: "Это сама запись, прочитанная как десятичное число: основание не учтено.",
    kk: "Бұл жазбаның өзі ондық сан ретінде оқылған: негіз ескерілмеген.",
  },
  timesBase: {
    ru: "Каждая цифра умножена на основание, а не на степень основания.",
    kk: "Әр цифр негіздің дәрежесіне емес, негізге көбейтілген.",
  },
  arithmetic: {
    ru: "Ошибка в вычислениях: проверь произведения «цифра · вес» и их сумму.",
    kk: "Есептеуде қате: «цифр · салмақ» көбейтінділерін және олардың қосындысын тексер.",
  },
  topDown: {
    ru: "Остатки прочитаны сверху вниз: их читают снизу вверх.",
    kk: "Қалдықтар жоғарыдан төмен оқылған: оларды төменнен жоғары оқиды.",
  },
  lostLast: {
    ru: "Потерян последний остаток — старшая цифра записи.",
    kk: "Соңғы қалдық — жазбаның бірінші цифры — жоғалған.",
  },
} satisfies Record<string, L>;

/** Собирает 4 варианта: верный + 3 уникальных неверных (добор — соседние значения), порядок перемешан. */
function buildOptions(
  rand: Rand,
  correct: string,
  wrongs: Wrong[],
  fill: (k: number) => string,
): { options: string[]; correct: number; whyWrong: (L | null)[] } {
  const seen = new Set<string>([correct]);
  const picked: Wrong[] = [];
  // Одинаковые значения неверных вариантов: сохраняем первое (самое «типичное») объяснение.
  const unique = wrongs.filter((w, i) => wrongs.findIndex((x) => x.v === w.v) === i);
  for (const w of shuffle(unique, rand)) {
    if (picked.length >= 3) break;
    if (!w.v || seen.has(w.v)) continue;
    seen.add(w.v);
    picked.push(w);
  }
  for (let k = 1; picked.length < 3 && k < 40; k++) {
    const v = fill(k);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    picked.push({ v, why: WHY.arithmetic });
  }
  const all: Wrong[] = [{ v: correct, why: WHY.arithmetic }, ...picked];
  const order = shuffle(all, rand);
  return {
    options: order.map((o) => o.v),
    correct: order.findIndex((o) => o.v === correct),
    whyWrong: order.map((o) => (o.v === correct ? null : o.why)),
  };
}

// ---------- Сцены-раскрытия ----------

/** Таблица развёрнутой формы: цифра, вес, вклад. */
function expansionScene(s: string, b: number): Scene {
  return {
    kind: "table",
    columns: [
      { ru: "Цифра", kk: "Цифр" },
      { ru: "Вес", kk: "Салмақ" },
      { ru: "Вклад", kk: "Үлес" },
    ],
    rows: s.split("").map((ch, i) => {
      const k = s.length - 1 - i;
      const d = digitValue(ch);
      return [ch, `${b}${sup(k)} = ${b ** k}`, `${d}·${b ** k} = ${d * b ** k}`];
    }),
  };
}

// ---------- Параметры по уровням ----------

const BASES_SMALL = [3, 4, 5, 6, 7, 8, 9] as const;
const BASES_LETTER = [11, 12, 13, 14, 15] as const;

/** Неизвестное основание для задач «найди x»: 10 исключено — запись совпала бы с десятичным числом. */
const pickX = (rand: Rand, max: number) => pick(rand, [5, 6, 7, 8, 9, 11, 12].filter((v) => v <= max));

/** Запись из len цифр так, чтобы значение не было слишком большим. */
function levelRecord(rand: Rand, level: Level): { b: number; s: string } {
  if (level === 1) {
    const b = pick(rand, BASES_SMALL);
    const len = b <= 5 ? pick(rand, [2, 3]) : 2;
    return { b, s: randomRecord(rand, b, len) };
  }
  if (level === 2) {
    const b = pick(rand, BASES_SMALL);
    return { b, s: randomRecord(rand, b, 3) };
  }
  const b = pick(rand, BASES_SMALL);
  return { b, s: randomRecord(rand, b, b <= 6 ? 4 : 3) };
}

// ---------- Генераторы заданий ----------

const HINT = {
  q2d: {
    ru: "Подпиши веса справа налево: 1, затем основание, затем основание в квадрате… Умножь каждую цифру на её вес и сложи.",
    kk: "Салмақтарды оңнан солға қарай жаз: 1, содан кейін негіз, одан кейін негіздің квадраты… Әр цифрды өз салмағына көбейтіп, қос.",
  },
  d2q: {
    ru: "Дели число на основание, пока частное не станет 0. Остатки читай снизу вверх.",
    kk: "Санды негізге бөл, бөлінді 0 болғанша. Қалдықтарды төменнен жоғары оқы.",
  },
  d2qLetter: {
    ru: "Дели на основание и читай остатки снизу вверх. Остаток 10 и больше пиши буквой: 10 = A, 11 = B, 12 = C…",
    kk: "Негізге бөліп, қалдықтарды төменнен жоғары оқы. 10 және одан үлкен қалдықты әріппен жаз: 10 = A, 11 = B, 12 = C…",
  },
  valid: {
    ru: "Цифры идут от 0 до основания минус 1. Найди запись, в которой есть цифра, не меньшая основания.",
    kk: "Цифрлар 0-ден негіз минус 1 болғанға дейін жүреді. Негізден кіші емес цифры бар жазбаны тап.",
  },
  compare: {
    ru: "Записи «на глаз» сравнивать нельзя: основания разные. Переведи каждое число в десятичную систему.",
    kk: "Жазбаларды «көзбен» салыстыруға болмайды: негіздері әртүрлі. Әр санды ондық жүйеге аудар.",
  },
  findBase: {
    ru: "Запиши число в развёрнутой форме с неизвестным x и составь уравнение. Помни: x больше любой цифры записи.",
    kk: "Санды белгісіз x арқылы жайылған түрінде жаз да, теңдеу құр. Есте сақта: x жазбадағы кез келген цифрдан үлкен.",
  },
  minBase: {
    ru: "Найди наибольшую цифру в записи: основание должно быть больше неё.",
    kk: "Жазбадағы ең үлкен цифрды тап: негіз одан үлкен болуы керек.",
  },
  count: {
    ru: "Переведи число в нужную систему и посчитай цифры (единицы) в записи.",
    kk: "Санды қажетті жүйеге аудар да, жазбадағы цифрларды (бірліктерді) санап шық.",
  },
  sum: {
    ru: "Переведи каждое число в десятичную систему, затем выполни действие.",
    kk: "Әр санды ондық жүйеге аудар, содан кейін амалды орында.",
  },
} satisfies Record<string, L>;

const ENTRY = (kind: string, arg: string, seed: number) => `g:${SKILL}:${kind}:${arg}:${seed}`;

/** q → 10: choice (L1) или input (L1–L3). */
function genQ2D(rand: Rand, level: Level, seed: number, letters = false): QuestionStep {
  let b: number;
  let s: string;
  if (letters) {
    b = pick(rand, BASES_LETTER);
    s = randomRecord(rand, b, 3, { letter: true });
  } else {
    ({ b, s } = levelRecord(rand, level));
  }
  const n = fromBase(s, b);
  const asChoice = level === 1 && rand() < 0.6;
  const id = ENTRY(letters ? "q2dl" : "q2d", `${s}b${b}`, seed);
  const explanation: L = {
    ru: `Развёрнутая форма: ${rec(s, b)} = ${expandPow(s, b)} = ${expandNum(s, b)}.${letters ? " Буква означает число: A = 10, B = 11, C = 12…" : ""}`,
    kk: `Жайылған түрі: ${rec(s, b)} = ${expandPow(s, b)} = ${expandNum(s, b)}.${letters ? " Әріп санды білдіреді: A = 10, B = 11, C = 12…" : ""}`,
  };
  const reveal = expansionScene(s, b);
  if (asChoice) {
    const o = buildOptions(
      rand,
      String(n),
      [
        { v: String(fromBase(reverseStr(s), b)), why: WHY.reversed },
        { v: String(n * b), why: WHY.shifted },
        { v: s, why: WHY.asDecimal },
        { v: String(b * s.split("").reduce((a, ch) => a + digitValue(ch), 0)), why: WHY.timesBase },
        { v: String(n + 1), why: WHY.arithmetic },
        { v: String(n - 1), why: WHY.arithmetic },
      ],
      (k) => String(n + k + 1),
    );
    return {
      id,
      type: "choice",
      skill: SKILL,
      level,
      prompt: { ru: `Переведи в десятичную систему: ${rec(s, b)}`, kk: `Ондық жүйеге аудар: ${rec(s, b)}` },
      ...o,
      reveal,
      hint: HINT.q2d,
      explanation,
    } satisfies ChoiceStep;
  }
  return {
    id,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Переведи в десятичную систему: ${rec(s, b)} = ?`, kk: `Ондық жүйеге аудар: ${rec(s, b)} = ?` },
    answers: [String(n)],
    mode: "number",
    suffix: "₁₀",
    reveal,
    hint: HINT.q2d,
    explanation,
  } satisfies InputStep;
}

/** 10 → q: choice (L1) или input. letters — основание 11…15, в записи есть буквы. */
function genD2Q(rand: Rand, level: Level, seed: number, letters = false): QuestionStep {
  let b: number;
  let n: number;
  if (letters) {
    b = pick(rand, BASES_LETTER);
    n = fromBase(randomRecord(rand, b, 3, { letter: true }), b);
  } else if (level === 1) {
    b = pick(rand, [3, 4, 5, 6, 7] as const);
    n = int(rand, 7, 40);
  } else if (level === 2) {
    b = pick(rand, BASES_SMALL);
    n = int(rand, 30, 200);
  } else {
    b = pick(rand, BASES_SMALL);
    n = int(rand, 200, 1200);
  }
  const answer = toBase(n, b);
  const id = ENTRY(letters ? "d2ql" : "d2q", `${n}b${b}`, seed);
  const explanation: L = {
    ru: `Делим на ${b} и читаем остатки снизу вверх: ${ladderChain(n, b, "ru")}. Ответ: ${rec(answer, b)}. Проверка: ${expandNum(answer, b)}.${hasLetter(answer) ? " Остаток 10 и больше пишем буквой." : ""}`,
    kk: `${b} санына бөліп, қалдықтарды төменнен жоғары оқимыз: ${ladderChain(n, b, "kk")}. Жауабы: ${rec(answer, b)}. Тексеру: ${expandNum(answer, b)}.${hasLetter(answer) ? " 10 және одан үлкен қалдықты әріппен жазамыз." : ""}`,
  };
  const reveal: Scene = { kind: "ladder", number: n, base: b, readUp: true };
  const prompt: L = {
    ru: `Запиши число ${n} в системе счисления с основанием ${b}`,
    kk: `${n} санын негізі ${b} санау жүйесінде жаз`,
  };
  const hint = letters ? HINT.d2qLetter : HINT.d2q;
  if (level === 1 && !letters && rand() < 0.6 && answer.length > 1) {
    const o = buildOptions(
      rand,
      answer,
      [
        { v: reverseStr(answer), why: WHY.topDown },
        { v: dropFirst(answer), why: WHY.lostLast },
        { v: toBase(n, b + 1), why: { ru: `Это запись числа в системе с основанием ${b + 1}, а не ${b}.`, kk: `Бұл санның негізі ${b + 1} жүйедегі жазбасы, ${b} емес.` } },
        { v: toBase(n, b - 1), why: { ru: `Это запись числа в системе с основанием ${b - 1}, а не ${b}.`, kk: `Бұл санның негізі ${b - 1} жүйедегі жазбасы, ${b} емес.` } },
      ],
      (k) => toBase(n + k, b),
    );
    return {
      id,
      type: "choice",
      skill: SKILL,
      level,
      prompt,
      options: o.options.map((x) => rec(x, b)),
      correct: o.correct,
      whyWrong: o.whyWrong,
      reveal,
      hint,
      explanation,
    } satisfies ChoiceStep;
  }
  return {
    id,
    type: "input",
    skill: SKILL,
    level,
    prompt,
    answers: [answer],
    mode: "number",
    suffix: sub(b),
    reveal,
    hint,
    explanation,
  } satisfies InputStep;
}

/** Какая запись возможна в системе с основанием b (L1). */
function genValid(rand: Rand, seed: number): QuestionStep {
  const b = pick(rand, [2, 3, 4, 5, 6, 7, 8] as const);
  const len = 4;
  const good = randomRecord(rand, b, len);
  const bads: Wrong[] = [];
  const seen = new Set<string>([good]);
  while (bads.length < 3) {
    const base = randomRecord(rand, b, len);
    const pos = int(rand, 0, len - 1);
    const bad = pick(rand, [b, b + 1].filter((d) => d <= 9));
    const s = `${base.slice(0, pos)}${bad}${base.slice(pos + 1)}`;
    if (seen.has(s)) continue;
    seen.add(s);
    bads.push({
      v: s,
      why: {
        ru: `В записи есть цифра ${bad}, а в системе с основанием ${b} наибольшая цифра — ${b - 1}.`,
        kk: `Жазбада ${bad} цифры бар, ал негізі ${b} жүйеде ең үлкен цифр — ${b - 1}.`,
      },
    });
  }
  const o = buildOptions(rand, good, bads, () => "");
  return {
    id: ENTRY("valid", `${good}b${b}`, seed),
    type: "choice",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: `Какая запись может быть числом в системе счисления с основанием ${b}?`,
      kk: `Негізі ${b} санау жүйесінде қандай жазба сан бола алады?`,
    },
    ...o,
    hint: HINT.valid,
    explanation: {
      ru: `В системе с основанием ${b} цифры от 0 до ${b - 1}. Подходит только ${good}: в остальных записях есть цифра, не меньшая ${b}.`,
      kk: `Негізі ${b} жүйеде цифрлар 0-ден ${b - 1} санына дейін болады. Тек ${good} жарайды: қалған жазбаларда ${b} санынан кіші емес цифр бар.`,
    },
  };
}

/** Какое из четырёх чисел в разных системах наибольшее / наименьшее (L2). */
function genCompare(rand: Rand, level: Level, seed: number): QuestionStep {
  const biggest = rand() < 0.65;
  const bases = [2, 3, 4, 5, 6, 7, 8, 9];
  let items: { b: number; s: string; n: number }[] = [];
  for (let attempt = 0; attempt < 80; attempt++) {
    const picked = shuffle(bases, rand).slice(0, 4);
    const cand = picked.map((b) => {
      const n = int(rand, level === 2 ? 12 : 30, level === 2 ? 40 : 90);
      return { b, s: toBase(n, b), n };
    });
    const values = cand.map((c) => c.n);
    if (new Set(values).size !== 4) continue;
    // Запись числа в двоичной системе всегда длиннее: ловушка «самая длинная = самая большая» остаётся честной.
    items = cand;
    break;
  }
  if (!items.length) {
    items = [
      { b: 2, s: "1101", n: 13 },
      { b: 6, s: "25", n: 17 },
      { b: 8, s: "16", n: 14 },
      { b: 5, s: "31", n: 16 },
    ];
  }
  const target = items.reduce((a, c) => ((biggest ? c.n > a.n : c.n < a.n) ? c : a));
  const options = items.map((c) => rec(c.s, c.b));
  const correct = items.indexOf(target);
  const longest = items.reduce((a, c) => (c.s.length > a.s.length ? c : a));
  const whyWrong: (L | null)[] = items.map((c, i) => {
    if (i === correct) return null;
    if (c === longest && biggest) {
      return {
        ru: `Запись самая длинная, но число равно ${c.n} — меньше, чем ${target.n}.`,
        kk: `Жазбасы ең ұзын, бірақ сан ${c.n} санына тең — ${target.n} санынан кіші.`,
      };
    }
    return biggest
      ? { ru: `${rec(c.s, c.b)} = ${c.n} — меньше, чем ${target.n}.`, kk: `${rec(c.s, c.b)} = ${c.n} — ${target.n} санынан кіші.` }
      : { ru: `${rec(c.s, c.b)} = ${c.n} — больше, чем ${target.n}.`, kk: `${rec(c.s, c.b)} = ${c.n} — ${target.n} санынан үлкен.` };
  });
  const conv = items.map((c) => `${rec(c.s, c.b)} = ${c.n}`).join(", ");
  return {
    id: ENTRY("compare", `${options.join("-")}${biggest ? "max" : "min"}`, seed),
    type: "choice",
    skill: SKILL,
    level,
    prompt: biggest ? { ru: "Какое из чисел наибольшее?", kk: "Қай сан ең үлкен?" } : { ru: "Какое из чисел наименьшее?", kk: "Қай сан ең кіші?" },
    options,
    correct,
    whyWrong,
    hint: HINT.compare,
    explanation: {
      ru: `Переводим всё в десятичную: ${conv}. ${biggest ? "Наибольшее" : "Наименьшее"} — ${rec(target.s, target.b)}.`,
      kk: `Барлығын ондық жүйеге аударамыз: ${conv}. ${biggest ? "Ең үлкені" : "Ең кішісі"} — ${rec(target.s, target.b)}.`,
    },
  };
}

/** Наименьшее основание, в котором можно записать число (L2: выбор, L3: значение в этой системе). */
function genMinBase(rand: Rand, level: Level, seed: number): QuestionStep {
  const m = int(rand, 3, 8);
  const len = int(rand, 3, 5);
  let s = "";
  for (let attempt = 0; attempt < 100; attempt++) {
    s = DIGITS[int(rand, 1, m)];
    for (let i = 1; i < len; i++) s += DIGITS[int(rand, 0, m)];
    if (s.includes(String(m))) break;
  }
  if (!s.includes(String(m))) s = `${s.slice(0, -1)}${m}`;
  const minBase = m + 1;
  if (level === 3) {
    const value = fromBase(s, minBase);
    return {
      id: ENTRY("minval", `${s}`, seed),
      type: "input",
      skill: SKILL,
      level,
      prompt: {
        ru: `Число ${s} записано в системе счисления с наименьшим возможным основанием. Найди его значение в десятичной системе.`,
        kk: `${s} саны мүмкін болатын ең кіші негізді санау жүйесінде жазылған. Оның ондық жүйедегі мәнін тап.`,
      },
      answers: [String(value)],
      mode: "number",
      suffix: "₁₀",
      reveal: expansionScene(s, minBase),
      hint: {
        ru: "Сначала найди наименьшее основание: наибольшая цифра плюс 1. Затем переведи запись в десятичную систему.",
        kk: "Алдымен ең кіші негізді тап: ең үлкен цифр плюс 1. Содан кейін жазбаны ондық жүйеге аудар.",
      },
      explanation: {
        ru: `Наибольшая цифра в записи ${s} — ${m}, значит наименьшее основание ${minBase}. Тогда ${rec(s, minBase)} = ${expandPow(s, minBase)} = ${expandNum(s, minBase)}.`,
        kk: `${s} жазбасындағы ең үлкен цифр — ${m}, демек ең кіші негіз ${minBase}. Сонда ${rec(s, minBase)} = ${expandPow(s, minBase)} = ${expandNum(s, minBase)}.`,
      },
    };
  }
  const o = buildOptions(
    rand,
    String(minBase),
    [
      {
        v: String(m),
        why: {
          ru: `Основание не может быть равно наибольшей цифре ${m}: в такой системе цифры только до ${m - 1}.`,
          kk: `Негіз ең үлкен цифр ${m} санына тең бола алмайды: мұндай жүйеде цифрлар тек ${m - 1} санына дейін.`,
        },
      },
      {
        v: String(minBase + 1),
        why: {
          ru: `Такое основание допустимо, но оно не наименьшее: подходит и ${minBase}.`,
          kk: `Мұндай негіз жарайды, бірақ ең кішісі емес: ${minBase} те жарайды.`,
        },
      },
      {
        v: String(s.length),
        why: {
          ru: "Это количество цифр в записи, а не наибольшая цифра плюс 1.",
          kk: "Бұл жазбадағы цифрлар саны, ал керегі — ең үлкен цифр плюс 1.",
        },
      },
      {
        v: String(minBase + 2),
        why: {
          ru: `Основание ${minBase + 2} допустимо, но не наименьшее.`,
          kk: `Негіз ${minBase + 2} жарайды, бірақ ең кішісі емес.`,
        },
      },
    ],
    (k) => String(minBase + 2 + k),
  );
  return {
    id: ENTRY("minbase", s, seed),
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Наименьшее основание системы счисления, в которой может быть записано число ${s}:`,
      kk: `${s} саны жазыла алатын санау жүйесінің ең кіші негізі:`,
    },
    ...o,
    hint: HINT.minBase,
    explanation: {
      ru: `Наибольшая цифра в записи ${s} — ${m}. Основание должно быть больше неё, поэтому наименьшее основание — ${m} + 1 = ${minBase}.`,
      kk: `${s} жазбасындағы ең үлкен цифр — ${m}. Негіз одан үлкен болуы керек, сондықтан ең кіші негіз — ${m} + 1 = ${minBase}.`,
    },
  };
}

/** Найти основание x: двузначная запись (линейное уравнение) или трёхзначная (подбор). */
function genFindBase(rand: Rand, level: Level, seed: number, three = false): QuestionStep {
  const x = pickX(rand, three ? 9 : 12);
  // Цифры только 0–9, чтобы запись из нескольких цифр читалась однозначно (цифра 10 была бы «A»).
  const dmax = Math.min(x - 1, 9);
  let digits: number[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    digits = [int(rand, 1, dmax), ...Array.from({ length: three ? 2 : 1 }, () => int(rand, 0, dmax))];
    if (!(three && digits[1] === 0 && digits[2] === 0)) break;
  }
  const n = digits.reduce((a, d) => a * x + d, 0);
  const record = digits.join("");
  const maxDigit = Math.max(...digits);
  const poly = three
    ? `${digits[0]}·x² + ${digits[1]}·x + ${digits[2]}`
    : `${digits[0]}·x + ${digits[1]}`;
  let explanationRu: string;
  let explanationKk: string;
  if (!three) {
    const rest = n - digits[1];
    explanationRu = `${record}(x) = ${poly} = ${n}, откуда ${digits[0]}x = ${rest} и x = ${x}. Проверка: наибольшая цифра ${maxDigit} меньше ${x}, запись возможна; ${digits[0]}·${x} + ${digits[1]} = ${n}.`;
    explanationKk = `${record}(x) = ${poly} = ${n}, осыдан ${digits[0]}x = ${rest} және x = ${x}. Тексеру: ең үлкен цифр ${maxDigit} < ${x}, жазба мүмкін; ${digits[0]}·${x} + ${digits[1]} = ${n}.`;
  } else {
    const tries: string[] = [];
    for (let t = maxDigit + 1; t <= x; t++) tries.push(`x = ${t}: ${digits[0] * t * t + digits[1] * t + digits[2]}`);
    explanationRu = `${record}(x) = ${poly} = ${n}. Наибольшая цифра ${maxDigit}, значит x ≥ ${maxDigit + 1}. Пробуем по очереди — ${tries.join("; ")}. Подходит x = ${x}: число растёт вместе с основанием, поэтому ответ один.`;
    explanationKk = `${record}(x) = ${poly} = ${n}. Ең үлкен цифр ${maxDigit}, демек x ≥ ${maxDigit + 1}. Ретімен сынаймыз — ${tries.join("; ")}. x = ${x} жарайды: сан негізбен бірге өседі, сондықтан жауап біреу.`;
  }
  return {
    id: ENTRY(three ? "findx3" : "findx", `${record}e${n}`, seed),
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Число ${record} записано в системе с основанием x: ${record}(x) = ${n}₁₀. Найди x.`,
      kk: `${record} саны негізі x жүйеде жазылған: ${record}(x) = ${n}₁₀. x мәнін тап.`,
    },
    answers: [String(x)],
    mode: "number",
    hint: HINT.findBase,
    explanation: { ru: explanationRu, kk: explanationKk },
  };
}

/** Сколько цифр / единиц в записи числа в системе с основанием b (L3). */
function genCount(rand: Rand, level: Level, seed: number): QuestionStep {
  const ones = rand() < 0.5;
  const b = ones ? pick(rand, [3, 4, 5] as const) : pick(rand, [3, 4, 5, 6, 7, 8] as const);
  let n = int(rand, 100, 900);
  // Для «сколько единиц» ответ не должен быть нулём.
  for (let attempt = 0; ones && attempt < 50 && !toBase(n, b).includes("1"); attempt++) n = int(rand, 100, 900);
  const s = toBase(n, b);
  const count = ones ? s.split("").filter((c) => c === "1").length : s.length;
  const reveal: Scene = { kind: "ladder", number: n, base: b, readUp: true };
  if (ones) {
    return {
      id: ENTRY("ones", `${n}b${b}`, seed),
      type: "input",
      skill: SKILL,
      level,
      prompt: {
        ru: `Сколько единиц в записи числа ${n} в системе счисления с основанием ${b}?`,
        kk: `${n} санының негізі ${b} санау жүйесіндегі жазбасында неше бірлік бар?`,
      },
      answers: [String(count)],
      mode: "number",
      reveal,
      hint: HINT.count,
      explanation: {
        ru: `${n} = ${rec(s, b)} (${s.length} цифр). Единиц в записи: ${count}.`,
        kk: `${n} = ${rec(s, b)} (${s.length} цифр). Жазбадағы бірліктер саны: ${count}.`,
      },
    };
  }
  const o = buildOptions(
    rand,
    String(count),
    [
      { v: String(count - 1), why: { ru: "Одна цифра потеряна — проверь, что последний остаток записан.", kk: "Бір цифр жоғалған — соңғы қалдықтың жазылғанын тексер." } },
      { v: String(count + 1), why: { ru: "Лишняя цифра: деление заканчивается, когда частное стало 0.", kk: "Артық цифр: бөлінді 0 болғанда бөлу аяқталады." } },
      { v: String(count + 2), why: WHY.arithmetic },
    ],
    (k) => String(count + k + 2),
  );
  return {
    id: ENTRY("len", `${n}b${b}`, seed),
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько цифр в записи числа ${n} в системе счисления с основанием ${b}?`,
      kk: `${n} санының негізі ${b} санау жүйесіндегі жазбасында неше цифр бар?`,
    },
    ...o,
    reveal,
    hint: HINT.count,
    explanation: {
      ru: `${b}${sup(s.length - 1)} = ${b ** (s.length - 1)} ≤ ${n} < ${b ** s.length} = ${b}${sup(s.length)}, значит цифр ${s.length}: ${n} = ${rec(s, b)}.`,
      kk: `${b}${sup(s.length - 1)} = ${b ** (s.length - 1)} ≤ ${n} < ${b ** s.length} = ${b}${sup(s.length)}, демек цифрлар саны ${s.length}: ${n} = ${rec(s, b)}.`,
    },
  };
}

/** Значение выражения с числами из двух систем (L3). */
function genSum(rand: Rand, level: Level, seed: number): QuestionStep {
  let plus = rand() < 0.6;
  let b1: number = pick(rand, BASES_SMALL);
  let b2: number = pick(rand, BASES_SMALL);
  if (b1 === b2) b2 = b1 === 9 ? 3 : b1 + 1;
  let s1 = randomRecord(rand, b1, 2);
  let s2 = randomRecord(rand, b2, 2);
  const a = fromBase(s1, b1);
  const c = fromBase(s2, b2);
  if (!plus) {
    // В разности уменьшаемое должно быть больше вычитаемого, равные числа — берём сумму.
    if (a === c) plus = true;
    else if (a < c) [s1, b1, s2, b2] = [s2, b2, s1, b1];
  }
  const x = fromBase(s1, b1);
  const y = fromBase(s2, b2);
  const result = plus ? x + y : x - y;
  const op = plus ? "+" : "−";
  return {
    id: ENTRY("expr", `${s1}b${b1}${plus ? "p" : "m"}${s2}b${b2}`, seed),
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Вычисли в десятичной системе: ${rec(s1, b1)} ${op} ${rec(s2, b2)}`,
      kk: `Ондық жүйеде есепте: ${rec(s1, b1)} ${op} ${rec(s2, b2)}`,
    },
    answers: [String(result)],
    mode: "number",
    suffix: "₁₀",
    hint: HINT.sum,
    explanation: {
      ru: `${rec(s1, b1)} = ${expandNum(s1, b1)}; ${rec(s2, b2)} = ${expandNum(s2, b2)}. Тогда ${x} ${op} ${y} = ${result}.`,
      kk: `${rec(s1, b1)} = ${expandNum(s1, b1)}; ${rec(s2, b2)} = ${expandNum(s2, b2)}. Сонда ${x} ${op} ${y} = ${result}.`,
    },
  };
}

function generate(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["q2d", "q2d", "d2q", "valid"] as const);
    if (kind === "q2d") return genQ2D(rand, level, seed);
    if (kind === "d2q") return genD2Q(rand, level, seed);
    return genValid(rand, seed);
  }
  if (level === 2) {
    const kind = pick(rand, ["q2d", "d2q", "d2q", "q2dl", "d2ql", "compare", "minbase"] as const);
    if (kind === "q2d") return genQ2D(rand, level, seed);
    if (kind === "d2q") return genD2Q(rand, level, seed);
    if (kind === "q2dl") return genQ2D(rand, level, seed, true);
    if (kind === "d2ql") return genD2Q(rand, level, seed, true);
    if (kind === "compare") return genCompare(rand, level, seed);
    return genMinBase(rand, level, seed);
  }
  const kind = pick(rand, ["findx", "findx", "findx3", "minval", "count", "expr", "d2q", "q2d", "compare"] as const);
  if (kind === "findx") return genFindBase(rand, level, seed);
  if (kind === "findx3") return genFindBase(rand, level, seed, true);
  if (kind === "minval") return genMinBase(rand, level, seed);
  if (kind === "count") return genCount(rand, level, seed);
  if (kind === "expr") return genSum(rand, level, seed);
  if (kind === "d2q") return genD2Q(rand, level, seed);
  if (kind === "q2d") return genQ2D(rand, level, seed);
  return genCompare(rand, level, seed);
}

// ---------- Утверждения «верно / неверно» ----------

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const id = (k: string, a: string) => `s:${SKILL}:${k}:${a}`;
  if (level === 1) {
    if (rand() < 0.5) {
      // Допустима ли запись в системе с основанием b.
      const b = pick(rand, [2, 3, 4, 5, 6, 7, 8] as const);
      const good = randomRecord(rand, b, 4);
      const value = rand() < 0.5;
      const bad = pick(rand, [b, b + 1].filter((d) => d <= 9));
      const s = value ? good : `${good.slice(0, 3)}${bad}`;
      return {
        id: id("valid", `${s}b${b}`),
        skill: SKILL,
        level,
        text: {
          ru: `Запись ${s} может быть числом в системе с основанием ${b}`,
          kk: `${s} жазбасы негізі ${b} жүйедегі сан бола алады`,
        },
        value,
        explanation: {
          ru: `Цифры системы с основанием ${b}: от 0 до ${b - 1}.${value ? "" : ` В записи ${s} есть цифра ${bad}.`}`,
          kk: `Негізі ${b} жүйенің цифрлары: 0-ден ${b - 1} санына дейін.${value ? "" : ` ${s} жазбасында ${bad} цифры бар.`}`,
        },
      };
    }
    const { b, s } = levelRecord(rand, 1);
    const n = fromBase(s, b);
    const value = rand() < 0.5;
    const claim = value ? n : pick(rand, [fromBase(reverseStr(s), b), n * b, n + 1, n - 1].filter((v) => v > 0 && v !== n));
    return {
      id: id("q2d", `${s}b${b}:${claim}`),
      skill: SKILL,
      level,
      text: same(`${rec(s, b)} = ${claim}₁₀`),
      value: claim === n,
      explanation: same(`${rec(s, b)} = ${expandPow(s, b)} = ${n}₁₀`),
    };
  }
  if (level === 2) {
    const kind = pick(rand, ["d2q", "ten", "pow"] as const);
    if (kind === "d2q") {
      const b = pick(rand, BASES_SMALL);
      const n = int(rand, 20, 150);
      const good = toBase(n, b);
      const value = rand() < 0.5;
      const claim = value ? good : pick(rand, [reverseStr(good), toBase(n + 1, b), dropFirst(good) || "1"].filter((v) => v !== good));
      return {
        id: id("d2q", `${n}b${b}:${claim}`),
        skill: SKILL,
        level,
        text: same(`${n}₁₀ = ${rec(claim, b)}`),
        value: claim === good,
        explanation: same(`${n}₁₀ = ${rec(good, b)}: ${expandNum(good, b)}`),
      };
    }
    if (kind === "ten") {
      const b = pick(rand, [3, 4, 5, 6, 7, 8, 9, 12] as const);
      const value = rand() < 0.5;
      const claim = value ? b : pick(rand, [b - 1, b + 1, 10]);
      return {
        id: id("ten", `${b}:${claim}`),
        skill: SKILL,
        level,
        text: {
          ru: `В системе с основанием ${b} запись 10 означает число ${claim}`,
          kk: `Негізі ${b} жүйеде 10 жазбасы ${claim} санын білдіреді`,
        },
        value: claim === b,
        explanation: {
          ru: `10(${b}) = 1·${b} + 0 = ${b}: «десять» в любой системе — это её основание.`,
          kk: `10(${b}) = 1·${b} + 0 = ${b}: кез келген жүйеде «10» — оның негізі.`,
        },
      };
    }
    const b = pick(rand, [3, 4, 5, 6, 7] as const);
    const value = rand() < 0.5;
    const claim = value ? b * b : pick(rand, [b * 2, b + b + 1, b * b + 1, 100]);
    return {
      id: id("pow", `${b}:${claim}`),
      skill: SKILL,
      level,
      text: {
        ru: `В системе с основанием ${b} запись 100 означает число ${claim}`,
        kk: `Негізі ${b} жүйеде 100 жазбасы ${claim} санын білдіреді`,
      },
      value: claim === b * b,
      explanation: {
        ru: `100(${b}) = 1·${b}² = ${b * b}: единица и два нуля — это квадрат основания.`,
        kk: `100(${b}) = 1·${b}² = ${b * b}: бір және екі нөл — негіздің квадраты.`,
      },
    };
  }
  // L3: основание и сравнение.
  const kind = pick(rand, ["findx", "minbase"] as const);
  if (kind === "findx") {
    const x = pickX(rand, 12);
    const d1 = int(rand, 1, Math.min(x - 1, 9));
    const d0 = int(rand, 0, Math.min(x - 1, 9));
    const n = d1 * x + d0;
    const value = rand() < 0.5;
    const claim = value ? x : pick(rand, [x - 1, x + 1, x + 2].filter((v) => v > Math.max(d1, d0)));
    return {
      id: id("findx", `${d1}${d0}:${n}:${claim}`),
      skill: SKILL,
      level,
      text: same(`${d1}${d0}(x) = ${n}₁₀ при x = ${claim}`),
      value: claim === x,
      explanation: same(`${d1}·x + ${d0} = ${n} → x = ${x}`),
    };
  }
  const m = int(rand, 3, 8);
  const claim = rand() < 0.5 ? m + 1 : pick(rand, [m, m + 2]);
  const s = `${int(rand, 1, m)}${m}${int(rand, 0, m)}`;
  return {
    id: id("minbase", `${s}:${claim}`),
    skill: SKILL,
    level,
    text: {
      ru: `Наименьшее основание, в котором можно записать число ${s}, равно ${claim}`,
      kk: `${s} санын жазуға болатын ең кіші негіз ${claim} санына тең`,
    },
    value: claim === m + 1,
    explanation: {
      ru: `Наибольшая цифра записи ${s} — ${m}, значит наименьшее основание ${m} + 1 = ${m + 1}.`,
      kk: `${s} жазбасының ең үлкен цифры — ${m}, демек ең кіші негіз ${m} + 1 = ${m + 1}.`,
    },
  };
}

// ---------- Пары ----------

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1) {
    const { b, s } = levelRecord(rand, 1);
    return { id: `p:${SKILL}:q2d:${s}b${b}`, skill: SKILL, level, left: rec(s, b), right: String(fromBase(s, b)) };
  }
  if (level === 2) {
    const b = pick(rand, BASES_SMALL);
    const n = int(rand, 20, 150);
    return { id: `p:${SKILL}:d2q:${n}b${b}`, skill: SKILL, level, left: `${n}₁₀`, right: rec(toBase(n, b), b) };
  }
  const x = pickX(rand, 12);
  const d1 = int(rand, 1, Math.min(x - 1, 9));
  const d0 = int(rand, 0, Math.min(x - 1, 9));
  return { id: `p:${SKILL}:findx:${d1}${d0}x${x}`, skill: SKILL, level, left: `${d1}${d0}(x) = ${d1 * x + d0}`, right: `x = ${x}` };
}

// ---------- Короткие вопросы ----------

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const { b, s } = levelRecord(rand, 1);
    const n = fromBase(s, b);
    return {
      id: `q:${SKILL}:q2d:${s}b${b}`,
      skill: SKILL,
      level,
      prompt: same(`${rec(s, b)} = ?₁₀`),
      answer: String(n),
      mode: "number",
      explanation: same(`${expandPow(s, b)} = ${n}`),
    };
  }
  if (level === 2) {
    const b = pick(rand, [...BASES_SMALL, ...BASES_LETTER]);
    const n = int(rand, 20, 200);
    const ans = toBase(n, b);
    return {
      id: `q:${SKILL}:d2q:${n}b${b}`,
      skill: SKILL,
      level,
      prompt: same(`${n}₁₀ = ?${sub(b)}`),
      answer: ans,
      mode: "number",
      explanation: same(`${n} → ${ans}${sub(b)}: ${expandNum(ans, b)}`),
    };
  }
  const x = pickX(rand, 12);
  const d1 = int(rand, 1, Math.min(x - 1, 9));
  const d0 = int(rand, 0, Math.min(x - 1, 9));
  const n = d1 * x + d0;
  return {
    id: `q:${SKILL}:findx:${d1}${d0}e${n}`,
    skill: SKILL,
    level,
    prompt: { ru: `Найди основание x, если ${d1}${d0}(x) = ${n}`, kk: `${d1}${d0}(x) = ${n} болса, x негізін тап` },
    answer: String(x),
    mode: "number",
    explanation: same(`${d1}x + ${d0} = ${n} → x = ${x}`),
  };
}

export const BANKS: SkillBank[] = [
  {
    skill: SKILL,
    question: (level, seed) => generate(level, seed),
    statement,
    pair,
    short,
  },
];
