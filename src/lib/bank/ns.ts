import type { L, Level } from "../types";
import { toBinary } from "../check";
import {
  HINT_BASE_COUNT,
  HINT_DIV,
  HINT_LENGTH,
  HINT_ONES,
  HINT_PARITY,
  HINT_WEIGHTS,
  generateLeveled,
  rangeForLevel,
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

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
export const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[d]);

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

// ---------- 2 → 10 ----------

const bin2dec: SkillBank = {
  skill: "ns.bin2dec",
  question: (level, seed) => generateLeveled("ns.bin2dec", level, seed),
  statement(level, seed) {
    const rand = seeded(seed);
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

const SYSTEM_NAME: Record<number, L> = {
  2: { ru: "двоичной", kk: "екілік" },
  8: { ru: "восьмеричной", kk: "сегіздік" },
  10: { ru: "десятичной", kk: "ондық" },
  16: { ru: "шестнадцатеричной", kk: "он алтылық" },
};
const SYSTEM_DIGITS: Record<number, string> = { 2: "0, 1", 8: "0–7", 10: "0–9", 16: "0–9, A–F" };
const HEX_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const HINT_HEX: L = {
  ru: "В шестнадцатеричной системе после цифры 9 цифры продолжаются буквами по порядку: A — следующая за 9. Отсчитай по порядку.",
  kk: `Он алтылық жүйеде ${kkSuffix(9, "abl")} кейін цифрлар әріптермен жалғасады: A — 9 цифрынан кейінгі цифр. Ретімен санап көр.`,
};

const base: SkillBank = {
  skill: "ns.base",
  question: (level, seed) => generateLeveled("ns.base", level, seed),
  statement(level, seed): Statement {
    const rand = seeded(seed);
    if (level === 1) {
      const b = pick(rand, [2, 8, 10, 16, 5, 3]);
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
      const i = int(rand, 0, 5);
      const letter = HEX_LETTERS[i];
      const value = rand() < 0.5;
      const claim = value ? 10 + i : 10 + i + pick(rand, [-1, 1]);
      return {
        id: `s:ns.base:hex:${letter}:${claim}`,
        skill: "ns.base",
        level,
        text: {
          ru: `В шестнадцатеричной системе цифра ${letter} означает ${claim}`,
          kk: `Он алтылық жүйеде ${letter} цифры ${claim} санын білдіреді`,
        },
        hint: HINT_HEX,
        value,
        explanation: {
          ru: `A = 10, B = 11, C = 12, D = 13, E = 14, F = 15. Значит, ${letter} = ${10 + i}.`,
          kk: `A = 10, B = 11, C = 12, D = 13, E = 14, F = 15. Демек, ${letter} = ${10 + i}.`,
        },
      };
    }
    // C: может ли запись быть числом в системе (ловушки: цифра 2 в двоичной, 8 и 9 — в восьмеричной).
    const b = pick(rand, [2, 8] as const);
    const value = rand() < 0.5;
    let rec = b === 2 ? toBinary(int(rand, 9, 120)) : int(rand, 10, 500).toString(8);
    if (!value) {
      const pos = int(rand, 1, rec.length - 1);
      rec = `${rec.slice(0, pos)}${b === 2 ? "2" : pick(rand, ["8", "9"])}${rec.slice(pos + 1)}`;
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
      const b = pick(rand, [2, 8, 10, 16] as const);
      const name = SYSTEM_NAME[b];
      return {
        id: `p:ns.base:sys:${b}`,
        skill: "ns.base",
        level,
        left: { ru: `${name.ru[0].toUpperCase()}${name.ru.slice(1).replace(/ой$/, "ая")}`, kk: `${name.kk[0].toUpperCase()}${name.kk.slice(1)}` },
        right: SYSTEM_DIGITS[b],
      };
    }
    const i = int(rand, 0, 5);
    return { id: `p:ns.base:hex:${i}`, skill: "ns.base", level, left: `${HEX_LETTERS[i]}₁₆`, right: String(10 + i) };
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    if (level === 1) {
      const b = pick(rand, [2, 3, 5, 8, 10, 16]);
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
    const i = int(rand, 0, 5);
    return {
      id: `q:ns.base:hex:${i}`,
      skill: "ns.base",
      level,
      prompt: same(`${HEX_LETTERS[i]}₁₆ = ?₁₀`),
      answer: String(10 + i),
      mode: "number",
      explanation: same("A = 10, B = 11, C = 12, D = 13, E = 14, F = 15"),
      hint: HINT_HEX,
    };
  },
};

// ---------- Свойства двоичных чисел ----------

const props: SkillBank = {
  skill: "ns.props",
  question: (level, seed) => generateLeveled("ns.props", level, seed),
  statement(level, seed): Statement {
    const rand = seeded(seed);
    const [lo, hi] = rangeForLevel(level);
    const n = int(rand, lo, hi);
    const bin = toBinary(n);
    const kind = level === 1 ? pick(rand, ["parity", "pow"] as const) : level === 2 ? pick(rand, ["length", "pow", "parity"] as const) : pick(rand, ["ones", "length"] as const);
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
