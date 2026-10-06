import type { ChoiceStep, InputStep, L, Level, QuestionStep, SkillId, Text } from "./types";
import { toBinary } from "./check";
import { seeded, shuffle } from "./text";
import type { SkillStat } from "./mastery";
import { levelFromMastery } from "./ent";
import { generateCurriculumQuestion, CURRICULUM_BANKS } from "./bank/curriculum";

// Процедурная генерация заданий: бесконечная тренировка без затрат на ИИ.
// У каждого задания уровень A/B/C (1/2/3), как в ЕНТ. Уровень выбирается по освоению навыка,
// а в тренировке задания идут от лёгкого к сложному.

type Rand = () => number;

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

/** Диапазон чисел по уровню: A — до 15, B — до 63, C — до 255. */
export function rangeForLevel(level: Level): [number, number] {
  if (level === 1) return [5, 15];
  if (level === 2) return [16, 63];
  return [64, 255];
}

/** Варианты ответа: правильный + уникальные отвлекающие, перемешанные. */
function options(rand: Rand, correct: string, distractors: string[], total = 4): { options: Text[]; correct: number } {
  const set = new Set<string>([correct]);
  for (const d of distractors) {
    if (set.size >= total) break;
    if (d && !set.has(d)) set.add(d);
  }
  const list = shuffle([...set], rand);
  return { options: list, correct: list.indexOf(correct) };
}

const sub2 = (bin: string) => `${bin}₂`;

// ---------- 2 → 10 ----------

function genBin2Dec(rand: Rand, level: Level, seed: number): QuestionStep {
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, hi);
  const bin = toBinary(n);
  // A — выбор и лампочки, B — всё, C — только ввод.
  const kind = pick(rand, level === 1 ? (["choice", "bits", "input"] as const) : level === 2 ? (["input", "input", "bits", "choice"] as const) : (["input"] as const));
  const id = `g:ns.bin2dec:${kind}:${n}:${seed}`;
  const explanation: L = {
    ru: `Складываем веса разрядов, где стоит 1: ${weightsSum(bin)} = ${n}.`,
    kk: `1 тұрған разрядтардың салмақтарын қосамыз: ${weightsSum(bin)} = ${n}.`,
  };
  if (kind === "bits" && n <= 255) {
    const bits = Math.max(4, bin.length);
    return {
      id,
      type: "bits",
      skill: "ns.bin2dec",
      prompt: { ru: `Включи биты так, чтобы получилось число ${n}`, kk: `${n} саны шығатындай биттерді қос` },
      target: n,
      bits,
      explanation,
    };
  }
  if (kind === "choice") {
    const o = options(rand, String(n), [String(n + 1), String(n - 1), String(parseInt(bin.split("").reverse().join(""), 2)), String(n + 2), String(n * 2)]);
    return {
      id,
      type: "choice",
      skill: "ns.bin2dec",
      prompt: { ru: `Чему равно ${sub2(bin)} в десятичной системе?`, kk: `${sub2(bin)} ондық жүйеде неге тең?` },
      ...o,
      explanation,
    } satisfies ChoiceStep;
  }
  return {
    id,
    type: "input",
    skill: "ns.bin2dec",
    prompt: { ru: `Переведи в десятичную: ${sub2(bin)} = ?`, kk: `Ондық жүйеге аудар: ${sub2(bin)} = ?` },
    answers: [String(n)],
    mode: "number",
    suffix: "₁₀",
    explanation,
  } satisfies InputStep;
}

export function weightsSum(bin: string): string {
  const parts: string[] = [];
  bin.split("").forEach((b, i) => {
    if (b === "1") parts.push(String(2 ** (bin.length - 1 - i)));
  });
  return parts.join(" + ") || "0";
}

// ---------- 10 → 2 ----------

function genDec2Bin(rand: Rand, level: Level, seed: number): QuestionStep {
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, level === 3 ? hi : Math.min(hi, 127));
  const bin = toBinary(n);
  // A — выбор и лесенка с подсказкой, B — лесенка и ввод, C — ввод.
  const kind = pick(rand, level === 1 ? (["choice", "ladder"] as const) : level === 2 ? (["ladder", "input"] as const) : (["input", "input", "ladder"] as const));
  const id = `g:ns.dec2bin:${kind}:${n}:${seed}`;
  const explanation: L = {
    ru: `Делим ${n} на 2 и читаем остатки снизу вверх: ${sub2(bin)}. Проверка: ${weightsSum(bin)} = ${n}.`,
    kk: `${n}-ді 2-ге бөліп, қалдықтарды төменнен жоғары оқимыз: ${sub2(bin)}. Тексеру: ${weightsSum(bin)} = ${n}.`,
  };
  if (kind === "ladder") {
    return {
      id,
      type: "ladder",
      skill: "ns.dec2bin",
      prompt: { ru: `Переведи ${n} в двоичную систему делением на 2`, kk: `${n} санын 2-ге бөлу арқылы екілік жүйеге аудар` },
      number: n,
      explanation,
    };
  }
  if (kind === "choice") {
    const reversed = bin.split("").reverse().join("").replace(/^0+/, "") || "0";
    const o = options(rand, sub2(bin), [
      sub2(reversed),
      sub2(toBinary(n + 1)),
      sub2(toBinary(Math.max(1, n - 1))),
      sub2(toBinary(n * 2)),
    ]);
    return {
      id,
      type: "choice",
      skill: "ns.dec2bin",
      prompt: { ru: `Как записать ${n} в двоичной системе?`, kk: `${n} саны екілік жүйеде қалай жазылады?` },
      ...o,
      explanation,
    };
  }
  return {
    id,
    type: "input",
    skill: "ns.dec2bin",
    prompt: { ru: `Переведи в двоичную: ${n}₁₀ = ?`, kk: `Екілік жүйеге аудар: ${n}₁₀ = ?` },
    answers: [bin],
    mode: "binary",
    suffix: "₂",
    explanation,
  };
}

// ---------- Основание и цифры ----------

function genBase(rand: Rand, level: Level, seed: number): QuestionStep {
  // A/B — «сколько цифр» и «какая запись не двоичная», C — только ловушки с записью (в т.ч. восьмеричной).
  const kind = level === 3 ? "invalid" : pick(rand, ["digits", "invalid"] as const);
  if (kind === "digits") {
    const base = pick(rand, [2, 8, 10, 16, 5, 3]);
    const o = options(rand, String(base), [String(base - 1), String(base + 1), "10", "2", "9"]);
    return {
      id: `g:ns.base:digits:${base}:${seed}`,
      type: "choice",
      skill: "ns.base",
      prompt: {
        ru: `Сколько разных цифр используется в системе счисления с основанием ${base}?`,
        kk: `Негізі ${base} санау жүйесінде қанша түрлі цифр қолданылады?`,
      },
      ...o,
      explanation: {
        ru: `Количество цифр равно основанию: от 0 до ${base - 1}, то есть ${base} цифр.`,
        kk: `Цифрлар саны негізге тең: 0-ден ${base - 1}-ге дейін, яғни ${base} цифр.`,
      },
    };
  }
  // C — восьмеричная система (ловушка: цифры 8 и 9), иначе — двоичная (ловушка: цифра 2).
  if (level === 3 && rand() < 0.5) {
    const validSet = new Set<string>();
    while (validSet.size < 3) validSet.add(int(rand, 10, 500).toString(8));
    const raw = int(rand, 10, 500).toString(8);
    const pos = int(rand, 0, raw.length - 1);
    const badDigit = pick(rand, ["8", "9"]);
    const fixedBad = `${raw.slice(0, pos)}${badDigit}${raw.slice(pos + 1)}`;
    const o = options(rand, fixedBad, [...validSet]);
    return {
      id: `g:ns.base:invalid8:${fixedBad}:${seed}`,
      type: "choice",
      skill: "ns.base",
      prompt: {
        ru: "Какая запись НЕ может быть числом в восьмеричной системе?",
        kk: "Қай жазба сегіздік жүйедегі сан бола АЛМАЙДЫ?",
      },
      ...o,
      explanation: {
        ru: `В восьмеричной системе цифры от 0 до 7. В записи ${fixedBad} есть цифра ${badDigit}.`,
        kk: `Сегіздік жүйеде 0-ден 7-ге дейінгі цифрлар бар. ${fixedBad} жазбасында ${badDigit} цифры бар.`,
      },
    };
  }
  const validSet = new Set<string>();
  while (validSet.size < 3) validSet.add(toBinary(int(rand, 5, 60)));
  const valid = [...validSet];
  const raw = toBinary(int(rand, 9, 60));
  const pos = int(rand, 1, raw.length - 1);
  const fixedBad = `${raw.slice(0, pos)}2${raw.slice(pos + 1)}`;
  const o = options(rand, fixedBad, valid);
  return {
    id: `g:ns.base:invalid:${fixedBad}:${seed}`,
    type: "choice",
    skill: "ns.base",
    prompt: {
      ru: "Какая запись НЕ может быть числом в двоичной системе?",
      kk: "Қай жазба екілік жүйедегі сан бола АЛМАЙДЫ?",
    },
    ...o,
    explanation: {
      ru: `В двоичной системе только цифры 0 и 1. В записи ${fixedBad} есть цифра 2.`,
      kk: `Екілік жүйеде тек 0 мен 1 цифрлары бар. ${fixedBad} жазбасында 2 цифры бар.`,
    },
  };
}

// ---------- Свойства ----------

function genProps(rand: Rand, level: Level, seed: number): QuestionStep {
  const kind = pick(rand, level === 1 ? (["parity", "pow", "length"] as const) : level === 2 ? (["length", "ones", "pow", "parity"] as const) : (["ones", "length"] as const));
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, hi);
  const bin = toBinary(n);
  if (kind === "parity") {
    const even = n % 2 === 0;
    const opts: L[] = [
      { ru: "Чётное", kk: "Жұп" },
      { ru: "Нечётное", kk: "Тақ" },
    ];
    return {
      id: `g:ns.props:parity:${n}:${seed}`,
      type: "choice",
      skill: "ns.props",
      prompt: { ru: `Число ${sub2(bin)} — чётное или нечётное?`, kk: `${sub2(bin)} саны — жұп па, тақ па?` },
      options: opts,
      correct: even ? 0 : 1,
      explanation: {
        ru: `Смотрим на последнюю цифру: ${bin.at(-1)}. Если 0 — число чётное, если 1 — нечётное.`,
        kk: `Соңғы цифрға қараймыз: ${bin.at(-1)}. 0 болса — жұп, 1 болса — тақ.`,
      },
    };
  }
  if (kind === "length") {
    const len = bin.length;
    const o = options(rand, String(len), [String(len - 1), String(len + 1), String(len + 2)]);
    return {
      id: `g:ns.props:length:${n}:${seed}`,
      type: "choice",
      skill: "ns.props",
      prompt: {
        ru: `Сколько цифр в двоичной записи числа ${n}?`,
        kk: `${n} санының екілік жазбасында неше цифр бар?`,
      },
      ...o,
      explanation: {
        ru: `${n} = ${sub2(bin)} — ${len} цифр. Быстрый способ: найди наибольшую степень двойки ≤ ${n}: 2^${len - 1} = ${2 ** (len - 1)}, значит цифр ${len}.`,
        kk: `${n} = ${sub2(bin)} — ${len} цифр. Жылдам тәсіл: ${n}-нен аспайтын екінің ең үлкен дәрежесін тап: 2^${len - 1} = ${2 ** (len - 1)}, демек ${len} цифр.`,
      },
    };
  }
  if (kind === "ones") {
    const ones = bin.split("").filter((c) => c === "1").length;
    const o = options(rand, String(ones), [String(ones + 1), String(Math.max(0, ones - 1)), String(ones + 2), String(bin.length - ones)]);
    return {
      id: `g:ns.props:ones:${n}:${seed}`,
      type: "choice",
      skill: "ns.props",
      ent: true,
      prompt: {
        ru: `Сколько единиц в двоичной записи числа ${n}?`,
        kk: `${n} санының екілік жазбасында неше бірлік бар?`,
      },
      ...o,
      explanation: {
        ru: `${n} = ${weightsSum(bin)} = ${sub2(bin)}. Единиц: ${ones}.`,
        kk: `${n} = ${weightsSum(bin)} = ${sub2(bin)}. Бірліктер саны: ${ones}.`,
      },
    };
  }
  const k = level === 1 ? int(rand, 3, 5) : int(rand, 5, 8);
  const pow = 2 ** k;
  const correct = sub2(`1${"0".repeat(k)}`);
  const o = options(rand, correct, [sub2(`1${"0".repeat(k - 1)}`), sub2("1".repeat(k)), sub2(`1${"0".repeat(k + 1)}`)]);
  return {
    id: `g:ns.props:pow:${k}:${seed}`,
    type: "choice",
    skill: "ns.props",
    prompt: { ru: `Как выглядит число ${pow} в двоичной системе?`, kk: `${pow} саны екілік жүйеде қалай жазылады?` },
    ...o,
    explanation: {
      ru: `${pow} = 2^${k}. Степень двойки 2^k в двоичной — это 1 и k нулей.`,
      kk: `${pow} = 2^${k}. Екінің 2^k дәрежесі екілік жүйеде — 1 және k нөл.`,
    },
  };
}

type Generator = (rand: Rand, level: Level, seed: number) => QuestionStep;

const GENERATORS: Record<string, Generator> = {
  "ns.base": genBase,
  "ns.bin2dec": genBin2Dec,
  "ns.dec2bin": genDec2Bin,
  "ns.props": genProps,
  ...Object.fromEntries(CURRICULUM_BANKS.map((bank) => [bank.skill, (_rand: Rand, level: Level, seed: number) => generateCurriculumQuestion(bank.skill, level, seed)])),
};

export function canGenerate(skill: SkillId): boolean {
  return skill in GENERATORS;
}

/** Задание нужного уровня (A/B/C). */
export function generateLeveled(skill: SkillId, level: Level, seed: number): QuestionStep {
  const gen = GENERATORS[skill];
  if (!gen) throw new Error(`Нет генератора для навыка ${skill}`);
  return { ...gen(seeded(seed), level, seed), level };
}

/** Задание по освоению навыка (уровень подбирается сам). */
export function generateStep(skill: SkillId, mastery: number, seed: number): QuestionStep {
  return generateLeveled(skill, levelFromMastery(mastery), seed);
}

/** Практикум трассировки: только задания с кодом, ответы проверяются локально. */
export function buildCodePractice(seed: number, count = 8): QuestionStep[] {
  const skills = ["py.variables", "py.conditions", "py.loops", "py.lists", "py.strings", "py.functions", "py.files", "algo.sorting"];
  const questions: QuestionStep[] = [];
  const seen = new Set<string>();
  const rand = seeded(seed);
  for (let tries = 0; questions.length < count && tries < count * 100; tries++) {
    const skill = skills[Math.floor(rand() * skills.length)];
    const level = (Math.min(2, Math.floor(questions.length * 3 / count)) + 1) as Level;
    const question = generateCurriculumQuestion(skill, level, Math.floor(rand() * 1e9));
    if (seen.has(question.id) || !question.prompt.ru.includes("```python")) continue;
    seen.add(question.id); questions.push(question);
  }
  return questions;
}

/**
 * Тренировка: count заданий, навыки выбираются с весом «чем слабее — тем чаще».
 * focus — тренировать только эти навыки.
 * Порядок — от лёгкого к сложному: последняя треть на уровень выше, затем сортировка по уровню.
 */
export function buildDrill(
  available: SkillId[],
  stats: Record<string, SkillStat>,
  opts: { count?: number; seed?: number; focus?: SkillId[] } = {},
): QuestionStep[] {
  const count = opts.count ?? 8;
  const seed = opts.seed ?? Date.now();
  const rand = seeded(seed);
  const pool = (opts.focus?.length ? opts.focus : available).filter(canGenerate);
  if (!pool.length) return [];
  // Вес ~ (1.1 − освоение)²: слабые навыки выпадают в разы чаще освоенных.
  const weights = pool.map((s) => (1.1 - (stats[s]?.mastery ?? 0.5)) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const steps: QuestionStep[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (steps.length < count && guard++ < count * 10) {
    let r = rand() * total;
    let idx = 0;
    while (r > weights[idx] && idx < weights.length - 1) r -= weights[idx++];
    const skill = pool[idx];
    const base = levelFromMastery(stats[skill]?.mastery ?? 0);
    const level = Math.min(3, base + (steps.length >= Math.ceil((count * 2) / 3) ? 1 : 0)) as Level;
    const step = generateLeveled(skill, level, Math.floor(rand() * 1e9));
    const key = step.id.split(":").slice(0, 4).join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(step);
  }
  // Стабильная сортировка по уровню: сначала A, потом B, потом C.
  return steps.map((s, i) => ({ s, i })).sort((a, b) => (a.s.level ?? 1) - (b.s.level ?? 1) || a.i - b.i).map((x) => x.s);
}
