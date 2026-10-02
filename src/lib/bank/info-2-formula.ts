import type { ChoiceStep, InputStep, L, Level } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка info.formula: N = 2ⁱ, I = K · i, выбор из N вариантов, mᵏ кодов, пароли с округлением до байт.
// Правильный ответ всегда считает код. Параметры задания зашиты в id (g:info.formula:<вид>:<параметры>:<seed>) —
// по ним ответы перепроверены независимым расчётом (scripts/out/info-2-formula/verify.py).
// После переменных чисел казахские тексты без падежных окончаний (число стоит перед существительным или в формуле).

const SKILL = "info.formula";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[d]);

/** Наименьшее i, при котором 2ⁱ ≥ n. */
const bitsFor = (n: number) => {
  let i = 0;
  while (2 ** i < n) i++;
  return i;
};
const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
/** Число из диапазона, не являющееся степенью двойки. */
function nonPow2(rand: Rand, min: number, max: number): number {
  let n = int(rand, min, max);
  while (isPow2(n)) n = int(rand, min, max);
  return n;
}
/** K · i делится на 8 нацело: шаг для K. */
const byteStep = (i: number) => 8 / gcd(8, i);

/** Русское склонение: 1 символ, 2 символа, 5 символов. */
function ruPl(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const symbols = (n: number) => `${n} ${ruPl(n, "символ", "символа", "символов")}`;
/** После «из»: из 1 символа, из 2 символов, из 21 символа. */
const symbolsOf = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "символа" : "символов"}`;
const bitsRu = (n: number) => `${n} ${ruPl(n, "бит", "бита", "бит")}`;

interface Opt {
  text: string;
  why: L | null;
}

interface ChoiceInput {
  id: string;
  level: Level;
  prompt: L;
  hint: L;
  explanation: L;
  correct: string;
  wrongs: Opt[];
}

/** Задание choice: правильный + 3 уникальных неверных (с разбором ошибки), перемешаны. */
function choice(rand: Rand, c: ChoiceInput): ChoiceStep {
  const seen = new Set<string>([c.correct]);
  const wrongs: Opt[] = [];
  for (const w of shuffle(c.wrongs, rand)) {
    if (wrongs.length >= 3) break;
    if (w.text && !seen.has(w.text)) {
      seen.add(w.text);
      wrongs.push(w);
    }
  }
  const all: Opt[] = shuffle([{ text: c.correct, why: null }, ...wrongs], rand);
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

function input(id: string, level: Level, prompt: L, hint: L, explanation: L, answer: number, suffix?: string): InputStep {
  return { id, type: "input", skill: SKILL, level, prompt, hint, answers: [String(answer)], mode: "number", suffix, explanation };
}

const HINT_FIND_I: L = {
  ru: "Сначала найди вес одного символа i: наименьшее i, при котором 2ⁱ не меньше мощности алфавита.",
  kk: "Алдымен бір символдың салмағы i-ді тап: 2ⁱ әліпби қуатынан кем болмайтын ең кіші i.",
};

// ---------- Генераторы заданий ----------

const KINDS: Record<Level, readonly string[]> = {
  1: ["weight", "weight", "volume", "alphabet", "guess"],
  2: ["weight-np", "volume-np", "bytes", "guess-np", "codes", "reverse"],
  3: ["password", "password-choice", "reverse-bytes", "codes-min", "volume-bytes"],
};

function question(level: Level, seed: number) {
  const rand = seeded(seed);
  const kind = pick(rand, KINDS[level]);
  const id = (params: string) => `g:${SKILL}:${kind}:${params}:${seed}`;

  // ---- A ----
  if (kind === "weight") {
    const i = int(rand, 2, 8);
    const n = 2 ** i;
    return choice(rand, {
      id: id(`n${n}`),
      level,
      prompt: {
        ru: `В алфавите ${symbols(n)}. Каков информационный вес одного символа?`,
        kk: `Әліпбиде ${n} символ бар. Бір символдың ақпараттық салмағы қандай?`,
      },
      hint: { ru: `В какую степень нужно возвести 2, чтобы получить ${n}?`, kk: `Екіні қандай дәрежеге шығарсақ, ${n} шығады?` },
      explanation: {
        ru: `Формула N = 2ⁱ: 2${sup(i)} = ${n}, значит i = ${i} бит.`,
        kk: `N = 2ⁱ формуласы: 2${sup(i)} = ${n}, демек i = ${i} бит.`,
      },
      correct: `${i} бит`,
      wrongs: [
        {
          text: `${i - 1} бит`,
          why: { ru: `2${sup(i - 1)} = ${2 ** (i - 1)} — этого мало, на ${n} символов не хватит кодов.`, kk: `2${sup(i - 1)} = ${2 ** (i - 1)} — бұл аз, ${n} символға код жетпейді.` },
        },
        {
          text: `${i + 1} бит`,
          why: { ru: `${i + 1} бит дадут ${2 ** (i + 1)} кодов — больше нужного. Ищем наименьшее i.`, kk: `${i + 1} бит ${2 ** (i + 1)} код береді — қажеттіден көп. Ең кіші i іздейміз.` },
        },
        {
          text: `${n} бит`,
          why: { ru: `${n} — это мощность алфавита N, а не вес символа i.`, kk: `${n} — әліпбидің қуаты N, символ салмағы i емес.` },
        },
        {
          text: `${i * 2} бит`,
          why: { ru: `Вес не нужно удваивать: i — такое число, что 2ⁱ = ${n}.`, kk: `Салмақты екі еселеудің қажеті жоқ: i — 2ⁱ = ${n} болатын сан.` },
        },
        {
          text: "8 бит",
          why: { ru: "8 бит — это один байт. Вес символа ищем по формуле N = 2ⁱ.", kk: "8 бит — бір байт. Символ салмағын N = 2ⁱ формуласымен іздейміз." },
        },
      ],
    });
  }
  if (kind === "volume") {
    const i = int(rand, 2, 6);
    const n = 2 ** i;
    const k = int(rand, 5, 30);
    return input(
      id(`n${n}-k${k}`),
      level,
      {
        ru: `Сообщение из ${symbolsOf(k)} записано алфавитом из ${symbolsOf(n)}. Каков объём сообщения в битах?`,
        kk: `${k} символдан тұратын хабарлама ${n} символдық әліпбимен жазылған. Хабарлама көлемі неше бит?`,
      },
      { ru: `Найди вес одного символа из 2ⁱ = ${n}, потом умножь на число символов.`, kk: `Бір символдың салмағын 2ⁱ = ${n} шартынан тап, содан кейін символдар санына көбейт.` },
      {
        ru: `2${sup(i)} = ${n}, значит i = ${i} бит. I = K · i = ${k} · ${i} = ${k * i} бит.`,
        kk: `2${sup(i)} = ${n}, демек i = ${i} бит. I = K · i = ${k} · ${i} = ${k * i} бит.`,
      },
      k * i,
      "бит",
    );
  }
  if (kind === "alphabet") {
    const i = int(rand, 3, 8);
    const n = 2 ** i;
    return choice(rand, {
      id: id(`i${i}`),
      level,
      prompt: {
        ru: `Один символ несёт ${bitsRu(i)}. Сколько символов может быть в самом большом такого алфавита?`,
        kk: `Бір символ ${i} бит тасымалдайды. Осындай ең үлкен әліпбиде неше символ болуы мүмкін?`,
      },
      hint: { ru: "Сколько разных кодов можно составить из i нулей и единиц?", kk: "i нөл мен бірден қанша түрлі код құрастыруға болады?" },
      explanation: {
        ru: `Из ${i} бит получается 2${sup(i)} = ${n} разных кодов, значит в алфавите не больше ${n} символов.`,
        kk: `${i} биттен 2${sup(i)} = ${n} түрлі код шығады, демек әліпбиде ${n} символдан артық болмайды.`,
      },
      correct: String(n),
      wrongs: [
        { text: String(i * i), why: { ru: `${i} · ${i} — не та формула: кодов 2ⁱ, а не i².`, kk: `${i} · ${i} — формула дұрыс емес: кодтар саны 2ⁱ, i² емес.` } },
        { text: String(i * 2), why: { ru: `Удвоение i — не то: с каждым битом кодов становится вдвое больше, то есть 2ⁱ.`, kk: `i-ді екі еселеу дұрыс емес: әр битпен кодтар екі есе көбейеді, яғни 2ⁱ.` } },
        { text: String(2 ** (i + 1)), why: { ru: `2${sup(i + 1)} = ${2 ** (i + 1)} — это для ${i + 1} бит, а у нас ${i}.`, kk: `2${sup(i + 1)} = ${2 ** (i + 1)} — бұл ${i + 1} бит үшін, ал бізде ${i}.` } },
        { text: String(2 ** (i - 1)), why: { ru: `2${sup(i - 1)} = ${2 ** (i - 1)} — это для ${i - 1} бит, а у нас ${i}.`, kk: `2${sup(i - 1)} = ${2 ** (i - 1)} — бұл ${i - 1} бит үшін, ал бізде ${i}.` } },
        { text: String(i), why: { ru: `${i} — это вес символа, а спрашивают, сколько символов в алфавите.`, kk: `${i} — символ салмағы, ал әліпбиде неше символ бар екені сұралып тұр.` } },
      ],
    });
  }
  if (kind === "guess") {
    const i = int(rand, 2, 8);
    const n = 2 ** i;
    return input(
      id(`n${n}`),
      level,
      {
        ru: `Загадано число от 1 до ${n}. Сколько вопросов «да/нет» нужно, чтобы гарантированно его угадать?`,
        kk: `1 мен ${n} аралығындағы сан ойластырылған. Оны міндетті түрде табу үшін «иә/жоқ» түріндегі қанша сұрақ керек?`,
      },
      { ru: "Каждый вопрос делит варианты пополам. Сколько раз нужно разделить пополам, чтобы остался один вариант?", kk: "Әрбір сұрақ нұсқаларды екіге бөледі. Бір нұсқа қалу үшін қанша рет екіге бөлу керек?" },
      {
        ru: `Выбор из N = ${n} вариантов: 2${sup(i)} = ${n}, значит ${i} вопросов (${i} бит).`,
        kk: `N = ${n} нұсқадан таңдау: 2${sup(i)} = ${n}, демек ${i} сұрақ (${i} бит).`,
      },
      i,
    );
  }

  // ---- B ----
  if (kind === "weight-np") {
    const n = nonPow2(rand, 5, 200);
    const i = bitsFor(n);
    return choice(rand, {
      id: id(`n${n}`),
      level,
      prompt: {
        ru: `Мощность алфавита — ${n}. Сколько бит минимально нужно на один символ при равномерном коде?`,
        kk: `Әліпбидің қуаты — ${n}. Біркелкі кодта бір символға ең азы неше бит қажет?`,
      },
      hint: HINT_FIND_I,
      explanation: {
        ru: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i} = 2${sup(i)}, значит i = ${i} бит (округляем вверх).`,
        kk: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i} = 2${sup(i)}, демек i = ${i} бит (жоғары дөңгелектейміз).`,
      },
      correct: `${i} бит`,
      wrongs: [
        {
          text: `${i - 1} бит`,
          why: { ru: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n}: кодов не хватит. i округляют вверх, а не вниз.`, kk: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n}: код жетпейді. i-ді жоғары дөңгелектейді, төмен емес.` },
        },
        {
          text: `${i + 1} бит`,
          why: { ru: `${i} бит уже хватает (2${sup(i)} = ${2 ** i} ≥ ${n}), лишний бит не нужен.`, kk: `${i} бит жеткілікті (2${sup(i)} = ${2 ** i} ≥ ${n}), артық бит қажет емес.` },
        },
        {
          text: "8 бит",
          why: { ru: "8 бит — это байт; вес символа считают по N = 2ⁱ с округлением вверх.", kk: "8 бит — байт; символ салмағы N = 2ⁱ бойынша жоғары дөңгелектеумен есептеледі." },
        },
        {
          text: `${i + 2} бит`,
          why: { ru: `${i + 2} бит дали бы ${2 ** (i + 2)} кодов — в разы больше нужного. Ищем наименьшее i.`, kk: `${i + 2} бит ${2 ** (i + 2)} код берер еді — қажеттіден әлдеқайда көп. Ең кіші i іздейміз.` },
        },
        {
          text: `${n} бит`,
          why: { ru: `${n} — мощность алфавита N, а не вес символа.`, kk: `${n} — әліпбидің қуаты N, символ салмағы емес.` },
        },
      ],
    });
  }
  if (kind === "volume-np") {
    const n = nonPow2(rand, 5, 100);
    const i = bitsFor(n);
    const k = int(rand, 6, 40);
    return input(
      id(`n${n}-k${k}`),
      level,
      {
        ru: `Сообщение из ${symbolsOf(k)} записано алфавитом мощностью ${n}. Сколько бит занимает сообщение при равномерном коде минимальной длины?`,
        kk: `${k} символдан тұратын хабарлама қуаты ${n} әліпбимен жазылған. Ең қысқа біркелкі кодта хабарлама неше бит алады?`,
      },
      HINT_FIND_I,
      {
        ru: `${n} не степень двойки: 2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, i = ${i} бит. I = ${k} · ${i} = ${k * i} бит.`,
        kk: `${n} екінің дәрежесі емес: 2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, i = ${i} бит. I = ${k} · ${i} = ${k * i} бит.`,
      },
      k * i,
      "бит",
    );
  }
  if (kind === "bytes") {
    const i = pick(rand, [3, 5, 6, 7] as const);
    const n = rand() < 0.5 ? 2 ** i : int(rand, 2 ** (i - 1) + 1, 2 ** i);
    const k = byteStep(i) * int(rand, 2, 12);
    return input(
      id(`n${n}-k${k}`),
      level,
      {
        ru: `Сообщение из ${symbolsOf(k)} записано алфавитом из ${symbolsOf(n)}. Сколько байт занимает сообщение?`,
        kk: `${k} символдан тұратын хабарлама ${n} символдық әліпбимен жазылған. Хабарлама неше байт алады?`,
      },
      { ru: "Найди i, потом объём в битах I = K · i, потом раздели на 8: в одном байте 8 бит.", kk: "i-ді тап, содан кейін биттегі көлем I = K · i, соңында 8-ге бөл: бір байтта 8 бит." },
      {
        ru: `i = ${i} (2${sup(i)} = ${2 ** i} ≥ ${n}). I = ${k} · ${i} = ${k * i} бит = ${k * i} : 8 = ${(k * i) / 8} байт.`,
        kk: `i = ${i} (2${sup(i)} = ${2 ** i} ≥ ${n}). I = ${k} · ${i} = ${k * i} бит = ${k * i} : 8 = ${(k * i) / 8} байт.`,
      },
      (k * i) / 8,
      "байт",
    );
  }
  if (kind === "guess-np") {
    const n = nonPow2(rand, 20, 200);
    const i = bitsFor(n);
    return input(
      id(`n${n}`),
      level,
      {
        ru: `Загадано целое число от 1 до ${n}. За какое наименьшее число вопросов «да/нет» его гарантированно можно угадать?`,
        kk: `1 мен ${n} аралығындағы бүтін сан ойластырылған. Оны міндетті түрде табу үшін «иә/жоқ» түріндегі ең аз қанша сұрақ керек?`,
      },
      { ru: "Каждый вопрос делит варианты пополам. Найди наименьшее i, при котором 2ⁱ ≥ N.", kk: "Әрбір сұрақ нұсқаларды екіге бөледі. 2ⁱ ≥ N болатын ең кіші i тап." },
      {
        ru: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i} = 2${sup(i)}, поэтому нужно ${i} вопросов.`,
        kk: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i} = 2${sup(i)}, сондықтан ${i} сұрақ керек.`,
      },
      i,
    );
  }
  if (kind === "codes") {
    const m = pick(rand, [3, 4, 5, 6] as const);
    const k = m >= 5 ? int(rand, 2, 3) : int(rand, 2, 4);
    const answer = m ** k;
    return input(
      id(`m${m}-k${k}`),
      level,
      {
        ru: `Сколько разных кодов длиной ${k} можно составить из ${symbolsOf(m)}? Символы в коде могут повторяться.`,
        kk: `${m} символдан ұзындығы ${k} неше түрлі код құрастыруға болады? Кодтағы символдар қайталана алады.`,
      },
      { ru: "На каждое из k мест можно поставить любой из m символов. Сколько получается вариантов подряд?", kk: "k орынның әрқайсысына m символдың кез келгенін қоюға болады. Қатарынан қанша нұсқа шығады?" },
      {
        ru: `На каждое из ${k} мест — ${m} ${ruPl(m, "вариант", "варианта", "вариантов")}: ${Array(k).fill(m).join(" · ")} = ${m}${sup(k)} = ${answer}.`,
        kk: `${k} орынның әрқайсысына — ${m} нұсқа: ${Array(k).fill(m).join(" · ")} = ${m}${sup(k)} = ${answer}.`,
      },
      answer,
    );
  }
  if (kind === "reverse") {
    const i = int(rand, 3, 7);
    const k = int(rand, 10, 60);
    return input(
      id(`i${i}-k${k}`),
      level,
      {
        ru: `Сообщение из ${symbolsOf(k)} занимает ${k * i} бит. Какое наибольшее число символов может быть в алфавите?`,
        kk: `${k} символдан тұратын хабарлама ${k * i} бит алады. Әліпбиде ең көбі неше символ болуы мүмкін?`,
      },
      { ru: "Раздели объём на число символов — получишь вес одного символа i. Потом N = 2ⁱ.", kk: "Көлемді символдар санына бөл — бір символдың салмағы i шығады. Содан кейін N = 2ⁱ." },
      {
        ru: `i = I : K = ${k * i} : ${k} = ${i} бит. N = 2${sup(i)} = ${2 ** i}.`,
        kk: `i = I : K = ${k * i} : ${k} = ${i} бит. N = 2${sup(i)} = ${2 ** i}.`,
      },
      2 ** i,
    );
  }

  // ---- C ----
  if (kind === "password" || kind === "password-choice") {
    // Подбираем так, чтобы округление до байта действительно понадобилось.
    let n = int(rand, 20, 100);
    let len = int(rand, 5, 14);
    let tries = 0;
    while ((len * bitsFor(n)) % 8 === 0 && tries++ < 50) {
      n = int(rand, 20, 100);
      len = int(rand, 5, 14);
    }
    const count = pick(rand, [20, 25, 30, 40, 50, 60, 100] as const);
    const i = bitsFor(n);
    const bits = len * i;
    const bytes = Math.ceil(bits / 8);
    const total = count * bytes;
    const prompt: L = {
      ru: `Пароль состоит из ${symbolsOf(len)}, используются ${n} ${ruPl(n, "разный символ", "разных символа", "разных символов")}. Каждый символ кодируется одинаковым минимальным числом бит, а каждый пароль — минимальным целым числом байт. Сколько байт нужно для хранения ${count} ${ruPl(count, "пароль", "пароля", "паролей")}?`,
      kk: `Құпиясөз ${len} символдан тұрады, барлығы ${n} әртүрлі символ қолданылады. Әрбір символ бірдей ең аз бит санымен, ал әрбір құпиясөз ең аз бүтін байт санымен кодталады. ${count} құпиясөзді сақтау үшін қанша байт қажет?`,
    };
    const hint: L = {
      ru: "Три действия: вес символа i, биты одного пароля, байты одного пароля (с округлением вверх). Умножай на число паролей в самом конце.",
      kk: "Үш әрекет: символ салмағы i, бір құпиясөздің биттері, бір құпиясөздің байттары (жоғары дөңгелектеумен). Құпиясөздер санына ең соңында көбейт.",
    };
    const explanation: L = {
      ru: `N = ${n}: 2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, i = ${i} бит. Один пароль: ${len} · ${i} = ${bits} бит = ${bits} : 8 → ${bytes} байт (вверх). ${count} паролей: ${count} · ${bytes} = ${total} байт.`,
      kk: `N = ${n}: 2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, i = ${i} бит. Бір құпиясөз: ${len} · ${i} = ${bits} бит = ${bits} : 8 → ${bytes} байт (жоғары). ${count} құпиясөз: ${count} · ${bytes} = ${total} байт.`,
    };
    const pid = id(`n${n}-l${len}-c${count}`);
    if (kind === "password") return input(pid, level, prompt, hint, explanation, total, "байт");
    const noRound = Math.round((count * bits) / 8);
    return choice(rand, {
      id: pid,
      level,
      prompt,
      hint,
      explanation,
      correct: String(total),
      wrongs: [
        {
          text: String(noRound),
          why: { ru: `Это ${count} · ${bits} : 8: округление сделано в конце. Но каждый пароль хранится целым числом байт — сначала округляем один пароль.`, kk: `Бұл ${count} · ${bits} : 8: дөңгелектеу соңында жасалған. Бірақ әрбір құпиясөз бүтін байтпен сақталады — алдымен бір құпиясөзді дөңгелектеу керек.` },
        },
        {
          text: String(count * len),
          why: { ru: `Это ${count} · ${len}: каждый символ принят за целый байт, а он занимает ${i} бит.`, kk: `Бұл ${count} · ${len}: әрбір символ бүтін байт деп алынған, ал ол ${i} бит алады.` },
        },
        {
          text: String(count * Math.floor(bits / 8)),
          why: { ru: `Это ${count} · ${Math.floor(bits / 8)}: пароль округлён вниз, но неполный байт тоже занимает целый байт.`, kk: `Бұл ${count} · ${Math.floor(bits / 8)}: құпиясөз төмен дөңгелектелген, бірақ толық емес байт та бүтін байт орын алады.` },
        },
        {
          text: String(count * bits),
          why: { ru: `Это ${count} · ${bits}: получены биты, а ответ нужен в байтах (1 байт = 8 бит).`, kk: `Бұл ${count} · ${bits}: бит шықты, ал жауап байтпен керек (1 байт = 8 бит).` },
        },
        {
          text: String(count * (bytes + 1)),
          why: { ru: `Это ${count} · ${bytes + 1}: на пароль взят лишний байт — округлять вверх нужно ровно до целого.`, kk: `Бұл ${count} · ${bytes + 1}: бір құпиясөзге артық байт алынған — тек бүтінге дейін жоғары дөңгелектеу керек.` },
        },
      ],
    });
  }
  if (kind === "reverse-bytes") {
    const i = int(rand, 3, 7);
    const k = byteStep(i) * int(rand, 8, 60);
    const v = (k * i) / 8;
    return input(
      id(`i${i}-k${k}`),
      level,
      {
        ru: `Текст из ${symbolsOf(k)} занимает ${v} байт. Какое наибольшее число символов может быть в алфавите, которым записан текст?`,
        kk: `${k} символдан тұратын мәтін ${v} байт алады. Мәтін жазылған әліпбиде ең көбі неше символ болуы мүмкін?`,
      },
      { ru: "Переведи байты в биты, раздели на число символов — получишь i. Потом N = 2ⁱ.", kk: "Байтты битке айналдыр, символдар санына бөл — i шығады. Содан кейін N = 2ⁱ." },
      {
        ru: `${v} байт = ${v} · 8 = ${v * 8} бит. i = ${v * 8} : ${k} = ${i} бит. N = 2${sup(i)} = ${2 ** i}.`,
        kk: `${v} байт = ${v} · 8 = ${v * 8} бит. i = ${v * 8} : ${k} = ${i} бит. N = 2${sup(i)} = ${2 ** i}.`,
      },
      2 ** i,
    );
  }
  if (kind === "codes-min") {
    const m = pick(rand, [3, 4, 5] as const);
    const n = int(rand, m ** 2 + 1, m ** 4);
    let k = 1;
    while (m ** k < n) k++;
    return input(
      id(`m${m}-n${n}`),
      level,
      {
        ru: `Флажки бывают ${m} ${ruPl(m, "цвет", "цвета", "цветов")}. Какое наименьшее число флажков, поднятых подряд, позволит передать ${n} ${ruPl(n, "сигнал", "сигнала", "сигналов")} (все разные)?`,
        kk: `${m} түсті жалаушалармен қатарынан ${n} түрлі сигнал беру керек. Қатарда ең азы неше жалауша қажет?`,
      },
      { ru: "Сигналов из k флажков m цветов — mᵏ. Подбирай наименьшее k, при котором mᵏ ≥ N.", kk: "m түсті k жалаушадан сигналдар саны — mᵏ. mᵏ ≥ N болатын ең кіші k таңда." },
      {
        ru: `${m}${sup(k - 1)} = ${m ** (k - 1)} < ${n} ≤ ${m ** k} = ${m}${sup(k)}, значит нужно ${k} ${ruPl(k, "флажок", "флажка", "флажков")}.`,
        kk: `${m}${sup(k - 1)} = ${m ** (k - 1)} < ${n} ≤ ${m ** k} = ${m}${sup(k)}, демек ${k} жалауша керек.`,
      },
      k,
    );
  }
  // volume-bytes
  const n = nonPow2(rand, 20, 200);
  const i = bitsFor(n);
  const k = byteStep(i) * int(rand, 4, 40);
  const bytes = (k * i) / 8;
  return input(
    id(`n${n}-k${k}`),
    level,
    {
      ru: `Текст из ${symbolsOf(k)} записан алфавитом мощностью ${n} равномерным кодом минимальной длины. Сколько байт занимает текст?`,
      kk: `${k} символдан тұратын мәтін қуаты ${n} әліпбимен ең қысқа біркелкі кодпен жазылған. Мәтін неше байт алады?`,
    },
    HINT_FIND_I,
    {
      ru: `${n} не степень двойки: i = ${i} бит (2${sup(i)} = ${2 ** i} ≥ ${n}). I = ${k} · ${i} = ${k * i} бит = ${bytes} байт.`,
      kk: `${n} екінің дәрежесі емес: i = ${i} бит (2${sup(i)} = ${2 ** i} ≥ ${n}). I = ${k} · ${i} = ${k * i} бит = ${bytes} байт.`,
    },
    bytes,
    "байт",
  );
}

// ---------- Утверждения, пары, короткие вопросы ----------

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const value = rand() < 0.5;
  if (level === 1) {
    const i = int(rand, 2, 8);
    const n = 2 ** i;
    const claim = value ? i : pick(rand, [i - 1, i + 1]);
    return {
      id: `s:${SKILL}:w:${n}:${claim}`,
      skill: SKILL,
      level,
      text: { ru: `Для алфавита из ${n} символов вес одного символа равен ${claim} бит`, kk: `${n} символдық әліпбиде бір символдың салмағы ${claim} битке тең` },
      value,
      explanation: { ru: `2${sup(i)} = ${n}, значит i = ${i} бит.`, kk: `2${sup(i)} = ${n}, демек i = ${i} бит.` },
    };
  }
  if (level === 2) {
    const n = nonPow2(rand, 5, 200);
    const i = bitsFor(n);
    const claim = value ? i : pick(rand, [i - 1, i + 1]);
    return {
      id: `s:${SKILL}:np:${n}:${claim}`,
      skill: SKILL,
      level,
      text: { ru: `Для алфавита из ${n} символов вес одного символа равен ${claim} бит`, kk: `${n} символдық әліпбиде бір символдың салмағы ${claim} битке тең` },
      value,
      explanation: {
        ru: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, значит i = ${i} бит (округляем вверх).`,
        kk: `2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i}, демек i = ${i} бит (жоғары дөңгелектейміз).`,
      },
    };
  }
  const n = nonPow2(rand, 20, 100);
  const len = int(rand, 5, 14);
  const i = bitsFor(n);
  const bytes = Math.ceil((len * i) / 8);
  const claim = value ? bytes : pick(rand, [Math.floor((len * i) / 8), bytes + 1].filter((v) => v !== bytes && v > 0));
  return {
    id: `s:${SKILL}:pw:${n}:${len}:${claim}`,
    skill: SKILL,
    level,
    text: {
      ru: `Пароль из ${len} символов алфавита мощностью ${n} (минимальный равномерный код, целое число байт) занимает ${claim} байт`,
      kk: `Қуаты ${n} әліпбидің ${len} символынан тұратын құпиясөз (ең қысқа біркелкі код, бүтін байт саны) ${claim} байт алады`,
    },
    value: claim === bytes,
    explanation: {
      ru: `i = ${i} бит, ${len} · ${i} = ${len * i} бит = ${(len * i) / 8} байта → округляем вверх: ${bytes} байт.`,
      kk: `i = ${i} бит, ${len} · ${i} = ${len * i} бит = ${(len * i) / 8} байт → жоғары дөңгелектейміз: ${bytes} байт.`,
    },
  };
}

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1) {
    const i = int(rand, 1, 8);
    return { id: `p:${SKILL}:pow:${i}`, skill: SKILL, level, left: `i = ${i}`, right: `N = ${2 ** i}` };
  }
  if (level === 2) {
    // K символов по i бит → объём (пары с разными значениями произведения).
    const [k, i] = pick(rand, [[6, 5], [8, 4], [10, 6], [12, 3], [15, 7], [20, 8], [9, 5], [14, 6]] as const);
    return { id: `p:${SKILL}:vol:${k}:${i}`, skill: SKILL, level, left: `K = ${k}, i = ${i}`, right: `I = ${k * i} бит` };
  }
  const [m, k] = pick(rand, [[2, 4], [3, 2], [3, 3], [4, 3], [5, 2], [6, 2], [2, 6], [10, 2]] as const);
  return {
    id: `p:${SKILL}:codes:${m}:${k}`,
    skill: SKILL,
    level,
    left: { ru: `${m} символ(а), длина ${k}`, kk: `${m} символ, ұзындығы ${k}` },
    right: `${m ** k}`,
  };
}

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const i = int(rand, 2, 8);
    const n = 2 ** i;
    return {
      id: `q:${SKILL}:w:${n}`,
      skill: SKILL,
      level,
      prompt: { ru: `N = ${n}. Чему равен вес символа i (в битах)?`, kk: `N = ${n}. Символдың салмағы i неге тең (бит)?` },
      answer: String(i),
      mode: "number",
      explanation: same(`2${sup(i)} = ${n} → i = ${i}`),
    };
  }
  if (level === 2) {
    const n = nonPow2(rand, 5, 150);
    const i = bitsFor(n);
    return {
      id: `q:${SKILL}:np:${n}`,
      skill: SKILL,
      level,
      prompt: { ru: `N = ${n}. Чему равен вес символа i (в битах)?`, kk: `N = ${n}. Символдың салмағы i неге тең (бит)?` },
      answer: String(i),
      mode: "number",
      explanation: same(`2${sup(i - 1)} = ${2 ** (i - 1)} < ${n} ≤ ${2 ** i} → i = ${i}`),
    };
  }
  const n = nonPow2(rand, 20, 100);
  const len = int(rand, 5, 14);
  const i = bitsFor(n);
  const bytes = Math.ceil((len * i) / 8);
  return {
    id: `q:${SKILL}:pw:${n}:${len}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `Пароль: ${len} символов, N = ${n}. Сколько байт займёт пароль (минимальный целый байт)?`,
      kk: `Құпиясөз: ${len} символ, N = ${n}. Құпиясөз неше байт алады (ең аз бүтін байт)?`,
    },
    answer: String(bytes),
    mode: "number",
    explanation: same(`i = ${i}; ${len} · ${i} = ${len * i} бит → ⌈${len * i} : 8⌉ = ${bytes}`),
  };
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
