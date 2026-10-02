import type { ChoiceStep, InputStep, L, Level, QuestionStep, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка info.units: единицы измерения информации (бит, байт, Кбайт, Мбайт, Гбайт, Тбайт).
// Правильный ответ всегда считает код. Параметры задания зашиты в id (g:info.units:<вид>:<параметры>:<seed>) —
// по ним ответы перепроверены независимым расчётом (scripts/out/info-1-units/verify.py).
// Договорённость как в ЕНТ: 1 Кбайт = 1024 байта, 1 байт = 8 бит. Неверные варианты — типичные ошибки:
// 1000 вместо 1024, забытый или лишний множитель 8, пропущенная ступенька, Кбит вместо Кбайт.
// Казахские тексты без падежных окончаний после переменных чисел: число стоит перед существительным или в формуле.

const SKILL = "info.units";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[d]);

// ---------- Единицы ----------

/** 0 бит, 1 байт, 2 Кбайт, 3 Мбайт, 4 Гбайт, 5 Тбайт. */
const NAMES = ["бит", "байт", "Кбайт", "Мбайт", "Гбайт", "Тбайт"] as const;
/** log₂ числа бит в одной единице: байт = 2³ бит, Кбайт = 2¹³ бит, … */
const EXP = [0, 3, 13, 23, 33, 43] as const;

/** Число с пробелами между тройками цифр (от 5 знаков): 16 777 216. */
const num = (n: number) => {
  const s = String(n);
  return s.length >= 5 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s;
};

/** Русское склонение: 1 бит, 2 бита, 5 бит. */
function ruPl(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const ruUnit = (n: number, u: number) => (u === 0 ? ruPl(n, "бит", "бита", "бит") : u === 1 ? ruPl(n, "байт", "байта", "байт") : NAMES[u]);
/** «3 Мбайт», «5 байт» (ru склоняется, kk — нет). */
const amt = (n: number, u: number): L => ({ ru: `${num(n)} ${ruUnit(n, u)}`, kk: `${num(n)} ${NAMES[u]}` });
/** Русская запись «число + единица» с согласованием: 3072 байта, 16 384 бита. */
const ra = (n: number, u: number) => `${num(n)} ${ruUnit(n, u)}`;
/** Остаток деления в разборе: «остаток 4» или «делится нацело». */
const remRu = (r: number) => (r === 0 ? "делится нацело" : `остаток ${r}`);
const remKk = (r: number) => (r === 0 ? "қалдықсыз бөлінеді" : `қалдық ${r}`);
/** Как amt, но строка, если оба языка совпадают (для вариантов ответа). */
const amtT = (n: number, u: number): Text => {
  const a = amt(n, u);
  return a.ru === a.kk ? a.ru : a;
};

// ---------- Варианты ответа ----------

interface Opt {
  text: Text;
  why: L | null;
}
const keyOf = (t: Text) => JSON.stringify(t);

interface ChoiceInput {
  id: string;
  level: Level;
  prompt: L;
  hint: L;
  explanation: L;
  correct: Text;
  wrongs: { text: Text; why: L }[];
}

/** Задание choice: правильный + 3 уникальных неверных (с разбором ошибки), перемешаны. */
function choice(rand: Rand, c: ChoiceInput): ChoiceStep {
  const seen = new Set<string>([keyOf(c.correct)]);
  const wrongs: Opt[] = [];
  for (const w of shuffle(c.wrongs, rand)) {
    if (wrongs.length >= 3) break;
    const k = keyOf(w.text);
    if (!seen.has(k)) {
      seen.add(k);
      wrongs.push({ text: w.text, why: w.why });
    }
  }
  if (wrongs.length < 3) throw new Error(`${c.id}: мало неверных вариантов`);
  const all: Opt[] = shuffle([{ text: c.correct, why: null } as Opt, ...wrongs], rand);
  return {
    id: c.id,
    type: "choice",
    skill: SKILL,
    level: c.level,
    prompt: c.prompt,
    hint: c.hint,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
    explanation: c.explanation,
  };
}

function input(id: string, level: Level, prompt: L, hint: L, explanation: L, answer: number): InputStep {
  return { id, type: "input", skill: SKILL, level, prompt, hint, answers: [String(answer)], mode: "number", explanation };
}

// ---------- Подсказки (не выдают ответ) ----------

const HINT_DOWN: L = {
  ru: "Переходим к более мелкой единице — вниз по лестнице, число станет больше. Умножаем на множитель одной ступеньки.",
  kk: "Ұсағырақ бірлікке өтеміз — баспалдақпен төмен, сан үлкейеді. Бір саты көбейткішіне көбейтеміз.",
};
const HINT_UP: L = {
  ru: "Переходим к более крупной единице — вверх по лестнице, число станет меньше. Делим на множитель одной ступеньки.",
  kk: "Ірірек бірлікке өтеміз — баспалдақпен жоғары, сан кішірейеді. Бір саты көбейткішіне бөлеміз.",
};
const HINT_BITS: L = {
  ru: "Вспомни, сколько бит в одном байте. Из байтов в биты — умножаем, из бит в байты — делим.",
  kk: "Бір байтта неше бит бар екенін еске түсір. Байттан битке — көбейтеміз, биттен байтқа — бөлеміз.",
};
const HINT_TWO_STEPS: L = {
  ru: "Идём по лестнице по одной ступеньке и записываем результат после каждого шага. Не пропусти промежуточную единицу.",
  kk: "Баспалдақпен бір-бір сатыдан жүріп, әр қадамнан кейін нәтижені жаз. Аралық бірлікті өткізіп жіберме.",
};
const HINT_SAME_UNIT: L = {
  ru: "Числа в разных единицах сравнивать нельзя. Переведи обе величины в одну — ту, что мельче.",
  kk: "Әртүрлі бірліктегі сандарды салыстыруға болмайды. Екі шаманы да бір бірлікке — ұсағырақ бірлікке аудар.",
};
const HINT_FIT: L = {
  ru: "Сначала переведи ёмкость в единицы файла (вниз по лестнице). Потом раздели ёмкость на размер одного файла.",
  kk: "Алдымен сыйымдылықты файл бірлігіне аудар (баспалдақпен төмен). Содан кейін сыйымдылықты бір файлдың көлеміне бөл.",
};
const HINT_POW: L = {
  ru: "Запиши единицу в битах степенью двойки (1024 = 2¹⁰, 8 = 2³): при умножении показатели складываются, при делении — вычитаются.",
  kk: "Бірлікті биттермен екінің дәрежесі арқылы жаз (1024 = 2¹⁰, 8 = 2³): көбейткенде көрсеткіштер қосылады, бөлгенде — шегеріледі.",
};
const HINT_STEP_FACTOR: L = {
  ru: "Между соседними байтовыми единицами всегда один и тот же множитель — степень двойки. А между байтом и битом — другой.",
  kk: "Көрші байттық бірліктер арасында әрқашан бірдей көбейткіш — екінің дәрежесі. Ал байт пен бит арасында — басқасы.",
};

// ---------- Разборы типичных ошибок ----------

const why1000: L = {
  ru: "Умножено на 1000: в информатике «кило», «мега», «гига» — это 1024, а не 1000.",
  kk: "1000-ға көбейтілген: информатикада «кило», «мега», «гига» — 1024, ал 1000 емес.",
};
const why8: L = {
  ru: "Множитель 8 бывает только между байтом и битом, а между Кбайт, Мбайт и Гбайт — 1024.",
  kk: "8 көбейткіші тек байт пен бит арасында болады, ал Кбайт, Мбайт және Гбайт арасында — 1024.",
};
const whySkipStep: L = {
  ru: "Умножено на 1024 дважды — перескочена целая единица. Нужна одна ступенька.",
  kk: "1024-ке екі рет көбейтілген — бір бірлік аттап кеткен. Бір саты ғана керек.",
};
const whyAdd: L = {
  ru: "Число сложено с 1024, а надо умножать: ступенька вниз — это умножение.",
  kk: "Сан 1024-ке қосылған, ал көбейту керек: бір саты төмен — көбейту.",
};

// ---------- Генераторы заданий ----------

type Gen = (rand: Rand, level: Level, id: (params: string) => string) => QuestionStep;

const KINDS: Record<Level, readonly string[]> = {
  1: ["down1", "down1", "up1", "bits", "bits2bytes", "cmp1"],
  2: ["kb2bits", "bits2kb", "down2", "up2", "fit", "cmp", "kbit"],
  3: ["pow-choice", "pow-bits2", "pow-exp", "fit3", "rest", "sum", "fit-kb"],
};

const GEN: Record<string, Gen> = {
  // ---- A ----
  // Одна ступенька вниз: N hi → lo, умножаем на 1024.
  down1(rand, level, id) {
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 2, 12);
    const ans = n * 1024;
    return choice(rand, {
      id: id(`${hi}-${n}`),
      level,
      prompt: {
        ru: `Файл занимает ${n} ${NAMES[hi]}. Сколько это ${NAMES[lo]}?`,
        kk: `Файл көлемі — ${n} ${NAMES[hi]}. Бұл неше ${NAMES[lo]}?`,
      },
      hint: HINT_DOWN,
      explanation: {
        ru: `${NAMES[hi]} → ${NAMES[lo]} — ступенька вниз, умножаем на 1024: ${n} · 1024 = ${num(ans)}. Ловушка: ${n} · 1000 = ${num(n * 1000)} — между соседними единицами множитель 1024, а не 1000.`,
        kk: `${NAMES[hi]} → ${NAMES[lo]} — бір саты төмен, 1024-ке көбейтеміз: ${n} · 1024 = ${num(ans)}. Тұзақ: ${n} · 1000 = ${num(n * 1000)} — көрші бірліктер арасындағы көбейткіш 1000 емес, 1024.`,
      },
      correct: num(ans),
      wrongs: [
        { text: num(n * 1000), why: why1000 },
        { text: num(n * 8), why: why8 },
        { text: num(n * 1024 * 1024), why: whySkipStep },
        { text: num(n + 1024), why: whyAdd },
      ],
    });
  },
  // Одна ступенька вверх: делим на 1024.
  up1(rand, level, id) {
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 2, 12);
    const given = n * 1024;
    return input(
      id(`${hi}-${n}`),
      level,
      {
        ru: `Файл занимает ${amt(given, lo).ru}. Сколько это ${NAMES[hi]}?`,
        kk: `Файл көлемі — ${amt(given, lo).kk}. Бұл неше ${NAMES[hi]}?`,
      },
      HINT_UP,
      {
        ru: `${NAMES[lo]} → ${NAMES[hi]} — ступенька вверх, делим на 1024: ${num(given)} : 1024 = ${n}.`,
        kk: `${NAMES[lo]} → ${NAMES[hi]} — бір саты жоғары, 1024-ке бөлеміз: ${num(given)} : 1024 = ${n}.`,
      },
      n,
    );
  },
  // Байты в биты: ×8.
  bits(rand, level, id) {
    const n = int(rand, 2, 24);
    return input(
      id(`${n}`),
      level,
      {
        ru: `Размер данных — ${amt(n, 1).ru}. Сколько это бит?`,
        kk: `Деректер көлемі — ${n} байт. Бұл неше бит?`,
      },
      HINT_BITS,
      {
        ru: `В одном байте 8 бит, из байтов в биты умножаем на 8: ${n} · 8 = ${n * 8}. Ловушка: ${n} · 1024 — так переходят между Кбайт и байтами.`,
        kk: `Бір байтта 8 бит бар, байттан битке 8-ге көбейтеміз: ${n} · 8 = ${n * 8}. Тұзақ: ${n} · 1024 — бұлай Кбайт пен байт арасында өтеді.`,
      },
      n * 8,
    );
  },
  // Биты в байты: :8.
  bits2bytes(rand, level, id) {
    const n = int(rand, 2, 30);
    return input(
      id(`${n}`),
      level,
      {
        ru: `Размер данных — ${amt(n * 8, 0).ru}. Сколько это байт?`,
        kk: `Деректер көлемі — ${n * 8} бит. Бұл неше байт?`,
      },
      HINT_BITS,
      {
        ru: `В одном байте 8 бит, из бит в байты делим на 8: ${n * 8} : 8 = ${n}.`,
        kk: `Бір байтта 8 бит бар, биттен байтқа 8-ге бөлеміз: ${n * 8} : 8 = ${n}.`,
      },
      n,
    );
  },
  // Ловушка 1000 против 1024: что больше — n hi или n·1000 lo.
  cmp1(rand, level, id) {
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 1, 9);
    const big = amtT(n, hi);
    const small = amtT(n * 1000, lo);
    return choice(rand, {
      id: id(`${hi}-${n}`),
      level,
      prompt: {
        ru: `Что больше: ${amt(n, hi).ru} или ${amt(n * 1000, lo).ru}?`,
        kk: `Қайсысы үлкен: ${amt(n, hi).kk} па, әлде ${amt(n * 1000, lo).kk} па?`,
      },
      hint: HINT_SAME_UNIT,
      explanation: {
        ru: `1 ${NAMES[hi]} = ${ra(1024, lo)}, значит ${n} ${NAMES[hi]} = ${ra(n * 1024, lo)}. Это больше, чем ${ra(n * 1000, lo)}: на ЕНТ множитель ступеньки — 1024, а не 1000.`,
        kk: `1 ${NAMES[hi]} = 1024 ${NAMES[lo]}, демек ${n} ${NAMES[hi]} = ${num(n * 1024)} ${NAMES[lo]}. Бұл ${num(n * 1000)} ${NAMES[lo]} шамасынан үлкен: ҰБТ-да саты көбейткіші — 1024, ал 1000 емес.`,
      },
      correct: big,
      wrongs: [
        {
          text: small,
          why: {
            ru: `${n} ${NAMES[hi]} = ${ra(n * 1024, lo)} — это больше, чем ${num(n * 1000)}. Число побольше ещё не значит величину побольше.`,
            kk: `${n} ${NAMES[hi]} = ${num(n * 1024)} ${NAMES[lo]} — бұл ${num(n * 1000)} санынан үлкен. Сан үлкен болғаны шама үлкен дегенді білдірмейді.`,
          },
        },
        {
          text: { ru: "Они равны", kk: "Олар тең" },
          why: {
            ru: `Равенство получилось бы, если бы в ${NAMES[hi]} было 1000 ${NAMES[lo]}, но их 1024.`,
            kk: `${NAMES[hi]} ішінде 1000 ${NAMES[lo]} болса, теңдік шығар еді, бірақ олар 1024.`,
          },
        },
        {
          text: { ru: "Сравнить нельзя", kk: "Салыстыруға болмайды" },
          why: {
            ru: "Можно: переведи обе величины в одну единицу и сравни числа.",
            kk: "Болады: екі шаманы бір бірлікке аударып, сандарды салыстыр.",
          },
        },
      ],
    });
  },

  // ---- B ----
  // Кбайт → биты: ×1024 ×8.
  kb2bits(rand, level, id) {
    const n = int(rand, 2, 9);
    const ans = n * 8192;
    return choice(rand, {
      id: id(`${n}`),
      level,
      prompt: {
        ru: `Файл занимает ${n} Кбайт. Сколько это бит?`,
        kk: `Файл көлемі — ${n} Кбайт. Бұл неше бит?`,
      },
      hint: HINT_TWO_STEPS,
      explanation: {
        ru: `Кбайт → байт: ${n} · 1024 = ${ra(n * 1024, 1)}. Байт → бит: ${num(n * 1024)} · 8 = ${ra(ans, 0)}. Короче: в 1 Кбайт 2¹⁰ · 2³ = 2¹³ = 8192 бита.`,
        kk: `Кбайт → байт: ${n} · 1024 = ${num(n * 1024)} байт. Байт → бит: ${num(n * 1024)} · 8 = ${num(ans)} бит. Қысқаша: 1 Кбайтта 2¹⁰ · 2³ = 2¹³ = 8192 бит бар.`,
      },
      correct: num(ans),
      wrongs: [
        {
          text: num(n * 1024),
          why: { ru: `Это байты: после перехода Кбайт → байт забыто умножить на 8.`, kk: `Бұл байттар: Кбайт → байт өткеннен кейін 8-ге көбейту ұмытылған.` },
        },
        { text: num(n * 8000), why: { ru: "Вместо 1024 взято 1000. В информатике — 1024.", kk: "1024 орнына 1000 алынған. Информатикада — 1024." } },
        {
          text: num(n * 8),
          why: { ru: "Умножено только на 8, а переход Кбайт → байт (×1024) пропущен.", kk: "Тек 8-ге көбейтілген, ал Кбайт → байт (×1024) өту өткізіліп кеткен." },
        },
        {
          text: num(n * 128),
          why: { ru: "1024 разделено на 8, а из байтов в биты нужно умножать.", kk: "1024 саны 8-ге бөлінген, ал байттан битке көбейту керек." },
        },
      ],
    });
  },
  // Биты → Кбайт: :8, :1024.
  bits2kb(rand, level, id) {
    const n = int(rand, 2, 12);
    const bits = n * 8192;
    return input(
      id(`${n}`),
      level,
      {
        ru: `Файл занимает ${ra(bits, 0)}. Сколько это Кбайт?`,
        kk: `Файл көлемі — ${num(bits)} бит. Бұл неше Кбайт?`,
      },
      HINT_TWO_STEPS,
      {
        ru: `Бит → байт: ${num(bits)} : 8 = ${ra(n * 1024, 1)}. Байт → Кбайт: ${num(n * 1024)} : 1024 = ${n}.`,
        kk: `Бит → байт: ${num(bits)} : 8 = ${num(n * 1024)} байт. Байт → Кбайт: ${num(n * 1024)} : 1024 = ${n}.`,
      },
      n,
    );
  },
  // Две ступеньки вниз: ×1024 ×1024.
  down2(rand, level, id) {
    const hi = int(rand, 3, 5);
    const lo = hi - 2;
    const n = int(rand, 2, 9);
    const ans = n * 1024 * 1024;
    return input(
      id(`${hi}-${n}`),
      level,
      {
        ru: `Файл занимает ${n} ${NAMES[hi]}. Сколько это ${NAMES[lo]}?`,
        kk: `Файл көлемі — ${n} ${NAMES[hi]}. Бұл неше ${NAMES[lo]}?`,
      },
      HINT_TWO_STEPS,
      {
        ru: `Две ступеньки вниз: ${NAMES[hi]} → ${NAMES[hi - 1]} → ${NAMES[lo]}. ${n} · 1024 = ${num(n * 1024)} ${NAMES[hi - 1]}, затем ${num(n * 1024)} · 1024 = ${ra(ans, lo)}. Степенями: ${n} · 2²⁰.`,
        kk: `Екі саты төмен: ${NAMES[hi]} → ${NAMES[hi - 1]} → ${NAMES[lo]}. ${n} · 1024 = ${num(n * 1024)} ${NAMES[hi - 1]}, содан кейін ${num(n * 1024)} · 1024 = ${num(ans)} ${NAMES[lo]}. Дәрежемен: ${n} · 2²⁰.`,
      },
      ans,
    );
  },
  // Две ступеньки вверх: :1024 :1024.
  up2(rand, level, id) {
    const hi = int(rand, 3, 5);
    const lo = hi - 2;
    const n = int(rand, 2, 9);
    const given = n * 1024 * 1024;
    return input(
      id(`${hi}-${n}`),
      level,
      {
        ru: `Файл занимает ${amt(given, lo).ru}. Сколько это ${NAMES[hi]}?`,
        kk: `Файл көлемі — ${amt(given, lo).kk}. Бұл неше ${NAMES[hi]}?`,
      },
      HINT_TWO_STEPS,
      {
        ru: `Две ступеньки вверх: ${NAMES[lo]} → ${NAMES[hi - 1]} → ${NAMES[hi]}. ${num(given)} : 1024 = ${num(n * 1024)} ${NAMES[hi - 1]}, затем ${num(n * 1024)} : 1024 = ${n} ${NAMES[hi]}.`,
        kk: `Екі саты жоғары: ${NAMES[lo]} → ${NAMES[hi - 1]} → ${NAMES[hi]}. ${num(given)} : 1024 = ${num(n * 1024)} ${NAMES[hi - 1]}, содан кейін ${num(n * 1024)} : 1024 = ${n} ${NAMES[hi]}.`,
      },
      n,
    );
  },
  // Сколько файлов поместится (ёмкость в Гбайт, файл в Мбайт).
  fit(rand, level, id) {
    const g = pick(rand, [1, 2, 3, 4, 5, 6, 8]);
    const m = pick(rand, [2, 4, 8, 16, 32, 64, 128, 256, 512]);
    const ans = (g * 1024) / m;
    return choice(rand, {
      id: id(`${g}-${m}`),
      level,
      prompt: {
        ru: `Ёмкость флешки — ${g} Гбайт, каждый файл занимает ${m} Мбайт. Сколько таких файлов поместится на флешку?`,
        kk: `Флеш-жадтың сыйымдылығы — ${g} Гбайт, әр файлдың көлемі — ${m} Мбайт. Флеш-жадқа осындай неше файл сыяды?`,
      },
      hint: HINT_FIT,
      explanation: {
        ru: `${g} Гбайт = ${g} · 1024 = ${num(g * 1024)} Мбайт. Файлов: ${num(g * 1024)} : ${m} = ${num(ans)}. Если считать 1 Гбайт = 1000 Мбайт, получится ${Math.floor((g * 1000) / m)} — ловушка.`,
        kk: `${g} Гбайт = ${g} · 1024 = ${num(g * 1024)} Мбайт. Файл саны: ${num(g * 1024)} : ${m} = ${num(ans)}. 1 Гбайт = 1000 Мбайт деп есептесек, ${Math.floor((g * 1000) / m)} шығады — тұзақ.`,
      },
      correct: num(ans),
      wrongs: [
        {
          text: num(Math.floor((g * 1000) / m)),
          why: { ru: "Ёмкость посчитана как 1 Гбайт = 1000 Мбайт. На ЕНТ — 1024.", kk: "Сыйымдылық 1 Гбайт = 1000 Мбайт деп есептелген. ҰБТ-да — 1024." },
        },
        {
          text: num(g * 1024),
          why: { ru: "Это ёмкость в Мбайт. Её ещё нужно разделить на размер одного файла.", kk: "Бұл — Мбайтпен берілген сыйымдылық. Оны бір файлдың көлеміне бөлу керек." },
        },
        {
          text: num((g * 1024 * 1024) / m),
          why: { ru: "Ёмкость переведена в Кбайт, а размер файла взят в Мбайт — единицы разные.", kk: "Сыйымдылық Кбайтқа аударылған, ал файл көлемі Мбайтпен алынған — бірліктер әртүрлі." },
        },
      ],
    });
  },
  // Что больше: n·1000 < m < n·1024 (ловушка) или m > n·1024.
  cmp(rand, level, id) {
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 2, 9);
    const hiBigger = rand() < 0.65;
    const m = hiBigger ? n * 1000 + int(rand, 1, 24 * n - 1) : n * 1024 + int(rand, 1, 24 * n);
    const a = amtT(n, hi);
    const b = amtT(m, lo);
    const aWhy: L = {
      ru: `${n} ${NAMES[hi]} = ${ra(n * 1024, lo)} — это меньше, чем ${ra(m, lo)}.`,
      kk: `${n} ${NAMES[hi]} = ${num(n * 1024)} ${NAMES[lo]} — бұл ${num(m)} ${NAMES[lo]} шамасынан кіші.`,
    };
    const bWhy: L = {
      ru: `${n} ${NAMES[hi]} = ${ra(n * 1024, lo)} — это больше, чем ${ra(m, lo)}. Сравнение «по числам» подвело.`,
      kk: `${n} ${NAMES[hi]} = ${num(n * 1024)} ${NAMES[lo]} — бұл ${num(m)} ${NAMES[lo]} шамасынан үлкен. «Сан бойынша» салыстыру қателестірді.`,
    };
    return choice(rand, {
      id: id(`${hi}-${n}-${m}`),
      level,
      prompt: {
        ru: `Что больше: ${amt(n, hi).ru} или ${amt(m, lo).ru}?`,
        kk: `Қайсысы үлкен: ${amt(n, hi).kk} па, әлде ${amt(m, lo).kk} па?`,
      },
      hint: HINT_SAME_UNIT,
      explanation: {
        ru: `Переведём в ${NAMES[lo]}: ${n} ${NAMES[hi]} = ${n} · 1024 = ${ra(n * 1024, lo)}. Сравниваем: ${num(n * 1024)} и ${num(m)} — ${hiBigger ? `${n} ${NAMES[hi]} больше` : `${ra(m, lo)} больше`}.`,
        kk: `${NAMES[lo]} бірлігіне аударамыз: ${n} ${NAMES[hi]} = ${n} · 1024 = ${num(n * 1024)} ${NAMES[lo]}. Салыстырамыз: ${num(n * 1024)} және ${num(m)} — ${hiBigger ? `${n} ${NAMES[hi]} үлкен` : `${num(m)} ${NAMES[lo]} үлкен`}.`,
      },
      correct: hiBigger ? a : b,
      wrongs: [
        { text: hiBigger ? b : a, why: hiBigger ? bWhy : aWhy },
        {
          text: { ru: "Они равны", kk: "Олар тең" },
          why: { ru: `${num(n * 1024)} и ${num(m)} — разные числа, значит величины не равны.`, kk: `${num(n * 1024)} және ${num(m)} — әртүрлі сандар, демек шамалар тең емес.` },
        },
        {
          text: { ru: "Сравнить нельзя", kk: "Салыстыруға болмайды" },
          why: { ru: "Можно: переведи обе величины в одну единицу.", kk: "Болады: екі шаманы бір бірлікке аудар." },
        },
      ],
    });
  },
  // Килобиты: N Кбит → байты (×1024 ÷8 = ×128).
  kbit(rand, level, id) {
    const n = int(rand, 2, 12);
    const ans = n * 128;
    return choice(rand, {
      id: id(`${n}`),
      level,
      prompt: {
        ru: `Размер данных — ${n} Кбит (килобит). Сколько это байт?`,
        kk: `Деректер көлемі — ${n} Кбит (килобит). Бұл неше байт?`,
      },
      hint: {
        ru: "Кбит — это килобиты, а не килобайты. Сначала найди число бит, потом переведи биты в байты.",
        kk: "Кбит — килобайт емес, килобит. Алдымен бит санын тап, содан кейін биттерді байтқа аудар.",
      },
      explanation: {
        ru: `${n} Кбит = ${n} · 1024 = ${ra(n * 1024, 0)}. Бит → байт: ${num(n * 1024)} : 8 = ${ra(ans, 1)}. Смотри на окончание записи: Кбит в 8 раз меньше, чем Кбайт.`,
        kk: `${n} Кбит = ${n} · 1024 = ${num(n * 1024)} бит. Бит → байт: ${num(n * 1024)} : 8 = ${num(ans)} байт. Жазудың соңына қара: Кбит Кбайттан 8 есе кіші.`,
      },
      correct: num(ans),
      wrongs: [
        { text: num(n * 1024), why: { ru: "Кбит принят за Кбайт: 1 Кбайт = 1024 байта, а у нас биты.", kk: "Кбит Кбайт деп қабылданған: 1 Кбайт = 1024 байт, ал бізде биттер." } },
        { text: num(n * 8192), why: { ru: "Из бит в байты нужно делить на 8, а здесь умножено.", kk: "Биттен байтқа 8-ге бөлу керек, ал мұнда көбейтілген." } },
        { text: num(n * 125), why: { ru: "Взято 1000 бит вместо 1024: 1000 : 8 = 125. В информатике «кило» — 1024.", kk: "1024 бит орнына 1000 бит алынған: 1000 : 8 = 125. Информатикада «кило» — 1024." } },
        { text: num(n * 8), why: { ru: "Переход Кбит → бит (×1024) пропущен, умножено только на 8.", kk: "Кбит → бит (×1024) өту өткізілген, тек 8-ге көбейтілген." } },
      ],
    });
  },

  // ---- C ----
  // Размер в битах степенью двойки: N = 2ᵏ единиц.
  "pow-choice"(rand, level, id) {
    const u = pick(rand, [2, 3, 4] as const);
    const k = int(rand, 1, 5);
    const n = 2 ** k;
    const x = EXP[u] + k;
    return choice(rand, {
      id: id(`${u}-${k}`),
      level,
      prompt: {
        ru: `Файл занимает ${n} ${NAMES[u]}. Чему равен его размер в битах?`,
        kk: `Файл көлемі — ${n} ${NAMES[u]}. Оның биттермен көлемі неге тең?`,
      },
      hint: HINT_POW,
      explanation: {
        ru: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, а ${n} = 2${sup(k)}. Показатели складываем: ${EXP[u]} + ${k} = ${x}. Ответ: 2${sup(x)} бит.`,
        kk: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, ал ${n} = 2${sup(k)}. Көрсеткіштерді қосамыз: ${EXP[u]} + ${k} = ${x}. Жауабы: 2${sup(x)} бит.`,
      },
      correct: `2${sup(x)} бит`,
      wrongs: [
        {
          text: `2${sup(x - 3)} бит`,
          why: { ru: `2${sup(x - 3)} — это размер в байтах: забыто умножить на 8 = 2³.`, kk: `2${sup(x - 3)} — бұл байттағы көлем: 8 = 2³-ке көбейту ұмытылған.` },
        },
        {
          text: `2${sup(x + 3)} бит`,
          why: { ru: "Умножено на 8 дважды: из байтов в биты переходят только один раз.", kk: "8-ге екі рет көбейтілген: байттан битке бір-ақ рет өтеді." },
        },
        {
          text: `2${sup(EXP[u])} бит`,
          why: { ru: `Это размер одной единицы: потерян множитель ${n} = 2${sup(k)}.`, kk: `Бұл бір бірліктің көлемі: ${n} = 2${sup(k)} көбейткіші жоғалған.` },
        },
        {
          text: `2${sup(x - 10)} бит`,
          why: { ru: "Показатель уменьшен на 10 — так переходят вверх на одну ступеньку, а нужно вниз до битов.", kk: "Көрсеткіш 10-ға азайтылған — бұлай бір саты жоғары өтеді, ал биттерге дейін төмен түсу керек." },
        },
      ],
    });
  },
  // Дан размер 2ᵃ бит — сколько Кбайт/Мбайт/Гбайт.
  "pow-bits2"(rand, level, id) {
    const u = pick(rand, [2, 3, 4] as const);
    const k = int(rand, 1, 8);
    const a = EXP[u] + k;
    return input(
      id(`${u}-${a}`),
      level,
      {
        ru: `Файл занимает 2${sup(a)} бит. Сколько это ${NAMES[u]}?`,
        kk: `Файл көлемі — 2${sup(a)} бит. Бұл неше ${NAMES[u]}?`,
      },
      HINT_POW,
      {
        ru: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит. Делим степени: 2${sup(a)} : 2${sup(EXP[u])} = 2${sup(a - EXP[u])} = ${2 ** k} ${NAMES[u]}.`,
        kk: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит. Дәрежелерді бөлеміз: 2${sup(a)} : 2${sup(EXP[u])} = 2${sup(a - EXP[u])} = ${2 ** k} ${NAMES[u]}.`,
      },
      2 ** k,
    );
  },
  // Дан размер 2ᵏ единиц — найти показатель размера в битах (обратная задача).
  "pow-exp"(rand, level, id) {
    const u = pick(rand, [1, 2, 3, 4] as const);
    const k = int(rand, 1, 7);
    const n = 2 ** k;
    return input(
      id(`${u}-${n}`),
      level,
      {
        ru: `Файл занимает ${amt(n, u).ru}, это 2ˣ бит. Чему равен показатель x?`,
        kk: `Файл көлемі — ${n} ${NAMES[u]}, бұл 2ˣ бит. x көрсеткіші неге тең?`,
      },
      HINT_POW,
      {
        ru: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, ${n} = 2${sup(k)}. Показатели складываем: x = ${EXP[u]} + ${k} = ${EXP[u] + k}.`,
        kk: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, ${n} = 2${sup(k)}. Көрсеткіштерді қосамыз: x = ${EXP[u]} + ${k} = ${EXP[u] + k}.`,
      },
      EXP[u] + k,
    );
  },
  // Целых файлов: ёмкость не делится нацело.
  fit3(rand, level, id) {
    const g = int(rand, 2, 16);
    const m = pick(rand, [3, 5, 6, 7, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50]);
    const total = g * 1024;
    const ans = Math.floor(total / m);
    return input(
      id(`${g}-${m}`),
      level,
      {
        ru: `На флешку ёмкостью ${g} Гбайт записывают видео по ${m} Мбайт. Сколько целых видео поместится?`,
        kk: `Сыйымдылығы ${g} Гбайт флеш-жадқа көлемі ${m} Мбайт болатын бейнефайлдар жазылады. Неше бүтін бейнефайл сыяды?`,
      },
      HINT_FIT,
      {
        ru: `${g} Гбайт = ${g} · 1024 = ${num(total)} Мбайт. ${num(total)} : ${m} = ${ans}, ${remRu(total - ans * m)}. Дробная часть видео не считается, поэтому целых: ${ans}.`,
        kk: `${g} Гбайт = ${g} · 1024 = ${num(total)} Мбайт. ${num(total)} : ${m} = ${ans}, ${remKk(total - ans * m)}. Бейнефайлдың бөлігі есептелмейді, сондықтан бүтін бейнефайл саны: ${ans}.`,
      },
      ans,
    );
  },
  // Сколько ещё поместится, если часть места занята.
  rest(rand, level, id) {
    const g = pick(rand, [2, 4, 8]);
    const total = g * 1024;
    const used = 100 * int(rand, 1, g * 5);
    const m = pick(rand, [6, 8, 10, 12, 15, 20, 25, 30]);
    const free = total - used;
    const ans = Math.floor(free / m);
    return input(
      id(`${g}-${used}-${m}`),
      level,
      {
        ru: `Ёмкость флешки — ${g} Гбайт, на ней уже занято ${used} Мбайт. Сколько ещё целых файлов по ${m} Мбайт можно записать?`,
        kk: `Флеш-жадтың сыйымдылығы — ${g} Гбайт, оның ${used} Мбайты бос емес. Көлемі ${m} Мбайт болатын тағы неше бүтін файл жазуға болады?`,
      },
      {
        ru: "Переведи ёмкость в Мбайт, вычти занятое место, и только потом дели на размер файла.",
        kk: "Сыйымдылықты Мбайтқа аудар, бос емес орынды алып тастап, содан кейін ғана файл көлеміне бөл.",
      },
      {
        ru: `${g} Гбайт = ${num(total)} Мбайт. Свободно: ${num(total)} − ${used} = ${num(free)} Мбайт. ${num(free)} : ${m} = ${ans}, ${remRu(free - ans * m)} — целых файлов ${ans}.`,
        kk: `${g} Гбайт = ${num(total)} Мбайт. Бос орын: ${num(total)} − ${used} = ${num(free)} Мбайт. ${num(free)} : ${m} = ${ans}, ${remKk(free - ans * m)} — бүтін файл саны ${ans}.`,
      },
      ans,
    );
  },
  // Сумма величин в разных единицах — в мелких.
  sum(rand, level, id) {
    const [hi, lo] = pick(rand, [[3, 2], [2, 1], [4, 3]] as const);
    const a = int(rand, 2, 9);
    const b = lo === 1 ? 100 * int(rand, 1, 9) : 50 * int(rand, 2, 18);
    const ans = a * 1024 + b;
    return input(
      id(`${hi}-${a}-${b}`),
      level,
      {
        ru: `На диске два файла: ${amt(a, hi).ru} и ${amt(b, lo).ru}. Сколько всего ${NAMES[lo]} занимают файлы?`,
        kk: `Дискіде екі файл бар: ${amt(a, hi).kk} және ${amt(b, lo).kk}. Файлдар барлығы неше ${NAMES[lo]} көлем алады?`,
      },
      {
        ru: "Складывать можно только величины в одной единице. Переведи крупную в мелкую и тогда сложи.",
        kk: "Тек бір бірліктегі шамаларды қосуға болады. Ірі бірлікті ұсағына аударып, содан кейін қос.",
      },
      {
        ru: `${a} ${NAMES[hi]} = ${a} · 1024 = ${ra(a * 1024, lo)}. Складываем: ${num(a * 1024)} + ${b} = ${ra(ans, lo)}. Ловушка: ${a} + ${b} = ${a + b} — числа сложены без перевода.`,
        kk: `${a} ${NAMES[hi]} = ${a} · 1024 = ${num(a * 1024)} ${NAMES[lo]}. Қосамыз: ${num(a * 1024)} + ${b} = ${num(ans)} ${NAMES[lo]}. Тұзақ: ${a} + ${b} = ${a + b} — сандар аударусыз қосылған.`,
      },
      ans,
    );
  },
  // Сколько фото по K Кбайт на карту G Гбайт: две ступеньки вниз и деление.
  "fit-kb"(rand, level, id) {
    const g = int(rand, 1, 8);
    const k = pick(rand, [200, 250, 300, 400, 500, 600, 640, 750, 800, 1200]);
    const total = g * 1024 * 1024;
    const ans = Math.floor(total / k);
    return input(
      id(`${g}-${k}`),
      level,
      {
        ru: `На карту памяти ёмкостью ${g} Гбайт записывают фото по ${k} Кбайт. Сколько целых фото поместится?`,
        kk: `Сыйымдылығы ${g} Гбайт жад картасына көлемі ${k} Кбайт болатын суреттер жазылады. Неше бүтін сурет сыяды?`,
      },
      {
        ru: "Фото измерено в Кбайт, карта — в Гбайт. Переведи ёмкость в Кбайт: это две ступеньки вниз.",
        kk: "Сурет Кбайтпен, карта Гбайтпен өлшенген. Сыйымдылықты Кбайтқа аудар: бұл екі саты төмен.",
      },
      {
        ru: `${g} Гбайт = ${g} · 1024 · 1024 = ${num(total)} Кбайт. ${num(total)} : ${k} = ${ans}, ${remRu(total - ans * k)} — целых фото ${ans}.`,
        kk: `${g} Гбайт = ${g} · 1024 · 1024 = ${num(total)} Кбайт. ${num(total)} : ${k} = ${ans}, ${remKk(total - ans * k)} — бүтін сурет саны ${ans}.`,
      },
      ans,
    );
  },
};

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  const kind = pick(rand, KINDS[level]);
  return GEN[kind](rand, level, (params) => `g:${SKILL}:${kind}:${params}:${seed}`);
}

// ---------- Утверждения «верно / неверно» ----------

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const truth = rand() < 0.5;
  const mk = (key: string, text: L, value: boolean, explanation: L, hint: L): Statement => ({
    id: `s:${SKILL}:${key}`,
    skill: SKILL,
    level,
    text,
    value,
    explanation,
    hint,
  });

  if (level === 1) {
    if (rand() < 0.35) {
      const k = truth ? 8 : pick(rand, [4, 10, 16, 1024]);
      return mk(
        `byte:${k}`,
        { ru: `В одном байте ${k} ${ruPl(k, "бит", "бита", "бит")}`, kk: `Бір байтта ${k} бит бар` },
        k === 8,
        { ru: "1 байт = 8 бит: это ряд из восьми «лампочек».", kk: "1 байт = 8 бит: бұл сегіз «шамнан» тұратын қатар." },
        HINT_STEP_FACTOR,
      );
    }
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const f = truth ? 1024 : pick(rand, [1000, 100, 8, 1048576]);
    return mk(
      `step:${hi}:${f}`,
      { ru: `1 ${NAMES[hi]} = ${amt(f, lo).ru}`, kk: `1 ${NAMES[hi]} = ${amt(f, lo).kk}` },
      f === 1024,
      {
        ru: `Верно только так: 1 ${NAMES[hi]} = ${ra(1024, lo)} (2¹⁰). Множитель 1000 — частая ловушка.`,
        kk: `Дұрысы тек былай: 1 ${NAMES[hi]} = 1024 ${NAMES[lo]} (2¹⁰). 1000 көбейткіші — жиі кездесетін тұзақ.`,
      },
      HINT_STEP_FACTOR,
    );
  }

  if (level === 2) {
    if (rand() < 0.5) {
      const n = int(rand, 2, 9);
      const x = truth ? n * 8192 : pick(rand, [n * 1024, n * 8000, n * 8, n * 128]);
      return mk(
        `kb2bits:${n}:${x}`,
        { ru: `${n} Кбайт = ${ra(x, 0)}`, kk: `${n} Кбайт = ${num(x)} бит` },
        x === n * 8192,
        {
          ru: `${n} Кбайт = ${n} · 1024 = ${ra(n * 1024, 1)} = ${num(n * 1024)} · 8 = ${ra(n * 8192, 0)}.`,
          kk: `${n} Кбайт = ${n} · 1024 = ${num(n * 1024)} байт = ${num(n * 1024)} · 8 = ${num(n * 8192)} бит.`,
        },
        HINT_TWO_STEPS,
      );
    }
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 2, 9);
    const m = truth ? n * 1000 + int(rand, 1, 24 * n - 1) : n * 1024 + int(rand, 1, 24 * n);
    return mk(
      `cmp:${hi}:${n}:${m}`,
      { ru: `${n} ${NAMES[hi]} больше, чем ${amt(m, lo).ru}`, kk: `${n} ${NAMES[hi]} ${amt(m, lo).kk} шамасынан үлкен` },
      n * 1024 > m,
      {
        ru: `${n} ${NAMES[hi]} = ${ra(n * 1024, lo)}, а это ${n * 1024 > m ? "больше" : "меньше"}, чем ${ra(m, lo)}.`,
        kk: `${n} ${NAMES[hi]} = ${num(n * 1024)} ${NAMES[lo]}, ал бұл ${num(m)} ${NAMES[lo]} шамасынан ${n * 1024 > m ? "үлкен" : "кіші"}.`,
      },
      HINT_SAME_UNIT,
    );
  }

  // C: степени двойки
  if (rand() < 0.5) {
    const u = pick(rand, [2, 3, 4] as const);
    const k = int(rand, 1, 6);
    const x = truth ? EXP[u] + k : EXP[u] + k + pick(rand, [-3, -1, 1, 3]);
    return mk(
      `pow:${u}:${k}:${x}`,
      { ru: `${2 ** k} ${NAMES[u]} = 2${sup(x)} бит`, kk: `${2 ** k} ${NAMES[u]} = 2${sup(x)} бит` },
      x === EXP[u] + k,
      {
        ru: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, ${2 ** k} = 2${sup(k)}; показатели складываем: ${EXP[u]} + ${k} = ${EXP[u] + k}.`,
        kk: `1 ${NAMES[u]} = 2${sup(EXP[u])} бит, ${2 ** k} = 2${sup(k)}; көрсеткіштерді қосамыз: ${EXP[u]} + ${k} = ${EXP[u] + k}.`,
      },
      HINT_POW,
    );
  }
  const u = pick(rand, [2, 3, 4] as const);
  const k = int(rand, 1, 8);
  const claim = truth ? k : k + pick(rand, [-1, 1, 3]);
  return mk(
    `pow2:${u}:${k}:${claim}`,
    { ru: `2${sup(EXP[u] + k)} бит = ${2 ** claim} ${NAMES[u]}`, kk: `2${sup(EXP[u] + k)} бит = ${2 ** claim} ${NAMES[u]}` },
    claim === k,
    {
      ru: `2${sup(EXP[u] + k)} : 2${sup(EXP[u])} = 2${sup(k)} = ${2 ** k} ${NAMES[u]}.`,
      kk: `2${sup(EXP[u] + k)} : 2${sup(EXP[u])} = 2${sup(k)} = ${2 ** k} ${NAMES[u]}.`,
    },
    HINT_POW,
  );
}

// ---------- Пары ----------

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1) {
    const u = int(rand, 1, 5);
    const f = u === 1 ? 8 : 1024;
    return { id: `p:${SKILL}:step:${u}`, skill: SKILL, level, left: `1 ${NAMES[u]}`, right: amtT(f, u - 1) };
  }
  if (level === 2) {
    if (rand() < 0.3) {
      const n = int(rand, 2, 30);
      return { id: `p:${SKILL}:b2bit:${n}`, skill: SKILL, level, left: amtT(n, 1), right: amtT(n * 8, 0) };
    }
    const hi = int(rand, 2, 5);
    const n = int(rand, 2, 9);
    return { id: `p:${SKILL}:down:${hi}:${n}`, skill: SKILL, level, left: `${n} ${NAMES[hi]}`, right: amtT(n * 1024, hi - 1) };
  }
  const u = pick(rand, [2, 3, 4] as const);
  const k = int(rand, 1, 7);
  return { id: `p:${SKILL}:pow:${u}:${k}`, skill: SKILL, level, left: `${2 ** k} ${NAMES[u]}`, right: `2${sup(EXP[u] + k)} бит` };
}

// ---------- Короткие вопросы ----------

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const mk = (key: string, prompt: L, answer: number, explanation: string, hint: L): ShortQuestion => ({
    id: `q:${SKILL}:${key}`,
    skill: SKILL,
    level,
    prompt,
    answer: String(answer),
    mode: "number",
    explanation: same(explanation),
    hint,
  });
  if (level === 1) {
    const kind = pick(rand, ["down", "up", "bits"] as const);
    if (kind === "bits") {
      const n = int(rand, 2, 24);
      return mk(`bits:${n}`, { ru: `${amt(n, 1).ru} = ? бит`, kk: `${n} байт = ? бит` }, n * 8, `${n} · 8 = ${n * 8}`, HINT_BITS);
    }
    const hi = int(rand, 2, 5);
    const lo = hi - 1;
    const n = int(rand, 2, 12);
    if (kind === "down") return mk(`down:${hi}:${n}`, same(`${n} ${NAMES[hi]} = ? ${NAMES[lo]}`), n * 1024, `${n} · 1024 = ${num(n * 1024)}`, HINT_DOWN);
    return mk(`up:${hi}:${n}`, { ru: `${amt(n * 1024, lo).ru} = ? ${NAMES[hi]}`, kk: `${amt(n * 1024, lo).kk} = ? ${NAMES[hi]}` }, n, `${num(n * 1024)} : 1024 = ${n}`, HINT_UP);
  }
  if (level === 2) {
    if (rand() < 0.5) {
      const n = int(rand, 2, 12);
      return mk(`bits2kb:${n}`, { ru: `${ra(n * 8192, 0)} = ? Кбайт`, kk: `${num(n * 8192)} бит = ? Кбайт` }, n, `${num(n * 8192)} : 8 : 1024 = ${n}`, HINT_TWO_STEPS);
    }
    const hi = int(rand, 3, 5);
    const n = int(rand, 2, 9);
    return mk(`down2:${hi}:${n}`, same(`${n} ${NAMES[hi]} = ? ${NAMES[hi - 2]}`), n * 1048576, `${n} · 1024 · 1024 = ${num(n * 1048576)}`, HINT_TWO_STEPS);
  }
  if (rand() < 0.5) {
    const u = pick(rand, [2, 3, 4] as const);
    const k = int(rand, 1, 8);
    return mk(`pow-bits2:${u}:${k}`, same(`2${sup(EXP[u] + k)} бит = ? ${NAMES[u]}`), 2 ** k, `2${sup(EXP[u] + k)} : 2${sup(EXP[u])} = 2${sup(k)} = ${2 ** k}`, HINT_POW);
  }
  const u = pick(rand, [1, 2, 3, 4] as const);
  const k = int(rand, 1, 7);
  return mk(`pow-exp:${u}:${k}`, { ru: `${amt(2 ** k, u).ru} = 2ˣ бит, x = ?`, kk: `${2 ** k} ${NAMES[u]} = 2ˣ бит, x = ?` }, EXP[u] + k, `${EXP[u]} + ${k} = ${EXP[u] + k}`, HINT_POW);
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
