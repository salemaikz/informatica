import type { ChoiceStep, InputStep, L, Level, QuestionStep, SkillId, Text } from "./types";
import { toBinary } from "./check";
import { seeded, shuffle } from "./text";
import type { SkillStat } from "./mastery";
import { levelFromMastery } from "./ent";
import { kkSuffix } from "./kk";

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

/** Вариант ответа с объяснением, какую ошибку он выдаёт (для whyWrong). */
export type Distractor = { value: string; why: L };

/**
 * Варианты ответа: правильный + уникальные отвлекающие, перемешанные.
 * whyWrong — в том же порядке, у верного null; при совпадении значений побеждает первое объяснение.
 */
export function options(
  rand: Rand,
  correct: string,
  distractors: Distractor[],
  total = 4,
): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  const whys = new Map<string, L>();
  for (const d of distractors) {
    if (whys.size >= total - 1) break;
    if (d.value && d.value !== correct && !whys.has(d.value)) whys.set(d.value, d.why);
  }
  const list = shuffle([correct, ...whys.keys()], rand);
  return { options: list, correct: list.indexOf(correct), whyWrong: list.map((v) => (v === correct ? null : (whys.get(v) as L))) };
}

/** «на 1 больше / на 2 меньше»: объяснение для числового дистрактора. */
function offBy(n: number, v: number, hint: L): L {
  const d = Math.abs(v - n);
  const more = v > n;
  return {
    ru: `Это на ${d} ${more ? "больше" : "меньше"} верного значения. ${hint.ru}`,
    kk: `Бұл дұрыс мәннен ${kkSuffix(d, "dat")} ${more ? "артық" : "кем"}. ${hint.kk}`,
  };
}

const sub2 = (bin: string) => `${bin}₂`;

const SUP_DIGITS: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** Показатель степени Unicode-цифрами: 12 → «¹²». */
export const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP_DIGITS[d]);

const reverseStr = (s: string) => s.split("").reverse().join("");
const ones1 = (bin: string) => bin.split("").filter((c) => c === "1").length;

/**
 * Ноль и единица на уровне A (аудит C8): примерно каждое десятое задание — про 0 или 1.
 * Решение берётся из отдельного потока seed, поэтому остальные задания по тем же seed не сдвигаются.
 */
export function edgeCase(seed: number): 0 | 1 | null {
  const r = seeded((seed ^ 0x2c1b3c6d) >>> 0);
  if (r() >= 0.1) return null;
  return r() < 0.5 ? 0 : 1;
}

/** Вариант выбора с объяснением ошибки; text — строка или { ru, kk }. */
type Opt = { text: Text; why: L | null };

/** Варианты в заданном порядке (для «Числа равны / Сравнить нельзя» и т. п.): индекс верного — correct. */
function fixed(items: Opt[], correct: number): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  return { options: items.map((i) => i.text), correct, whyWrong: items.map((i, k) => (k === correct ? null : i.why)) };
}

// ---------- Шаблоны подсказок (без ответа: подталкивают к первому шагу) ----------

export const HINT_WEIGHTS: L = {
  ru: "Подпиши под цифрами веса разрядов справа налево: 1, 2, 4, 8… Затем сложи веса только тех разрядов, где стоит 1.",
  kk: "Цифрлардың астына разряд салмақтарын оңнан солға қарай жаз: 1, 2, 4, 8… Содан кейін тек 1 тұрған разрядтардың салмақтарын қос.",
};
const HINT_BITS: L = {
  ru: "Разложи число на веса 1, 2, 4, 8…: начни с самого большого веса, который не больше числа, и вычти его.",
  kk: "Санды 1, 2, 4, 8… салмақтарына жікте: саннан аспайтын ең үлкен салмақтан баста да, оны алып таста.",
};
export const HINT_DIV: L = {
  ru: "Дели на 2 и записывай остатки; читай их снизу вверх.",
  kk: `${kkSuffix(2, "dat")} бөліп, қалдықтарды жаз; оларды төменнен жоғары қарай оқы.`,
};
const HINT_LADDER: L = {
  ru: "Дели число на 2, потом частное снова на 2 — и так до нуля. Остаток каждого деления — одна цифра ответа; читай их снизу вверх.",
  kk: `Санды ${kkSuffix(2, "dat")} бөл, сосын бөліндіні қайта ${kkSuffix(2, "dat")} бөл — нөлге дейін. Әр бөлудің қалдығы — жауаптың бір цифры; оларды төменнен жоғары оқы.`,
};

// ---------- 2 → 10 ----------

/** Уровень A: 0₂ = ?₁₀ и 1₂ = ?₁₀ (аудит C8). */
function bin2decEdge(n: 0 | 1, seed: number): QuestionStep {
  const bin = String(n);
  return {
    id: `g:ns.bin2dec:input:${n}:${seed}`,
    type: "input",
    skill: "ns.bin2dec",
    prompt: { ru: `Переведи в десятичную: ${sub2(bin)} = ?`, kk: `Ондық жүйеге аудар: ${sub2(bin)} = ?` },
    answers: [String(n)],
    mode: "number",
    suffix: "₁₀",
    explanation:
      n === 0
        ? {
            ru: "В записи 0₂ нет ни одной единицы, поэтому ни один вес не складывается: сумма пустая, 0₂ = 0.",
            kk: "0₂ жазбасында бірлік жоқ, сондықтан ешбір салмақ қосылмайды: қосынды бос, 0₂ = 0.",
          }
        : {
            ru: "Единица стоит в разряде с весом 1, других единиц нет: сумма весов 1₂ = 1.",
            kk: "Бірлік салмағы 1 болатын разрядта тұр, басқа бірлік жоқ: салмақтар қосындысы 1₂ = 1.",
          },
    hint: HINT_WEIGHTS,
  };
}

/** Уровень C: «найди цифру x: 1x01₂ = 13» — обратная задача, веса известных единиц и вес разряда с x. */
function bin2decFindX(rand: Rand, seed: number): QuestionStep {
  const len = int(rand, 5, 8);
  let bits = "1";
  for (let i = 1; i < len; i++) bits += rand() < 0.5 ? "0" : "1";
  const p = int(rand, 1, len - 1); // x стоит не на первом месте
  const d = Number(bits[p]);
  const n = parseInt(bits, 2);
  const masked = `${bits.slice(0, p)}x${bits.slice(p + 1)}`;
  const w = 2 ** (len - 1 - p);
  const known = n - d * w; // сумма весов остальных единиц
  const rest = bits
    .split("")
    .flatMap((b, i) => (i !== p && b === "1" ? [2 ** (len - 1 - i)] : []))
    .join(" + ");
  const ws = bits.split("").map((_, i) => 2 ** (len - 1 - i)).join(", ");
  const other = 1 - d;
  const o = options(rand, String(d), [
    {
      value: String(other),
      why: {
        ru: `Проверка: при x = ${other} сумма весов получается ${known + other * w}, а не ${n}.`,
        kk: `Тексеру: x = ${other} болса, салмақтардың қосындысы ${known + other * w} шығады, ${n} емес.`,
      },
    },
    ...shuffle(
      [
        {
          value: String(w),
          why: {
            ru: `${w} — вес разряда с x, а не сама цифра. В двоичной системе цифра — 0 или 1.`,
            kk: `${w} — x тұрған разрядтың салмағы, цифрдың өзі емес. Екілік жүйеде цифр 0 немесе 1 болады.`,
          },
        },
        { value: "2", why: { ru: "Цифры 2 в двоичной системе нет: возможны только 0 и 1.", kk: "Екілік жүйеде 2 цифры жоқ: тек 0 және 1 болуы мүмкін." } },
        {
          value: String(2 * w),
          why: { ru: `${2 * w} — вес соседнего разряда, а не цифра.`, kk: `${2 * w} — көрші разрядтың салмағы, цифр емес.` },
        },
        { value: String(n), why: { ru: `${n} — значение всего числа, а не цифра x.`, kk: `${n} — бүкіл санның мәні, x цифры емес.` } },
      ],
      rand,
    ),
  ]);
  return {
    id: `g:ns.bin2dec:findx:${masked}:${seed}`,
    type: "choice",
    skill: "ns.bin2dec",
    prompt: {
      ru: `Найди цифру x: ${sub2(masked)} = ${n}`,
      kk: `${sub2(masked)} = ${n} теңдігі дұрыс болатын x цифрын тап`,
    },
    ...o,
    explanation: {
      ru: `Веса разрядов слева направо: ${ws}. Единицы, кроме x, дают ${rest} = ${known}. До ${n} не хватает ${n} − ${known} = ${n - known}, а вес разряда с x равен ${w}: ${n - known} = x · ${w}, значит x = ${d}.`,
      kk: `Разряд салмақтары солдан оңға қарай: ${ws}. x-тен басқа бірліктер ${rest} = ${known} береді. ${n} санына дейін ${n} − ${known} = ${n - known} жетпейді, ал x тұрған разрядтың салмағы ${w}: ${n - known} = x · ${w}, демек x = ${d}.`,
    },
    hint: {
      ru: "Подпиши веса разрядов. Сложи веса известных единиц и посмотри, сколько не хватает до заданного числа: хватает ли для этого веса разряда с x?",
      kk: "Разряд салмақтарын жаз. Белгілі бірліктердің салмақтарын қос та, берілген санға неше жетпейтінін қара: x тұрған разрядтың салмағы соған жете ме?",
    },
  };
}

/** Уровень C: «101₂ + 11₂ = ?₁₀» — два перевода и сложение (или сложение в двоичной и один перевод). */
function bin2decSum(rand: Rand, seed: number): QuestionStep {
  let a = 13;
  let b = 7;
  // общий бит у слагаемых — чтобы был перенос (иначе ошибка «без переноса» совпала бы с верным ответом)
  for (let g = 0; g < 50; g++) {
    const x = int(rand, 5, 31);
    const y = int(rand, 3, 15);
    if ((x & y) !== 0) {
      a = x;
      b = y;
      break;
    }
  }
  const s = a + b;
  const binA = toBinary(a);
  const binB = toBinary(b);
  const sumBin = toBinary(s);
  const prompt: L = {
    ru: `Чему равна сумма ${sub2(binA)} + ${sub2(binB)}? Запиши ответ в десятичной системе.`,
    kk: `${sub2(binA)} + ${sub2(binB)} қосындысы неге тең? Жауабын ондық жүйеде жаз.`,
  };
  const explanation: L = {
    ru: `Переводим слагаемые: ${sub2(binA)} = ${weightsSum(binA)} = ${a}, ${sub2(binB)} = ${weightsSum(binB)} = ${b}. Сумма: ${a} + ${b} = ${s}. Проверка в двоичной системе: ${sub2(binA)} + ${sub2(binB)} = ${sub2(sumBin)} = ${s}.`,
    kk: `Қосылғыштарды аударамыз: ${sub2(binA)} = ${weightsSum(binA)} = ${a}, ${sub2(binB)} = ${weightsSum(binB)} = ${b}. Қосынды: ${a} + ${b} = ${s}. Екілік жүйеде тексеру: ${sub2(binA)} + ${sub2(binB)} = ${sub2(sumBin)} = ${s}.`,
  };
  const hint: L = {
    ru: "Переведи каждое слагаемое в десятичную систему по весам разрядов, а затем сложи числа. Можно и наоборот: сложить в столбик в двоичной системе и перевести результат.",
    kk: "Әр қосылғышты разряд салмақтары бойынша ондық жүйеге аудар да, сосын сандарды қос. Керісінше де болады: екілік жүйеде бағанмен қосып, нәтижені аудар.",
  };
  const id = `g:ns.bin2dec:sum:${binA}+${binB}:${seed}`;
  if (rand() < 0.5) {
    return { id, type: "input", skill: "ns.bin2dec", prompt, answers: [String(s)], mode: "number", suffix: "₁₀", explanation, hint };
  }
  const o = options(rand, String(s), [
    {
      value: sumBin,
      why: { ru: `Это ${sub2(sumBin)} — сумма в двоичной системе. Ответ нужно записать в десятичной.`, kk: `Бұл ${sub2(sumBin)} — екілік жүйедегі қосынды. Жауап ондық жүйеде жазылуы керек.` },
    },
    {
      value: String(Number(binA) + Number(binB)),
      why: {
        ru: `Двоичные записи сложены как десятичные числа: ${binA} + ${binB}. Их нужно сначала перевести или складывать по правилам двоичной системы.`,
        kk: `Екілік жазбалар ондық сандар сияқты қосылған: ${binA} + ${binB}. Оларды алдымен аудару немесе екілік жүйе ережесімен қосу керек.`,
      },
    },
    {
      value: String(a ^ b),
      why: {
        ru: "Сложение без переносов: 1 + 1 = 10₂, единица переносится в следующий разряд.",
        kk: "Ауыстырусыз қосу: 1 + 1 = 10₂, бірлік келесі разрядқа ауысады.",
      },
    },
    {
      value: String(Math.max(a, b)),
      why: { ru: "Переведено только одно слагаемое: второе забыто.", kk: "Тек бір қосылғыш аударылған: екіншісі ұмытылған." },
    },
  ]);
  return { id, type: "choice", skill: "ns.bin2dec", prompt, ...o, explanation, hint };
}

/** Уровень C: «какое число больше: 1101₂ или 12₁₀?» — запись длиннее не значит число больше. */
function bin2decCmp(rand: Rand, seed: number): QuestionStep {
  const b = int(rand, 9, 120);
  const bs = toBinary(b);
  const eq = rand() < 1 / 6;
  const decBigger = rand() < 0.5;
  const delta = int(rand, 1, 4);
  const d = eq ? b : decBigger ? b + delta : b - delta;
  const binOpt: Opt = { text: sub2(bs), why: null };
  const decOpt: Opt = { text: `${d}₁₀`, why: null };
  const equalOpt: Opt = { text: { ru: "Числа равны", kk: "Сандар тең" }, why: null };
  const noOpt: Opt = {
    text: { ru: "Сравнить числа нельзя", kk: "Сандарды салыстыруға болмайды" },
    why: {
      ru: `Числа из разных систем сравнивают, переведя их в одну систему: ${sub2(bs)} = ${b}.`,
      kk: `Әртүрлі жүйедегі сандарды бір жүйеге аударып салыстырады: ${sub2(bs)} = ${b}.`,
    },
  };
  // верный — тот, что больше; при равенстве — «Числа равны»
  binOpt.why = eq
    ? { ru: `${sub2(bs)} = ${b} — это то же число, что ${d}₁₀: числа равны.`, kk: `${sub2(bs)} = ${b} — бұл ${d}₁₀ санымен бірдей сан: сандар тең.` }
    : {
        ru: `${sub2(bs)} = ${b}, а это меньше, чем ${d}: длинная запись не означает большое число.`,
        kk: `${sub2(bs)} = ${b}, бұл ${d} санынан кіші: жазбаның ұзын болуы санның үлкен екенін білдірмейді.`,
      };
  decOpt.why = eq
    ? { ru: `${d}₁₀ — то же число, что ${sub2(bs)}: числа равны.`, kk: `${d}₁₀ — ${sub2(bs)} санымен бірдей сан: сандар тең.` }
    : { ru: `${d}₁₀ меньше, чем ${sub2(bs)} = ${b}.`, kk: `${d}₁₀ саны ${sub2(bs)} = ${b} санынан кіші.` };
  equalOpt.why = { ru: `Значения разные: ${sub2(bs)} = ${b}, а второе число — ${d}.`, kk: `Мәндер әртүрлі: ${sub2(bs)} = ${b}, ал екінші сан — ${d}.` };
  const swap = rand() < 0.5;
  const pair = swap ? [decOpt, binOpt] : [binOpt, decOpt];
  const items = [...pair, equalOpt, noOpt];
  const correct = eq ? 2 : b > d ? items.indexOf(binOpt) : items.indexOf(decOpt);
  const verdict = eq
    ? { ru: `${b} = ${d}: числа равны`, kk: `${b} = ${d}: сандар тең` }
    : b > d
      ? { ru: `${b} > ${d}: больше двоичное число`, kk: `${b} > ${d}: екілік сан үлкен` }
      : { ru: `${b} < ${d}: больше десятичное число`, kk: `${b} < ${d}: ондық сан үлкен` };
  return {
    id: `g:ns.bin2dec:cmp:${bs}-${d}:${seed}`,
    type: "choice",
    skill: "ns.bin2dec",
    prompt: {
      ru: `Какое число больше: ${sub2(bs)} или ${d}₁₀?`,
      kk: `Қай сан үлкен: ${sub2(bs)} немесе ${d}₁₀?`,
    },
    ...fixed(items, correct),
    explanation: {
      ru: `Переводим двоичное число: ${sub2(bs)} = ${weightsSum(bs)} = ${b}. Сравниваем ${b} и ${d}: ${verdict.ru}. Запись ${bs} длиннее, но это ещё не значит, что число больше.`,
      kk: `Екілік санды аударамыз: ${sub2(bs)} = ${weightsSum(bs)} = ${b}. ${b} және ${d} салыстырамыз: ${verdict.kk}. ${bs} жазбасы ұзынырақ, бірақ бұл санның үлкен екенін білдірмейді.`,
    },
    hint: {
      ru: "Числа записаны в разных системах: сначала переведи двоичное число в десятичную систему, и только потом сравнивай.",
      kk: "Сандар әртүрлі жүйеде жазылған: алдымен екілік санды ондық жүйеге аудар, содан кейін ғана салыстыр.",
    },
  };
}

function genBin2Dec(rand: Rand, level: Level, seed: number): QuestionStep {
  if (level === 1) {
    const edge = edgeCase(seed);
    if (edge !== null) return bin2decEdge(edge, seed);
  }
  if (level === 3) {
    // C — не только «число больше»: обратная задача, сумма, сравнение с десятичным числом.
    const kind = pick(rand, ["input", "findx", "sum", "cmp"] as const);
    if (kind === "findx") return bin2decFindX(rand, seed);
    if (kind === "sum") return bin2decSum(rand, seed);
    if (kind === "cmp") return bin2decCmp(rand, seed);
  }
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, hi);
  const bin = toBinary(n);
  // A — выбор и ввод, B — ввод и выбор, C — только ввод. «Включи биты» — направление 10 → 2, оно в genDec2Bin.
  const kind = pick(rand, level === 1 ? (["choice", "input"] as const) : level === 2 ? (["input", "input", "choice"] as const) : (["input"] as const));
  const id = `g:ns.bin2dec:${kind}:${n}:${seed}`;
  const explanation: L = {
    ru: `Складываем веса разрядов, где стоит 1: ${weightsSum(bin)} = ${n}.`,
    kk: `1 тұрған разрядтардың салмақтарын қосамыз: ${weightsSum(bin)} = ${n}.`,
  };
  if (kind === "choice") {
    const o = options(rand, String(n), [
      { value: String(n + 1), why: offBy(n, n + 1, { ru: "Проверь сложение весов: лишней единицы быть не должно.", kk: "Салмақтарды қосуды тексер: артық бірлік болмауы керек." }) },
      { value: String(n - 1), why: offBy(n, n - 1, { ru: "Проверь, не пропущен ли вес разряда, где стоит 1.", kk: "1 тұрған разрядтардың бірінің салмағы жіберіліп кетпегенін тексер." }) },
      {
        value: String(reverseBin(bin)),
        why: {
          ru: "Цифры прочитаны справа налево: вес 1 у правой цифры, а не у левой.",
          kk: "Цифрлар оңнан солға оқылып қалған: 1 салмағы сол жақтағы емес, оң жақтағы цифрдікі.",
        },
      },
      { value: String(n + 2), why: offBy(n, n + 2, { ru: "Проверь сложение весов.", kk: "Салмақтарды қосуды тексер." }) },
      {
        value: String(n * 2),
        why: {
          ru: "Это вдвое больше верного: веса сдвинуты на один разряд. У правой цифры вес 1, а не 2.",
          kk: "Бұл дұрыс жауаптан екі есе артық: салмақтар бір разрядқа жылжып кеткен. Оң жақтағы цифрдың салмағы 2 емес, 1.",
        },
      },
    ]);
    return {
      id,
      type: "choice",
      skill: "ns.bin2dec",
      prompt: { ru: `Чему равно ${sub2(bin)} в десятичной системе?`, kk: `${sub2(bin)} ондық жүйеде неге тең?` },
      ...o,
      explanation,
      hint: HINT_WEIGHTS,
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
    hint: HINT_WEIGHTS,
  } satisfies InputStep;
}

const reverseBin = (bin: string) => parseInt(bin.split("").reverse().join(""), 2);

export function weightsSum(bin: string): string {
  const parts: string[] = [];
  bin.split("").forEach((b, i) => {
    if (b === "1") parts.push(String(2 ** (bin.length - 1 - i)));
  });
  return parts.join(" + ") || "0";
}

// ---------- 10 → 2 ----------

/** Уровень A: 0₁₀ = ?₂ и 1₁₀ = ?₂ (аудит C8): выбор или ввод. */
function dec2binEdge(rand: Rand, n: 0 | 1, seed: number): QuestionStep {
  const bin = String(n);
  const explanation: L =
    n === 0
      ? {
          ru: "Для нуля не нужен ни один вес: все разряды выключены, а пустой записи не бывает, поэтому пишем одну цифру: 0₂. Деление на 2 даёт то же: 0 : 2 = 0, остаток 0.",
          kk: `Нөл үшін бірде-бір салмақ қажет емес: барлық разряд өшірулі, ал бос жазба болмайды, сондықтан бір цифр жазамыз: 0₂. ${kkSuffix(2, "dat")} бөлу де сол нәтижені береді: 0 : 2 = 0, қалдығы 0.`,
        }
      : {
          ru: "Число 1 — это один вес 1: единица в младшем разряде, других цифр нет: 1₂. Деление: 1 : 2 = 0, остаток 1.",
          kk: "1 саны — бір ғана 1 салмағы: ең кіші разрядтағы бірлік, басқа цифр жоқ: 1₂. Бөлу: 1 : 2 = 0, қалдығы 1.",
        };
  if (rand() < 0.5) {
    return {
      id: `g:ns.dec2bin:input:${n}:${seed}`,
      type: "input",
      skill: "ns.dec2bin",
      prompt: { ru: `Переведи в двоичную: ${n}₁₀ = ?`, kk: `Екілік жүйеге аудар: ${n}₁₀ = ?` },
      answers: [bin],
      mode: "binary",
      suffix: "₂",
      explanation,
      hint: HINT_DIV,
    };
  }
  const items: Opt[] =
    n === 0
      ? [
          { text: "0₂", why: null },
          {
            text: "1₂",
            why: {
              ru: "1₂ — это число 1: вес 1 включён, а для нуля не включён ни один вес.",
              kk: "1₂ — бұл 1 саны: 1 салмағы қосылған, ал нөл үшін бірде-бір салмақ қосылмайды.",
            },
          },
          { text: "10₂", why: { ru: "10₂ — это число 2, а не ноль.", kk: "10₂ — бұл 2 саны, нөл емес." } },
          {
            text: { ru: "Пустая запись: у нуля нет цифр", kk: "Бос жазба: нөлде цифр жоқ" },
            why: { ru: "Пустой записи не бывает: для нуля пишут одну цифру 0.", kk: "Бос жазба болмайды: нөл үшін бір ғана 0 цифры жазылады." },
          },
        ]
      : [
          { text: "1₂", why: null },
          { text: "0₂", why: { ru: "0₂ — это ноль: вес 1 не включён.", kk: "0₂ — бұл нөл: 1 салмағы қосылмаған." } },
          { text: "10₂", why: { ru: "10₂ — это число 2: включён вес 2, а нужен вес 1.", kk: "10₂ — бұл 2 саны: 2 салмағы қосылған, ал 1 салмағы керек." } },
          { text: "11₂", why: { ru: "11₂ — это число 3: включены веса 2 и 1.", kk: "11₂ — бұл 3 саны: 2 және 1 салмақтары қосылған." } },
        ];
  const order = shuffle(
    items.map((_, i) => i),
    rand,
  );
  const shuffled = order.map((i) => items[i]);
  return {
    id: `g:ns.dec2bin:choice:${n}:${seed}`,
    type: "choice",
    skill: "ns.dec2bin",
    prompt: { ru: `Как записать ${n} в двоичной системе?`, kk: `${n} саны екілік жүйеде қалай жазылады?` },
    ...fixed(shuffled, order.indexOf(0)),
    explanation,
    hint: {
      ru: "Сколько весов нужно включить, чтобы набрать это число? Какая цифра стоит под включённым весом, а какая — под выключенным?",
      kk: "Бұл санды жинау үшін қанша салмақты қосу керек? Қосылған салмақтың астында қандай цифр тұрады, өшірулі салмақтың астында ше?",
    },
  };
}

/** Уровень C: «запиши в двоичной системе сумму 25 + 14» — сначала сложить, потом перевести. */
function dec2binSum(rand: Rand, seed: number): QuestionStep {
  let a = 25;
  let b = 14;
  // общий бит у двоичных записей слагаемых — чтобы ошибки «без переноса» и «или» не совпали с верным ответом
  for (let g = 0; g < 50; g++) {
    const x = int(rand, 9, 60);
    const y = int(rand, 5, 40);
    if ((x & y) !== 0) {
      a = x;
      b = y;
      break;
    }
  }
  const s = a + b;
  const bin = toBinary(s);
  const prompt: L = { ru: `Запиши в двоичной системе сумму ${a} + ${b}`, kk: `${a} + ${b} қосындысын екілік жүйеде жаз` };
  const explanation: L = {
    ru: `Сначала складываем: ${a} + ${b} = ${s}. Переводим ${s} в двоичную систему: ${weightsSum(bin)} = ${s} → ${sub2(bin)}. Проверка: ${sub2(toBinary(a))} + ${sub2(toBinary(b))} = ${sub2(bin)}.`,
    kk: `Алдымен қосамыз: ${a} + ${b} = ${s}. ${kkSuffix(s, "acc")} екілік жүйеге аударамыз: ${weightsSum(bin)} = ${s} → ${sub2(bin)}. Тексеру: ${sub2(toBinary(a))} + ${sub2(toBinary(b))} = ${sub2(bin)}.`,
  };
  const hint: L = {
    ru: "Сначала сложи числа в десятичной системе, затем переведи сумму: делением на 2 или по весам разрядов.",
    kk: `Алдымен сандарды ондық жүйеде қос, сосын қосындыны аудар: ${kkSuffix(2, "dat")} бөлу арқылы немесе разряд салмақтары бойынша.`,
  };
  const id = `g:ns.dec2bin:sumbin:${a}+${b}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.dec2bin", prompt, answers: [bin], mode: "binary", suffix: "₂", explanation, hint };
  const rev = reverseStr(bin);
  const o = options(rand, bin, [
    {
      value: `${toBinary(a)}${toBinary(b)}`,
      why: {
        ru: `Двоичные записи слагаемых просто записаны подряд. Сначала нужно найти сумму ${s}, а потом перевести её.`,
        kk: `Қосылғыштардың екілік жазбалары жай қатар жазылған. Алдымен ${s} қосындысын табу, сосын оны аудару керек.`,
      },
    },
    {
      value: rev,
      why: {
        ru: `Это ${sub2(rev)}: остатки прочитаны сверху вниз. Читать нужно снизу вверх.`,
        kk: `Бұл ${sub2(rev)}: қалдықтар жоғарыдан төмен оқылған. Төменнен жоғары оқу керек.`,
      },
    },
    {
      value: toBinary(a ^ b),
      why: {
        ru: "Сложение без переносов: в разрядах, где обе цифры равны 1, единица переносится дальше.",
        kk: "Ауыстырусыз қосу: екі цифр да 1 болатын разрядтарда бірлік әрі қарай ауысады.",
      },
    },
    {
      value: toBinary(a | b),
      why: {
        ru: "Это «или» разрядов, а не сумма: где обе цифры равны 1, нужно сложить 1 + 1 = 10₂.",
        kk: "Бұл разрядтардың «немесе» амалы, қосынды емес: екі цифр да 1 болған жерде 1 + 1 = 10₂ қосу керек.",
      },
    },
    { value: toBinary(s * 2), why: { ru: "Лишний ноль справа удваивает число.", kk: "Оң жақтағы артық нөл санды екі есе өсіреді." } },
  ]);
  return { id, type: "choice", skill: "ns.dec2bin", prompt, ...o, explanation, hint };
}

/** Уровень C: «известно, что 13 = 1101₂ — запиши 52» — умножение/деление на 2ᵏ без перевода заново. */
function dec2binShift(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 1, 3);
  const n = int(rand, 5, 30);
  const mul = rand() < 0.5;
  const base = toBinary(n);
  const m = n * 2 ** k;
  const given = mul ? n : m;
  const askN = mul ? m : n;
  const givenBin = toBinary(given);
  const correct = toBinary(askN);
  const dropRight = (s: string, j: number) => (j === 0 ? s : s.slice(0, s.length - j));
  const noLead = (s: string) => s.replace(/^0+/, "") || "0";
  const kind2 = kkSuffix(2, "dat");
  const raz = k === 1 ? "раз" : "раза";
  const times = mul ? { ru: "умножение", kk: "көбейту" } : { ru: "деление", kk: "бөлу" };
  const explanation: L = mul
    ? {
        ru: `${m} = ${n} · ${2 ** k}, то есть ${n} умножено на 2 ровно ${k} ${raz}. Каждое умножение на 2 дописывает справа один ноль: ${sub2(base)} → ${sub2(correct)}. Проверка: ${weightsSum(correct)} = ${m}.`,
        kk: `${m} = ${n} · ${2 ** k}, яғни ${n} саны ${kind2} дәл ${k} рет көбейтілген. ${kind2} әр көбейту оң жаққа бір нөл жазады: ${sub2(base)} → ${sub2(correct)}. Тексеру: ${weightsSum(correct)} = ${m}.`,
      }
    : {
        ru: `${n} = ${m} : ${2 ** k}, то есть ${m} разделено на 2 нацело ровно ${k} ${raz}. Каждое такое деление убирает последнюю цифру 0: ${sub2(givenBin)} → ${sub2(correct)}. Проверка: ${weightsSum(correct)} = ${n}.`,
        kk: `${n} = ${m} : ${2 ** k}, яғни ${m} саны ${kind2} дәл ${k} рет бөлінген. ${kind2} әр бөлу соңғы 0 цифрын алып тастайды: ${sub2(givenBin)} → ${sub2(correct)}. Тексеру: ${weightsSum(correct)} = ${n}.`,
      };
  const wrong: { value: string; why: L }[] = mul
    ? [
        {
          value: `${base}${"0".repeat(k - 1)}`,
          why:
            k === 1
              ? { ru: `Это исходное число ${n}: умножения не произошло.`, kk: `Бұл бастапқы ${n} саны: көбейту орындалмаған.` }
              : { ru: `Нулей на один меньше: это число ${n * 2 ** (k - 1)}.`, kk: `Нөл бірге аз: бұл ${n * 2 ** (k - 1)} саны.` },
        },
        { value: `${base}${"0".repeat(k + 1)}`, why: { ru: `Нулей на один больше: это число ${n * 2 ** (k + 1)}.`, kk: `Нөл бірге артық: бұл ${n * 2 ** (k + 1)} саны.` } },
        {
          value: `${base}${"1".repeat(k)}`,
          why: { ru: `Справа дописаны единицы, а при умножении на ${2 ** k} дописывают нули.`, kk: `Оң жаққа бірліктер жазылған, ал ${2 ** k} санына көбейткенде нөлдер жазылады.` },
        },
        {
          value: `${"0".repeat(k)}${base}`,
          why: { ru: `Нули слева ничего не меняют: это снова число ${n}.`, kk: `Сол жақтағы нөлдер ештеңені өзгертпейді: бұл қайтадан ${n} саны.` },
        },
      ]
    : [
        {
          value: dropRight(givenBin, k - 1),
          why:
            k === 1
              ? { ru: `Ничего не отброшено: это снова число ${m}.`, kk: `Ештеңе алынып тасталмаған: бұл қайтадан ${m} саны.` }
              : { ru: `Отброшено на одну цифру меньше нужного: это число ${m / 2 ** (k - 1)}.`, kk: `Керектіден бір цифр аз алынып тасталған: бұл ${m / 2 ** (k - 1)} саны.` },
        },
        { value: dropRight(givenBin, k + 1), why: { ru: `Отброшено слишком много цифр: получилось число ${n >> 1}.`, kk: `Тым көп цифр алынып тасталған: ${n >> 1} саны шыққан.` } },
        {
          value: noLead(givenBin.slice(k)),
          why: {
            ru: `Цифры убраны слева, а при делении на ${2 ** k} убирают ${k === 1 ? "последнюю цифру" : `последние ${k} цифры`} справа.`,
            kk: `Цифрлар сол жақтан алынған, ал ${2 ** k} санына бөлгенде оң жақтағы соңғы ${k} цифр алынады.`,
          },
        },
        {
          value: `${dropRight(givenBin, k)}0`,
          why: { ru: "После деления справа остался лишний ноль.", kk: "Бөлгеннен кейін оң жақта артық нөл қалған." },
        },
        { value: dropRight(givenBin, k + 2), why: { ru: `Отброшено слишком много цифр: получилось число ${n >> 2}.`, kk: `Тым көп цифр алынып тасталған: ${n >> 2} саны шыққан.` } },
      ];
  const o = options(rand, correct, wrong);
  return {
    id: `g:ns.dec2bin:shift:${mul ? "mul" : "div"}${n}:${seed}`,
    type: "choice",
    skill: "ns.dec2bin",
    prompt: {
      ru: `Известно, что ${given} = ${sub2(givenBin)}. Не переводя заново, запиши в двоичной системе число ${askN}`,
      kk: `${given} = ${sub2(givenBin)} екені белгілі. Қайта аудармай-ақ ${askN} санын екілік жүйеде жаз`,
    },
    ...o,
    explanation,
    hint: {
      ru: `Умножение на 2 дописывает справа один ноль, а деление нацело на 2 убирает последнюю цифру. Сколько раз нужно выполнить ${times.ru} на 2?`,
      kk: `${kind2} көбейту оң жаққа бір нөл жазады, ал бүтін бөлу соңғы цифрды алып тастайды. ${kind2} ${times.kk} неше рет орындау керек?`,
    },
  };
}

/** Уровень C: «запиши 2⁷ − 1 в двоичной системе» — все разряды заполнены единицами. */
function dec2binAllOnes(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 5, 9);
  const target = "1".repeat(k);
  const v = 2 ** k - 1;
  const prompt: L = { ru: `Запиши в двоичной системе число 2${sup(k)} − 1`, kk: `2${sup(k)} − 1 санын екілік жүйеде жаз` };
  const explanation: L = {
    ru: `2${sup(k)} = ${sub2(`1${"0".repeat(k)}`)} (${2 ** k}). Вычитаем 1: ${2 ** k} − 1 = ${v} — все ${k} разрядов заполняются единицами: ${sub2(target)}. Проверка: ${weightsSum(target)} = ${v}.`,
    kk: `2${sup(k)} = ${sub2(`1${"0".repeat(k)}`)} (${2 ** k}). 1 алып тастаймыз: ${2 ** k} − 1 = ${v} — барлық ${k} разряд бірліктермен толады: ${sub2(target)}. Тексеру: ${weightsSum(target)} = ${v}.`,
  };
  const hint: L = {
    ru: "Сначала запиши 2ᵏ в двоичной системе: единица и несколько нулей. Затем вычти 1 — как в десятичной системе 1000 − 1 = 999.",
    kk: "Алдымен 2ᵏ санын екілік жүйеде жаз: бірлік және бірнеше нөл. Содан кейін 1 алып таста — ондық жүйедегі 1000 − 1 = 999 сияқты.",
  };
  const id = `g:ns.dec2bin:allones:k${k}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.dec2bin", prompt, answers: [target], mode: "binary", suffix: "₂", explanation, hint };
  const o = options(rand, target, [
    {
      value: `1${"0".repeat(k)}`,
      why: { ru: `Это само число 2${sup(k)}: единица и ${k} нулей. Нужно число на 1 меньше.`, kk: `Бұл 2${sup(k)} санының өзі: бірлік және ${k} нөл. 1-ге кем сан керек.` },
    },
    { value: "1".repeat(k + 1), why: { ru: `Единиц на одну больше: это 2${sup(k + 1)} − 1.`, kk: `Бірлік бірге артық: бұл 2${sup(k + 1)} − 1.` } },
    { value: "1".repeat(k - 1), why: { ru: `Единиц на одну меньше: это 2${sup(k - 1)} − 1.`, kk: `Бірлік бірге аз: бұл 2${sup(k - 1)} − 1.` } },
    {
      value: `1${"0".repeat(k - 1)}`,
      why: { ru: `Это число 2${sup(k - 1)}: единица и ${k - 1} нулей.`, kk: `Бұл 2${sup(k - 1)} саны: бірлік және ${k - 1} нөл.` },
    },
  ]);
  return { id, type: "choice", skill: "ns.dec2bin", prompt, ...o, explanation, hint };
}

function genDec2Bin(rand: Rand, level: Level, seed: number): QuestionStep {
  if (level === 1) {
    const edge = edgeCase(seed);
    if (edge !== null) return dec2binEdge(rand, edge, seed);
  }
  if (level === 3) {
    // C — не только «число больше»: сложить и перевести, сдвиг на 2ᵏ, число из одних единиц.
    const kind = pick(rand, ["old", "sumbin", "shift", "allones", "old"] as const);
    if (kind === "sumbin") return dec2binSum(rand, seed);
    if (kind === "shift") return dec2binShift(rand, seed);
    if (kind === "allones") return dec2binAllOnes(rand, seed);
  }
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, level === 3 ? hi : Math.min(hi, 127));
  const bin = toBinary(n);
  // A — выбор, лесенка и «включи биты», B — лесенка, ввод и «включи биты», C — ввод и лесенка.
  const kind = pick(
    rand,
    level === 1 ? (["choice", "ladder", "bits"] as const) : level === 2 ? (["ladder", "input", "bits"] as const) : (["input", "input", "ladder"] as const),
  );
  const id = `g:ns.dec2bin:${kind}:${n}:${seed}`;
  const explanation: L = {
    ru: `Делим ${n} на 2 и читаем остатки снизу вверх: ${sub2(bin)}. Проверка: ${weightsSum(bin)} = ${n}.`,
    kk: `${kkSuffix(n, "acc")} ${kkSuffix(2, "dat")} бөліп, қалдықтарды төменнен жоғары оқимыз: ${sub2(bin)}. Тексеру: ${weightsSum(bin)} = ${n}.`,
  };
  if (kind === "bits") {
    // Направление 10 → 2: по заданному числу собрать его двоичную запись (раньше вид жил в ns.bin2dec).
    return {
      id,
      type: "bits",
      skill: "ns.dec2bin",
      prompt: { ru: `Включи биты так, чтобы получилось число ${n}`, kk: `${n} саны шығатындай биттерді қос` },
      target: n,
      bits: Math.max(4, bin.length),
      explanation: {
        ru: `Раскладываем ${n} на веса разрядов: ${weightsSum(bin)} = ${n}. Включены биты с этими весами: ${sub2(bin)}.`,
        kk: `${n} санын разряд салмақтарына жіктейміз: ${weightsSum(bin)} = ${n}. Осы салмақтарға сәйкес биттер қосылады: ${sub2(bin)}.`,
      },
      hint: HINT_BITS,
    };
  }
  if (kind === "ladder") {
    return {
      id,
      type: "ladder",
      skill: "ns.dec2bin",
      prompt: { ru: `Переведи ${n} в двоичную систему делением на 2`, kk: `${n} санын ${kkSuffix(2, "dat")} бөлу арқылы екілік жүйеге аудар` },
      number: n,
      explanation,
      hint: HINT_LADDER,
    };
  }
  if (kind === "choice") {
    const reversed = bin.split("").reverse().join("").replace(/^0+/, "") || "0";
    const lower = Math.max(1, n - 1);
    const o = options(rand, sub2(bin), [
      {
        value: sub2(reversed),
        why: {
          ru: `Это ${sub2(reversed)}: остатки прочитаны сверху вниз. Читать нужно снизу вверх.`,
          kk: `Бұл ${sub2(reversed)}: қалдықтар жоғарыдан төмен оқылған. Төменнен жоғары оқу керек.`,
        },
      },
      {
        value: sub2(toBinary(n + 1)),
        why: { ru: `Это двоичная запись числа ${n + 1}, а не ${n}.`, kk: `Бұл ${n} емес, ${n + 1} санының екілік жазбасы.` },
      },
      {
        value: sub2(toBinary(lower)),
        why: { ru: `Это двоичная запись числа ${lower}, а не ${n}.`, kk: `Бұл ${n} емес, ${lower} санының екілік жазбасы.` },
      },
      {
        value: sub2(toBinary(n * 2)),
        why: {
          ru: `Это запись числа ${n * 2}: лишний ноль справа удваивает число.`,
          kk: `Бұл ${n * 2} санының жазбасы: оң жақтағы артық нөл санды екі есе өсіреді.`,
        },
      },
    ]);
    return {
      id,
      type: "choice",
      skill: "ns.dec2bin",
      prompt: { ru: `Как записать ${n} в двоичной системе?`, kk: `${n} саны екілік жүйеде қалай жазылады?` },
      ...o,
      explanation,
      hint: HINT_DIV,
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
    hint: HINT_DIV,
  };
}

// ---------- Основание и цифры ----------
// ns.base открыт после первого урока (двоичная система), поэтому здесь только основания 2 и 10 и общий смысл основания
// (цифр столько, сколько основание; наибольшая цифра на 1 меньше). Цифры 8- и 16-ричной систем, буквы A–F и «не восьмеричная
// запись» живут в ns.octhex (lib/bank/ns-octhex-digits.ts) — после урока о 2 ↔ 8 ↔ 16 (аудит C6).

/** Основания для вопросов «сколько цифр»: 2 и 10 и пара «неизвестных» — смысл основания один и тот же. */
export const BASE_DIGIT_BASES = [2, 10, 3, 5] as const;

export const HINT_BASE_COUNT: L = {
  ru: "Цифры в системе начинаются с 0 и идут по порядку. Самая большая цифра на 1 меньше основания — посчитай, сколько всего цифр.",
  kk: `Жүйедегі цифрлар ${kkSuffix(0, "abl")} басталып, ретімен жүреді. Ең үлкен цифр негізден ${kkSuffix(1, "dat")} кем — барлығы неше цифр екенін санап көр.`,
};
export const HINT_BASE_INVALID = (sys: L): L => ({
  ru: `Посмотри, из каких цифр состоит каждая запись, и вспомни, какие цифры есть в ${sys.ru} системе.`,
  kk: `Әр жазба қандай цифрлардан тұратынын қарап, ${sys.kk} жүйеде қандай цифрлар бар екенін еске түсір.`,
});

/** Неверная запись в системе base (2 или 3): одна цифра заменена на лишнюю (позиция не первая). */
function invalidRecord(rand: Rand, base: 2 | 3, level: Level): { bad: string; valid: string[]; badDigit: string } {
  // A/B — короткие записи, C — длиннее: цифру-ловушку нужно искать глазами по всей записи.
  const [lo, hi] = level === 3 ? [100, 1000] : [9, 60];
  const toBase = (n: number) => n.toString(base);
  const validSet = new Set<string>();
  while (validSet.size < 3) validSet.add(toBase(int(rand, level === 3 ? 60 : 5, hi)));
  const raw = toBase(int(rand, lo, hi));
  const pos = int(rand, 1, raw.length - 1);
  const badDigit = base === 2 ? "2" : pick(rand, ["3", "4"]);
  return { bad: `${raw.slice(0, pos)}${badDigit}${raw.slice(pos + 1)}`, valid: [...validSet], badDigit };
}

/** Уровень A: «какие цифры в двоичной системе» — цифры начинаются с нуля (аудит C8). */
function baseDigitSet(rand: Rand, seed: number): QuestionStep {
  const items: Opt[] = [
    { text: { ru: "0 и 1", kk: "0 және 1" }, why: null },
    {
      text: { ru: "1 и 2", kk: "1 және 2" },
      why: {
        ru: "Цифры всегда начинаются с нуля: в двоичной системе это 0 и 1. Число 2 — это основание, а не цифра.",
        kk: "Цифрлар әрқашан нөлден басталады: екілік жүйеде бұл — 0 және 1. 2 саны — негіз, цифр емес.",
      },
    },
    {
      text: { ru: "0, 1 и 2", kk: "0, 1 және 2" },
      why: { ru: "Цифр столько, сколько основание, то есть две. Цифры 2 в двоичной системе нет.", kk: "Цифрлар саны негізге тең, яғни екеу. Екілік жүйеде 2 цифры жоқ." },
    },
    {
      text: { ru: "0 и 2", kk: "0 және 2" },
      why: {
        ru: "Цифры идут подряд: после 0 следует 1, а не 2. Цифры 2 в двоичной системе нет.",
        kk: `Цифрлар қатарынан жүреді: ${kkSuffix(0, "abl")} кейін 1 келеді, 2 емес. Екілік жүйеде 2 цифры жоқ.`,
      },
    },
  ];
  const order = shuffle(
    items.map((_, i) => i),
    rand,
  );
  return {
    id: `g:ns.base:digitset:2:${seed}`,
    type: "choice",
    skill: "ns.base",
    prompt: { ru: "Какие цифры используются в двоичной системе счисления?", kk: "Екілік санау жүйесінде қандай цифрлар қолданылады?" },
    ...fixed(
      order.map((i) => items[i]),
      order.indexOf(0),
    ),
    explanation: {
      ru: "Основание двоичной системы — 2, значит цифр две: 0 и 1. Цифры начинаются с нуля, а наибольшая из них на 1 меньше основания.",
      kk: `Екілік жүйенің негізі — 2, демек екі цифр бар: 0 және 1. Цифрлар нөлден басталады, ал олардың ең үлкені негізден ${kkSuffix(1, "dat")} кем.`,
    },
    hint: HINT_BASE_COUNT,
  };
}

/** Уровень C: «какое наименьшее основание у системы, в которой записано 2301» — обратная задача по самой большой цифре. */
function baseMinBase(rand: Rand, seed: number): QuestionStep {
  const d = pick(rand, [2, 3, 4, 5, 6, 9] as const);
  const len = int(rand, 4, 5);
  let digits = String(int(rand, 1, d));
  for (let i = 1; i < len; i++) digits += String(int(rand, 0, d));
  // гарантируем, что самая большая цифра встречается (место — любое, кроме первого)
  if (!digits.includes(String(d))) {
    const pos = int(rand, 1, len - 1);
    digits = `${digits.slice(0, pos)}${d}${digits.slice(pos + 1)}`;
  }
  const maxD = Math.max(...digits.split("").map(Number));
  const answer = maxD + 1;
  const distinct = new Set(digits.split("")).size;
  const prompt: L = {
    ru: `Какое наименьшее основание может иметь система счисления, в которой записано число ${digits}?`,
    kk: `${digits} саны жазылған санау жүйесінің негізі ең кемі қандай болуы мүмкін?`,
  };
  const explanation: L = {
    ru: `Наибольшая цифра записи ${digits} — ${maxD}. Цифры системы идут от 0 до (основание − 1), значит основание должно быть больше ${maxD}. Наименьшее такое — ${answer}.`,
    kk: `${digits} жазбасындағы ең үлкен цифр — ${maxD}. Жүйенің цифрлары ${kkSuffix(0, "abl")} (негіз − 1) санына дейін болады, демек негіз ${maxD} санынан үлкен болуы керек. Ондай ең кішісі — ${answer}.`,
  };
  const hint: L = {
    ru: "Найди в записи самую большую цифру. Основание должно быть больше любой цифры записи — какое наименьшее значение подойдёт?",
    kk: "Жазбадағы ең үлкен цифрды тап. Негіз жазбадағы кез келген цифрдан үлкен болуы керек — ең кіші қандай мән жарайды?",
  };
  const id = `g:ns.base:minbase:${digits}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.base", prompt, answers: [String(answer)], mode: "number", explanation, hint };
  const o = options(
    rand,
    String(answer),
    shuffle(
      [
        {
          value: String(maxD),
          why: {
            ru: `${maxD} — самая большая цифра записи, а основание на 1 больше: цифры идут от 0 до основания − 1.`,
            kk: `${maxD} — жазбадағы ең үлкен цифр, ал негіз ${kkSuffix(1, "dat")} артық: цифрлар ${kkSuffix(0, "abl")} негіз − 1 санына дейін жүреді.`,
          },
        },
        {
          value: String(maxD + 2),
          why: {
            ru: `В системе с основанием ${maxD + 2} такая запись возможна, но есть система с меньшим основанием — ${answer}.`,
            kk: `Негізі ${maxD + 2} жүйеде мұндай жазба мүмкін, бірақ негізі кішірек жүйе бар — ${answer}.`,
          },
        },
        {
          value: String(digits.length),
          why: { ru: "Это количество цифр в записи, а не основание.", kk: "Бұл жазбадағы цифрлар саны, негіз емес." },
        },
        {
          value: String(distinct),
          why: {
            ru: "Это количество разных цифр в записи, а основание определяется самой большой цифрой.",
            kk: "Бұл жазбадағы әртүрлі цифрлар саны, ал негізді ең үлкен цифр анықтайды.",
          },
        },
        {
          value: "10",
          why: { ru: `Запись возможна и в десятичной системе, но основание ${answer} меньше.`, kk: `Жазба ондық жүйеде де мүмкін, бірақ ${answer} негізі кішірек.` },
        },
      ],
      rand,
    ),
  );
  return { id, type: "choice", skill: "ns.base", prompt, ...o, explanation, hint };
}

/** Уровень C: «наибольшее двузначное число в системе с основанием 5» — наибольшая цифра в каждом разряде. */
function baseMaxRecord(rand: Rand, seed: number): QuestionStep {
  const b = pick(rand, [2, 3, 4, 5, 6, 7, 9] as const);
  const m = pick(rand, [2, 3] as const);
  const top = String(b - 1);
  const answer = top.repeat(m);
  const word = m === 2 ? { ru: "двузначное", kk: "екі таңбалы", ru3: "трёхзначное" } : { ru: "трёхзначное", kk: "үш таңбалы", ru3: "четырёхзначное" };
  const prompt: L = {
    ru: `Какое наибольшее ${word.ru} число можно записать в системе счисления с основанием ${b}?`,
    kk: `Негізі ${b} санау жүйесінде жазуға болатын ең үлкен ${word.kk} санды көрсет.`,
  };
  const explanation: L = {
    ru: `Наибольшая цифра в системе с основанием ${b} — ${b - 1}. Ставим её во все ${m === 2 ? "два" : "три"} разряда: ${answer}.`,
    kk: `Негізі ${b} жүйедегі ең үлкен цифр — ${b - 1}. Оны барлық ${m === 2 ? "екі" : "үш"} разрядқа қоямыз: ${answer}.`,
  };
  const hint: L = {
    ru: "Какая цифра в этой системе самая большая? Чем больше цифра в каждом разряде, тем больше число.",
    kk: "Бұл жүйедегі ең үлкен цифр қандай? Әр разрядтағы цифр неғұрлым үлкен болса, сан соғұрлым үлкен.",
  };
  const id = `g:ns.base:maxrec:${b}-${m}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.base", prompt, answers: [answer], mode: "number", explanation, hint };
  const o = options(rand, answer, [
    {
      value: String(b).repeat(m),
      why: {
        ru: `В записи цифра ${b}, а такой цифры в системе с основанием ${b} нет: цифры только от 0 до ${b - 1}.`,
        kk: `Жазбада ${b} цифры бар, ал негізі ${b} жүйеде ондай цифр жоқ: цифрлар тек ${kkSuffix(0, "abl")} ${kkSuffix(b - 1, "dat")} дейін.`,
      },
    },
    {
      value: `1${"0".repeat(m)}`,
      why: {
        ru: `Это уже ${word.ru3} число (десятичное значение ${b ** m}), а нужно ${word.ru}.`,
        kk: `Бұл ${m === 2 ? "үш" : "төрт"} таңбалы сан (ондық мәні ${b ** m}), ал ${word.kk} сан керек.`,
      },
    },
    {
      value: top.repeat(m + 1),
      why: { ru: `Это ${word.ru3} число, а нужно ${word.ru}.`, kk: `Бұл ${m === 2 ? "үш" : "төрт"} таңбалы сан, ал ${word.kk} сан керек.` },
    },
    {
      value: `${top}${"0".repeat(m - 1)}`,
      why: {
        ru: `Нули в младших разрядах можно заменить наибольшей цифрой ${b - 1}, и число станет больше.`,
        kk: `Төменгі разрядтардағы нөлдерді ең үлкен ${b - 1} цифрына ауыстыруға болады, сонда сан үлкейеді.`,
      },
    },
  ]);
  return { id, type: "choice", skill: "ns.base", prompt, ...o, explanation, hint };
}

function genBase(rand: Rand, level: Level, seed: number): QuestionStep {
  if (level === 1 && edgeCase(seed) !== null) return baseDigitSet(rand, seed);
  if (level === 3) {
    // C — не только ловушки с записью: наименьшее основание по цифрам, наибольшее число из m цифр.
    const kind = pick(rand, ["invalid", "minbase", "maxrec"] as const);
    if (kind === "minbase") return baseMinBase(rand, seed);
    if (kind === "maxrec") return baseMaxRecord(rand, seed);
  }
  // A/B — «сколько цифр» и «какая запись не двоичная», C — ещё и ловушки с записью (двоичной и троичной).
  const kind = level === 3 ? "invalid" : pick(rand, ["digits", "invalid"] as const);
  if (kind === "digits") {
    const base = pick(rand, BASE_DIGIT_BASES);
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
        kk: `Цифрлар саны негізге тең: ${kkSuffix(0, "abl")} ${kkSuffix(base - 1, "dat")} дейін, яғни ${base} цифр.`,
      },
      hint: HINT_BASE_COUNT,
    };
  }
  // C: в половине заданий — троичная система (ловушка: цифра 3), иначе — двоичная (ловушка: цифра 2).
  if (level === 3 && rand() < 0.5) {
    const { bad, valid } = invalidRecord(rand, 3, level);
    const o = options(
      rand,
      bad,
      valid.map((v) => ({
        value: v,
        why: {
          ru: `В записи ${v} только цифры 0, 1 и 2 — она может быть троичной.`,
          kk: `${v} жазбасында тек 0, 1 және 2 цифрлары бар — ол үштік сан бола алады.`,
        },
      })),
    );
    return {
      id: `g:ns.base:invalid3:${bad}:${seed}`,
      type: "choice",
      skill: "ns.base",
      prompt: {
        ru: "Какая запись НЕ может быть числом в троичной системе?",
        kk: "Қай жазба үштік жүйедегі сан бола АЛМАЙДЫ?",
      },
      ...o,
      explanation: {
        ru: "В троичной системе три цифры: 0, 1 и 2. Цифра 3 или больше в записи невозможна.",
        kk: "Үштік жүйеде үш цифр бар: 0, 1 және 2. Жазбада 3 немесе одан үлкен цифр болуы мүмкін емес.",
      },
      hint: HINT_BASE_INVALID({ ru: "троичной", kk: "үштік" }),
    };
  }
  const { bad, valid } = invalidRecord(rand, 2, level);
  const o = options(
    rand,
    bad,
    valid.map((v) => ({
      value: v,
      why: { ru: `В записи ${v} только 0 и 1 — она может быть двоичной.`, kk: `${v} жазбасында тек 0 мен 1 бар — ол екілік сан бола алады.` },
    })),
  );
  return {
    id: `g:ns.base:invalid:${bad}:${seed}`,
    type: "choice",
    skill: "ns.base",
    prompt: {
      ru: "Какая запись НЕ может быть числом в двоичной системе?",
      kk: "Қай жазба екілік жүйедегі сан бола АЛМАЙДЫ?",
    },
    ...o,
    explanation: {
      ru: `В двоичной системе только цифры 0 и 1. В записи ${bad} есть цифра 2.`,
      kk: `Екілік жүйеде тек 0 мен 1 цифрлары бар. ${bad} жазбасында 2 цифры бар.`,
    },
    hint: HINT_BASE_INVALID({ ru: "двоичной", kk: "екілік" }),
  };
}

// ---------- Свойства ----------

export const HINT_PARITY: L = {
  ru: "Смотри только на последнюю цифру двоичной записи. Что она говорит о делении числа на 2?",
  kk: `Тек екілік жазбаның соңғы цифрына қара. Ол санның ${kkSuffix(2, "dat")} бөлінуі туралы не айтады?`,
};
export const HINT_LENGTH: L = {
  ru: "Найди наибольшую степень двойки, которая не больше числа (1, 2, 4, 8, 16…). Сколько цифр в её двоичной записи: единица и сколько нулей?",
  kk: "Саннан аспайтын екінің ең үлкен дәрежесін тап (1, 2, 4, 8, 16…). Оның екілік жазбасында неше цифр бар: бірлік және неше нөл?",
};
export const HINT_ONES: L = {
  ru: "Запиши число в двоичной системе (разложи на веса 1, 2, 4, 8…), а затем посчитай, сколько в записи единиц.",
  kk: "Санды екілік жүйеде жаз (1, 2, 4, 8… салмақтарына жікте), содан кейін жазбада неше бірлік барын сана.",
};
export const HINT_POW: L = {
  ru: "В двоичной системе умножение на 2 дописывает справа один ноль. Сколько раз нужно умножить 1 на 2, чтобы получить это число?",
  kk: `Екілік жүйеде ${kkSuffix(2, "dat")} көбейту оң жаққа бір нөл жазады. Осы санды алу үшін ${kkSuffix(1, "acc")} неше рет ${kkSuffix(2, "dat")} көбейту керек?`,
};

/** «Чётное или нечётное?» по последней цифре двоичной записи; работает и для 0 и 1. */
function parityStep(n: number, seed: number): QuestionStep {
  const bin = toBinary(n);
  const even = n % 2 === 0;
  const last = bin.at(-1);
  const opts: L[] = [
    { ru: "Чётное", kk: "Жұп" },
    { ru: "Нечётное", kk: "Тақ" },
  ];
  // Объяснение — для неверного варианта.
  const wrong: L = even
    ? { ru: `У нечётного числа последняя цифра 1, а здесь ${last}.`, kk: `Тақ санның соңғы цифры 1 болады, ал мұнда ${last}.` }
    : { ru: `У чётного числа последняя цифра 0, а здесь ${last}.`, kk: `Жұп санның соңғы цифры 0 болады, ал мұнда ${last}.` };
  return {
    id: `g:ns.props:parity:${n}:${seed}`,
    type: "choice",
    skill: "ns.props",
    prompt: { ru: `Число ${sub2(bin)} — чётное или нечётное?`, kk: `${sub2(bin)} саны — жұп па, тақ па?` },
    options: opts,
    correct: even ? 0 : 1,
    whyWrong: even ? [null, wrong] : [wrong, null],
    explanation: {
      ru: `Смотрим на последнюю цифру: ${last}. Если 0 — число чётное, если 1 — нечётное.`,
      kk: `Соңғы цифрға қараймыз: ${last}. 0 болса — жұп, 1 болса — тақ.`,
    },
    hint: HINT_PARITY,
  };
}

/** Уровень A: ноль и единица — чётность, число цифр, число единиц/нулей (аудит C8). */
function propsEdge(rand: Rand, n: 0 | 1, seed: number): QuestionStep {
  const kind = pick(rand, ["parity", "len", "count"] as const);
  const name: L = n === 0 ? { ru: "нуля", kk: "Нөл" } : { ru: "единицы", kk: "Бірлік" };
  if (kind === "len") {
    const o = options(rand, "1", [
      {
        value: "0",
        why: { ru: "Запись не бывает пустой: хотя бы одна цифра есть всегда.", kk: "Жазба бос болмайды: кемінде бір цифр әрқашан бар." },
      },
      {
        value: "8",
        why: {
          ru: "8 бит — это размер байта, где слева дописаны нули. В обычной записи числа лишних нулей нет.",
          kk: "8 бит — байттың өлшемі, онда сол жаққа нөлдер жазылған. Санның қарапайым жазбасында артық нөл болмайды.",
        },
      },
      { value: "2", why: { ru: `Для ${name.ru} хватает одной цифры: вторая не нужна.`, kk: `${name.kk} үшін бір цифр жеткілікті: екіншісі қажет емес.` } },
    ]);
    return {
      id: `g:ns.props:len01:${n}:${seed}`,
      type: "choice",
      skill: "ns.props",
      prompt: { ru: `Сколько цифр в двоичной записи числа ${n}?`, kk: `${n} санының екілік жазбасында неше цифр бар?` },
      ...o,
      explanation:
        n === 0
          ? {
              ru: "Ноль записывают одной цифрой: 0₂. Правило «наибольшая степень двойки, не больше числа» работает для чисел от 1, а пустой записи не бывает.",
              kk: "Нөл бір цифрмен жазылады: 0₂. «Саннан аспайтын екінің ең үлкен дәрежесі» ережесі 1-ден бастап сандар үшін жұмыс істейді, ал бос жазба болмайды.",
            }
          : {
              ru: "1 = 2⁰, а 2⁰ ≤ 1 < 2¹, поэтому цифр одна: 1₂.",
              kk: "1 = 2⁰, ал 2⁰ ≤ 1 < 2¹, сондықтан цифр біреу: 1₂.",
            },
      hint: HINT_LENGTH,
    };
  }
  if (kind === "count") {
    // 0 → единиц нет; 1 → нулей нет: ответ — ноль
    const unit = n === 0 ? { ru: "единиц", kk: "бірлік" } : { ru: "нулей", kk: "нөл" };
    return {
      id: `g:ns.props:cnt01:${n}:${seed}`,
      type: "input",
      skill: "ns.props",
      prompt: {
        ru: `Сколько ${unit.ru} в двоичной записи числа ${n}?`,
        kk: `${n} санының екілік жазбасында неше ${unit.kk} бар?`,
      },
      answers: ["0"],
      mode: "number",
      explanation:
        n === 0
          ? { ru: "Запись числа 0 — это одна цифра 0₂. Единиц в ней нет, значит ответ — 0.", kk: "0 санының жазбасы — бір ғана 0₂ цифры. Онда бірлік жоқ, демек жауап — 0." }
          : { ru: "Запись числа 1 — это одна цифра 1₂. Нулей в ней нет, значит ответ — 0.", kk: "1 санының жазбасы — бір ғана 1₂ цифры. Онда нөл жоқ, демек жауап — 0." },
      hint: {
        ru: "Запиши число в двоичной системе и посмотри, из каких цифр состоит запись. Считай только те цифры, о которых спрашивают.",
        kk: "Санды екілік жүйеде жазып, жазба қандай цифрлардан тұратынын қара. Тек сұралған цифрларды ғана сана.",
      },
    };
  }
  return parityStep(n, seed);
}

/** Уровень C: «наибольшее число из k двоичных цифр» (ответ — десятичное значение 2ᵏ − 1). */
function propsMaxK(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 5, 10);
  const v = 2 ** k - 1;
  const prompt: L = {
    ru: `Чему равно (в десятичной системе) наибольшее число, двоичная запись которого состоит из ${k} цифр?`,
    kk: `Екілік жазбасы ${k} цифрдан тұратын ең үлкен санның ондық мәні неге тең?`,
  };
  const explanation: L = {
    ru: `Наибольшее число получается, когда во всех ${k} разрядах стоят единицы: ${sub2("1".repeat(k))} = 2${sup(k)} − 1 = ${v}. Число 2${sup(k)} = ${2 ** k} уже записывается ${k + 1} цифрами.`,
    kk: `Ең үлкен сан барлық ${k} разрядта бірлік тұрғанда шығады: ${sub2("1".repeat(k))} = 2${sup(k)} − 1 = ${v}. 2${sup(k)} = ${2 ** k} саны ${k + 1} цифрмен жазылады.`,
  };
  const hint: L = {
    ru: "Запиши самую большую двоичную запись из k цифр: какая цифра должна стоять в каждом разряде? Затем найди её значение по весам.",
    kk: "k цифрдан тұратын ең үлкен екілік жазбаны жаз: әр разрядта қандай цифр тұруы керек? Содан кейін оның мәнін салмақтар бойынша тап.",
  };
  const id = `g:ns.props:maxk:${k}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.props", prompt, answers: [String(v)], mode: "number", explanation, hint };
  const o = options(rand, String(v), [
    {
      value: String(2 ** k),
      why: { ru: `2${sup(k)} — единица и ${k} нулей, это уже ${k + 1} цифр: число не помещается.`, kk: `2${sup(k)} — бірлік және ${k} нөл, бұл ${k + 1} цифр: сан сыймайды.` },
    },
    {
      value: String(2 ** (k - 1)),
      why: {
        ru: `2${sup(k - 1)} — наименьшее число из ${k} цифр (единица и ${k - 1} нулей), а нужно наибольшее.`,
        kk: `2${sup(k - 1)} — ${k} цифрдан тұратын ең кіші сан (бірлік және ${k - 1} нөл), ал ең үлкені керек.`,
      },
    },
    {
      value: String(2 ** k - 2),
      why: {
        ru: "Это запись из единиц и нуля на конце: последний 0 можно заменить на 1 — число станет больше.",
        kk: "Бұл соңында нөлі бар бірліктер жазбасы: соңғы 0-ді 1-ге ауыстыруға болады — сан үлкейеді.",
      },
    },
    {
      value: String(2 ** (k + 1) - 1),
      why: { ru: `Это наибольшее число из ${k + 1} цифр, а нужно из ${k}.`, kk: `Бұл ${k + 1} цифрдан тұратын ең үлкен сан, ал ${k} цифрдан тұратыны керек.` },
    },
  ]);
  return { id, type: "choice", skill: "ns.props", prompt, ...o, explanation, hint };
}

/** Уровень C: «наименьшее число из k двоичных цифр (без ведущих нулей)» — 2ᵏ⁻¹. */
function propsMinK(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 4, 9);
  const v = 2 ** (k - 1);
  const prompt: L = {
    ru: `Чему равно (в десятичной системе) наименьшее число, двоичная запись которого (без ведущих нулей) состоит из ${k} цифр?`,
    kk: `Екілік жазбасы (алдыңғы нөлсіз) ${k} цифрдан тұратын ең кіші санның ондық мәні неге тең?`,
  };
  const explanation: L = {
    ru: `Первая цифра должна быть 1, остальные — как можно меньше, то есть нули: ${sub2(`1${"0".repeat(k - 1)}`)} = 2${sup(k - 1)} = ${v}. Предыдущее число ${v - 1} записывается уже ${k - 1} цифрами.`,
    kk: `Бірінші цифр 1 болуы керек, қалғандары мүмкіндігінше кіші, яғни нөлдер: ${sub2(`1${"0".repeat(k - 1)}`)} = 2${sup(k - 1)} = ${v}. Алдыңғы ${v - 1} саны ${k - 1} цифрмен жазылады.`,
  };
  const hint: L = {
    ru: "Запиши самую маленькую двоичную запись из k цифр без ведущих нулей: первая цифра должна быть 1, а остальные — как можно меньше. Чему равно её значение по весам?",
    kk: "Алдыңғы нөлсіз k цифрдан тұратын ең кіші екілік жазбаны жаз: бірінші цифр 1 болуы керек, қалғандары мүмкіндігінше кіші. Оның мәні салмақтар бойынша неге тең?",
  };
  const id = `g:ns.props:mink:${k}:${seed}`;
  if (rand() < 0.5) return { id, type: "input", skill: "ns.props", prompt, answers: [String(v)], mode: "number", explanation, hint };
  const o = options(rand, String(v), [
    {
      value: String(2 ** k - 1),
      why: { ru: `${2 ** k - 1} — наибольшее число из ${k} цифр, а нужно наименьшее.`, kk: `${2 ** k - 1} — ${k} цифрдан тұратын ең үлкен сан, ал ең кішісі керек.` },
    },
    {
      value: String(2 ** k),
      why: { ru: `2${sup(k)} — единица и ${k} нулей: это уже ${k + 1} цифр.`, kk: `2${sup(k)} — бірлік және ${k} нөл: бұл ${k + 1} цифр.` },
    },
    {
      value: String(2 ** (k - 2)),
      why: { ru: `Это ${sub2(`1${"0".repeat(k - 2)}`)}: цифр на одну меньше, чем нужно.`, kk: `Бұл ${sub2(`1${"0".repeat(k - 2)}`)}: цифр керектіден біреу аз.` },
    },
    {
      value: String(k),
      why: { ru: "Это количество цифр, а не значение числа.", kk: "Бұл цифрлар саны, санның мәні емес." },
    },
  ]);
  return { id, type: "choice", skill: "ns.props", prompt, ...o, explanation, hint };
}

/** Уровень C: число цифр у чисел на границе степени двойки (2ᵏ − 1 и 2ᵏ). */
function propsLenEdge(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 6, 12);
  const atPow = rand() < 0.5;
  const N = atPow ? 2 ** k : 2 ** k - 1;
  const bin = toBinary(N);
  const len = bin.length;
  const decLen = String(N).length;
  const o = options(rand, String(len), [
    atPow
      ? {
          value: String(k),
          why: {
            ru: `2${sup(k)} — это единица и ${k} нулей, то есть ${k + 1} цифр: старшую единицу тоже нужно посчитать.`,
            kk: `2${sup(k)} — бірлік және ${k} нөл, яғни ${k + 1} цифр: ең жоғарғы бірлікті де санау керек.`,
          },
        }
      : {
          value: String(k + 1),
          why: {
            ru: `Число ${N} на 1 меньше 2${sup(k)} = ${2 ** k}: оно ещё помещается в ${k} цифр (все они — единицы), а ${k + 1} цифр нужно только для ${2 ** k}.`,
            kk: `${N} саны 2${sup(k)} = ${2 ** k} санынан ${kkSuffix(1, "dat")} кем: ол әлі ${k} цифрге сыяды (бәрі бірлік), ал ${k + 1} цифр тек ${2 ** k} үшін керек.`,
          },
        },
    { value: String(decLen), why: { ru: "Это количество цифр в десятичной записи, а нужно в двоичной.", kk: "Бұл ондық жазбадағы цифрлар саны, ал екілік жазбадағысы керек." } },
    {
      value: String(len + 2),
      why: {
        ru: `Слишком много цифр: для ${len + 2} цифр число должно быть не меньше ${2 ** (len + 1)}.`,
        kk: `Цифр тым көп: ${len + 2} цифр үшін сан ${kkSuffix(2 ** (len + 1), "abl")} кем болмауы керек.`,
      },
    },
    {
      value: String(len - 1),
      why: {
        ru: `Слишком мало цифр: ${len - 1} цифрами записывают числа только до ${2 ** (len - 1) - 1}.`,
        kk: `Цифр тым аз: ${len - 1} цифрмен тек ${2 ** (len - 1) - 1} санына дейінгі сандар жазылады.`,
      },
    },
  ]);
  return {
    id: `g:ns.props:lenedge:${N}:${seed}`,
    type: "choice",
    skill: "ns.props",
    prompt: { ru: `Сколько цифр в двоичной записи числа ${N}?`, kk: `${N} санының екілік жазбасында неше цифр бар?` },
    ...o,
    explanation: atPow
      ? {
          ru: `${N} = 2${sup(k)}: единица и ${k} нулей, всего ${len} цифр. Проверка: ${sub2(bin)} = ${N}.`,
          kk: `${N} = 2${sup(k)}: бірлік және ${k} нөл, барлығы ${len} цифр. Тексеру: ${sub2(bin)} = ${N}.`,
        }
      : {
          ru: `${N} = 2${sup(k)} − 1: во всех ${k} разрядах стоят единицы, всего ${len} цифр. Проверка: ${sub2(bin)} = ${N}.`,
          kk: `${N} = 2${sup(k)} − 1: барлық ${k} разрядта бірлік тұр, барлығы ${len} цифр. Тексеру: ${sub2(bin)} = ${N}.`,
        },
    hint: HINT_LENGTH,
  };
}

/** Уровень C: «сколько чётных чисел среди …» — правило последней цифры применяется к набору чисел. */
function propsEvenCount(rand: Rand, seed: number): QuestionStep {
  let nums: number[] = [];
  for (let g = 0; g < 50; g++) {
    nums = Array.from({ length: 5 }, () => int(rand, 5, 200));
    const ev = nums.filter((v) => v % 2 === 0).length;
    // нужны и чётные, и нечётные, и все числа разные
    if (ev >= 1 && ev <= 4 && new Set(nums).size === 5) break;
  }
  const bins = nums.map(toBinary);
  const even = nums.filter((v) => v % 2 === 0).length;
  const odd = nums.length - even;
  const withZero = bins.filter((b) => b.includes("0")).length;
  const evenOnes = bins.filter((b) => ones1(b) % 2 === 0).length;
  const list = bins.map(sub2).join(", ");
  const evens = bins
    .filter((_, i) => nums[i] % 2 === 0)
    .map(sub2)
    .join(", ");
  const o = options(rand, String(even), [
    { value: String(odd), why: { ru: "Это количество нечётных чисел: у них последняя цифра 1.", kk: "Бұл тақ сандардың саны: олардың соңғы цифры 1." } },
    {
      value: String(evenOnes),
      why: {
        ru: "Это количество чисел с чётным числом единиц, а чётность числа определяет только последняя цифра.",
        kk: "Бұл бірліктер саны жұп сандардың саны, ал санның жұптығын тек соңғы цифр анықтайды.",
      },
    },
    {
      value: String(withZero),
      why: {
        ru: "Это количество записей, где есть хотя бы один 0, а чётность зависит только от последней цифры.",
        kk: "Бұл жазбасында кемінде бір 0 бар сандардың саны, ал жұптық тек соңғы цифрға тәуелді.",
      },
    },
    { value: String(nums.length), why: { ru: "Это количество всех чисел: не все они чётные.", kk: "Бұл барлық сандардың саны: олардың бәрі жұп емес." } },
    { value: "0", why: { ru: "Чётные числа есть: у них последняя цифра 0.", kk: "Жұп сандар бар: олардың соңғы цифры 0." } },
  ]);
  return {
    id: `g:ns.props:evencount:${bins.join("-")}:${seed}`,
    type: "choice",
    skill: "ns.props",
    prompt: { ru: `Сколько чётных чисел среди: ${list}?`, kk: `Мына сандардың ішінде қанша жұп сан бар: ${list}?` },
    ...o,
    explanation: {
      ru: `Чётность определяет последняя цифра: 0 — чётное, 1 — нечётное. Чётные: ${evens}. Всего ${even}.`,
      kk: `Жұптықты соңғы цифр анықтайды: 0 — жұп, 1 — тақ. Жұп сандар: ${evens}. Барлығы ${even}.`,
    },
    hint: HINT_PARITY,
  };
}

function genProps(rand: Rand, level: Level, seed: number): QuestionStep {
  if (level === 1) {
    const edge = edgeCase(seed);
    if (edge !== null) return propsEdge(rand, edge, seed);
  }
  if (level === 3) {
    // C — не только «посчитай единицы»: границы длины, наибольшее и наименьшее из k цифр, чётность набора.
    const k = pick(rand, ["old", "maxk", "mink", "lenedge", "evencount", "old"] as const);
    if (k === "maxk") return propsMaxK(rand, seed);
    if (k === "mink") return propsMinK(rand, seed);
    if (k === "lenedge") return propsLenEdge(rand, seed);
    if (k === "evencount") return propsEvenCount(rand, seed);
  }
  const kind = pick(rand, level === 1 ? (["parity", "pow", "length"] as const) : level === 2 ? (["length", "ones", "pow", "parity"] as const) : (["ones", "length"] as const));
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, hi);
  const bin = toBinary(n);
  if (kind === "parity") return parityStep(n, seed);
  if (kind === "length") {
    const len = bin.length;
    const o = options(rand, String(len), [
      {
        value: String(len - 1),
        why: {
          ru: "Цифр на одну больше: в записи степени двойки 2ᵏ есть единица и k нулей — старшую единицу тоже нужно посчитать.",
          kk: "Цифрлар бірге көп: екінің 2ᵏ дәрежесінің жазбасында бірлік және k нөл бар — ең жоғарғы бірлікті де санау керек.",
        },
      },
      {
        value: String(len + 1),
        why: {
          ru: `Слишком много цифр: чтобы их было ${len + 1}, число должно быть не меньше ${2 ** len}.`,
          kk: `Цифр тым көп: олар ${len + 1} болу үшін сан ${kkSuffix(2 ** len, "abl")} кем болмауы керек.`,
        },
      },
      {
        value: String(len + 2),
        why: {
          ru: `Слишком много цифр: нужно было бы число не меньше ${2 ** (len + 1)}.`,
          kk: `Цифр тым көп: сан ${kkSuffix(2 ** (len + 1), "abl")} кем болмауы керек еді.`,
        },
      },
    ]);
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
        kk: `${n} = ${sub2(bin)} — ${len} цифр. Жылдам тәсіл: ${kkSuffix(n, "abl")} аспайтын екінің ең үлкен дәрежесін тап: 2^${len - 1} = ${2 ** (len - 1)}, демек ${len} цифр.`,
      },
      hint: HINT_LENGTH,
    };
  }
  if (kind === "ones") {
    const ones = bin.split("").filter((c) => c === "1").length;
    const o = options(rand, String(ones), [
      { value: String(ones + 1), why: { ru: "На одну единицу больше: пересчитай — нули не считаются.", kk: "Бір бірлік артық: қайта санап шық — нөлдер есептелмейді." } },
      { value: String(Math.max(0, ones - 1)), why: { ru: "На одну единицу меньше: пересчитай единицы в записи внимательнее.", kk: "Бір бірлік кем: жазбадағы бірліктерді мұқият қайта санап шық." } },
      { value: String(ones + 2), why: { ru: "Слишком много: пересчитай единицы в записи, нули не считаются.", kk: "Тым көп: жазбадағы бірліктерді қайта сана, нөлдер есептелмейді." } },
      { value: String(bin.length - ones), why: { ru: "Это количество нулей, а спрашивали про единицы.", kk: "Бұл нөлдердің саны, ал сұрақ бірліктер туралы." } },
    ]);
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
      hint: HINT_ONES,
    };
  }
  const k = level === 1 ? int(rand, 3, 5) : int(rand, 5, 8);
  const pow = 2 ** k;
  const correct = sub2(`1${"0".repeat(k)}`);
  const o = options(rand, correct, [
    {
      value: sub2(`1${"0".repeat(k - 1)}`),
      why: { ru: "Нулей на один меньше: это предыдущая степень двойки, вдвое меньше.", kk: "Нөл бірге аз: бұл екінің алдыңғы дәрежесі, екі есе кіші." },
    },
    {
      value: sub2("1".repeat(k)),
      why: {
        ru: `Одни единицы — это ${pow - 1}, на 1 меньше ${pow}.`,
        kk: `Тек бірліктер — бұл ${pow - 1}, ${pow} санынан ${kkSuffix(1, "dat")} кем.`,
      },
    },
    {
      value: sub2(`1${"0".repeat(k + 1)}`),
      why: { ru: `Нулей на один больше: это ${pow * 2}, вдвое больше.`, kk: `Нөл бірге артық: бұл ${pow * 2}, екі есе үлкен.` },
    },
  ]);
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
    hint: HINT_POW,
  };
}

type Generator = (rand: Rand, level: Level, seed: number) => QuestionStep;

const GENERATORS: Record<string, Generator> = {
  "ns.base": genBase,
  "ns.bin2dec": genBin2Dec,
  "ns.dec2bin": genDec2Bin,
  "ns.props": genProps,
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
