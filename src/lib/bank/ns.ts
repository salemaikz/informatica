import type { L, Level } from "../types";
import { toBinary } from "../check";
import {
  BASE_DIGIT_BASES,
  HINT_BASE_COUNT,
  HINT_DIV,
  HINT_LENGTH,
  HINT_ONES,
  HINT_PARITY,
  HINT_WEIGHTS,
  edgeCase,
  generateLeveled,
  rangeForLevel,
  sup,
  weightsSum,
} from "../generators";
import { kkSuffix } from "../kk";
import { seeded } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыков раздела «Системы счисления»: утверждения, пары и короткие вопросы.
// Правильность всегда вычисляет код. Окончания после чисел по-казахски — только через kkSuffix
// (окончание зависит от слова-числительного: «25-ті», «6-дан»), либо фраза строится без окончания.
// У утверждений и коротких вопросов — бесплатная подсказка hint (не выдаёт ответ).

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

export { sup };

const HINT_POW_CHECK: L = {
  ru: "Умножение на 2 в двоичной системе дописывает справа один ноль. Сравни число нулей в записи с показателем степени.",
  kk: `Екілік жүйеде ${kkSuffix(2, "dat")} көбейту оң жаққа бір нөл жазады. Жазбадағы нөлдер санын дәреже көрсеткішімен салыстыр.`,
};

const reversedValue = (bin: string) => parseInt(bin.split("").reverse().join(""), 2);

/** Неверное, но правдоподобное значение (типичные ошибки: ±1, обратный порядок разрядов, ×2). */
function nearMiss(rand: Rand, n: number, bin: string): number {
  const cands = [n + 1, n - 1, n + 2, reversedValue(bin), n * 2].filter((v) => v > 0 && v !== n);
  return pick(rand, cands);
}

/** Два слагаемых с общим битом (в сумме будет перенос): иначе ошибка «без переноса» совпала бы с верным ответом. */
function sumPair(rand: Rand, aLo: number, aHi: number, bLo: number, bHi: number): { a: number; b: number } {
  for (let g = 0; g < 50; g++) {
    const a = int(rand, aLo, aHi);
    const b = int(rand, bLo, bHi);
    if ((a & b) !== 0) return { a, b };
  }
  return { a: 13, b: 7 };
}

// ---------- 2 → 10 ----------

const bin2dec: SkillBank = {
  skill: "ns.bin2dec",
  question: (level, seed) => generateLeveled("ns.bin2dec", level, seed),
  statement(level, seed) {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null) {
      // 0 и 1 (аудит C8): ноль и единица в двоичной записи
      const claim = rand() < 0.5 ? edge : edge === 0 ? 1 : pick(rand, [0, 2] as const);
      return {
        id: `s:ns.bin2dec:${edge}:${claim}`,
        skill: "ns.bin2dec",
        level,
        text: same(`${edge}₂ = ${claim}₁₀`),
        value: claim === edge,
        explanation:
          edge === 0
            ? { ru: "В записи 0₂ нет единиц, сумма весов пустая и равна 0.", kk: "0₂ жазбасында бірлік жоқ, салмақтар қосындысы бос және 0-ге тең." }
            : { ru: "Единица стоит в разряде с весом 1: 1₂ = 1₁₀.", kk: "Бірлік салмағы 1 болатын разрядта тұр: 1₂ = 1₁₀." },
        hint: HINT_WEIGHTS,
      };
    }
    if (level === 3 && rand() < 0.5) {
      // C: сумма двух двоичных чисел в десятичной записи (ловушки: сложение «как десятичных», без переноса)
      const { a, b } = sumPair(rand, 5, 31, 3, 15);
      const binA = toBinary(a);
      const binB = toBinary(b);
      const s = a + b;
      const claim = rand() < 0.5 ? s : pick(rand, [Number(binA) + Number(binB), a ^ b, Math.max(a, b)]);
      return {
        id: `s:ns.bin2dec:sum:${binA}+${binB}:${claim}`,
        skill: "ns.bin2dec",
        level,
        text: same(`${binA}₂ + ${binB}₂ = ${claim}₁₀`),
        value: claim === s,
        explanation: same(`${binA}₂ + ${binB}₂ = ${a} + ${b} = ${s}₁₀`),
        hint: {
          ru: "Переведи оба слагаемых в десятичную систему и сложи, затем сравни с числом справа.",
          kk: "Екі қосылғышты да ондық жүйеге аударып қос, сосын оң жақтағы санмен салыстыр.",
        },
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    const value = rand() < 0.5;
    const claim = value ? n : nearMiss(rand, n, bin);
    return {
      id: `s:ns.bin2dec:${bin}:${claim}`,
      skill: "ns.bin2dec",
      level,
      text: same(`${bin}₂ = ${claim}₁₀`),
      value,
      explanation: same(`${bin}₂ = ${weightsSum(bin)} = ${n}₁₀`),
      hint: HINT_WEIGHTS,
    };
  },
  pair(level, seed) {
    const rand = seeded(seed);
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    return { id: `p:ns.bin2dec:${n}`, skill: "ns.bin2dec", level, left: `${toBinary(n)}₂`, right: String(n) };
  },
  short(level, seed) {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null) {
      return {
        id: `q:ns.bin2dec:${edge}`,
        skill: "ns.bin2dec",
        level,
        prompt: same(`${edge}₂ = ?₁₀`),
        answer: String(edge),
        mode: "number",
        explanation: same(`${edge}₂ = ${edge}`),
        hint: HINT_WEIGHTS,
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    return {
      id: `q:ns.bin2dec:${n}`,
      skill: "ns.bin2dec",
      level,
      prompt: same(`${bin}₂ = ?₁₀`),
      answer: String(n),
      mode: "number",
      explanation: same(`${weightsSum(bin)} = ${n}`),
      hint: HINT_WEIGHTS,
    };
  },
};

// ---------- 10 → 2 ----------

const dec2bin: SkillBank = {
  skill: "ns.dec2bin",
  question: (level, seed) => generateLeveled("ns.dec2bin", level, seed),
  statement(level, seed) {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null) {
      // 0 и 1 (аудит C8): ноль записывается одной цифрой, единица — одной цифрой 1
      const claim = rand() < 0.5 ? String(edge) : edge === 0 ? "1" : pick(rand, ["0", "10"] as const);
      return {
        id: `s:ns.dec2bin:${edge}:${claim}`,
        skill: "ns.dec2bin",
        level,
        text: same(`${edge}₁₀ = ${claim}₂`),
        value: claim === String(edge),
        explanation:
          edge === 0
            ? { ru: "Ноль записывается одной цифрой: 0₁₀ = 0₂.", kk: "Нөл бір цифрмен жазылады: 0₁₀ = 0₂." }
            : { ru: "Это один вес 1: 1₁₀ = 1₂.", kk: "Бұл бір ғана 1 салмағы: 1₁₀ = 1₂." },
        hint: HINT_DIV,
      };
    }
    if (level === 3 && rand() < 0.5) {
      // C: умножение на 2ᵏ дописывает k нулей — число из записи известного
      const k = int(rand, 1, 3);
      const n = int(rand, 5, 30);
      const bin = toBinary(n);
      const correct = `${bin}${"0".repeat(k)}`;
      // ловушки: нулей на один больше или меньше, единицы вместо нулей (при k = 1 «нулей меньше» — это сама запись числа: так не берём)
      const wrongs = [`${bin}${"0".repeat(k + 1)}`, `${bin}${"0".repeat(k - 1)}`, `${bin}${"1".repeat(k)}`].filter((w) => w !== bin);
      const claim = rand() < 0.5 ? correct : pick(rand, wrongs);
      const m = n * 2 ** k;
      const zerosWord = [
        { ru: "дописывается один ноль", kk: "бір нөл жазылады" },
        { ru: "дописываются два нуля", kk: "екі нөл жазылады" },
        { ru: "дописываются три нуля", kk: "үш нөл жазылады" },
      ][k - 1];
      return {
        id: `s:ns.dec2bin:shift:${n}-${k}:${claim}`,
        skill: "ns.dec2bin",
        level,
        text: { ru: `Если ${n}₁₀ = ${bin}₂, то ${m}₁₀ = ${claim}₂`, kk: `${n}₁₀ = ${bin}₂ болса, онда ${m}₁₀ = ${claim}₂` },
        value: claim === correct,
        explanation: {
          ru: `${m} = ${n} · ${2 ** k}: при умножении на ${2 ** k} справа ${zerosWord.ru}: ${bin}₂ → ${correct}₂.`,
          kk: `${m} = ${n} · ${2 ** k}: ${kkSuffix(2 ** k, "dat")} көбейткенде оң жаққа ${zerosWord.kk}: ${bin}₂ → ${correct}₂.`,
        },
        hint: {
          ru: "Умножение на 2 дописывает справа один ноль. Во сколько раз второе число больше первого?",
          kk: `${kkSuffix(2, "dat")} көбейту оң жаққа бір нөл жазады. Екінші сан біріншіден неше есе үлкен?`,
        },
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    const value = rand() < 0.5;
    // Самая частая ошибка — прочитать остатки сверху вниз (обратный порядок).
    let claim = bin;
    if (!value) {
      const reversed = bin.split("").reverse().join("").replace(/^0+/, "");
      claim = reversed && reversed !== bin ? reversed : toBinary(nearMiss(rand, n, bin));
    }
    return {
      id: `s:ns.dec2bin:${n}:${claim}`,
      skill: "ns.dec2bin",
      level,
      text: same(`${n}₁₀ = ${claim}₂`),
      value: claim === bin,
      explanation: same(`${n} = ${weightsSum(bin)} → ${bin}₂`),
      hint: HINT_DIV,
    };
  },
  pair(level, seed) {
    const rand = seeded(seed);
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    return { id: `p:ns.dec2bin:${n}`, skill: "ns.dec2bin", level, left: `${n}₁₀`, right: `${toBinary(n)}₂` };
  },
  short(level, seed) {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null) {
      return {
        id: `q:ns.dec2bin:${edge}`,
        skill: "ns.dec2bin",
        level,
        prompt: same(`${edge}₁₀ = ?₂`),
        answer: String(edge),
        mode: "binary",
        explanation: same(`${edge}₁₀ = ${edge}₂`),
        hint: HINT_DIV,
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    return {
      id: `q:ns.dec2bin:${n}`,
      skill: "ns.dec2bin",
      level,
      prompt: same(`${n}₁₀ = ?₂`),
      answer: bin,
      mode: "binary",
      explanation: same(`${n} = ${weightsSum(bin)} → ${bin}₂`),
      hint: HINT_DIV,
    };
  },
};

// ---------- Основание и цифры ----------
// Только основания 2 и 10 и общий смысл основания: навык открыт после первого урока. Цифры 8- и 16-ричной систем,
// буквы A–F и «восьмеричная запись» — в ns.octhex (bank/ns-octhex-digits.ts), см. аудит C6.

const SYSTEM_NAME: Record<number, L> = {
  2: { ru: "двоичной", kk: "екілік" },
  3: { ru: "троичной", kk: "үштік" },
};
const SYSTEM_DIGITS: Record<number, string> = { 2: "0, 1", 3: "0–2" };
/** Описание набора цифр системы: «0, 1», «0–2», «0–9». */
const digitsRange = (b: number) => (b === 2 ? "0, 1" : `0–${b - 1}`);

const HINT_BASE_MAX: L = {
  ru: "Цифры начинаются с 0 и идут по порядку, а цифр столько же, сколько основание. Какая по счёту цифра — последняя?",
  kk: `Цифрлар ${kkSuffix(0, "abl")} басталып, ретімен жүреді, ал цифрлар саны негізге тең. Соңғы цифр нешінші?`,
};

const base: SkillBank = {
  skill: "ns.base",
  question: (level, seed) => generateLeveled("ns.base", level, seed),
  statement(level, seed): Statement {
    const rand = seeded(seed);
    if (level === 1 && edgeCase(seed) !== null) {
      // 0 и 1 (аудит C8): цифры любой системы начинаются с нуля
      const claim = rand() < 0.5 ? 0 : 1;
      return {
        id: `s:ns.base:min:2:${claim}`,
        skill: "ns.base",
        level,
        text: { ru: `Наименьшая цифра в двоичной системе — ${claim}`, kk: `Екілік жүйедегі ең кіші цифр — ${claim}` },
        value: claim === 0,
        explanation: {
          ru: "Цифры любой системы начинаются с нуля: в двоичной системе наименьшая цифра — 0, а наибольшая — 1.",
          kk: "Кез келген жүйенің цифрлары нөлден басталады: екілік жүйеде ең кіші цифр — 0, ал ең үлкені — 1.",
        },
        hint: {
          ru: "С какой цифры начинается счёт в любой системе счисления: с нуля или с единицы?",
          kk: "Кез келген санау жүйесінде есеп қай цифрдан басталады: нөлден бе, әлде бірден бе?",
        },
      };
    }
    if (level === 1) {
      const b = pick(rand, BASE_DIGIT_BASES);
      const value = rand() < 0.5;
      const k = value ? b : pick(rand, [b - 1, b + 1]);
      return {
        id: `s:ns.base:count:${b}:${k}`,
        skill: "ns.base",
        level,
        text: {
          ru: `В системе счисления с основанием ${b} используется цифр: ${k}`,
          kk: `Негізі ${b} санау жүйесінде қолданылатын цифрлар саны: ${k}`,
        },
        value,
        explanation: {
          ru: `Цифр столько, сколько основание: от 0 до ${b - 1} — всего ${b}.`,
          kk: `Цифрлар саны негізге тең: ${kkSuffix(0, "abl")} ${kkSuffix(b - 1, "dat")} дейін — барлығы ${b}.`,
        },
        hint: HINT_BASE_COUNT,
      };
    }
    if (level === 2) {
      // Наибольшая цифра на 1 меньше основания (ловушка: «наибольшая цифра равна основанию»).
      const b = pick(rand, [2, 3, 5, 10] as const);
      const value = rand() < 0.5;
      const k = value ? b - 1 : pick(rand, [b, b - 2]);
      return {
        id: `s:ns.base:max:${b}:${k}`,
        skill: "ns.base",
        level,
        text: {
          ru: `В системе счисления с основанием ${b} наибольшая цифра — ${k}`,
          kk: `Негізі ${b} санау жүйесіндегі ең үлкен цифр — ${k}`,
        },
        value,
        explanation: {
          ru: `Цифры идут от 0 до ${b - 1}: наибольшая из них — ${b - 1}.`,
          kk: `Цифрлар ${kkSuffix(0, "abl")} ${kkSuffix(b - 1, "dat")} дейін: олардың ең үлкені — ${b - 1}.`,
        },
        hint: HINT_BASE_MAX,
      };
    }
    // C: может ли запись быть числом в системе (ловушки: цифра 2 в двоичной, цифры 3 и больше — в троичной).
    const b = pick(rand, [2, 3] as const);
    const value = rand() < 0.5;
    let rec = b === 2 ? toBinary(int(rand, 9, 120)) : int(rand, 10, 500).toString(3);
    if (!value) {
      const pos = int(rand, 1, rec.length - 1);
      rec = `${rec.slice(0, pos)}${b === 2 ? "2" : pick(rand, ["3", "4"])}${rec.slice(pos + 1)}`;
    }
    const sys = SYSTEM_NAME[b];
    return {
      id: `s:ns.base:valid:${b}:${rec}`,
      skill: "ns.base",
      level,
      text: { ru: `Запись ${rec} может быть числом в ${sys.ru} системе`, kk: `${rec} жазбасы ${sys.kk} жүйедегі сан бола алады` },
      value,
      explanation: {
        ru: `Цифры ${sys.ru} системы: ${SYSTEM_DIGITS[b]}.${value ? "" : ` В записи ${rec} есть лишняя цифра.`}`,
        kk: `${sys.kk[0].toUpperCase()}${sys.kk.slice(1)} жүйенің цифрлары: ${SYSTEM_DIGITS[b]}.${value ? "" : ` ${rec} жазбасында артық цифр бар.`}`,
      },
      hint: {
        ru: `Проверь каждую цифру записи ${rec}: есть ли такая цифра в ${sys.ru} системе?`,
        kk: `${rec} жазбасының әр цифрын тексер: ${sys.kk} жүйеде ондай цифр бар ма?`,
      },
    };
  },
  pair(level, seed): Pair {
    const rand = seeded(seed);
    if (level === 1) {
      const b = pick(rand, [2, 3, 4, 5, 6, 10] as const);
      return {
        id: `p:ns.base:sys:${b}`,
        skill: "ns.base",
        level,
        left: { ru: `Основание ${b}`, kk: `Негізі ${b}` },
        right: digitsRange(b),
      };
    }
    // B/C: «наибольшая цифра k» ↔ «основание k + 1» (цифр на одну больше, чем наибольшая цифра).
    const k = pick(rand, [1, 2, 3, 4, 5, 9] as const);
    return {
      id: `p:ns.base:max:${k}`,
      skill: "ns.base",
      level,
      left: { ru: `Наибольшая цифра ${k}`, kk: `Ең үлкен цифр ${k}` },
      right: { ru: `Основание ${k + 1}`, kk: `Негізі ${k + 1}` },
    };
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    // Набор оснований широкий (без 8 и 16), чтобы у навыка хватало разных ответов — например, на карточку бинго 3 × 3.
    if (level === 1) {
      const b = pick(rand, [2, 3, 4, 5, 6, 7, 10] as const);
      return {
        id: `q:ns.base:count:${b}`,
        skill: "ns.base",
        level,
        prompt: {
          ru: `Сколько цифр в системе счисления с основанием ${b}?`,
          kk: `Негізі ${b} санау жүйесінде неше цифр бар?`,
        },
        answer: String(b),
        mode: "number",
        explanation: { ru: `Цифр столько, сколько основание: ${b}.`, kk: `Цифрлар саны негізге тең: ${b}.` },
        hint: HINT_BASE_COUNT,
      };
    }
    if (level === 2) {
      const b = pick(rand, [2, 3, 4, 5, 6, 7, 10] as const);
      return {
        id: `q:ns.base:max:${b}`,
        skill: "ns.base",
        level,
        prompt: {
          ru: `Какая наибольшая цифра в системе счисления с основанием ${b}?`,
          kk: `Негізі ${b} санау жүйесіндегі ең үлкен цифр қандай?`,
        },
        answer: String(b - 1),
        mode: "number",
        explanation: { ru: `Цифры идут от 0 до ${b - 1}: наибольшая — ${b - 1}.`, kk: `Цифрлар ${kkSuffix(0, "abl")} ${kkSuffix(b - 1, "dat")} дейін: ең үлкені — ${b - 1}.` },
        hint: HINT_BASE_MAX,
      };
    }
    // C: обратная задача — по наибольшей цифре найти основание.
    const k = pick(rand, [1, 2, 3, 4, 5, 6, 9] as const);
    return {
      id: `q:ns.base:inv:${k}`,
      skill: "ns.base",
      level,
      prompt: {
        ru: `В системе счисления наибольшая цифра — ${k}. Чему равно основание?`,
        kk: `Санау жүйесіндегі ең үлкен цифр — ${k}. Негізі неге тең?`,
      },
      answer: String(k + 1),
      mode: "number",
      explanation: {
        ru: `Цифры идут от 0 до ${k}, значит их ${k + 1}. Цифр столько, сколько основание, поэтому основание — ${k + 1}.`,
        kk: `Цифрлар ${kkSuffix(0, "abl")} ${kkSuffix(k, "dat")} дейін, демек олар ${k + 1}. Цифрлар саны негізге тең, сондықтан негіз — ${k + 1}.`,
      },
      hint: HINT_BASE_MAX,
    };
  },
};

// ---------- Свойства двоичных чисел ----------

const props: SkillBank = {
  skill: "ns.props",
  question: (level, seed) => generateLeveled("ns.props", level, seed),
  statement(level, seed): Statement {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null && rand() < 0.5) {
      // 0 и 1 (аудит C8): ноль записывается одной цифрой, а не «пустой записью»
      const claim = rand() < 0.5 ? 1 : pick(rand, [0, 2] as const);
      return {
        id: `s:ns.props:length:${edge}:${claim}`,
        skill: "ns.props",
        level,
        text: {
          ru: `Количество цифр в двоичной записи числа ${edge}: ${claim}`,
          kk: `${edge} санының екілік жазбасындағы цифрлар саны: ${claim}`,
        },
        value: claim === 1,
        explanation:
          edge === 0
            ? {
                ru: "Ноль записывают одной цифрой: 0₂. Правило «степень двойки, не больше числа» работает для чисел от 1.",
                kk: "Нөл бір цифрмен жазылады: 0₂. «Саннан аспайтын екінің дәрежесі» ережесі 1-ден бастап сандар үшін жұмыс істейді.",
              }
            : { ru: "1 = 2⁰ ≤ 1 < 2¹, поэтому цифра одна: 1₂.", kk: "1 = 2⁰ ≤ 1 < 2¹, сондықтан цифр біреу: 1₂." },
        hint: HINT_LENGTH,
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = edge !== null ? edge : int(rand, lo, hi);
    const bin = toBinary(n);
    const kind =
      edge !== null
        ? "parity"
        : level === 1
          ? pick(rand, ["parity", "pow"] as const)
          : level === 2
            ? pick(rand, ["length", "pow", "parity"] as const)
            : pick(rand, ["ones", "length", "maxk"] as const);
    if (kind === "maxk") {
      // C: наибольшее число из k двоичных цифр — 2ᵏ − 1
      const k = int(rand, 5, 10);
      const v = 2 ** k - 1;
      const claim = rand() < 0.5 ? v : pick(rand, [2 ** k, 2 ** (k - 1), 2 ** k - 2]);
      return {
        id: `s:ns.props:maxk:${k}:${claim}`,
        skill: "ns.props",
        level,
        text: {
          ru: `Наибольшее число из ${k} двоичных цифр равно ${claim}`,
          kk: `${k} екілік цифрдан тұратын ең үлкен сан ${kkSuffix(claim, "dat")} тең`,
        },
        value: claim === v,
        explanation: {
          ru: `Наибольшее число состоит из одних единиц: ${"1".repeat(k)}₂ = 2${sup(k)} − 1 = ${v}.`,
          kk: `Ең үлкен сан тек бірліктерден тұрады: ${"1".repeat(k)}₂ = 2${sup(k)} − 1 = ${v}.`,
        },
        hint: {
          ru: "Какая двоичная запись из k цифр самая большая? Найди её значение по весам разрядов.",
          kk: "k цифрдан тұратын қай екілік жазба ең үлкен? Оның мәнін разряд салмақтары бойынша тап.",
        },
      };
    }
    if (kind === "parity") {
      const claimEven = rand() < 0.5;
      const even = n % 2 === 0;
      return {
        id: `s:ns.props:parity:${bin}:${claimEven}`,
        skill: "ns.props",
        level,
        text: claimEven ? { ru: `${bin}₂ — чётное число`, kk: `${bin}₂ — жұп сан` } : { ru: `${bin}₂ — нечётное число`, kk: `${bin}₂ — тақ сан` },
        value: claimEven === even,
        explanation: {
          ru: `Последняя цифра — ${bin.at(-1)}: ${even ? "0 → чётное" : "1 → нечётное"}.`,
          kk: `Соңғы цифры — ${bin.at(-1)}: ${even ? "0 → жұп" : "1 → тақ"}.`,
        },
        hint: HINT_PARITY,
      };
    }
    if (kind === "pow") {
      const k = level === 1 ? int(rand, 2, 5) : int(rand, 5, 10);
      const value = rand() < 0.5;
      const zeros = value ? k : k + pick(rand, [-1, 1]);
      return {
        id: `s:ns.props:pow:${k}:${zeros}`,
        skill: "ns.props",
        level,
        text: same(`2${sup(k)} = ${2 ** k} = 1${"0".repeat(zeros)}₂`),
        value,
        explanation: {
          ru: `2${sup(k)} в двоичной системе — единица и ${k} нулей после неё: 1${"0".repeat(k)}₂.`,
          kk: `2${sup(k)} екілік жүйеде — бірлік және одан кейін ${k} нөл: 1${"0".repeat(k)}₂.`,
        },
        hint: HINT_POW_CHECK,
      };
    }
    if (kind === "length") {
      const len = bin.length;
      const value = rand() < 0.5;
      const claim = value ? len : len + pick(rand, [-1, 1]);
      return {
        id: `s:ns.props:length:${n}:${claim}`,
        skill: "ns.props",
        level,
        text: {
          ru: `Количество цифр в двоичной записи числа ${n}: ${claim}`,
          kk: `${n} санының екілік жазбасындағы цифрлар саны: ${claim}`,
        },
        value,
        explanation: {
          ru: `2${sup(len - 1)} = ${2 ** (len - 1)} ≤ ${n} < ${2 ** len} = 2${sup(len)}, значит цифр ${len}: ${bin}₂.`,
          kk: `2${sup(len - 1)} = ${2 ** (len - 1)} ≤ ${n} < ${2 ** len} = 2${sup(len)}, демек цифрлар саны ${len}: ${bin}₂.`,
        },
        hint: HINT_LENGTH,
      };
    }
    const ones = bin.split("").filter((c) => c === "1").length;
    const value = rand() < 0.5;
    const claim = value ? ones : Math.max(0, ones + pick(rand, [-1, 1]));
    return {
      id: `s:ns.props:ones:${n}:${claim}`,
      skill: "ns.props",
      level,
      text: {
        ru: `Количество единиц в двоичной записи числа ${n}: ${claim}`,
        kk: `${n} санының екілік жазбасындағы бірліктер саны: ${claim}`,
      },
      value: claim === ones,
      explanation: same(`${n} = ${weightsSum(bin)} = ${bin}₂ → ${ones}`),
      hint: HINT_ONES,
    };
  },
  pair(level, seed): Pair {
    const rand = seeded(seed);
    const k = level === 1 ? int(rand, 1, 6) : level === 2 ? int(rand, 5, 10) : int(rand, 8, 16);
    return { id: `p:ns.props:pow:${k}`, skill: "ns.props", level, left: `2${sup(k)}`, right: String(2 ** k) };
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    const edge = level === 1 ? edgeCase(seed) : null;
    if (edge !== null) {
      return {
        id: `q:ns.props:length:${edge}`,
        skill: "ns.props",
        level,
        prompt: { ru: `Сколько цифр в двоичной записи числа ${edge}?`, kk: `${edge} санының екілік жазбасында неше цифр бар?` },
        answer: "1",
        mode: "number",
        explanation: same(`${edge} = ${edge}₂ → 1`),
        hint: HINT_LENGTH,
      };
    }
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    if (rand() < 0.5) {
      const ones = bin.split("").filter((c) => c === "1").length;
      return {
        id: `q:ns.props:ones:${n}`,
        skill: "ns.props",
        level,
        prompt: { ru: `Сколько единиц в двоичной записи числа ${n}?`, kk: `${n} санының екілік жазбасында неше бірлік бар?` },
        answer: String(ones),
        mode: "number",
        explanation: same(`${n} = ${bin}₂ → ${ones}`),
        hint: HINT_ONES,
      };
    }
    return {
      id: `q:ns.props:length:${n}`,
      skill: "ns.props",
      level,
      prompt: { ru: `Сколько цифр в двоичной записи числа ${n}?`, kk: `${n} санының екілік жазбасында неше цифр бар?` },
      answer: String(bin.length),
      mode: "number",
      explanation: same(`${n} = ${bin}₂ → ${bin.length}`),
      hint: HINT_LENGTH,
    };
  },
};

export const NS_BANKS: SkillBank[] = [base, bin2dec, dec2bin, props];

/** Для тестов: значение выражения «Level» в допустимых пределах. */
export const LEVELS: Level[] = [1, 2, 3];
