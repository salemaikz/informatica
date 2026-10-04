import type { L, Level, QuestionStep } from "../types";
import { HINT_BASE_COUNT, HINT_BASE_INVALID, options } from "../generators";
import { kkSuffix } from "../kk";
import { seeded } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Цифры 8- и 16-ричной систем для навыка ns.octhex: сколько цифр, буквы A–F, «не восьмеричная запись».
// Раньше эти задания жили в ns.base, который открыт после первого урока — то есть спрашивали про A–F
// и восьмеричную запись до урока о 2 ↔ 8 ↔ 16 (аудит C6). Теперь они попадают в ns.octhex (уровни A и B):
// withMovedDigits подмешивает их к основному банку урока, не меняя его собственные задания.
// Правильный ответ всегда считает код. После чисел в казахском — только kkSuffix или без окончания.

const SKILL = "ns.octhex";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

const HEX_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const SYSTEM_NAME: Record<8 | 16, L> = {
  8: { ru: "восьмеричной", kk: "сегіздік" },
  16: { ru: "шестнадцатеричной", kk: "он алтылық" },
};
const DIGITS_OF: Record<8 | 16, string> = { 8: "0–7", 16: "0–9, A–F" };

const HINT_HEX: L = {
  ru: "В шестнадцатеричной системе после цифры 9 цифры продолжаются буквами по порядку: A — следующая за 9. Отсчитай по порядку.",
  kk: `Он алтылық жүйеде ${kkSuffix(9, "abl")} кейін цифрлар әріптермен жалғасады: A — 9 цифрынан кейінгі цифр. Ретімен санап көр.`,
};
const HEX_TABLE = "A = 10, B = 11, C = 12, D = 13, E = 14, F = 15";

// ---------- Задания ----------

/** A: «сколько цифр в системе с основанием 8 / 16». */
function digitsCount(rand: Rand, level: Level, seed: number): QuestionStep {
  const base = pick(rand, [8, 16] as const);
  const o = options(rand, String(base), [
    {
      value: String(base - 1),
      why: {
        ru: `${base - 1} — значение самой большой цифры этой системы, а цифр на одну больше: 0 — тоже цифра.`,
        kk: `${base - 1} — бұл жүйедегі ең үлкен цифрдың мәні, ал цифрлар бірге көп: нөлді де санау керек.`,
      },
    },
    {
      value: String(base + 1),
      why: {
        ru: `Значения цифр идут от 0 до ${base - 1}, цифры со значением ${base} в этой системе нет — цифр не бывает больше основания.`,
        kk: `Цифрлардың мәндері ${kkSuffix(0, "abl")} ${kkSuffix(base - 1, "dat")} дейін, бұл жүйеде мәні ${base} болатын цифр жоқ — цифрлар саны негізден артық болмайды.`,
      },
    },
    { value: "10", why: { ru: "Десять цифр — только в десятичной системе, а здесь основание другое.", kk: "Он цифр тек ондық жүйеде, ал мұнда негіз басқа." } },
    { value: "2", why: { ru: "Две цифры (0 и 1) — только в двоичной системе.", kk: "Екі цифр (0 мен 1) тек екілік жүйеде болады." } },
    { value: "9", why: { ru: "9 — самая большая цифра десятичной системы, а не количество цифр.", kk: "9 — ондық жүйедегі ең үлкен цифр, цифрлар саны емес." } },
  ]);
  return {
    id: `g:ns.octhex:digits:${base}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько разных цифр используется в системе счисления с основанием ${base}?`,
      kk: `Негізі ${base} санау жүйесінде қанша түрлі цифр қолданылады?`,
    },
    ...o,
    explanation: {
      ru: `Количество цифр равно основанию: от 0 до ${base - 1}${base === 16 ? " (цифры 10–15 записываются буквами A–F)" : ""}, то есть ${base} цифр.`,
      kk: `Цифрлар саны негізге тең: ${kkSuffix(0, "abl")} ${kkSuffix(base - 1, "dat")} дейін${base === 16 ? " (10–15 цифрлары A–F әріптерімен жазылады)" : ""}, яғни ${base} цифр.`,
    },
    hint: HINT_BASE_COUNT,
  };
}

/** B: какая запись не может быть восьмеричной (ловушка: цифры 8 и 9). */
function invalidOctal(rand: Rand, level: Level, seed: number): QuestionStep {
  const validSet = new Set<string>();
  while (validSet.size < 3) validSet.add(int(rand, 10, 500).toString(8));
  const raw = int(rand, 10, 500).toString(8);
  const pos = int(rand, 0, raw.length - 1);
  const badDigit = pick(rand, ["8", "9"]);
  const bad = `${raw.slice(0, pos)}${badDigit}${raw.slice(pos + 1)}`;
  const o = options(
    rand,
    bad,
    [...validSet].map((v) => ({
      value: v,
      why: {
        ru: `В записи ${v} только цифры от 0 до 7 — она может быть восьмеричной.`,
        kk: `${v} жазбасында тек ${kkSuffix(0, "abl")} ${kkSuffix(7, "dat")} дейінгі цифрлар бар — ол сегіздік сан бола алады.`,
      },
    })),
  );
  return {
    id: `g:ns.octhex:invalid8:${bad}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: "Какая запись НЕ может быть числом в восьмеричной системе?",
      kk: "Қай жазба сегіздік жүйедегі сан бола АЛМАЙДЫ?",
    },
    ...o,
    explanation: {
      ru: `В восьмеричной системе цифры от 0 до 7. В записи ${bad} есть цифра ${badDigit}.`,
      kk: `Сегіздік жүйеде ${kkSuffix(0, "abl")} ${kkSuffix(7, "dat")} дейінгі цифрлар бар. ${bad} жазбасында ${badDigit} цифры бар.`,
    },
    hint: HINT_BASE_INVALID(SYSTEM_NAME[8]),
  };
}

export function octhexDigitsQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  return level === 1 ? digitsCount(rand, level, seed) : invalidOctal(rand, level, seed);
}

// ---------- Утверждения ----------

export function octhexDigitsStatement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  if (level === 1) {
    if (rand() < 0.5) {
      const b = pick(rand, [8, 16] as const);
      const value = rand() < 0.5;
      const k = value ? b : pick(rand, [b - 1, b + 1]);
      return {
        id: `s:ns.octhex:count:${b}:${k}`,
        skill: SKILL,
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
    const i = int(rand, 0, 5);
    const letter = HEX_LETTERS[i];
    const value = rand() < 0.5;
    const claim = value ? 10 + i : 10 + i + pick(rand, [-1, 1]);
    return {
      id: `s:ns.octhex:hex:${letter}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `В шестнадцатеричной системе цифра ${letter} означает ${claim}`,
        kk: `Он алтылық жүйеде ${letter} цифры ${claim} санын білдіреді`,
      },
      hint: HINT_HEX,
      value,
      explanation: {
        ru: `${HEX_TABLE}. Значит, ${letter} = ${10 + i}.`,
        kk: `${HEX_TABLE}. Демек, ${letter} = ${10 + i}.`,
      },
    };
  }
  // B: может ли запись быть восьмеричной (ловушка: цифры 8 и 9).
  const value = rand() < 0.5;
  let rec = int(rand, 10, 500).toString(8);
  if (!value) {
    const pos = int(rand, 1, rec.length - 1);
    rec = `${rec.slice(0, pos)}${pick(rand, ["8", "9"])}${rec.slice(pos + 1)}`;
  }
  return {
    id: `s:ns.octhex:valid8:${rec}`,
    skill: SKILL,
    level,
    text: { ru: `Запись ${rec} может быть числом в восьмеричной системе`, kk: `${rec} жазбасы сегіздік жүйедегі сан бола алады` },
    value,
    explanation: {
      ru: `Цифры восьмеричной системы: ${DIGITS_OF[8]}.${value ? "" : ` В записи ${rec} есть лишняя цифра.`}`,
      kk: `Сегіздік жүйенің цифрлары: ${DIGITS_OF[8]}.${value ? "" : ` ${rec} жазбасында артық цифр бар.`}`,
    },
    hint: {
      ru: `Проверь каждую цифру записи ${rec}: есть ли такая цифра в восьмеричной системе?`,
      kk: `${rec} жазбасының әр цифрын тексер: сегіздік жүйеде ондай цифр бар ма?`,
    },
  };
}

// ---------- Пары ----------

export function octhexDigitsPair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1 && rand() < 0.4) {
    const b = pick(rand, [8, 16] as const);
    return { id: `p:ns.octhex:sys:${b}`, skill: SKILL, level, left: { ru: `Основание ${b}`, kk: `Негізі ${b}` }, right: DIGITS_OF[b] };
  }
  const i = int(rand, 0, 5);
  return { id: `p:ns.octhex:letter:${i}`, skill: SKILL, level, left: `${HEX_LETTERS[i]}₁₆`, right: String(10 + i) };
}

// ---------- Короткие вопросы ----------

export function octhexDigitsShort(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1 && rand() < 0.5) {
    const b = pick(rand, [8, 16] as const);
    return {
      id: `q:ns.octhex:count:${b}`,
      skill: SKILL,
      level,
      prompt: { ru: `Сколько цифр в системе счисления с основанием ${b}?`, kk: `Негізі ${b} санау жүйесінде неше цифр бар?` },
      answer: String(b),
      mode: "number",
      explanation: { ru: `Цифр столько, сколько основание: ${b}.`, kk: `Цифрлар саны негізге тең: ${b}.` },
      hint: HINT_BASE_COUNT,
    };
  }
  const i = int(rand, 0, 5);
  return {
    id: `q:ns.octhex:letter:${i}`,
    skill: SKILL,
    level,
    prompt: same(`${HEX_LETTERS[i]}₁₆ = ?₁₀`),
    answer: String(10 + i),
    mode: "number",
    explanation: same(HEX_TABLE),
    hint: HINT_HEX,
  };
}

// ---------- Подмешивание к банку урока ----------

/** Доля заданий уровней A и B, которые берутся из «переехавших» (на уровне C их нет). */
const SHARE: Record<Level, number> = { 1: 0.3, 2: 0.15, 3: 0 };

/** Отдельный поток случайных чисел для выбора «переехавшее / основное»: поток основного банка не сдвигается. */
const gate = (level: Level, seed: number, salt: number) => seeded((seed ^ 0x9e3779b1) + salt)() < SHARE[level];

/** Банк урока + цифры 8/16 и буквы A–F (уровни A и B). */
export function withMovedDigits(bank: SkillBank): SkillBank {
  return {
    ...bank,
    question: (level, seed) => (gate(level, seed, 1) ? octhexDigitsQuestion(level, seed) : bank.question(level, seed)),
    statement: bank.statement && ((level, seed) => (gate(level, seed, 2) ? octhexDigitsStatement(level, seed) : bank.statement!(level, seed))),
    pair: bank.pair && ((level, seed) => (gate(level, seed, 3) ? octhexDigitsPair(level, seed) : bank.pair!(level, seed))),
    short: bank.short && ((level, seed) => (gate(level, seed, 4) ? octhexDigitsShort(level, seed) : bank.short!(level, seed))),
  };
}
