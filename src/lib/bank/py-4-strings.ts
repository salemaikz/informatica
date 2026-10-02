import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.strings: генератор программ со строками. Результат всегда считает код (функции pySlice, pyCount
// и т. д. повторяют семантику Python), неверные варианты — типичные ошибки (счёт с единицы, правая граница среза
// включена, «строка изменилась», перекрывающиеся вхождения и т. д.).
// Проверка: scripts/out/py-4-strings/verify-bank.ts прогоняет сгенерированные программы в python3 и сравнивает вывод.
// Тексты после переменных чисел — без падежных окончаний: код всегда показывается в сцене или в самом условии.

const SKILL = "py.strings";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const l = (ru: string, kk: string): L => ({ ru, kk });
const code = (...lines: string[]): Scene => ({ kind: "code", lang: "python", lines });
const slug = (...p: (string | number)[]) => p.join("_").replace(/[^A-Za-z0-9_]/g, "-");
/** Русское согласование с числом: plural(3, "символ", "символа", "символов") → «3 символа». */
const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  return `${n} ${a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`;
};
const ruSym = (n: number) => plural(n, "символ", "символа", "символов");
const ruTimes = (n: number) => plural(n, "раз", "раза", "раз");

// ---------- Семантика Python для строк ----------

type Val = string | number | boolean;

/** Как Python печатает значение внутри кода (repr). */
const repr = (v: Val): string => (typeof v === "string" ? `'${v}'` : typeof v === "boolean" ? (v ? "True" : "False") : String(v));
/** Как print выводит значение. */
const show = (v: Val): string => (typeof v === "string" ? v : repr(v));

interface Sl {
  a?: number;
  b?: number;
  st?: number;
}

/** Индексы среза s[a:b:st] — как PySlice_AdjustIndices. */
function sliceIndices(n: number, { a, b, st = 1 }: Sl): number[] {
  const out: number[] = [];
  if (st > 0) {
    const lo = a === undefined ? 0 : a < 0 ? Math.max(a + n, 0) : Math.min(a, n);
    const hi = b === undefined ? n : b < 0 ? Math.max(b + n, 0) : Math.min(b, n);
    for (let i = lo; i < hi; i += st) out.push(i);
  } else {
    const lo = a === undefined ? n - 1 : a < 0 ? Math.max(a + n, -1) : Math.min(a, n - 1);
    const hi = b === undefined ? -1 : b < 0 ? Math.max(b + n, -1) : Math.min(b, n - 1);
    for (let i = lo; i > hi; i += st) out.push(i);
  }
  return out;
}
export const pySlice = (s: string, sp: Sl): string =>
  sliceIndices(s.length, sp)
    .map((i) => s[i])
    .join("");
const slText = ({ a, b, st }: Sl) => `[${a ?? ""}:${b ?? ""}${st !== undefined ? `:${st}` : ""}]`;
const reverse = (s: string) => s.split("").reverse().join("");
const replaceAll = (s: string, x: string, y: string) => s.split(x).join(y);
/** str.count: непересекающиеся вхождения. */
function pyCount(s: string, sub: string): number {
  let k = 0;
  let i = 0;
  for (;;) {
    const j = s.indexOf(sub, i);
    if (j < 0) return k;
    k++;
    i = j + sub.length;
  }
}
/** Все вхождения, включая перекрывающиеся (типичная ошибка при count). */
function overlapCount(s: string, sub: string): number {
  let k = 0;
  for (let i = 0; i + sub.length <= s.length; i++) if (s.startsWith(sub, i)) k++;
  return k;
}

// ---------- Данные ----------

const WORDS = [
  "python", "robot", "banana", "keyboard", "monitor", "program", "internet", "computer", "algorithm", "variable",
  "student", "kazakhstan", "information", "network", "printer", "pixel", "coding", "binary", "mouse", "pointer",
  "message", "display", "memory", "database", "function", "loop", "string", "letter", "number", "browser",
];
const PHRASES = ["red apple", "hello world", "a b c", "big data", "exam day", "python 3", "i love code", "just one more"];
const SENTENCES = ["red green blue", "big data cloud", "learn python today", "one two three four", "good luck on exam", "fast and simple"];
const PALINDROMES = ["level", "radar", "noon", "civic", "refer", "kayak", "madam", "abba", "abcba", "12321", "1221", "anna"];
const NOT_PALINDROMES = ["robot", "python", "banana", "data", "code", "abcab", "12345", "annas", "level1", "radars"];
const ALPHA = "abcdefghijklmnopqrstuvwxyz";
const VOWELS = "aeiou";

const pickWord = (rand: Rand, min: number, max: number, pred: (w: string) => boolean = () => true) => {
  const pool = WORDS.filter((w) => w.length >= min && w.length <= max && pred(w));
  return pick(rand, pool.length ? pool : WORDS);
};
const hasRepeat = (w: string) => new Set(w).size < w.length;
const lettersOf = (w: string) => [...new Set(w.split(""))];

// ---------- Подсказки (не выдают ответ) ----------

const HINT_IDX = l(
  "Нумерация символов идёт с нуля: первый символ — s[0]. Выпиши индексы по порядку, пока не дойдёшь до нужного.",
  "Символдар нөлден нөмірленеді: бірінші символ — s[0]. Керегіне жеткенше индекстерді ретімен жаз.",
);
const HINT_NEG = l(
  "Минус считает с конца: s[-1] — последний символ, s[-2] — предпоследний. Отсчитай нужное число символов с правого края.",
  "Минус соңынан санайды: s[-1] — соңғы символ, s[-2] — соңғысының алдындағысы. Оң жақ шетінен керекті санда символ санап шық.",
);
const HINT_LEN = l(
  "len считает все символы подряд, и пробелы тоже. Посчитай символы по одному.",
  "len барлық символды қатарынан санайды, бос орындарды да. Символдарды бір-бірлеп сана.",
);
const HINT_CASE = l(
  "upper() делает все буквы заглавными, lower() — строчными. Какой метод вызван и какие буквы уже стоят в строке?",
  "upper() барлық әріпті бас әріп, lower() — кіші әріп етеді. Қай әдіс шақырылған және жолда қандай әріптер тұр?",
);
const HINT_SLICE = l(
  "В срезе s[a:b] берутся индексы от a до b, но сам индекс b не входит. Выпиши индексы и буквы под ними, потом склей.",
  "s[a:b] тілімінде a индексінен b индексіне дейінгі символдар алынады, бірақ b индексінің өзі кірмейді. Индекстерді және олардың астындағы әріптерді жазып, сосын жалға.",
);
const HINT_STEP = l(
  "Третье число среза — шаг: 2 берёт каждый второй символ, -1 идёт справа налево. Если начало не указано, при шаге 2 оно равно 0.",
  "Тілімнің үшінші саны — қадам: 2 әр екінші символды алады, -1 оңнан солға жүреді. Басы көрсетілмесе, 2 қадамында ол 0-ге тең.",
);
const HINT_FIND = l(
  "find возвращает индекс первого найденного символа (счёт с нуля) или -1, если такого символа в строке нет.",
  "find бірінші табылған символдың индексін (санау нөлден) қайтарады, ал жолда ондай символ жоқ болса — -1.",
);
const HINT_COUNT = l(
  "count считает все вхождения. Пройди строку слева направо и отмечай каждое совпадение.",
  "count барлық кездесуді санайды. Жолды солдан оңға қарай өтіп, әр сәйкестікті белгіле.",
);
const HINT_COUNT_SUB = l(
  "count ищет вхождения слева направо и не считает кусок, который заходит на уже найденный. Найди первое вхождение и продолжай поиск после него.",
  "count кездесулерді солдан оңға қарай іздейді және бұрын табылғанмен қиылысатын бөлікті санамайды. Бірінші кездесуді тап та, іздеуді содан кейін жалғастыр.",
);
const HINT_REPLACE = l(
  "replace заменяет все подходящие символы, а не только первый. Просмотри строку слева направо и замени каждую нужную букву.",
  "replace барлық сәйкес символды ауыстырады, тек біріншісін емес. Жолды солдан оңға қарай қарап, әр керекті әріпті ауыстыр.",
);
const HINT_ORD = l(
  "Коды букв идут подряд, как в алфавите: после 'a' (97) идёт 'b' (98), потом 'c' (99) и так далее. Отсчитай от известного кода.",
  "Әріптердің кодтары әліпбидегідей қатар жүреді: 'a' (97) әрпінен кейін 'b' (98), сосын 'c' (99) және т. б. Белгілі кодтан бастап санап шық.",
);
const HINT_CHAIN = l(
  "Выполняй команды по одной, слева направо: сначала срез (индекс b не входит), потом каждый следующий метод или срез к уже полученной строке.",
  "Командаларды бір-бірлеп, солдан оңға қарай орында: алдымен тілім (b индексі кірмейді), сосын әр келесі әдісті немесе тілімді алынған жолға қолдан.",
);
const HINT_PALIN = l(
  "Палиндром читается одинаково в обе стороны. Выпиши строку задом наперёд (s[::-1]) и сравни с исходной буква за буквой.",
  "Палиндром екі жағынан да бірдей оқылады. Жолды керісінше жаз (s[::-1]) да, бастапқысымен әріптен әріпке салыстыр.",
);
const HINT_NEXT = l(
  "Сначала найди find — индекс первого вхождения (счёт с нуля). Потом подставь это число в индекс или срез.",
  "Алдымен find — бірінші кездесудің индексін (санау нөлден) тап. Сосын осы санды индекске немесе тілімге қой.",
);
const HINT_STRIP = l(
  "strip() убирает пробелы только по краям строки, а len считает все символы, которые остались.",
  "strip() бос орындарды тек жолдың шеттерінен алып тастайды, ал len қалған барлық символды санайды.",
);
const HINT_SPLIT = l(
  "split() режет строку по пробелам на слова, join склеивает слова через разделитель. Выпиши слова по порядку.",
  "split() жолды бос орындар бойынша сөздерге бөледі, join сөздерді бөлгіш арқылы жалғайды. Сөздерді ретімен жаз.",
);
const HINT_ITER = l(
  "Тело цикла выполняется один раз на каждый символ, по которому идёт цикл. Сначала найди эту строку, потом посчитай её символы.",
  "Цикл денесі цикл өтетін әр символға бір рет орындалады. Алдымен сол жолды тап, сосын оның символдарын сана.",
);
const HINT_LOOP = l(
  "Пройди цикл по символам по одному и следи за счётчиком: он меняется только тогда, когда условие в if верно.",
  "Цикл бойынша символдарды бір-бірлеп өтіп, санауышты бақыла: ол тек if ішіндегі шарт ақиқат болғанда өзгереді.",
);
const HINT_BUILD = l(
  "Выпиши, как меняется строка t после каждого символа: что дописывается и с какой стороны.",
  "Әр символдан кейін t жолының қалай өзгеретінін жаз: не жазылады және қай жағынан.",
);
const HINT_CAESAR = l(
  "chr(ord(ch) + k) даёт букву на k шагов дальше по алфавиту. Сдвинь каждую букву отдельно и склей результат.",
  "chr(ord(ch) + k) әліпби бойынша k қадам әрі тұрған әріпті береді. Әр әріпті жеке жылжытып, нәтижені жалға.",
);
const HINT_IMMUT = l(
  "Строки неизменяемы: присвоить символу значение нельзя. Ошибку даёт и номер за пределами строки. Срезы и методы ошибок не дают.",
  "Жолдар өзгермейді: символға мән меншіктеуге болмайды. Жолдан тыс нөмір де қате береді. Тілімдер мен әдістер қате бермейді.",
);

// ---------- Варианты ответа ----------

interface Cand {
  value: Val;
  why: L;
}

/** Запасные неверные варианты, если кандидатов мало. */
function fallback(correct: Val): Cand[] {
  if (typeof correct === "number") {
    const why = l("Ошибка в счёте на один-два шага: пройди программу по строкам.", "Санауда бір-екі қадамға қателесу: программаны жол-жолымен өткіз.");
    return [correct + 1, correct - 1, correct + 2, correct - 2, correct * 2].filter((v) => v >= -1).map((value) => ({ value, why }));
  }
  if (typeof correct === "string" && correct.length > 1) {
    const lost = l("Лишний или потерянный символ: пройди выражение по шагам.", "Артық немесе жоғалған символ: өрнекті қадам-қадаммен өткіз.");
    return [
      { value: correct.slice(1), why: lost },
      { value: correct.slice(0, -1), why: lost },
      { value: reverse(correct), why: l("Нарушен порядок символов.", "Символдар реті бұзылған.") },
      { value: correct + correct[0], why: lost },
    ];
  }
  if (typeof correct === "string") {
    const other = l("Другой символ: пройди индексы по порядку.", "Басқа символ: индекстерді ретімен өткіз.");
    return ALPHA.split("").map((value) => ({ value, why: other }));
  }
  return [];
}

/** Верный + (total − 1) уникальных неверных с whyWrong, всё перемешано. */
function buildOptions(rand: Rand, correct: Val, cands: Cand[], total = 4) {
  const seen = new Set<string>([show(correct)]);
  const wrong: Cand[] = [];
  for (const c of [...shuffle(cands, rand), ...fallback(correct)]) {
    if (wrong.length >= total - 1) break;
    const key = show(c.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    wrong.push(c);
  }
  const all = shuffle([{ value: correct, why: null as L | null }, ...wrong], rand);
  return {
    options: all.map((x) => show(x.value)),
    correct: all.findIndex((x) => x.value === correct),
    whyWrong: all.map((x) => x.why),
  };
}

const OUT = l("Что выведет программа?", "Программа не шығарады?");
const OUT_NUM = l("Что выведет программа? Введи число.", "Программа не шығарады? Санды енгіз.");
const OUT_STR = l("Что выведет программа? Введи ответ без кавычек.", "Программа не шығарады? Жауапты тырнақшасыз енгіз.");

interface QSpec {
  id: string;
  level: Level;
  lines: string[];
  value: Val;
  cands: Cand[];
  hint: L;
  explanation: L;
  /** Вероятность поля ввода (если ответ подходит для ввода). */
  pInput?: number;
}

/** Ответ можно ввести с клавиатуры: число или строка без заглавных букв (ввод регистр не различает). */
const typable = (v: Val) => typeof v === "number" || (typeof v === "string" && v.length > 0 && v === v.toLowerCase() && v.trim() === v && !/[.,!?;:]$/.test(v));

function makeQuestion(rand: Rand, s: QSpec): QuestionStep {
  const scene = code(...s.lines);
  if (typable(s.value) && rand() < (s.pInput ?? 0.35)) {
    return {
      id: s.id,
      type: "input",
      skill: SKILL,
      level: s.level,
      prompt: typeof s.value === "number" ? OUT_NUM : OUT_STR,
      scene,
      answers: [show(s.value)],
      mode: typeof s.value === "number" ? "number" : "text",
      hint: s.hint,
      explanation: s.explanation,
    } satisfies InputStep;
  }
  if (typeof s.value === "boolean") {
    const wrong = s.cands[0]?.why ?? l("Пройди выражение по шагам.", "Өрнекті қадам-қадаммен өткіз.");
    const options = shuffle(["True", "False"], rand);
    const right = show(s.value);
    return {
      id: s.id,
      type: "choice",
      skill: SKILL,
      level: s.level,
      prompt: OUT,
      scene,
      options,
      correct: options.indexOf(right),
      whyWrong: options.map((o) => (o === right ? null : wrong)),
      hint: s.hint,
      explanation: s.explanation,
    } satisfies ChoiceStep;
  }
  const o = buildOptions(rand, s.value, s.cands);
  return {
    id: s.id,
    type: "choice",
    skill: SKILL,
    level: s.level,
    prompt: OUT,
    scene,
    ...o,
    hint: s.hint,
    explanation: s.explanation,
  } satisfies ChoiceStep;
}

// ---------- Выражения: общий материал для заданий, утверждений, пар и коротких вопросов ----------

interface ExprItem {
  /** Идентификатор содержимого (без «:» и «#»). */
  key: string;
  /** Строка, к которой применяется выражение (для сцены: s = '…'). */
  w: string;
  /** Выражение Python над именем строки (переменной или литералом). */
  mk: (sv: string) => string;
  value: Val;
  wrongs: Cand[];
  hint: L;
  explanation: L;
  /** Особая программа вместо стандартной («s = …» и print выражения). */
  lines?: string[];
  /** Выражение не использует строку s (ord, chr): в условии выводится как есть. */
  standalone?: boolean;
}

const cl = (w: string) => `'${w}'`;
const idxList = (w: string, upto: number) =>
  w
    .slice(0, upto + 1)
    .split("")
    .map((ch, j) => `s[${j}] = ${ch}`)
    .join(", ");

function kIdx(rand: Rand): ExprItem {
  const w = pickWord(rand, 5, 9);
  const i = int(rand, 1, w.length - 2);
  const c = w[i];
  return {
    key: slug("idx", w, i),
    w,
    mk: (sv) => `${sv}[${i}]`,
    value: c,
    wrongs: [
      { value: w[i - 1], why: l(`Это ${i}-я буква по счёту, а индекс ${i} — это буква номер ${i + 1}: нумерация идёт с нуля.`, `Бұл санағанда ${i}-әріп, ал ${i} индексі — ${i + 1}-әріп: нөмірлеу нөлден басталады.`) },
      { value: w[i + 1], why: l(`Это следующий символ, s[${i + 1}]. Нужен символ с индексом ${i}.`, `Бұл келесі символ, s[${i + 1}]. ${i} индексі бар символ керек.`) },
      { value: w[0], why: l("Это первый символ s[0]: индекс нужно отсчитать дальше.", "Бұл бірінші символ s[0]: индексті әрі қарай санау керек.") },
      { value: w[w.length - 1], why: l("Это последний символ строки, а не символ с нужным индексом.", "Бұл жолдың соңғы символы, керек индексі бар символ емес.") },
    ],
    hint: HINT_IDX,
    explanation: l(`Нумерация идёт с нуля: ${idxList(w, i)}. Значит, s[${i}] — это «${c}».`, `Нөмірлеу нөлден басталады: ${idxList(w, i)}. Демек, s[${i}] — «${c}» символы.`),
  };
}

function kNeg(rand: Rand, level: Level): ExprItem {
  const w = pickWord(rand, 5, 9);
  const k = level === 1 ? int(rand, 1, 2) : int(rand, 2, 4);
  const n = w.length;
  const c = w[n - k];
  const list = Array.from({ length: k }, (_, j) => `s[-${j + 1}] = ${w[n - j - 1]}`).join(", ");
  const wrongs: Cand[] = [
    { value: w[k], why: l(`Минус не учтён: взят символ с начала, s[${k}]. Отрицательный индекс считает с конца.`, `Минус ескерілмеген: символ басынан алынған, s[${k}]. Теріс индекс соңынан санайды.`) },
    { value: w[n - k - 1], why: l(`Взят символ на одну позицию левее. s[-1] — последний, s[-2] — предпоследний, то есть s[-${k}] — ${k}-й с конца.`, `Бір орын солға қарай символ алынған. s[-1] — соңғы, s[-2] — соңғысының алдындағысы, яғни s[-${k}] — соңынан санағанда ${k}-символ.`) },
    { value: w[k - 1], why: l(`Это символ с начала, s[${k - 1}]. Отрицательный индекс считает с конца.`, `Бұл басынан алынған символ, s[${k - 1}]. Теріс индекс соңынан санайды.`) },
  ];
  if (k > 1) wrongs.push({ value: w[n - k + 1], why: l(`Взят символ на одну позицию правее: s[-${k - 1}]. Нужен s[-${k}].`, `Бір орын оңға қарай символ алынған: s[-${k - 1}]. s[-${k}] керек.`) });
  return {
    key: slug("neg", w, k),
    w,
    mk: (sv) => `${sv}[-${k}]`,
    value: c,
    wrongs,
    hint: HINT_NEG,
    explanation: l(`Отрицательный индекс считает с конца: ${list}. Значит, s[-${k}] — это «${c}».`, `Теріс индекс соңынан санайды: ${list}. Демек, s[-${k}] — «${c}» символы.`),
  };
}

function kLen(rand: Rand, level: Level): ExprItem {
  const w = level === 1 ? pickWord(rand, 4, 10) : pick(rand, PHRASES);
  const n = w.length;
  const spaces = w.split(" ").length - 1;
  const wrongs: Cand[] = [
    { value: n - 1, why: l(`Это последний индекс, а len возвращает количество символов.`, `Бұл соңғы индекс, ал len символдар санын қайтарады.`) },
    { value: n + 1, why: l(`Лишний символ: пересчитай по одному.`, `Артық символ: бір-бірлеп қайта сана.`) },
  ];
  if (spaces) {
    wrongs.unshift({ value: n - spaces, why: l(`Пробелы тоже символы: в этой строке их ${spaces}, и они входят в длину.`, `Бос орындар да — символ: бұл жолда олар ${spaces}, және олар ұзындыққа кіреді.`) });
    wrongs.push({ value: spaces + 1, why: l(`Это количество слов, а len считает символы.`, `Бұл сөздер саны, ал len символдарды санайды.`) });
  }
  return {
    key: slug("len", w),
    w,
    mk: (sv) => `len(${sv})`,
    value: n,
    wrongs,
    hint: HINT_LEN,
    explanation: l(`В строке ${ruSym(n)}${spaces ? " (пробелы тоже считаются)" : ""}, поэтому len(s) = ${n}.`, `Жолда ${n} символ бар${spaces ? " (бос орындар да есептеледі)" : ""}, сондықтан len(s) = ${n}.`),
  };
}

function kCase(rand: Rand): ExprItem {
  const base = pickWord(rand, 4, 8);
  const up = rand() < 0.5;
  const w = up ? base : base[0].toUpperCase() + base.slice(1);
  const value = up ? w.toUpperCase() : w.toLowerCase();
  const swapped = w
    .split("")
    .map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
    .join("");
  const wrongs: Cand[] = up
    ? [
        { value: w, why: l("Буквы остались строчными, но upper() делает все буквы заглавными.", "Әріптер кіші күйінде қалған, ал upper() барлық әріпті бас әріп етеді.") },
        { value: w[0].toUpperCase() + w.slice(1), why: l("Заглавной стала только первая буква, а upper() меняет все буквы.", "Тек бірінші әріп бас әріп болған, ал upper() барлық әріпті өзгертеді.") },
      ]
    : [
        { value: w.toUpperCase(), why: l("Это результат upper(), а в программе вызван lower().", "Бұл upper() нәтижесі, ал программада lower() шақырылған.") },
        { value: w, why: l("Первая буква осталась заглавной, но lower() делает все буквы строчными.", "Бірінші әріп бас әріп болып қалған, ал lower() барлық әріпті кіші әріп етеді.") },
        { value: swapped, why: l("Регистр поменян на противоположный у каждой буквы, а lower() делает все буквы строчными.", "Әр әріптің регистрі қарама-қарсыға ауысқан, ал lower() барлық әріпті кіші әріп етеді.") },
      ];
  const m = up ? "upper" : "lower";
  return {
    key: slug("case", w, m),
    w,
    mk: (sv) => `${sv}.${m}()`,
    value,
    wrongs,
    hint: HINT_CASE,
    explanation: up
      ? l(`upper() делает все буквы заглавными: «${value}». Сама строка s при этом не меняется.`, `upper() барлық әріпті бас әріп етеді: «${value}». Ал s жолының өзі өзгермейді.`)
      : l(`lower() делает все буквы строчными: «${value}». Сама строка s при этом не меняется.`, `lower() барлық әріпті кіші әріп етеді: «${value}». Ал s жолының өзі өзгермейді.`),
  };
}

function kSlice1(rand: Rand): ExprItem {
  const w = pickWord(rand, 6, 10);
  const a = int(rand, 1, w.length - 4);
  const b = int(rand, a + 2, Math.min(w.length - 1, a + 4));
  const v = w.slice(a, b);
  const wrongs: Cand[] = [
    { value: w.slice(a, b + 1), why: l(`Правая граница включена, но в срезе s[${a}:${b}] индекс ${b} не входит.`, `Оң жақ шекара қосылған, ал s[${a}:${b}] тілімінде ${b} индексі кірмейді.`) },
    { value: w.slice(a - 1, b - 1), why: l(`Счёт начат с единицы: срез начинается с индекса ${a}, то есть с буквы «${w[a]}», а не с «${w[a - 1]}».`, `Санау бірден басталған: тілім ${a} индексінен, яғни «${w[a]}» әрпінен басталады, «${w[a - 1]}» әрпінен емес.`) },
    { value: w.slice(a + 1, b + 1), why: l("Срез сдвинут на одну позицию вправо: начало среза — индекс " + a + ".", "Тілім бір орын оңға жылжытылған: тілімнің басы — " + a + " индексі.") },
    { value: w.slice(a, b - 1), why: l(`Потерян последний символ: в срез входят индексы от ${a} до ${b - 1}.`, `Соңғы символ жоғалған: тілімге ${a} индексінен ${b - 1} индексіне дейін кіреді.`) },
  ];
  const chars = w
    .slice(a, b)
    .split("")
    .map((ch, j) => `s[${a + j}] = ${ch}`)
    .join(", ");
  return {
    key: slug("slice1", w, a, b),
    w,
    mk: (sv) => `${sv}[${a}:${b}]`,
    value: v,
    wrongs,
    hint: HINT_SLICE,
    explanation: l(
      `Берём индексы от ${a} до ${b - 1} (индекс ${b} не входит): ${chars}. Склеиваем: «${v}».`,
      `${a} индексінен ${b - 1} индексіне дейін аламыз (${b} индексі кірмейді): ${chars}. Жалғаймыз: «${v}».`,
    ),
  };
}

/** Срезы с пропущенными границами и шагом. */
function kSlice2(rand: Rand): ExprItem {
  const w = pickWord(rand, 6, 10);
  const n = w.length;
  const form = int(rand, 0, 6);
  let sp: Sl;
  let alts: { sp: Sl; why: L }[];
  let explain: (v: string) => L;
  let hint = HINT_SLICE;
  if (form === 0) {
    const b = int(rand, 2, n - 2);
    sp = { b };
    alts = [
      { sp: { b: b + 1 }, why: l(`Правая граница включена, но индекс ${b} в срез не входит.`, `Оң жақ шекара қосылған, ал ${b} индексі тілімге кірмейді.`) },
      { sp: { a: b }, why: l(`Взят остаток строки, а нужно начало: срез [:${b}] идёт от начала.`, `Жолдың қалған бөлігі алынған, ал басы керек: [:${b}] тілімі басынан жүреді.`) },
      { sp: { a: 1, b }, why: l(`Потеряна первая буква: срез без начала идёт с индекса 0.`, `Бірінші әріп жоғалған: басы жоқ тілім 0 индексінен басталады.`) },
    ];
    explain = (v) => l(`s[:${b}] — от начала до индекса ${b}, сам индекс не берём: индексы 0…${b - 1}. Получается «${v}».`, `s[:${b}] — басынан ${b} индексіне дейін, индекстің өзін алмаймыз: 0…${b - 1} индекстері. «${v}» шығады.`);
  } else if (form === 1) {
    const a = int(rand, 2, n - 2);
    sp = { a };
    alts = [
      { sp: { a: a + 1 }, why: l(`Срез начат на одну позицию позже: s[${a}:] включает и индекс ${a}.`, `Тілім бір орын кеш басталған: s[${a}:] ${a} индексін де қамтиды.`) },
      { sp: { b: a }, why: l(`Взято начало строки, а нужен остаток: s[${a}:] идёт до конца.`, `Жолдың басы алынған, ал қалған бөлігі керек: s[${a}:] соңына дейін жүреді.`) },
      { sp: { a: a - 1 }, why: l(`Срез начат на одну позицию раньше: он начинается с индекса ${a}.`, `Тілім бір орын ертерек басталған: ол ${a} индексінен басталады.`) },
    ];
    explain = (v) => l(`s[${a}:] — от индекса ${a} до конца строки. Получается «${v}».`, `s[${a}:] — ${a} индексінен жолдың соңына дейін. «${v}» шығады.`);
  } else if (form === 2) {
    const k = int(rand, 2, 4);
    sp = { a: -k };
    alts = [
      { sp: { b: k }, why: l(`Взяты первые символы, а минус считает с конца: нужны последние.`, `Алғашқы символдар алынған, ал минус соңынан санайды: соңғылары керек.`) },
      { sp: { a: -k - 1 }, why: l(`Взят лишний символ: s[-${k}:] — ровно ${k} последних.`, `Артық символ алынған: s[-${k}:] — дәл соңғы ${k} символ.`) },
      { sp: { a: k }, why: l(`Минус не учтён: срез идёт от индекса ${k} с начала.`, `Минус ескерілмеген: тілім басынан ${k} индексінен жүреді.`) },
    ];
    explain = (v) => l(`s[-${k}:] — последние ${k} символов (счёт с конца до самого конца). Получается «${v}».`, `s[-${k}:] — соңғы ${k} символ (соңынан санап, ең соңына дейін). «${v}» шығады.`);
  } else if (form === 3) {
    const k = int(rand, 2, 4);
    sp = { b: -k };
    alts = [
      { sp: { a: -k }, why: l(`Взяты последние символы, а нужны все, кроме последних.`, `Соңғы символдар алынған, ал соңғылардан басқасының бәрі керек.`) },
      { sp: { b: k }, why: l(`Минус не учтён: срез идёт до индекса ${k} с начала.`, `Минус ескерілмеген: тілім басынан ${k} индексіне дейін жүреді.`) },
      { sp: { b: -k + 1 }, why: l(`Отброшено на один символ меньше: s[:-${k}] убирает ровно ${k} последних.`, `Бір символ аз тасталған: s[:-${k}] дәл соңғы ${k} символды алып тастайды.`) },
    ];
    explain = (v) => l(`s[:-${k}] — всё, кроме последних ${k} символов. Получается «${v}».`, `s[:-${k}] — соңғы ${k} символдан басқасының бәрі. «${v}» шығады.`);
  } else if (form === 4) {
    sp = { st: -1 };
    alts = [
      { sp: {}, why: l("Строка осталась прежней, а шаг -1 разворачивает её.", "Жол бұрынғы күйінде қалған, ал -1 қадамы оны төңкереді.") },
      { sp: { a: n - 2, st: -1 }, why: l("Потеряна последняя буква: s[::-1] начинает с самого конца.", "Соңғы әріп жоғалған: s[::-1] ең соңынан бастайды.") },
      { sp: { b: -1, st: -1 }, why: l("Срез [:-1:-1] пуст, а нужен полный переворот.", "[:-1:-1] тілімі бос, ал толық төңкеру керек.") },
      { sp: { st: 2 }, why: l("Это шаг 2 (через один символ), а нужен шаг -1.", "Бұл 2 қадамы (біреуін аралатып), ал -1 қадамы керек.") },
    ];
    explain = (v) => l(`Шаг -1 идёт справа налево: s[::-1] — строка наоборот: «${v}».`, `-1 қадамы оңнан солға жүреді: s[::-1] — жол керісінше: «${v}».`);
    hint = HINT_STEP;
  } else if (form === 5) {
    sp = { st: 2 };
    alts = [
      { sp: { a: 1, st: 2 }, why: l("Срез начат со второй буквы, а [::2] начинается с индекса 0.", "Тілім екінші әріптен басталған, ал [::2] 0 индексінен басталады.") },
      { sp: { st: 3 }, why: l("Это шаг 3, а в срезе шаг 2: через один символ.", "Бұл 3 қадамы, ал тілімде 2 қадамы: біреуін аралатып.") },
      { sp: { st: -1 }, why: l("Это переворот строки, а шаг 2 идёт вперёд через один символ.", "Бұл жолды төңкеру, ал 2 қадамы біреуін аралатып алға жүреді.") },
      { sp: { b: Math.ceil(n / 2) }, why: l("Это половина строки, а шаг 2 берёт каждый второй символ по всей строке.", "Бұл жолдың жартысы, ал 2 қадамы бүкіл жолдан әр екінші символды алады.") },
    ];
    explain = (v) => l(`Шаг 2 берёт индексы 0, 2, 4…: «${v}».`, `2 қадамы 0, 2, 4… индекстерін алады: «${v}».`);
    hint = HINT_STEP;
  } else {
    sp = { a: 1, st: 2 };
    alts = [
      { sp: { st: 2 }, why: l("Срез начат с индекса 0, а в [1::2] начало — индекс 1.", "Тілім 0 индексінен басталған, ал [1::2] тілімінде басы — 1 индексі.") },
      { sp: { a: 1 }, why: l("Потерян шаг: берутся все символы, а не каждый второй.", "Қадам жоғалған: әр екінші символ емес, барлық символ алынған.") },
      { sp: { a: 2, st: 2 }, why: l("Срез начат с индекса 2, а в [1::2] начало — индекс 1.", "Тілім 2 индексінен басталған, ал [1::2] тілімінде басы — 1 индексі.") },
    ];
    explain = (v) => l(`[1::2] начинает с индекса 1 и берёт каждый второй символ: индексы 1, 3, 5…: «${v}».`, `[1::2] 1 индексінен бастап әр екінші символды алады: 1, 3, 5… индекстері: «${v}».`);
    hint = HINT_STEP;
  }
  const value = pySlice(w, sp);
  return {
    key: slug("slice2", w, slText(sp).replace(/:/g, "c")),
    w,
    mk: (sv) => `${sv}${slText(sp)}`,
    value,
    wrongs: alts.map((x) => ({ value: pySlice(w, x.sp), why: x.why })),
    hint,
    explanation: explain(value),
  };
}

function kFind(rand: Rand, level: Level): ExprItem {
  const w = pickWord(rand, 5, 10, level === 3 ? () => true : hasRepeat);
  const n = w.length;
  if (level === 3) {
    // Подстрока из двух букв — присутствует или отсутствует.
    const present = rand() < 0.7;
    const j = int(rand, 0, n - 2);
    let sub = w.slice(j, j + 2);
    if (!present) {
      do sub = pick(rand, ALPHA.split("")) + pick(rand, ALPHA.split(""));
      while (w.includes(sub));
    }
    const v = w.indexOf(sub);
    const wrongs: Cand[] = !present
      ? [
          { value: 0, why: l("0 — индекс первого символа. Когда куска в строке нет, find возвращает -1.", "0 — бірінші символдың индексі. Бөлік жолда жоқ болғанда find -1 қайтарады.") },
          { value: n, why: l("Длина строки здесь ни при чём: если куска нет, find возвращает -1.", "Жолдың ұзындығының бұған қатысы жоқ: бөлік жоқ болса, find -1 қайтарады.") },
          ...(w.includes(sub[0])
            ? [{ value: w.indexOf(sub[0]), why: l(`Найдена только первая буква «${sub[0]}», а find ищет весь кусок «${sub}» целиком — его в строке нет.`, `Тек «${sub[0]}» әрпі табылған, ал find «${sub}» бөлігін толығымен іздейді — ол жолда жоқ.`) }]
            : []),
          { value: n - 1, why: l("Это последний индекс. Если куска нет, find возвращает -1.", "Бұл соңғы индекс. Бөлік жоқ болса, find -1 қайтарады.") },
        ]
      : [
      { value: w.lastIndexOf(sub), why: l("Это индекс последнего вхождения, а find ищет первое.", "Бұл соңғы кездесудің индексі, ал find біріншісін іздейді.") },
      { value: v + 1, why: l("Счёт начат с единицы: индексы идут с нуля.", "Санау бірден басталған: индекстер нөлден басталады.") },
      { value: v + 2, why: l("Это индекс буквы после найденного куска: find возвращает индекс начала куска.", "Бұл табылған бөліктен кейінгі әріптің индексі: find бөліктің басының индексін қайтарады.") },
      { value: -1, why: l("-1 возвращается только когда куска в строке нет, а здесь он есть.", "-1 бөлік жолда жоқ болғанда ғана қайтарылады, ал мұнда ол бар.") },
    ];
    return {
      key: slug("findsub", w, sub),
      w,
      mk: (sv) => `${sv}.find('${sub}')`,
      value: v,
      wrongs,
      hint: HINT_FIND,
      explanation: present
        ? l(`Кусок «${sub}» впервые встречается с индекса ${v}: find возвращает индекс начала первого вхождения — ${v}.`, `«${sub}» бөлігі алғаш ${v} индексінен кездеседі: find бірінші кездесудің басының индексін қайтарады — ${v}.`)
        : l(`Куска «${sub}» в строке нет, поэтому find возвращает -1.`, `«${sub}» бөлігі жолда жоқ, сондықтан find -1 қайтарады.`),
    };
  }
  const absent = rand() < 0.3;
  let c = pick(rand, lettersOf(w));
  if (absent) {
    do c = pick(rand, ALPHA.split(""));
    while (w.includes(c));
  }
  const v = w.indexOf(c);
  const wrongs: Cand[] = absent
    ? [
        { value: 0, why: l("0 — индекс первого символа. Когда символа нет, find возвращает -1.", "0 — бірінші символдың индексі. Символ жоқ болғанда find -1 қайтарады.") },
        { value: n, why: l("Длина строки здесь ни при чём: если символа нет, find возвращает -1.", "Жолдың ұзындығының бұған қатысы жоқ: символ жоқ болса, find -1 қайтарады.") },
        { value: n - 1, why: l("Это последний индекс. Если символа нет, find возвращает -1.", "Бұл соңғы индекс. Символ жоқ болса, find -1 қайтарады.") },
      ]
    : [
        { value: w.lastIndexOf(c), why: l("Это индекс последнего вхождения, а find ищет первое.", "Бұл соңғы кездесудің индексі, ал find біріншісін іздейді.") },
        { value: v + 1, why: l("Счёт начат с единицы: индексы идут с нуля.", "Санау бірден басталған: индекстер нөлден басталады.") },
        { value: pyCount(w, c), why: l("Это количество вхождений (count), а find возвращает индекс.", "Бұл кездесулер саны (count), ал find индексті қайтарады.") },
        { value: -1, why: l("-1 возвращается только когда символа в строке нет, а здесь он есть.", "-1 символ жолда жоқ болғанда ғана қайтарылады, ал мұнда ол бар.") },
      ];
  return {
    key: slug("find", w, c),
    w,
    mk: (sv) => `${sv}.find('${c}')`,
    value: v,
    wrongs,
    hint: HINT_FIND,
    explanation: absent
      ? l(`Символа «${c}» в строке нет, поэтому find возвращает -1.`, `«${c}» символы жолда жоқ, сондықтан find -1 қайтарады.`)
      : l(`Первое «${c}» стоит на индексе ${v} (счёт с нуля): find возвращает ${v}.`, `Бірінші «${c}» ${v} индексінде тұр (санау нөлден): find ${v} қайтарады.`),
  };
}

const OVERLAP: [string, string][] = [
  ["banana", "ana"],
  ["aaaa", "aa"],
  ["ababa", "aba"],
  ["mississippi", "issi"],
  ["aaaaa", "aa"],
  ["nanana", "nan"],
];

function kCount(rand: Rand, level: Level): ExprItem {
  if (level === 3) {
    const [w, sub] = pick(rand, OVERLAP);
    const v = pyCount(w, sub);
    const naive = overlapCount(w, sub);
    return {
      key: slug("countsub", w, sub),
      w,
      mk: (sv) => `${sv}.count('${sub}')`,
      value: v,
      wrongs: [
        { value: naive, why: l("Посчитаны и перекрывающиеся вхождения. count идёт слева направо и не считает кусок, заходящий на уже найденный.", "Қиылысатын кездесулер де есептелген. count солдан оңға жүреді және бұрын табылғанмен қиылысатын бөлікті санамайды.") },
        { value: v + 2, why: l("Ошибка в счёте: пройди строку слева направо и отмечай вхождения, не заходя на найденные.", "Санауда қате: жолды солдан оңға өтіп, табылғандарға кірместен кездесулерді белгіле.") },
        { value: 0, why: l("Кусок в строке есть, так что вхождений не меньше одного.", "Бөлік жолда бар, демек кездесу бірден кем емес.") },
        { value: w.indexOf(sub), why: l("Это индекс первого вхождения (find), а count возвращает количество.", "Бұл бірінші кездесудің индексі (find), ал count санын қайтарады.") },
      ],
      hint: HINT_COUNT_SUB,
      explanation: l(
        `Находим «${sub}» слева направо: ${ruTimes(v)}. Следующее вхождение ${naive > v ? "начинается внутри уже найденного, поэтому count его не считает" : "не пересекается с найденным"}. Результат: ${v}.`,
        `«${sub}» бөлігін солдан оңға іздейміз: ${v} рет. Келесі кездесу ${naive > v ? "табылғанның ішінен басталады, сондықтан count оны санамайды" : "табылғанмен қиылыспайды"}. Нәтиже: ${v}.`,
      ),
    };
  }
  const w = pickWord(rand, 5, 10, hasRepeat);
  const c = pick(
    rand,
    lettersOf(w).filter((x) => pyCount(w, x) >= 2),
  );
  const v = pyCount(w, c);
  return {
    key: slug("count", w, c),
    w,
    mk: (sv) => `${sv}.count('${c}')`,
    value: v,
    wrongs: [
      { value: v + 1, why: l("Лишнее вхождение: пересчитай буквы одну за другой.", "Артық кездесу: әріптерді бірінен соң бірін қайта сана.") },
      { value: v - 1, why: l("Потеряно одно вхождение: пройди строку до конца.", "Бір кездесу жоғалған: жолды соңына дейін өт.") },
      { value: w.indexOf(c), why: l("Это индекс первого вхождения (find), а count возвращает количество.", "Бұл бірінші кездесудің индексі (find), ал count санын қайтарады.") },
      { value: w.length, why: l("Это длина всей строки, а count считает только нужную букву.", "Бұл бүкіл жолдың ұзындығы, ал count тек керекті әріпті санайды.") },
    ],
    hint: HINT_COUNT,
    explanation: l(`Буква «${c}» встречается ${ruTimes(v)}: на индексах ${w.split("").map((ch, i) => (ch === c ? i : -1)).filter((i) => i >= 0).join(", ")}. count возвращает ${v}.`, `«${c}» әрпі ${v} рет кездеседі: ${w.split("").map((ch, i) => (ch === c ? i : -1)).filter((i) => i >= 0).join(", ")} индекстерінде. count ${v} қайтарады.`),
  };
}

function kReplace(rand: Rand): ExprItem {
  const w = pickWord(rand, 5, 10, hasRepeat);
  const x = pick(
    rand,
    lettersOf(w).filter((ch) => pyCount(w, ch) >= 2),
  );
  let y = x;
  while (y === x || w.includes(y)) y = pick(rand, ALPHA.split(""));
  const v = replaceAll(w, x, y);
  return {
    key: slug("replace", w, x, y),
    w,
    mk: (sv) => `${sv}.replace('${x}', '${y}')`,
    value: v,
    wrongs: [
      { value: w.replace(x, y), why: l(`Заменено только первое «${x}», а replace заменяет все.`, `Тек бірінші «${x}» ауыстырылған, ал replace барлығын ауыстырады.`) },
      { value: w, why: l(`Строка напечатана без замены. Но replace возвращает новую строку, где замена уже выполнена, — её и печатает print.`, `Жол ауыстырусыз шығарылған. Бірақ replace ауыстыру орындалған жаңа жолды қайтарады — print соны шығарады.`) },
      { value: replaceAll(w, x, ""), why: l(`Буквы «${x}» не удалены, а заменены на «${y}».`, `«${x}» әріптері алынып тасталмаған, «${y}» әрпіне ауыстырылған.`) },
      { value: reverse(reverse(w).replace(x, y)), why: l(`Заменено только последнее «${x}», а replace заменяет все.`, `Тек соңғы «${x}» ауыстырылған, ал replace барлығын ауыстырады.`) },
    ],
    hint: HINT_REPLACE,
    explanation: l(`replace заменяет все «${x}» на «${y}»: «${v}». Сама строка s при этом не меняется.`, `replace барлық «${x}» әрпін «${y}» әрпіне ауыстырады: «${v}». Ал s жолының өзі өзгермейді.`),
  };
}

function kOrd(rand: Rand): ExprItem {
  const form = int(rand, 0, 3);
  const comment = "# ord('a') = 97";
  const pos = int(rand, 2, 12);
  const letter = ALPHA[pos];
  const code = 97 + pos;
  const off = int(rand, 2, 9);
  if (form === 0) {
    return {
      key: slug("ord", letter),
      w: "",
      standalone: true,
      lines: [comment, `print(ord('${letter}'))`],
      mk: () => `ord('${letter}')`,
      value: code,
      wrongs: [
        { value: code - 1, why: l(`Это код буквы «${ALPHA[pos - 1]}»: коды идут подряд, а у «a» код 97.`, `Бұл «${ALPHA[pos - 1]}» әрпінің коды: кодтар қатар жүреді, ал «a» әрпінің коды 97.`) },
        { value: code + 1, why: l(`Это код буквы «${ALPHA[pos + 1]}»: отсчитай от «a» = 97 ровно ${pos} шагов.`, `Бұл «${ALPHA[pos + 1]}» әрпінің коды: «a» = 97 мәнінен дәл ${pos} қадам санап шық.`) },
        { value: pos + 1, why: l("Это номер буквы в алфавите, а ord возвращает код символа.", "Бұл әріптің әліпбидегі нөмірі, ал ord символдың кодын қайтарады.") },
        { value: code - 32, why: l("Это код заглавной буквы, а в программе строчная.", "Бұл бас әріптің коды, ал программада кіші әріп.") },
      ],
      hint: HINT_ORD,
      explanation: l(`ord('a') = 97, буквы идут подряд: «${letter}» — ${pos}-я после «a», поэтому ord('${letter}') = 97 + ${pos} = ${code}.`, `ord('a') = 97, әріптер қатар жүреді: «${letter}» — «a» әрпінен кейінгі ${pos}-әріп, сондықтан ord('${letter}') = 97 + ${pos} = ${code}.`),
    };
  }
  if (form === 1) {
    return {
      key: slug("chr", code),
      w: "",
      standalone: true,
      lines: [comment, `print(chr(${code}))`],
      mk: () => `chr(${code})`,
      value: letter,
      wrongs: [
        { value: ALPHA[pos - 1], why: l(`Это буква с кодом ${code - 1}: отсчитай от 97 («a») ровно ${pos} шагов.`, `Бұл коды ${code - 1} болатын әріп: 97 («a») мәнінен дәл ${pos} қадам санап шық.`) },
        { value: ALPHA[pos + 1], why: l(`Это буква с кодом ${code + 1}: отсчитай от 97 («a») ровно ${pos} шагов.`, `Бұл коды ${code + 1} болатын әріп: 97 («a») мәнінен дәл ${pos} қадам санап шық.`) },
        { value: letter.toUpperCase(), why: l("Это заглавная буква, а коды 97…122 — строчные.", "Бұл бас әріп, ал 97…122 кодтары — кіші әріптер.") },
        { value: ALPHA[pos - 2], why: l(`Это буква с кодом ${code - 2}: ошибка в счёте шагов от «a».`, `Бұл коды ${code - 2} болатын әріп: «a» әрпінен қадамдарды санауда қате.`) },
      ],
      hint: HINT_ORD,
      explanation: l(`chr — символ по коду. 97 — «a», поэтому ${code} = 97 + ${pos} — буква через ${pos} после «a»: «${letter}».`, `chr — код бойынша символ. 97 — «a», сондықтан ${code} = 97 + ${pos} — «a» әрпінен кейін ${pos} орын тұрған әріп: «${letter}».`),
    };
  }
  if (form === 2) {
    const shifted = ALPHA[pos + off > 25 ? pos : pos + off];
    const o = pos + off > 25 ? 0 : off;
    const base = ALPHA[pos];
    return {
      key: slug("chrord", base, o),
      w: "",
      standalone: true,
      lines: [`print(chr(ord('${base}') + ${o}))`],
      mk: () => `chr(ord('${base}') + ${o})`,
      value: shifted,
      wrongs: [
        { value: ALPHA[Math.max(pos + o - 1, 0)], why: l("Сдвиг на один шаг меньше: сосчитай шаги по алфавиту точно.", "Бір қадам аз жылжу: әліпби бойынша қадамдарды дәл сана.") },
        { value: ALPHA[Math.min(pos + o + 1, 25)], why: l("Сдвиг на один шаг больше: сосчитай шаги по алфавиту точно.", "Бір қадам артық жылжу: әліпби бойынша қадамдарды дәл сана.") },
        { value: base, why: l("Буква не сдвинута: к её коду прибавляется число.", "Әріп жылжымаған: оның кодына сан қосылады.") },
        ...(pos - o >= 0 ? [{ value: ALPHA[pos - o], why: l("Сдвиг в обратную сторону: число прибавляется, значит буква уходит вперёд по алфавиту.", "Кері бағытқа жылжу: сан қосылады, демек әріп әліпби бойынша алға кетеді.") }] : []),
      ],
      hint: l("ord даёт код буквы, прибавление числа сдвигает код, chr возвращает букву. Значит, нужно сдвинуть букву вперёд по алфавиту на это число.", "ord әріптің кодын береді, санды қосу кодты жылжытады, chr әріпті қайтарады. Демек, әріпті әліпби бойынша осы санға алға жылжыту керек."),
      explanation: l(`ord('${base}') + ${o} — код буквы, которая стоит в алфавите на ${plural(o, "позицию", "позиции", "позиций")} дальше «${base}». chr превращает код в букву: «${shifted}».`, `ord('${base}') + ${o} — әліпбиде «${base}» әрпінен ${o} орын кейін тұрған әріптің коды. chr кодты әріпке айналдырады: «${shifted}».`),
    };
  }
  const p2 = int(rand, 3, 24);
  const q = int(rand, 0, p2 - 1);
  return {
    key: slug("orddiff", ALPHA[q], ALPHA[p2]),
    w: "",
    standalone: true,
    lines: [`print(ord('${ALPHA[p2]}') - ord('${ALPHA[q]}'))`],
    mk: () => `ord('${ALPHA[p2]}') - ord('${ALPHA[q]}')`,
    value: p2 - q,
    wrongs: [
      { value: p2 - q + 1, why: l("Ошибка на 1: разность кодов равна разности позиций букв в алфавите.", "1-ге қателесу: кодтар айырмасы әріптердің әліпбидегі орындарының айырмасына тең.") },
      { value: p2 - q - 1, why: l("Ошибка на 1: разность кодов равна разности позиций букв в алфавите.", "1-ге қателесу: кодтар айырмасы әріптердің әліпбидегі орындарының айырмасына тең.") },
      { value: q - p2, why: l("Знак перепутан: из большего кода вычитается меньший.", "Таңба шатасқан: үлкен кодтан кіші код алынады.") },
      { value: 97 + p2 - q, why: l("К разности лишний раз прибавлено 97: коды букв при вычитании сокращаются.", "Айырмаға артық 97 қосылған: әріп кодтары азайтқанда қысқарады.") },
    ],
    hint: l("Коды букв идут подряд, поэтому разность кодов равна числу шагов между буквами в алфавите.", "Әріптердің кодтары қатар жүреді, сондықтан кодтар айырмасы әріптер арасындағы әліпби қадамдарының санына тең."),
    explanation: l(`Коды идут подряд, поэтому ord('${ALPHA[p2]}') - ord('${ALPHA[q]}') — это число шагов от «${ALPHA[q]}» до «${ALPHA[p2]}»: ${p2 - q}.`, `Кодтар қатар жүреді, сондықтан ord('${ALPHA[p2]}') - ord('${ALPHA[q]}') — «${ALPHA[q]}» әрпінен «${ALPHA[p2]}» әрпіне дейінгі қадамдар саны: ${p2 - q}.`),
  };
}

interface Op {
  text: string;
  apply: (s: string) => string;
}

function kChain(rand: Rand): ExprItem {
  const w = pickWord(rand, 8, 11);
  const a = int(rand, 1, 3);
  const b = int(rand, a + 4, Math.min(w.length - 1, a + 6));
  const t = w.slice(a, b);
  const x = pick(rand, lettersOf(t));
  let y = x;
  while (y === x) y = pick(rand, ALPHA.split(""));
  const pool: Op[] = [
    { text: ".upper()", apply: (s) => s.toUpperCase() },
    { text: "[::-1]", apply: reverse },
    { text: "[::2]", apply: (s) => pySlice(s, { st: 2 }) },
    { text: `.replace('${x}', '${y}')`, apply: (s) => replaceAll(s, x, y) },
  ];
  const ops = shuffle(pool, rand).slice(0, rand() < 0.4 ? 1 : 2);
  const steps: string[] = [];
  let cur = t;
  for (const o of ops) {
    cur = o.apply(cur);
    steps.push(`${o.text} → «${cur}»`);
  }
  const value = cur;
  const chain = (list: Op[], from = t) => list.reduce((s, o) => o.apply(s), from);
  const wrongs: Cand[] = [
    { value: chain(ops.slice(0, -1)), why: l(`Не выполнен последний шаг ${ops[ops.length - 1].text}.`, `Соңғы ${ops[ops.length - 1].text} қадамы орындалмаған.`) },
    { value: chain(ops, w.slice(a, b + 1)), why: l(`В срез попал индекс ${b}, но в s[${a}:${b}] правая граница не входит.`, `Тілімге ${b} индексі түсіп кеткен, ал s[${a}:${b}] тілімінде оң жақ шекара кірмейді.`) },
    { value: chain(ops, w.slice(a - 1, b)), why: l(`Срез начат на одну позицию раньше: он начинается с индекса ${a}.`, `Тілім бір орын ертерек басталған: ол ${a} индексінен басталады.`) },
  ];
  if (ops.length === 2) {
    wrongs.push({ value: chain([ops[1], ops[0]]), why: l("Команды выполнены в обратном порядке: сначала нужно первую, потом вторую.", "Командалар кері ретпен орындалған: алдымен біріншісін, сосын екіншісін орындау керек.") });
    wrongs.push({ value: chain(ops.slice(1)), why: l(`Пропущен первый шаг ${ops[0].text}.`, `Бірінші ${ops[0].text} қадамы өткізіліп кеткен.`) });
  }
  const tail = ops.map((o) => o.text).join("");
  return {
    key: slug("chain", w, a, b, tail.replace(/[^a-z0-9]/gi, "")),
    w,
    mk: (sv) => `${sv}[${a}:${b}]${tail}`,
    lines: [`s = '${w}'`, `t = s[${a}:${b}]`, `print(t${tail})`],
    value,
    wrongs,
    hint: HINT_CHAIN,
    explanation: l(
      `Идём по шагам. s[${a}:${b}] — индексы ${a}…${b - 1}: «${t}». Затем ${steps.join(", затем ")}. Итог: «${value}».`,
      `Қадам-қадаммен жүреміз. s[${a}:${b}] — ${a}…${b - 1} индекстері: «${t}». Сосын ${steps.join(", сосын ")}. Нәтиже: «${value}».`,
    ),
  };
}

function kPalin(rand: Rand): ExprItem {
  const w = pick(rand, [...PALINDROMES, ...NOT_PALINDROMES]);
  const rev = reverse(w);
  const value = w === rev;
  return {
    key: slug("palin", w),
    w,
    mk: (sv) => `${sv} == ${sv}[::-1]`,
    value,
    wrongs: [
      {
        value: !value,
        why: value
          ? l(`Перевёрнутая строка «${rev}» совпадает с исходной, поэтому сравнение верно.`, `Төңкерілген «${rev}» жолы бастапқысымен сәйкес келеді, сондықтан салыстыру ақиқат.`)
          : l(`Перевёрнутая строка «${rev}» отличается от исходной «${w}», поэтому сравнение неверно.`, `Төңкерілген «${rev}» жолы бастапқы «${w}» жолынан өзгеше, сондықтан салыстыру жалған.`),
      },
    ],
    hint: HINT_PALIN,
    explanation: value
      ? l(`s[::-1] — это «${rev}», то же самое, что s. Строка читается одинаково в обе стороны (палиндром), поэтому True.`, `s[::-1] — бұл «${rev}», s жолымен бірдей. Жол екі жағынан да бірдей оқылады (палиндром), сондықтан True.`)
      : l(`s[::-1] — это «${rev}», а s — «${w}». Строки различаются, это не палиндром, поэтому False.`, `s[::-1] — бұл «${rev}», ал s — «${w}». Жолдар әртүрлі, бұл палиндром емес, сондықтан False.`),
  };
}

function kNext(rand: Rand): ExprItem {
  const w = pickWord(rand, 6, 11, hasRepeat);
  const cs = lettersOf(w).filter((c) => w.indexOf(c) < w.length - 2 && pyCount(w, c) >= 2 && w.indexOf(c) !== w.lastIndexOf(c));
  const c = pick(rand, cs.length ? cs : lettersOf(w).filter((ch) => w.indexOf(ch) < w.length - 2));
  const j = w.indexOf(c);
  const last = w.lastIndexOf(c);
  if (rand() < 0.5) {
    const v = w[j + 1];
    return {
      key: slug("next", w, c),
      w,
      mk: (sv) => `${sv}[${sv}.find('${c}') + 1]`,
      value: v,
      wrongs: [
        { value: c, why: l(`Это сама буква «${c}»: к индексу прибавлена единица, значит нужна следующая буква.`, `Бұл «${c}» әрпінің өзі: индекске бір қосылған, демек келесі әріп керек.`) },
        { value: w[j - 1] ?? w[0], why: l("Это буква перед найденной, а не после неё.", "Бұл табылған әріптің алдындағы әріп, одан кейінгісі емес.") },
        { value: w[Math.min(last + 1, w.length - 1)], why: l(`Использовано последнее вхождение, а find ищет первое.`, `Соңғы кездесу қолданылған, ал find біріншісін іздейді.`) },
        { value: w[j + 2], why: l("Прибавлено слишком много: в выражении после find стоит + 1.", "Тым көп қосылған: өрнекте find-тан кейін + 1 тұр.") },
      ],
      hint: HINT_NEXT,
      explanation: l(`find('${c}') = ${j} — индекс первого «${c}». Тогда s[${j} + 1] = s[${j + 1}] — следующая буква «${v}».`, `find('${c}') = ${j} — бірінші «${c}» индексі. Сонда s[${j} + 1] = s[${j + 1}] — келесі «${v}» әрпі.`),
    };
  }
  const v = w.slice(j);
  return {
    key: slug("tail", w, c),
    w,
    mk: (sv) => `${sv}[${sv}.find('${c}'):]`,
    value: v,
    wrongs: [
      { value: w.slice(j + 1), why: l(`Срез начат на одну позицию позже: найденная буква «${c}» входит в срез.`, `Тілім бір орын кеш басталған: табылған «${c}» әрпі тілімге кіреді.`) },
      { value: w.slice(0, j), why: l("Взято начало строки до найденной буквы, а срез [k:] идёт от неё до конца.", "Табылған әріпке дейінгі жол басы алынған, ал [k:] тілімі содан соңына дейін жүреді.") },
      { value: w.slice(last), why: l("Использовано последнее вхождение, а find ищет первое.", "Соңғы кездесу қолданылған, ал find біріншісін іздейді.") },
      { value: w.slice(j - 1 < 0 ? 0 : j - 1), why: l("Срез начат на одну позицию раньше найденной буквы.", "Тілім табылған әріптен бір орын ертерек басталған.") },
    ],
    hint: HINT_NEXT,
    explanation: l(`find('${c}') = ${j}. Срез s[${j}:] — от индекса ${j} до конца строки: «${v}».`, `find('${c}') = ${j}. s[${j}:] тілімі — ${j} индексінен жолдың соңына дейін: «${v}».`),
  };
}

function kStrip(rand: Rand): ExprItem {
  const core = pickWord(rand, 4, 8);
  const left = int(rand, 1, 3);
  const right = int(rand, 1, 3);
  const w = " ".repeat(left) + core + " ".repeat(right);
  const n = w.length;
  const wrongs: Cand[] = [
    { value: n, why: l("Это длина без strip(): пробелы по краям тоже считаются, а strip() их убирает.", "Бұл strip() қолданбаған ұзындық: шеттердегі бос орындар да есептеледі, ал strip() оларды алып тастайды.") },
    { value: n - left, why: l("Убраны пробелы только слева, а strip() убирает их с обоих краёв.", "Бос орындар тек сол жақтан алынған, ал strip() екі шеттен де алады.") },
    { value: n - right, why: l("Убраны пробелы только справа, а strip() убирает их с обоих краёв.", "Бос орындар тек оң жақтан алынған, ал strip() екі шеттен де алады.") },
    { value: core.length + 1, why: l("Лишний символ: после strip() остаются только буквы слова.", "Артық символ: strip() орындалғаннан кейін сөздің тек әріптері қалады.") },
  ];
  return {
    key: slug("strip", core, left, right),
    w,
    mk: (sv) => `len(${sv}.strip())`,
    value: core.length,
    wrongs,
    hint: HINT_STRIP,
    explanation: l(
      `В строке ${ruSym(n)}: пробелов слева — ${left}, справа — ${right}, между ними слово «${core}». strip() убирает пробелы по краям, остаётся слово «${core}»: len = ${core.length}.`,
      `Жолда ${n} символ бар: сол жақтағы бос орындар саны — ${left}, оң жақтағысы — ${right}, олардың арасында «${core}» сөзі. strip() шеттердегі бос орындарды алып тастайды, «${core}» сөзі қалады: len = ${core.length}.`,
    ),
  };
}

function kSplit(rand: Rand): ExprItem {
  const w = pick(rand, SENTENCES);
  const words = w.split(" ");
  if (rand() < 0.5) {
    return {
      key: slug("split", w),
      w,
      mk: (sv) => `len(${sv}.split())`,
      value: words.length,
      wrongs: [
        { value: w.length, why: l("Это количество символов, а split() режет строку на слова: считается число слов.", "Бұл символдар саны, ал split() жолды сөздерге бөледі: сөздер саны есептеледі.") },
        { value: words.length - 1, why: l("Это число пробелов. Слов на одно больше, чем пробелов между ними.", "Бұл бос орындар саны. Сөздер араларындағы бос орындардан біреуге көп.") },
        { value: words.length + 1, why: l("Лишнее слово: пересчитай слова по одному.", "Артық сөз: сөздерді бір-бірлеп қайта сана.") },
      ],
      hint: HINT_SPLIT,
      explanation: l(`split() режет строку по пробелам: ${words.map((x) => `«${x}»`).join(", ")}. Слов: ${words.length}, поэтому len = ${words.length}.`, `split() жолды бос орындар бойынша бөледі: ${words.map((x) => `«${x}»`).join(", ")}. Сөздер саны: ${words.length}, сондықтан len = ${words.length}.`),
    };
  }
  const sep = pick(rand, ["-", "+", "_", "/"]);
  const v = words.join(sep);
  return {
    key: slug("join", w, sep === "-" ? "dash" : sep === "+" ? "plus" : sep === "_" ? "under" : "slash"),
    w,
    mk: (sv) => `'${sep}'.join(${sv}.split())`,
    value: v,
    wrongs: [
      { value: w, why: l("Строка осталась прежней, но join склеивает слова через разделитель.", "Жол бұрынғы күйінде қалған, ал join сөздерді бөлгіш арқылы жалғайды.") },
      { value: w.split("").join(sep), why: l("Разделитель вставлен между всеми символами. Но сначала split() даёт слова, и join склеивает именно слова.", "Бөлгіш барлық символдың арасына қойылған. Бірақ алдымен split() сөздерді береді, ал join дәл сөздерді жалғайды.") },
      { value: words.join(""), why: l(`Слова склеены без разделителя «${sep}».`, `Сөздер «${sep}» бөлгішінсіз жалғанған.`) },
      { value: words.slice().reverse().join(sep), why: l("Нарушен порядок слов: join склеивает их в том порядке, как они шли в строке.", "Сөздер реті бұзылған: join оларды жолдағы ретімен жалғайды.") },
    ],
    hint: HINT_SPLIT,
    explanation: l(`split() даёт слова ${words.map((x) => `«${x}»`).join(", ")}, а '${sep}'.join склеивает их через «${sep}»: «${v}».`, `split() ${words.map((x) => `«${x}»`).join(", ")} сөздерін береді, ал '${sep}'.join оларды «${sep}» арқылы жалғайды: «${v}».`),
  };
}

// Какие выражения доступны на каком уровне.
const EXPR: Record<Level, ((rand: Rand) => ExprItem)[]> = {
  1: [kIdx, (r) => kNeg(r, 1), (r) => kLen(r, 1), kCase, kSlice1],
  2: [(r) => kNeg(r, 2), (r) => kLen(r, 2), kSlice2, kSlice2, (r) => kFind(r, 2), (r) => kCount(r, 2), kReplace, kOrd, kStrip],
  3: [kChain, kChain, kPalin, kNext, (r) => kFind(r, 3), (r) => kCount(r, 3), kSplit, kOrd],
};

/** Задание «что выведет программа» из выражения. */
function questionFromExpr(rand: Rand, item: ExprItem, level: Level, seed: number): QuestionStep {
  const lines = item.lines ?? [`s = ${cl(item.w)}`, `print(${item.mk("s")})`];
  return makeQuestion(rand, {
    id: `g:${SKILL}:${item.key}:${seed}`,
    level,
    lines,
    value: item.value,
    cands: item.wrongs,
    hint: item.hint,
    explanation: item.explanation,
    pInput: level === 1 ? 0.25 : 0.4,
  });
}

// ---------- Особые задания: циклы по строке, неизменяемость, сборка строки ----------

function qIter(rand: Rand, level: Level, seed: number): QuestionStep {
  const w = pickWord(rand, 5, 9);
  const n = w.length;
  const forms =
    level === 1
      ? [{ it: "s", v: n }]
      : [
          { it: "s[1:]", v: n - 1 },
          { it: "s[:-1]", v: n - 1 },
          { it: "s[::2]", v: Math.ceil(n / 2) },
          { it: `s[1:${n - 1}]`, v: n - 2 },
          { it: "s[::-1]", v: n },
        ];
  const f = pick(rand, forms);
  return makeQuestion(rand, {
    id: `g:${SKILL}:iter:${slug(w, f.it.replace(/[^a-z0-9]/gi, "c"))}:${seed}`,
    level,
    lines: [`s = ${cl(w)}`, "k = 0", `for ch in ${f.it}:`, "    k += 1", "print(k)"],
    value: f.v,
    cands: [
      { value: n, why: l(`Это длина всей строки, а цикл идёт по ${f.it}.`, `Бұл бүкіл жолдың ұзындығы, ал цикл ${f.it} бойынша жүреді.`) },
      { value: f.v - 1, why: l("Потерян один символ: пересчитай символы той строки, по которой идёт цикл.", "Бір символ жоғалған: цикл өтетін жолдың символдарын қайта сана.") },
      { value: f.v + 1, why: l("Лишний символ: пересчитай символы той строки, по которой идёт цикл.", "Артық символ: цикл өтетін жолдың символдарын қайта сана.") },
      ...(f.it === "s[::2]"
        ? [{ value: Math.floor(n / 2), why: l("Это половина длины с округлением вниз; при шаге 2 берутся индексы 0, 2, 4… — округление вверх.", "Бұл ұзындықтың жартысы төмен қарай дөңгелектелген; 2 қадамында 0, 2, 4… индекстері алынады — жоғары қарай дөңгелектеледі.") }]
        : []),
    ],
    hint: HINT_ITER,
    explanation: l(
      `Тело цикла выполняется по разу на каждый символ в ${f.it}. В «${w}» ${ruSym(n)}${f.it === "s" ? "" : `, а ${f.it} даёт ${f.v}`}. Значит, k = ${f.v}.`,
      `Цикл денесі ${f.it} жолындағы әр символға бір реттен орындалады. «${w}» жолында ${n} символ бар${f.it === "s" ? "" : `, ал ${f.it} ${f.v} символ береді`}. Демек, k = ${f.v}.`,
    ),
    pInput: 0.5,
  });
}

function mixed(rand: Rand, len: number, digits: number): string {
  const chars: string[] = [];
  for (let i = 0; i < len; i++) chars.push(i < digits ? String(int(rand, 1, 9)) : pick(rand, ALPHA.split("")));
  return shuffle(chars, rand).join("");
}

function qLoop(rand: Rand, level: Level, seed: number): QuestionStep {
  const kinds = level === 2 ? ["vowels", "letter", "digits"] : ["consonants", "digitsum", "digitsum", "vowels"];
  const kind = pick(rand, kinds);
  const head = (s: string) => [`s = ${cl(s)}`, "k = 0", "for ch in s:"];
  if (kind === "vowels" || kind === "consonants") {
    const w = pickWord(rand, 6, 10);
    const isV = (c: string) => VOWELS.includes(c);
    const v = w.split("").filter((c) => (kind === "vowels" ? isV(c) : !isV(c))).length;
    const other = w.length - v;
    return makeQuestion(rand, {
      id: `g:${SKILL}:loop:${slug(kind, w)}:${seed}`,
      level,
      lines: [...head(w), `    if ch ${kind === "vowels" ? "in" : "not in"} 'aeiou':`, "        k += 1", "print(k)"],
      value: v,
      cands: [
        { value: other, why: kind === "vowels" ? l("Это число согласных, а условие считает гласные.", "Бұл дауыссыздар саны, ал шарт дауыстыларды санайды.") : l("Это число гласных, а условие not in считает все остальные буквы.", "Бұл дауыстылар саны, ал not in шарты қалған барлық әріпті санайды.") },
        { value: w.length, why: l("Это длина строки: счётчик растёт не на каждом символе, а только когда условие верно.", "Бұл жолдың ұзындығы: санауыш әр символда емес, тек шарт ақиқат болғанда өседі.") },
        { value: v + 1, why: l("Лишний символ: проверь каждую букву на условие.", "Артық символ: әр әріпті шартқа тексер.") },
        { value: v - 1, why: l("Потерян один символ: проверь каждую букву на условие.", "Бір символ жоғалған: әр әріпті шартқа тексер.") },
      ],
      hint: HINT_LOOP,
      explanation: l(
        `Цикл берёт буквы «${w}» по одной. ${kind === "vowels" ? "Буквы из aeiou" : "Буквы не из aeiou"}: ${w.split("").filter((c) => (kind === "vowels" ? isV(c) : !isV(c))).join(", ")}. Счётчик вырос ${ruTimes(v)}, k = ${v}.`,
        `Цикл «${w}» жолының әріптерін бір-бірлеп алады. ${kind === "vowels" ? "aeiou ішіндегі әріптер" : "aeiou ішінде жоқ әріптер"}: ${w.split("").filter((c) => (kind === "vowels" ? isV(c) : !isV(c))).join(", ")}. Санауыш ${v} рет өсті, k = ${v}.`,
      ),
      pInput: 0.45,
    });
  }
  if (kind === "letter") {
    const w = pickWord(rand, 6, 10, hasRepeat);
    const c = pick(rand, lettersOf(w).filter((x) => pyCount(w, x) >= 2));
    const v = pyCount(w, c);
    return makeQuestion(rand, {
      id: `g:${SKILL}:loop:${slug(kind, w, c)}:${seed}`,
      level,
      lines: [...head(w), `    if ch == '${c}':`, "        k += 1", "print(k)"],
      value: v,
      cands: [
        { value: w.length, why: l("Это длина строки: счётчик растёт только на нужной букве.", "Бұл жолдың ұзындығы: санауыш тек керекті әріпте өседі.") },
        { value: v - 1, why: l("Потеряно одно совпадение: проверь каждую букву.", "Бір сәйкестік жоғалған: әр әріпті тексер.") },
        { value: v + 1, why: l("Лишнее совпадение: проверь каждую букву.", "Артық сәйкестік: әр әріпті тексер.") },
        { value: w.indexOf(c), why: l("Это индекс первой буквы, а счётчик считает все совпадения.", "Бұл бірінші әріптің индексі, ал санауыш барлық сәйкестікті санайды.") },
      ],
      hint: HINT_LOOP,
      explanation: l(`Счётчик растёт каждый раз, когда ch равно «${c}». В «${w}» таких букв ${v}, поэтому k = ${v}.`, `ch «${c}» әрпіне тең болған сайын санауыш өседі. «${w}» жолында мұндай әріп ${v}, сондықтан k = ${v}.`),
      pInput: 0.45,
    });
  }
  const s = mixed(rand, int(rand, 7, 10), int(rand, 3, 5));
  const digits = s.split("").filter((c) => c >= "0" && c <= "9");
  if (kind === "digits") {
    const v = digits.length;
    return makeQuestion(rand, {
      id: `g:${SKILL}:loop:${slug(kind, s)}:${seed}`,
      level,
      lines: [...head(s), "    if ch.isdigit():", "        k += 1", "print(k)"],
      value: v,
      cands: [
        { value: digits.reduce((a, c) => a + Number(c), 0), why: l("Это сумма цифр, а k увеличивается на 1 за каждую цифру: считается их количество.", "Бұл цифрлар қосындысы, ал k әр цифр үшін 1-ге өседі: олардың саны есептеледі.") },
        { value: s.length, why: l("Это длина строки: счётчик растёт только на цифрах.", "Бұл жолдың ұзындығы: санауыш тек цифрларда өседі.") },
        { value: s.length - v, why: l("Это число букв, а isdigit() верно для цифр.", "Бұл әріптер саны, ал isdigit() цифрлар үшін ақиқат.") },
        { value: v + 1, why: l("Лишний символ: проверь каждый символ на isdigit().", "Артық символ: әр символды isdigit() бойынша тексер.") },
      ],
      hint: HINT_LOOP,
      explanation: l(`isdigit() верно только для цифр: ${digits.join(", ")}. Их ${v}, и k увеличивается на 1 за каждую, поэтому k = ${v}.`, `isdigit() тек цифрлар үшін ақиқат: ${digits.join(", ")}. Олар ${v}, және k әрқайсысы үшін 1-ге өседі, сондықтан k = ${v}.`),
      pInput: 0.5,
    });
  }
  const sum = digits.reduce((a, c) => a + Number(c), 0);
  return makeQuestion(rand, {
    id: `g:${SKILL}:loop:${slug(kind, s)}:${seed}`,
    level,
    lines: [...head(s), "    if ch.isdigit():", "        k += int(ch)", "print(k)"],
    value: sum,
    cands: [
      { value: digits.length, why: l("Это количество цифр, а k растёт на значение каждой цифры (int(ch)), а не на 1.", "Бұл цифрлар саны, ал k әр цифрдың мәніне (int(ch)) өседі, 1-ге емес.") },
      { value: sum + 1, why: l("Ошибка в сложении: сложи цифры по одной.", "Қосуда қате: цифрларды бір-бірлеп қос.") },
      { value: sum - 1, why: l("Ошибка в сложении: сложи цифры по одной.", "Қосуда қате: цифрларды бір-бірлеп қос.") },
      { value: s.length, why: l("Это длина строки, а в k складываются только значения цифр.", "Бұл жолдың ұзындығы, ал k ішінде тек цифрлардың мәндері қосылады.") },
    ],
    hint: HINT_LOOP,
    explanation: l(`Буквы пропускаются, цифры складываются: ${digits.join(" + ")} = ${sum}. Это сумма цифр, а не их количество (${digits.length}).`, `Әріптер өткізіледі, цифрлар қосылады: ${digits.join(" + ")} = ${sum}. Бұл цифрлар қосындысы, олардың саны (${digits.length}) емес.`),
    pInput: 0.55,
  });
}

function qBuild(rand: Rand, seed: number): QuestionStep {
  const kind = pick(rand, ["reverse", "dropv", "skip", "double"]);
  const w = pickWord(rand, 5, 8, (x) => x.split("").some((c) => !VOWELS.includes(c)) && x.split("").some((c) => VOWELS.includes(c)));
  const head = [`s = ${cl(w)}`, "t = ''", "for ch in s:"];
  let body: string[];
  let value: string;
  let cands: Cand[];
  let explain: L;
  if (kind === "reverse") {
    body = ["    t = ch + t"];
    value = reverse(w);
    cands = [
      { value: w, why: l("Так получилось бы при t = t + ch. Но здесь символ дописывается слева (ch + t), и порядок меняется на обратный.", "Бұл t = t + ch болғанда шығар еді. Бірақ мұнда символ сол жаққа жазылады (ch + t), және рет кері болады.") },
      { value: value.slice(1) , why: l("Потерян один символ: в t попадает каждая буква строки.", "Бір символ жоғалған: t ішіне жолдың әр әрпі түседі.") },
      { value: w.slice(0, -1), why: l("Потерян один символ: в t попадает каждая буква строки.", "Бір символ жоғалған: t ішіне жолдың әр әрпі түседі.") },
    ];
    explain = l(`Каждая новая буква дописывается слева от уже собранного. Получается строка наоборот: «${value}».`, `Әр жаңа әріп жиналған жолдың сол жағына жазылады. Жол керісінше шығады: «${value}».`);
  } else if (kind === "dropv") {
    body = ["    if ch not in 'aeiou':", "        t += ch"];
    value = w.split("").filter((c) => !VOWELS.includes(c)).join("");
    cands = [
      { value: w.split("").filter((c) => VOWELS.includes(c)).join(""), why: l("Это только гласные, а условие not in оставляет всё, кроме гласных.", "Бұл тек дауыстылар, ал not in шарты дауыстылардан басқасының бәрін қалдырады.") },
      { value: w, why: l("Строка не изменилась, но гласные пропускаются условием.", "Жол өзгермеген, бірақ дауыстылар шартпен өткізіледі.") },
      { value: reverse(value), why: l("Порядок нарушен: буквы дописываются справа (t += ch), порядок сохраняется.", "Рет бұзылған: әріптер оң жаққа жазылады (t += ch), рет сақталады.") },
    ];
    explain = l(`В t попадают все буквы, кроме гласных (a, e, i, o, u), в прежнем порядке: «${value}».`, `t ішіне дауыстылардан (a, e, i, o, u) басқа барлық әріп бұрынғы ретімен түседі: «${value}».`);
  } else if (kind === "skip") {
    const x = pick(rand, lettersOf(w));
    body = [`    if ch != '${x}':`, "        t += ch"];
    value = replaceAll(w, x, "");
    cands = [
      { value: w.split("").filter((c) => c === x).join(""), why: l(`Это только буквы «${x}», а условие != оставляет все остальные.`, `Бұл тек «${x}» әріптері, ал != шарты қалғандарының бәрін қалдырады.`) },
      { value: w, why: l(`Строка не изменилась, но буква «${x}» условием пропускается.`, `Жол өзгермеген, бірақ «${x}» әрпі шартпен өткізіледі.`) },
      { value: reverse(value), why: l("Порядок нарушен: буквы дописываются справа, порядок сохраняется.", "Рет бұзылған: әріптер оң жаққа жазылады, рет сақталады.") },
    ];
    explain = l(`В t попадают все буквы, кроме «${x}», в прежнем порядке: «${value}».`, `t ішіне «${x}» әрпінен басқа барлық әріп бұрынғы ретімен түседі: «${value}».`);
  } else {
    body = ["    t += ch + ch"];
    value = w
      .split("")
      .map((c) => c + c)
      .join("");
    cands = [
      { value: w, why: l("Каждая буква дописывается дважды (ch + ch), поэтому строка вдвое длиннее.", "Әр әріп екі рет жазылады (ch + ch), сондықтан жол екі есе ұзын.") },
      { value: reverse(value), why: l("Порядок нарушен: буквы дописываются справа, порядок сохраняется.", "Рет бұзылған: әріптер оң жаққа жазылады, рет сақталады.") },
      { value: w + w, why: l("Строка повторена целиком, а удваивается каждая буква отдельно.", "Жол түгел қайталанған, ал әр әріп жеке екі еселенеді.") },
    ];
    explain = l(`Для каждой буквы в t дописываются две такие же: «${value}».`, `Әр әріп үшін t ішіне дәл сондай екі әріп жазылады: «${value}».`);
  }
  return makeQuestion(rand, {
    id: `g:${SKILL}:build:${slug(kind, w)}:${seed}`,
    level: 3,
    lines: [...head, ...body, "print(t)"],
    value,
    cands,
    hint: HINT_BUILD,
    explanation: explain,
    pInput: 0.45,
  });
}

function qCaesar(rand: Rand, seed: number): QuestionStep {
  const k = int(rand, 1, 3);
  const len = int(rand, 3, 4);
  let w = "";
  for (let i = 0; i < len; i++) w += ALPHA[int(rand, 3, 21)];
  const shifted = w
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) + k))
    .join("");
  const shift = (d: number) =>
    w
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) + d))
      .join("");
  return makeQuestion(rand, {
    id: `g:${SKILL}:caesar:${slug(w, k)}:${seed}`,
    level: 3,
    lines: [`s = ${cl(w)}`, "t = ''", "for ch in s:", `    t += chr(ord(ch) + ${k})`, "print(t)"],
    value: shifted,
    cands: [
      { value: shift(k - 1), why: l("Сдвиг на один шаг меньше: к коду каждой буквы прибавляется ровно число из программы.", "Бір қадам аз жылжу: әр әріптің кодына программадағы сан дәл қосылады.") },
      { value: shift(k + 1), why: l("Сдвиг на один шаг больше: к коду каждой буквы прибавляется ровно число из программы.", "Бір қадам артық жылжу: әр әріптің кодына программадағы сан дәл қосылады.") },
      { value: shift(-k), why: l("Сдвиг в обратную сторону: число прибавляется, значит буквы уходят вперёд по алфавиту.", "Кері бағытқа жылжу: сан қосылады, демек әріптер әліпби бойынша алға кетеді.") },
      { value: reverse(shifted), why: l("Порядок нарушен: буквы дописываются справа (t += …), порядок сохраняется.", "Рет бұзылған: әріптер оң жаққа жазылады (t += …), рет сақталады.") },
    ],
    hint: HINT_CAESAR,
    explanation: l(
      `Каждая буква сдвигается на ${k} вперёд по алфавиту: ${w.split("").map((c, i) => `${c} → ${shifted[i]}`).join(", ")}. Получается «${shifted}».`,
      `Әр әріп әліпби бойынша ${k} орынға алға жылжиды: ${w.split("").map((c, i) => `${c} → ${shifted[i]}`).join(", ")}. «${shifted}» шығады.`,
    ),
    pInput: 0.45,
  });
}

/** «Какая команда вызовет ошибку?» — одна ошибочная команда и три безопасные. */
function qImmut(rand: Rand, seed: number): QuestionStep {
  const w = pickWord(rand, 5, 8);
  const n = w.length;
  const errKind = pick(rand, ["assign", "index", "assign", "index2"]);
  const i = int(rand, 0, n - 1);
  const bad =
    errKind === "assign"
      ? { cmd: `s[${i}] = 'x'`, why: l("Строки неизменяемы: присвоить символу новое значение нельзя — будет ошибка TypeError.", "Жолдар өзгермейді: символға жаңа мән меншіктеуге болмайды — TypeError қатесі шығады.") }
      : errKind === "index"
        ? { cmd: `print(s[${n}])`, why: l(`В строке из ${n} символов индексы 0…${n - 1}. Индекса ${n} нет — ошибка IndexError.`, `${n} символды жолда индекстер 0…${n - 1}. ${n} индексі жоқ — IndexError қатесі.`) }
        : { cmd: `print(s[${n + 2}])`, why: l(`В строке из ${n} символов индексы 0…${n - 1}. Индекса ${n + 2} нет — ошибка IndexError.`, `${n} символды жолда индекстер 0…${n - 1}. ${n + 2} индексі жоқ — IndexError қатесі.`) };
  const safe: { cmd: string; why: L }[] = [
    { cmd: "t = s.upper()", why: l("upper() возвращает новую строку и ничего не меняет в s — ошибки нет.", "upper() жаңа жол қайтарады және s ішінде ештеңені өзгертпейді — қате жоқ.") },
    { cmd: "t = s + '!'", why: l("Склеивание создаёт новую строку — ошибки нет.", "Жалғау жаңа жол жасайды — қате жоқ.") },
    { cmd: "print(s[::-1])", why: l("Срез с шагом -1 просто даёт перевёрнутую копию — ошибки нет.", "-1 қадамымен алынған тілім төңкерілген көшірмені береді — қате жоқ.") },
    { cmd: "print(s[-1])", why: l("s[-1] — последний символ, такой индекс существует.", "s[-1] — соңғы символ, мұндай индекс бар.") },
    { cmd: `print(s[:${n + 5}])`, why: l("Срез не вызывает ошибку, даже если конец за пределами строки: берётся сколько есть.", "Тілім шеті жолдан асып кетсе де қате бермейді: бар болғаны алынады.") },
    { cmd: "s = s.lower()", why: l("Это присваивание новой строки переменной, а не изменение символа — ошибки нет.", "Бұл символды өзгерту емес, айнымалыға жаңа жолды меншіктеу — қате жоқ.") },
    { cmd: `print(s[${n - 1}])`, why: l(`Индекс ${n - 1} — последний в этой строке, он существует.`, `${n - 1} индексі — осы жолдағы соңғысы, ол бар.`) },
    { cmd: "t = 'x' + s[1:]", why: l("Это сборка новой строки из частей — ошибки нет.", "Бұл бөліктерден жаңа жол жинау — қате жоқ.") },
    { cmd: "t = s.replace('a', 'b')", why: l("replace возвращает новую строку — ошибки нет.", "replace жаңа жол қайтарады — қате жоқ.") },
  ];
  const chosen = shuffle(safe, rand).slice(0, 3);
  const all = shuffle([{ cmd: bad.cmd, why: null as L | null }, ...chosen.map((c) => ({ cmd: c.cmd, why: c.why as L | null }))], rand);
  return {
    id: `g:${SKILL}:immut:${slug(w, errKind, i)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 2,
    prompt: l("Какая команда вызовет ошибку?", "Қай команда қате шығарады?"),
    scene: code(`s = ${cl(w)}`),
    options: all.map((x) => x.cmd),
    correct: all.findIndex((x) => x.why === null),
    whyWrong: all.map((x) => x.why),
    hint: HINT_IMMUT,
    explanation: bad.why,
  };
}

// ---------- Сборка вопросов ----------

type Maker = (rand: Rand, level: Level, seed: number) => QuestionStep;

const SPECIAL: Record<Level, Maker[]> = {
  1: [(r, lv, sd) => qIter(r, lv, sd)],
  2: [(r, lv, sd) => qIter(r, lv, sd), (r, lv, sd) => qLoop(r, lv, sd), (r, _lv, sd) => qImmut(r, sd), (r, _lv, sd) => qImmut(r, sd)],
  3: [(r, lv, sd) => qLoop(r, lv, sd), (r, _lv, sd) => qBuild(r, sd), (r, _lv, sd) => qCaesar(r, sd)],
};

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  const exprShare = 0.65;
  if (rand() < exprShare) {
    const item = pick(rand, EXPR[level])(rand);
    return { ...questionFromExpr(rand, item, level, seed), level };
  }
  return { ...pick(rand, SPECIAL[level])(rand, level, seed), level };
}

// ---------- Утверждения, пары, короткие вопросы ----------

function exprItem(rand: Rand, level: Level, accept: (it: ExprItem) => boolean = () => true): ExprItem {
  let item = pick(rand, EXPR[level])(rand);
  for (let tries = 0; tries < 12 && !accept(item); tries++) item = pick(rand, EXPR[level])(rand);
  return item;
}

const litExpr = (it: ExprItem) => (it.standalone ? it.mk("") : it.mk(cl(it.w)));

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const item = exprItem(rand, level);
  const expr = litExpr(item);
  const makeTrue = rand() < 0.5;
  const wrong = item.wrongs.find((c) => show(c.value) !== show(item.value));
  const claim = makeTrue || !wrong ? item.value : wrong.value;
  const value = show(claim) === show(item.value);
  return {
    id: `s:${SKILL}:${item.key}:${slug(show(claim))}`,
    skill: SKILL,
    level,
    text: l(`${expr} даёт ${repr(claim)}`, `${expr} нәтижесі — ${repr(claim)}`),
    value,
    explanation: item.explanation,
    hint: item.hint,
  };
}

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  // В паре нужен однозначный короткий результат: без пустых строк и булевых значений.
  const item = exprItem(rand, level, (it) => typeof it.value !== "boolean" && show(it.value) !== "");
  return { id: `p:${SKILL}:${item.key}`, skill: SKILL, level, left: litExpr(item), right: repr(item.value) };
}

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const item = exprItem(rand, level, (it) => typable(it.value));
  const expr = litExpr(item);
  const value = item.value;
  return {
    id: `q:${SKILL}:${item.key}`,
    skill: SKILL,
    level,
    prompt: l(`Что выведет print(${expr})?`, `print(${expr}) не шығарады?`),
    answer: show(value),
    mode: typeof value === "number" ? "number" : "text",
    explanation: item.explanation,
    hint: item.hint,
  };
}

const strings: SkillBank = { skill: SKILL, question, statement, pair, short };

export const BANKS: SkillBank[] = [strings];
