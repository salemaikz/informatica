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

function genBin2Dec(rand: Rand, level: Level, seed: number): QuestionStep {
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

function genDec2Bin(rand: Rand, level: Level, seed: number): QuestionStep {
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

function genBase(rand: Rand, level: Level, seed: number): QuestionStep {
  // A/B — «сколько цифр» и «какая запись не двоичная», C — только ловушки с записью (двоичной и троичной).
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

function genProps(rand: Rand, level: Level, seed: number): QuestionStep {
  const kind = pick(rand, level === 1 ? (["parity", "pow", "length"] as const) : level === 2 ? (["length", "ones", "pow", "parity"] as const) : (["ones", "length"] as const));
  const [lo, hi] = rangeForLevel(level);
  const n = int(rand, lo, hi);
  const bin = toBinary(n);
  if (kind === "parity") {
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
