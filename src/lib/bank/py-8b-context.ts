import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import { poolBank } from "./pool";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.context («Контекстные задания: касса»). Две части:
//  1) генератор «кассы»: программа с вводом до нуля, continue для мелочи и (на уровне C) скидкой x − x // 10.
//     Правильный ответ считает код (kassaRun повторяет логику программы), неверные варианты — типичные ошибки:
//     continue не учтён, граница < и <= перепутана, скидка забыта. kassaChecks() отдаёт те же программы для сверки в python3;
//  2) статичный пул (знания и разборы небольших программ): ответы пересчитаны в python3.
// Тексты после чисел — без падежных окончаний (в казахском окончание зависит от числа): формулы и двоеточия.

const SKILL = "py.context";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const w = (ru: string, kk: string): L => ({ ru, kk });
const codeScene = (lines: string[], marks?: number[]): Scene => ({ kind: "code", lang: "python", lines, ...(marks ? { marks } : {}) });

// ======================================================================
// Генератор «кассы»
// ======================================================================

interface KassaOpts {
  /** Порог мелочи. */
  low: number;
  /** true: пропускаем x < low, false: x <= low. */
  strict: boolean;
  /** Скидка x − x // 10 для x >= thr (ge) или x > thr. */
  disc?: { thr: number; ge: boolean };
  /** Что печатает программа: только n, только total или обе строки (n, затем total). */
  show: "n" | "total" | "both";
}

interface KassaMod {
  /** Не пропускать мелочь (как будто нет continue). */
  noSkip?: boolean;
  /** Не применять скидку. */
  noDisc?: boolean;
  /** Поменять < на <= (и > на >=) на границах. */
  flipLow?: boolean;
  flipDisc?: boolean;
}

function kassaLines(o: KassaOpts): string[] {
  const lines = ["total = 0", "n = 0", "while True:", "    x = int(input())", "    if x == 0:", "        break", `    if x ${o.strict ? "<" : "<="} ${o.low}:`, "        continue"];
  if (o.disc) lines.push(`    if x ${o.disc.ge ? ">=" : ">"} ${o.disc.thr}:`, "        x = x - x // 10");
  lines.push("    total += x", "    n += 1");
  if (o.show !== "total") lines.push("print(n)");
  if (o.show !== "n") lines.push("print(total)");
  return lines;
}

interface KassaResult {
  n: number;
  total: number;
  skipped: number[];
  /** Цены, попавшие в чек (после скидки), и подписи «x → y» для объяснения. */
  added: string[];
}

function kassaRun(o: KassaOpts, xs: number[], mod: KassaMod = {}): KassaResult {
  let total = 0;
  let n = 0;
  const skipped: number[] = [];
  const added: string[] = [];
  const strictLow = mod.flipLow ? !o.strict : o.strict;
  for (const x0 of xs) {
    if (x0 === 0) break;
    let x = x0;
    const isSmall = strictLow ? x < o.low : x <= o.low;
    if (isSmall && !mod.noSkip) {
      skipped.push(x0);
      continue;
    }
    if (o.disc && !mod.noDisc) {
      const ge = mod.flipDisc ? !o.disc.ge : o.disc.ge;
      if (ge ? x >= o.disc.thr : x > o.disc.thr) x = x - Math.floor(x / 10);
    }
    total += x;
    n += 1;
    added.push(x === x0 ? String(x0) : `${x0} → ${x}`);
  }
  return { n, total, skipped, added };
}

/** Данные для сверки в python3: программа, ввод и ожидаемый вывод по версии TypeScript. */
export interface KassaCheck {
  lines: string[];
  stdin: string;
  /** Что программа реально выводит (то, что насчитал TypeScript). */
  stdout: string;
}
let sink: KassaCheck[] | null = null;
function emit(o: KassaOpts, xs: number[]) {
  if (!sink) return;
  const r = kassaRun(o, xs);
  const out: string[] = [];
  if (o.show !== "total") out.push(String(r.n));
  if (o.show !== "n") out.push(String(r.total));
  sink.push({ lines: kassaLines(o), stdin: `${xs.join("\n")}\n`, stdout: out.join("\n") });
}

/** Ввод для кассы: мелочь, обычные цены, при необходимости — граничные и дорогие; в конце 0. */
function makeInputs(rand: Rand, o: KassaOpts, f: { boundaryLow?: boolean; big?: boolean; boundaryThr?: boolean }): number[] {
  const xs: number[] = [];
  const upper = o.disc ? o.disc.thr - 1 : o.low * 6;
  const small = () => 5 * int(rand, 2, Math.floor((o.low - 1) / 5));
  const mid = () => 10 * int(rand, Math.floor(o.low / 10) + 1, Math.floor(upper / 10));
  for (let i = int(rand, 1, 2); i > 0; i--) xs.push(small());
  for (let i = o.disc ? int(rand, 1, 2) : int(rand, 2, 3); i > 0; i--) xs.push(mid());
  if (f.boundaryLow) xs.push(o.low);
  if (o.disc && f.big) for (let i = int(rand, 1, 2); i > 0; i--) xs.push(int(rand, o.disc.thr + 1, o.disc.thr * 2));
  if (o.disc && f.boundaryThr) xs.push(o.disc.thr);
  return [...shuffle(xs, rand), 0];
}

const listText = (xs: number[]) => xs.join(", ");
const lowCond = (o: KassaOpts) => `x ${o.strict ? "<" : "<="} ${o.low}`;

function inputPhrase(xs: number[]): L {
  const l = listText(xs);
  return w(`при вводе ${l} (каждое число с новой строки)`, `${l} енгізілгенде (әр сан жаңа жолдан)`);
}

const HINT_KASSA: L = w(
  "Иди по вводу слева направо. Для каждого числа реши: оно пропускается (continue) или идёт в чек? Если в программе есть скидка, примени её, и только потом прибавь к сумме.",
  "Енгізуді солдан оңға қарай жүр. Әр сан үшін шеш: ол өткізіліп жіберіле ме (continue), әлде чекке түседі ме? Программада жеңілдік болса, оны қолданып, содан кейін ғана қосындыға қос.",
);
const HINT_FLIP: L = w(
  "Найди в вводе число, на котором условие меняет результат: на границе знак < или <= решает, пропустить товар или нет. Остальные числа считай как раньше.",
  "Енгізуде шарт нәтижені өзгертетін санды тап: шекарада < немесе <= белгісі тауарды өткізіп жіберу-жібермеуді шешеді. Қалған сандарды бұрынғыдай есепте.",
);
const GENERIC_WHY: L = w(
  "Такое значение не получается при аккуратной трассировке: пройди ввод по порядку ещё раз.",
  "Мұндай мән мұқият трассировкада шықпайды: енгізуді ретімен қайта өт.",
);

function explainKassa(o: KassaOpts, r: KassaResult, tail: L): L {
  const sk = r.skipped.length ? listText(r.skipped) : null;
  const ad = r.added.length ? r.added.join(", ") : null;
  return w(
    `Пропущены (continue): ${sk ?? "нет"}. Учтены: ${ad ?? "нет"}. ${tail.ru}`,
    `Өткізіліп жіберілді (continue): ${sk ?? "жоқ"}. Есепке алынды: ${ad ?? "жоқ"}. ${tail.kk}`,
  );
}

interface GenBase {
  id: string;
  level: Level;
  prompt: L;
  scene: Scene;
  hint: L;
  explanation: L;
}

/** Числовой вопрос: choice с тремя неверными (с разбором) или ввод числа, если неверных не хватило. */
function askNumber(rand: Rand, base: GenBase, right: number, wrongs: { value: number; why: L }[], pChoice = 0.65): ChoiceStep | InputStep {
  const seen = new Set<number>([right]);
  const uniq: { value: number; why: L }[] = [];
  const add = (v: number, why: L) => {
    if (v < 0 || seen.has(v)) return;
    seen.add(v);
    uniq.push({ value: v, why });
  };
  for (const x of wrongs) add(x.value, x.why);
  for (const v of [right + 1, right - 1, right + 2, right * 2]) add(v, GENERIC_WHY);
  if (uniq.length >= 3 && rand() < pChoice) {
    const chosen = uniq.slice(0, 3);
    const all = shuffle([{ value: right, why: null as L | null }, ...chosen], rand);
    return {
      type: "choice",
      skill: SKILL,
      ...base,
      options: all.map((a) => String(a.value)),
      correct: all.findIndex((a) => a.why === null),
      whyWrong: all.map((a) => a.why),
    };
  }
  return { type: "input", skill: SKILL, ...base, answers: [String(right)], mode: "number" };
}

type Gen = (rand: Rand, level: Level, seed: number) => ChoiceStep | InputStep;

const WHY = {
  noSkip: w("Здесь в сумму попала и мелочь, но continue её пропускает.", "Мұнда қосындыға ұсақ-түйек те түскен, бірақ оны continue өткізіп жібереді."),
  noSkipN: w("Здесь посчитаны и пропущенные товары, а n увеличивается только для учтённых.", "Мұнда өткізіліп жіберілген тауарлар да саналған, ал n тек есепке алынғандар үшін артады."),
  noDisc: w("Скидка забыта: для дорогих товаров цена уменьшается на x // 10.", "Жеңілдік ұмытылған: қымбат тауарлар үшін баға x // 10 шамасына кемиді."),
  flip: w("Граница устроена иначе: число, равное порогу, обрабатывается по-другому.", "Шекара басқаша құрылған: шекке тең сан басқаша өңделеді."),
  skippedN: w("Это число пропущенных товаров, а выводится число учтённых.", "Бұл өткізіліп жіберілген тауарлар саны, ал есепке алынғандар саны шығады."),
  skippedSum: w("Это сумма пропущенных товаров, а в чек идут остальные.", "Бұл өткізіліп жіберілген тауарлардың қосындысы, ал чекке қалғандары түседі."),
  nInstead: w("Это число учтённых товаров n, а второй строкой выводится сумма total.", "Бұл есепке алынған тауарлар саны n, ал екінші жолға total қосындысы шығады."),
};

/** A: простая касса без скидки — сумма или число товаров. */
const genPlain: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100]), strict: true, show: pick(rand, ["total", "n"] as const) };
  const xs = makeInputs(rand, o, {});
  emit(o, xs);
  const r = kassaRun(o, xs);
  const asked = o.show === "total" ? r.total : r.n;
  const tail = o.show === "total" ? w(`Сумма: ${r.total}.`, `Қосынды: ${r.total}.`) : w(`Учтено товаров: ${r.n}.`, `Есепке алынған тауарлар: ${r.n}.`);
  const all = kassaRun(o, xs, { noSkip: true });
  const wrongs =
    o.show === "total"
      ? [
          { value: all.total, why: WHY.noSkip },
          { value: r.skipped.reduce((s, x) => s + x, 0), why: WHY.skippedSum },
          { value: r.n, why: WHY.nInstead },
        ]
      : [
          { value: all.n, why: WHY.noSkipN },
          { value: r.skipped.length, why: WHY.skippedN },
        ];
  return askNumber(rand, {
    id: `g:${SKILL}:plain:${o.show}:${seed}`,
    level,
    prompt: w(`Что выведет программа ${inputPhrase(xs).ru}?`, `${inputPhrase(xs).kk} программа не шығарады?`),
    scene: codeScene(kassaLines(o)),
    hint: HINT_KASSA,
    explanation: explainKassa(o, r, tail),
  }, asked, wrongs);
};

/** B: граница < / <= — в вводе есть число, равное порогу. */
const genBoundary: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100, 200]), strict: rand() < 0.5, show: pick(rand, ["total", "n"] as const) };
  const xs = makeInputs(rand, o, { boundaryLow: true });
  emit(o, xs);
  const r = kassaRun(o, xs);
  const flipped = kassaRun(o, xs, { flipLow: true });
  const all = kassaRun(o, xs, { noSkip: true });
  const asked = o.show === "total" ? r.total : r.n;
  const tail = o.show === "total" ? w(`Сумма: ${r.total}.`, `Қосынды: ${r.total}.`) : w(`Учтено товаров: ${r.n}.`, `Есепке алынған тауарлар: ${r.n}.`);
  const wrongs =
    o.show === "total"
      ? [
          { value: flipped.total, why: WHY.flip },
          { value: all.total, why: WHY.noSkip },
          { value: r.skipped.reduce((s, x) => s + x, 0), why: WHY.skippedSum },
        ]
      : [
          { value: flipped.n, why: WHY.flip },
          { value: all.n, why: WHY.noSkipN },
          { value: r.skipped.length, why: WHY.skippedN },
        ];
  const what = o.show === "total" ? w("сумму", "қосындыны") : w("число товаров", "тауарлар санын");
  return askNumber(rand, {
    id: `g:${SKILL}:bound:${o.show}:${seed}`,
    level,
    prompt: w(
      `Программа выводит ${what.ru} в чеке. Какое число будет выведено ${inputPhrase(xs).ru}?`,
      `Программа чектегі ${what.kk} шығарады. ${inputPhrase(xs).kk} қандай сан шығады?`,
    ),
    scene: codeScene(kassaLines(o), [6]),
    hint: HINT_FLIP,
    explanation: explainKassa(o, r, tail),
  }, asked, wrongs);
};

/** B: «что изменится» — знак в строке 7 заменили на соседний. */
const genFlip: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100, 200]), strict: rand() < 0.5, show: pick(rand, ["total", "n"] as const) };
  const xs = makeInputs(rand, o, { boundaryLow: true });
  const flipO: KassaOpts = { ...o, strict: !o.strict };
  emit(flipO, xs);
  const r0 = kassaRun(o, xs);
  const r = kassaRun(o, xs, { flipLow: true });
  const all = kassaRun(o, xs, { noSkip: true });
  const asked = o.show === "total" ? r.total : r.n;
  const orig = o.show === "total" ? r0.total : r0.n;
  const tail = o.show === "total" ? w(`Сумма после замены: ${r.total}.`, `Ауыстырудан кейінгі қосынды: ${r.total}.`) : w(`Учтено товаров после замены: ${r.n}.`, `Ауыстырудан кейін есепке алынған тауарлар: ${r.n}.`);
  const from = lowCond(o);
  const to = lowCond(flipO);
  const what = o.show === "total" ? w("сумму", "қосындыны") : w("число товаров", "тауарлар санын");
  const wrongs =
    o.show === "total"
      ? [
          { value: orig, why: w("Это ответ исходной программы: после замены товар на границе обрабатывается по-другому.", "Бұл бастапқы программаның жауабы: ауыстырудан кейін шекаралық тауар басқаша өңделеді.") },
          { value: all.total, why: WHY.noSkip },
        ]
      : [
          { value: orig, why: w("Это ответ исходной программы: после замены товар на границе обрабатывается по-другому.", "Бұл бастапқы программаның жауабы: ауыстырудан кейін шекаралық тауар басқаша өңделеді.") },
          { value: all.n, why: WHY.noSkipN },
        ];
  return askNumber(rand, {
    id: `g:${SKILL}:flip:${o.show}:${seed}`,
    level,
    prompt: w(
      `Программа выводит ${what.ru} в чеке. Что она выведет ${inputPhrase(xs).ru}, если в строке 7 заменить ${from} на ${to}?`,
      `Программа чектегі ${what.kk} шығарады. 7-жолда ${from} өрнегін ${to} өрнегімен ауыстырса, ${inputPhrase(xs).kk} ол не шығарады?`,
    ),
    scene: codeScene(kassaLines(o), [6]),
    hint: HINT_FLIP,
    explanation: explainKassa(flipO, r, tail),
  }, asked, wrongs);
};

/** B: сколько раз сработает continue. */
const genSkipCount: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100, 200]), strict: rand() < 0.5, show: "both" };
  const xs = makeInputs(rand, o, { boundaryLow: true });
  emit(o, xs);
  const r = kassaRun(o, xs);
  const count = xs.length - 1;
  const flipped = kassaRun(o, xs, { flipLow: true });
  return askNumber(rand, {
    id: `g:${SKILL}:skips:${seed}`,
    level,
    prompt: w(
      `Сколько раз сработает continue ${inputPhrase(xs).ru}?`,
      `${inputPhrase(xs).kk} continue неше рет орындалады?`,
    ),
    scene: codeScene(kassaLines(o), [7]),
    hint: w(
      "Для каждого числа до нуля проверь условие в строке 7. Считай только те числа, для которых оно верно (ноль останавливает цикл раньше).",
      "Нөлге дейінгі әр сан үшін 7-жолдағы шартты тексер. Тек шарт ақиқат сандарды сана (нөл циклді ертерек тоқтатады).",
    ),
    explanation: w(
      `Условие ${lowCond(o)} верно для: ${listText(r.skipped)}. Это ${r.skipped.length} раз (число ${o.low} на границе: ${o.strict ? "знак <, не пропускается" : "знак <=, пропускается"}).`,
      `${lowCond(o)} шарты мына сандар үшін ақиқат: ${listText(r.skipped)}. Бұл ${r.skipped.length} рет (шекаралық ${o.low} саны ${o.strict ? "< белгісімен: өткізіліп жіберілмейді" : "<= белгісімен: өткізіліп жіберіледі"}).`,
    ),
  }, r.skipped.length, [
    { value: flipped.skipped.length, why: WHY.flip },
    { value: r.n, why: w("Это число учтённых товаров, а нужно число пропусков.", "Бұл есепке алынған тауарлар саны, ал өткізулер саны керек.") },
    { value: count, why: w("Это число всех введённых цен, а continue срабатывает не для каждой.", "Бұл енгізілген барлық бағаның саны, ал continue әрқайсысында орындалмайды.") },
  ]);
};

/** C: касса со скидкой — вторая строка вывода (сумма). */
const genDiscount: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100]), strict: rand() < 0.7, disc: { thr: pick(rand, [500, 1000, 2000]), ge: rand() < 0.6 }, show: "both" };
  const xs = makeInputs(rand, o, { big: true, boundaryThr: rand() < 0.4, boundaryLow: rand() < 0.4 });
  emit(o, xs);
  const r = kassaRun(o, xs);
  const noDisc = kassaRun(o, xs, { noDisc: true });
  const all = kassaRun(o, xs, { noSkip: true });
  const flipD = kassaRun(o, xs, { flipDisc: true });
  const flipL = kassaRun(o, xs, { flipLow: true });
  const wrongs = [
    { value: noDisc.total, why: WHY.noDisc },
    { value: all.total, why: WHY.noSkip },
    { value: flipD.total, why: WHY.flip },
    { value: flipL.total, why: WHY.flip },
    { value: r.n, why: WHY.nInstead },
  ];
  return askNumber(rand, {
    id: `g:${SKILL}:disc:${seed}`,
    level,
    prompt: w(
      `Что выведет программа второй строкой ${inputPhrase(xs).ru}?`,
      `${inputPhrase(xs).kk} программа екінші жолға не шығарады?`,
    ),
    scene: codeScene(kassaLines(o)),
    hint: w(
      "Для каждой учтённой цены проверь условие скидки. Скидка — это x // 10 с отбрасыванием дробной части, она вычитается из цены. Потом сложи цены.",
      "Есепке алынған әр баға үшін жеңілдік шартын тексер. Жеңілдік — бөлшек бөлігі алынып тасталған x // 10, ол бағадан шегеріледі. Содан кейін бағаларды қос.",
    ),
    explanation: explainKassa(o, r, w(`Первая строка: ${r.n}, вторая (сумма): ${r.total}.`, `Бірінші жол: ${r.n}, екінші (қосынды): ${r.total}.`)),
  }, r.total, wrongs);
};

/** C: «что изменится» — условие скидки изменили (>= на > или наоборот), в вводе есть число, равное порогу. */
const genDiscountFlip: Gen = (rand, level, seed) => {
  const o: KassaOpts = { low: pick(rand, [50, 100]), strict: true, disc: { thr: pick(rand, [500, 1000, 2000]), ge: rand() < 0.5 }, show: "both" };
  const xs = makeInputs(rand, o, { big: true, boundaryThr: true });
  const disc = o.disc!;
  const flipO: KassaOpts = { ...o, disc: { ...disc, ge: !disc.ge } };
  emit(flipO, xs);
  const r0 = kassaRun(o, xs);
  const r = kassaRun(o, xs, { flipDisc: true });
  const noDisc = kassaRun(o, xs, { noDisc: true });
  const from = `x ${disc.ge ? ">=" : ">"} ${disc.thr}`;
  const to = `x ${disc.ge ? ">" : ">="} ${disc.thr}`;
  return askNumber(rand, {
    id: `g:${SKILL}:discflip:${seed}`,
    level,
    prompt: w(
      `Что выведет программа второй строкой ${inputPhrase(xs).ru}, если в строке 9 заменить ${from} на ${to}?`,
      `9-жолда ${from} өрнегін ${to} өрнегімен ауыстырса, ${inputPhrase(xs).kk} программа екінші жолға не шығарады?`,
    ),
    scene: codeScene(kassaLines(o), [8]),
    hint: w(
      "Найди в вводе число, равное порогу скидки: после замены знака именно оно меняет цену. Остальные цены считай как раньше.",
      "Енгізуде жеңілдік шегіне тең санды тап: таңбаны ауыстырғаннан кейін бағаны дәл сол өзгертеді. Қалған бағаларды бұрынғыдай есепте.",
    ),
    explanation: explainKassa(flipO, r, w(`Сумма после замены: ${r.total}.`, `Ауыстырудан кейінгі қосынды: ${r.total}.`)),
  }, r.total, [
    { value: r0.total, why: w("Это ответ исходной программы: после замены число на пороге обрабатывается по-другому.", "Бұл бастапқы программаның жауабы: ауыстырудан кейін шектегі сан басқаша өңделеді.") },
    { value: noDisc.total, why: WHY.noDisc },
  ]);
};

const GENS: Record<Level, Gen[]> = {
  1: [genPlain],
  2: [genBoundary, genFlip, genSkipCount],
  3: [genDiscount, genDiscountFlip],
};

/** Для проверки: те же программы и ввод с выводом, посчитанным TypeScript (сверяется в python3). */
export function kassaChecks(level: Level, seed: number): KassaCheck[] {
  const out: KassaCheck[] = [];
  sink = out;
  try {
    for (const gen of GENS[level]) gen(seeded(seed + out.length), level, seed);
  } finally {
    sink = null;
  }
  return out;
}

// ----- утверждения и короткие вопросы по кассе -----

function kassaWords(o: KassaOpts): L {
  const disc = o.disc;
  return w(
    `Программа кассы читает цены, пока не введён 0. Цены, для которых ${lowCond(o)}, пропускаются (continue)${disc ? `, а при x ${disc.ge ? ">=" : ">"} ${disc.thr} цена уменьшается на x // 10` : ""}.`,
    `Касса программасы 0 енгізілгенше бағаларды оқиды. ${lowCond(o)} болатын бағалар өткізіліп жіберіледі (continue)${disc ? `, ал x ${disc.ge ? ">=" : ">"} ${disc.thr} болғанда баға x // 10 шамасына кемиді` : ""}.`,
  );
}

function kassaStatement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const o: KassaOpts = level === 3
    ? { low: pick(rand, [50, 100]), strict: true, disc: { thr: pick(rand, [500, 1000]), ge: true }, show: "both" }
    : { low: pick(rand, [50, 100, 200]), strict: level === 1 ? true : rand() < 0.5, show: "both" };
  const xs = makeInputs(rand, o, { boundaryLow: level === 2, big: level === 3 });
  const r = kassaRun(o, xs);
  const value = rand() < 0.5;
  const wrongPool = [kassaRun(o, xs, { flipLow: true }).total, kassaRun(o, xs, { noSkip: true }).total, kassaRun(o, xs, { noDisc: true }).total, r.total + 10, r.total - 10].filter((v) => v !== r.total && v > 0);
  const claim = value ? r.total : pick(rand, wrongPool);
  return {
    id: `s:${SKILL}:kassa:${level}:${seed}`,
    skill: SKILL,
    level,
    text: w(`${kassaWords(o).ru} При вводе ${listText(xs)} сумма чека равна ${claim}.`, `${kassaWords(o).kk} ${listText(xs)} енгізілгенде чектің қосындысы ${claim} болады.`),
    value,
    explanation: explainKassa(o, r, w(`Сумма чека: ${r.total}.`, `Чектің қосындысы: ${r.total}.`)),
    hint: w("Пройди ввод по порядку: что пропускается, что идёт в чек. Сравни свою сумму с названной.", "Енгізуді ретімен өт: не өткізіліп жіберіледі, не чекке түседі. Өз қосындыңды аталған қосындымен салыстыр."),
  };
}

function kassaShort(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const o: KassaOpts = level === 3
    ? { low: pick(rand, [50, 100]), strict: true, disc: { thr: pick(rand, [500, 1000]), ge: true }, show: "both" }
    : { low: pick(rand, [50, 100, 200]), strict: level === 1 ? true : rand() < 0.5, show: "both" };
  const xs = makeInputs(rand, o, { boundaryLow: level === 2, big: level === 3 });
  const r = kassaRun(o, xs);
  const asksTotal = level === 3 || rand() < 0.6;
  const answer = asksTotal ? r.total : r.n;
  return {
    id: `q:${SKILL}:kassa:${level}:${seed}`,
    skill: SKILL,
    level,
    prompt: w(
      `${kassaWords(o).ru} Ввод: ${listText(xs)}. Чему равна ${asksTotal ? "сумма чека" : "число товаров в чеке"}?`,
      `${kassaWords(o).kk} Енгізу: ${listText(xs)}. ${asksTotal ? "Чектің қосындысы" : "Чектегі тауарлар саны"} неге тең?`,
    ),
    answer: String(answer),
    mode: "number",
    explanation: explainKassa(o, r, asksTotal ? w(`Сумма чека: ${r.total}.`, `Чектің қосындысы: ${r.total}.`) : w(`Товаров в чеке: ${r.n}.`, `Чектегі тауарлар: ${r.n}.`)),
    hint: w("Пройди ввод по порядку: пропущенные не считай, к остальным примени скидку (если она есть).", "Енгізуді ретімен өт: өткізіліп жіберілгендерді санама, қалғандарына жеңілдікті (бар болса) қолдан."),
  };
}

// ======================================================================
// Статичный пул
// ======================================================================

type Opt = [ru: string, kk: string];
type WrongOpt = [ru: string, kk: string, whyRu: string, whyKk: string];

const lt = (o: Opt): L => ({ ru: o[0], kk: o[1] });
const txt = (ru: string, kk: string): Text => (ru === kk ? ru : { ru, kk });

/** choice: верный вариант первым (poolBank перемешает), неверные — с разбором ошибки. */
function ch(name: string, level: Level, prompt: Opt, right: Opt, wrongs: WrongOpt[], hint: Opt, expl: Opt, scene?: Scene): ChoiceStep {
  return {
    type: "choice",
    id: `p:${SKILL}:${name}`,
    skill: SKILL,
    level,
    prompt: lt(prompt),
    ...(scene ? { scene } : {}),
    options: [txt(right[0], right[1]), ...wrongs.map((x) => txt(x[0], x[1]))],
    correct: 0,
    whyWrong: [null, ...wrongs.map((x) => w(x[2], x[3]))],
    hint: lt(hint),
    explanation: lt(expl),
  };
}

function inp(name: string, level: Level, prompt: Opt, answer: string, hint: Opt, expl: Opt, scene?: Scene): InputStep {
  return {
    type: "input",
    id: `p:${SKILL}:${name}`,
    skill: SKILL,
    level,
    prompt: lt(prompt),
    ...(scene ? { scene } : {}),
    answers: [answer],
    mode: "number",
    hint: lt(hint),
    explanation: lt(expl),
  };
}

const SUM_UNTIL_ZERO = ["s = 0", "while True:", "    x = int(input())", "    if x == 0:", "        break", "    s += x", "print(s)"];
const TIER = ["s = int(input())", "if s >= 5000:", "    print(3)", "elif s >= 2000:", "    print(2)", "elif s >= 500:", "    print(1)", "else:", "    print(0)"];
const BAKERY = [
  "n = int(input())",
  "total = 0",
  "free = 0",
  "for i in range(n):",
  "    p = int(input())",
  "    if p <= 200:",
  "        free += 1",
  "        continue",
  "    if p > 2000:",
  "        p = p - 300",
  "    total += p",
  "print(free)",
  "print(total)",
];
const KASSA = kassaLines({ low: 100, strict: true, disc: { thr: 1000, ge: true }, show: "both" });
const SWAPPED = ["total = 0", "while True:", "    x = int(input())", "    if x < 100:", "        continue", "    if x == 0:", "        break", "    total += x", "print(total)"];

const QUESTIONS: QuestionStep[] = [
  // ---------------- A ----------------
  inp(
    "trace-marks",
    1,
    ["Что выведет программа при вводе 5, 2, 4, 1 (каждое число с новой строки)?", "5, 2, 4, 1 енгізілгенде (әр сан жаңа жолдан) программа не шығарады?"],
    "9",
    ["Для каждой оценки проверь условие m < 3: такие оценки пропускает continue. Остальные прибавляются к s.", "Әр баға үшін m < 3 шартын тексер: мұндай бағаларды continue өткізіп жібереді. Қалғандары s-ке қосылады."],
    ["Оценки 2 и 1 меньше 3 и пропускаются. Складываются 5 и 4: s = 9.", "2 және 1 бағалары 3-тен кіші, олар өткізіліп жіберіледі. 5 және 4 қосылады: s = 9."],
    codeScene(["s = 0", "for i in range(4):", "    m = int(input())", "    if m < 3:", "        continue", "    s += m", "print(s)"]),
  ),
  ch(
    "input-order-n",
    1,
    ["Что выведет программа при вводе 3, 2, 5, 4 (каждое число с новой строки)?", "3, 2, 5, 4 енгізілгенде (әр сан жаңа жолдан) программа не шығарады?"],
    ["40", "40"],
    [
      ["120", "120", "Так получится, если умножить и число 3. Но первое число читается в n и в произведение не входит.", "Бұл 3 санын да көбейткенде шығады. Бірақ бірінші сан n-ге оқылады да, көбейтіндіге кірмейді."],
      ["11", "11", "11 — это сумма 2 + 5 + 4, а программа перемножает числа.", "11 — бұл 2 + 5 + 4 қосындысы, ал программа сандарды көбейтеді."],
      ["20", "20", "20 — произведение только двух последних чисел. Цикл выполняется три раза.", "20 — тек соңғы екі санның көбейтіндісі. Цикл үш рет орындалады."],
    ],
    ["Первое число читается в n и задаёт, сколько чисел перемножать. Сколько их и какие это числа?", "Бірінші сан n-ге оқылады және қанша санды көбейту керегін көрсетеді. Олар қанша және қандай сандар?"],
    ["n = 3, цикл читает 2, 5, 4 и перемножает: 2 · 5 · 4 = 40.", "n = 3, цикл 2, 5, 4 сандарын оқып, көбейтеді: 2 · 5 · 4 = 40."],
    codeScene(["n = int(input())", "p = 1", "for i in range(n):", "    p *= int(input())", "print(p)"]),
  ),
  ch(
    "lines-count",
    1,
    ["Сколько строк выведет программа при вводе 4, 12, 10, 25, 11 (каждое число с новой строки)?", "4, 12, 10, 25, 11 енгізілгенде (әр сан жаңа жолдан) программа неше жол шығарады?"],
    ["3", "3"],
    [
      ["5", "5", "5 — число введённых чисел, а print срабатывает не для каждого.", "5 — енгізілген сандар саны, ал print әрқайсысына орындалмайды."],
      ["4", "4", "Так получится при условии x >= 10. Но число 10 не больше 10, оно не выводится.", "Бұл x >= 10 шартында шығады. Бірақ 10 саны 10-нан үлкен емес, ол шықпайды."],
      ["2", "2", "Выводятся три числа: 12, 25 и 11. Число 11 тоже больше 10.", "Үш сан шығады: 12, 25 және 11. 11 саны да 10-нан үлкен."],
    ],
    ["Для каждого числа проверь условие x > 10. print срабатывает только там, где оно верно.", "Әр сан үшін x > 10 шартын тексер. print тек шарт ақиқат жерде орындалады."],
    ["Условие x > 10 верно для 12, 25 и 11, а для 4 и 10 ложно. print выполнился три раза: три строки.", "x > 10 шарты 12, 25 және 11 үшін ақиқат, ал 4 және 10 үшін жалған. print үш рет орындалды: үш жол."],
    codeScene(["for i in range(5):", "    x = int(input())", "    if x > 10:", "        print(x)"]),
  ),
  ch(
    "role-break",
    1,
    ["Что делает команда break в этой программе?", "Бұл программада break командасы не істейді?"],
    ["Заканчивает цикл, когда введён ноль", "Нөл енгізілгенде циклді аяқтайды"],
    [
      ["Пропускает ноль и читает следующее число", "Нөлді өткізіп жіберіп, келесі санды оқиды", "Так работает continue. break выходит из цикла совсем.", "Бұл continue-дің жұмысы. break циклден мүлде шығады."],
      ["Завершает программу, print не выполняется", "Программаны аяқтайды, print орындалмайды", "break выходит только из цикла: print(s) после цикла выполняется.", "break тек циклден шығады: циклден кейінгі print(s) орындалады."],
      ["Прибавляет ноль к сумме", "Нөлді қосындыға қосады", "Сумму увеличивает строка s += x, а до неё при нуле дело не доходит.", "Қосындыны s += x жолы арттырады, ал нөлде оған кезек жетпейді."],
    ],
    ["Посмотри, что будет после break: куда переходит выполнение и выполнится ли строка print(s).", "break-тен кейін не болатынын қара: орындалу қайда өтеді және print(s) жолы орындала ма."],
    ["При x = 0 срабатывает break: цикл прекращается, и программа продолжает работу с print(s). Так ввод заканчивается нулём.", "x = 0 болғанда break орындалады: цикл тоқтайды, ал программа print(s) жолынан жалғасады. Енгізу осылай нөлмен аяқталады."],
    codeScene(SUM_UNTIL_ZERO, [4]),
  ),
  ch(
    "purpose-average",
    1,
    ["Что вычисляет эта программа?", "Бұл программа нені есептейді?"],
    ["Целую часть среднего арифметического введённых чисел", "Енгізілген сандардың орта арифметикалығының бүтін бөлігін"],
    [
      ["Сумму введённых чисел", "Енгізілген сандардың қосындысын", "Сумма s делится на количество c: выводится s // c, а не s.", "s қосындысы c санына бөлінеді: s емес, s // c шығады."],
      ["Количество введённых чисел", "Енгізілген сандардың санын", "Количество c делит сумму, а выводится результат деления.", "c саны қосындыны бөледі, ал бөлу нәтижесі шығады."],
      ["Наибольшее из введённых чисел", "Енгізілген сандардың ең үлкенін", "Программа ничего не сравнивает, а складывает числа.", "Программа ештеңені салыстырмайды, сандарды қосады."],
    ],
    ["Посмотри, что накапливают переменные s и c, и что делается с ними в последней строке.", "s және c айнымалылары нені жинайтынын және соңғы жолда олармен не істелетінін қара."],
    ["s накапливает сумму, c считает числа. s // c — целая часть среднего арифметического. Для ввода 4, 6, 8: 18 // 3 = 6.", "s қосындыны жинайды, c сандарды санайды. s // c — орта арифметикалықтың бүтін бөлігі. 4, 6, 8 енгізуі үшін: 18 // 3 = 6."],
    codeScene(["c = 0", "s = 0", "for i in range(3):", "    x = int(input())", "    c += 1", "    s += x", "print(s // c)"]),
  ),
  ch(
    "legend-vs-code",
    1,
    ["В описании: «скидка от 500 тенге», а в коде стоит условие x > 500. Получит ли скидку товар за ровно 500 тенге?", "Сипаттамада: «500 теңгеден бастап жеңілдік», ал кодта x > 500 шарты тұр. Дәл 500 теңгелік тауар жеңілдік ала ма?"],
    ["Нет: программа работает по коду, а 500 > 500 ложно", "Жоқ: программа кодқа сай жұмыс істейді, ал 500 > 500 жалған"],
    [
      ["Да, ведь так сказано в описании", "Иә, себебі сипаттамада солай айтылған", "Выполняется код, а не описание. Условие 500 > 500 ложно.", "Кодты орындайды, сипаттама емес. 500 > 500 шарты жалған."],
      ["Да, потому что 500 — это граница", "Иә, себебі 500 — шекара", "Граничное значение попадает в условие только при знаке >=.", "Шекаралық мән шартқа тек >= таңбасымен ғана кіреді."],
      ["Нельзя определить без запуска программы", "Программаны іске қоспай анықтау мүмкін емес", "Определить можно: достаточно подставить 500 в условие.", "Анықтауға болады: 500 санын шартқа қою жеткілікті."],
    ],
    ["Подставь 500 в условие x > 500. Что важнее для программы: описание или код?", "500 санын x > 500 шартына қой. Программа үшін не маңыздырақ: сипаттама ма, әлде код па?"],
    ["Подставим x = 500: условие 500 > 500 ложно, скидка не применяется. Если описание и код расходятся, программа всё равно выполняет код.", "x = 500 қояйық: 500 > 500 шарты жалған, жеңілдік қолданылмайды. Сипаттама мен код қайшы болса да, программа кодты орындайды."],
    codeScene(["if x > 500:", "    x = x - x // 10"], [0]),
  ),
  ch(
    "plan-first",
    1,
    ["Контекстное задание: одна программа и пять вопросов. Как разумно действовать?", "Контекстік тапсырма: бір программа және бес сұрақ. Қалай әрекет ету орынды?"],
    ["Один раз понять программу и пользоваться этим во всех вопросах", "Программаны бір рет түсініп, оны барлық сұраққа пайдалану"],
    [
      ["Каждый вопрос решать заново, не глядя на программу целиком", "Әр сұрақты программаны түгел қарамай, қайтадан шешу", "Так уходит много времени: понимание программы нужно один раз и годится для всех пяти вопросов.", "Бұлай уақыт көп кетеді: программаны түсіну бір рет қажет және бес сұраққа да жарайды."],
      ["Пропустить описание и смотреть только на вопросы", "Сипаттаманы оқымай, тек сұрақтарға қарау", "Описание объясняет, что значат переменные, и экономит время.", "Сипаттама айнымалылардың мағынасын түсіндіреді және уақытты үнемдейді."],
      ["Выбирать ответ, который выглядит правдоподобно", "Шындыққа ұқсас жауапты таңдау", "Дистракторы нарочно выглядят правдоподобно: нужно считать.", "Дистракторлар әдейі шындыққа ұқсас көрінеді: санау керек."],
    ],
    ["Подумай, где экономится время: на каждый вопрос заново читать программу или понять её один раз?", "Уақыт қайда үнемделетінін ойла: әр сұраққа программаны қайта оқу ма, әлде бір рет түсіну ме?"],
    ["Все пять вопросов относятся к одной программе. Прочитав её один раз и записав таблицу, ты используешь её в каждом вопросе.", "Бес сұрақтың бәрі бір программаға қатысты. Оны бір рет оқып, кестені жазғаннан кейін оны әр сұрақта пайдаланасың."],
  ),

  // ---------------- B ----------------
  inp(
    "change-lt-le",
    2,
    ["Что выведет программа при вводе 50, 80, 20, 50 (каждое число с новой строки), если в строке 4 заменить x < 50 на x <= 50?", "Егер 4-жолда x < 50 өрнегін x <= 50 өрнегімен ауыстырса, 50, 80, 20, 50 енгізілгенде (әр сан жаңа жолдан) программа не шығарады?"],
    "80",
    ["Найди в вводе числа, равные 50: после замены знака continue пропускает и их. Затем сложи оставшиеся.", "Енгізуде 50-ге тең сандарды тап: таңбаны ауыстырғаннан кейін continue оларды да өткізіп жібереді. Содан кейін қалғандарын қос."],
    ["Теперь пропускаются числа не больше 50: 50, 20 и 50. Остаётся 80, t = 80. До замены было 50 + 80 + 50 = 180.", "Енді 50-ден артық емес сандар өткізіліп жіберіледі: 50, 20 және 50. 80 қалады, t = 80. Ауыстыруға дейін 50 + 80 + 50 = 180 болған."],
    codeScene(["t = 0", "for i in range(4):", "    x = int(input())", "    if x < 50:", "        continue", "    t += x", "print(t)"], [3]),
  ),
  ch(
    "if-vs-elif",
    2,
    ["Что выведет программа при вводе 9?", "9 енгізілгенде программа не шығарады?"],
    ["3", "3"],
    [
      ["1", "1", "Так было бы, если бы вторая проверка была elif. Здесь два отдельных if, и оба условия верны.", "Екінші тексеру elif болса, осылай болар еді. Мұнда екі бөлек if, және екі шарт та ақиқат."],
      ["2", "2", "2 добавляется только во второй проверке, но и первая тоже срабатывает: 1 + 2.", "2 тек екінші тексеруде қосылады, бірақ бірінші де орындалады: 1 + 2."],
      ["0", "0", "9 > 5 верно, поэтому r уже увеличивается.", "9 > 5 ақиқат, сондықтан r әлдеқашан артады."],
    ],
    ["Проверь оба условия по очереди. Они стоят в отдельных if, поэтому второй if проверяется всегда.", "Екі шартты кезекпен тексер. Олар бөлек if ішінде тұр, сондықтан екінші if әрқашан тексеріледі."],
    ["9 > 5 верно: r = 1. Затем отдельный if: 9 > 8 верно: r = 1 + 2 = 3. При elif вторая ветка не проверялась бы, и вывод был бы 1.", "9 > 5 ақиқат: r = 1. Содан кейін бөлек if: 9 > 8 ақиқат: r = 1 + 2 = 3. elif болса, екінші тармақ тексерілмес еді, шығару 1 болар еді."],
    codeScene(["x = int(input())", "r = 0", "if x > 5:", "    r += 1", "if x > 8:", "    r += 2", "print(r)"]),
  ),
  ch(
    "count-or",
    2,
    ["Чему равно значение c после выполнения программы?", "Программа орындалғаннан кейін c мәні неге тең?"],
    ["10", "10"],
    [
      ["12", "12", "7 + 5 = 12 — это кратные 4 и кратные 6 по отдельности. Числа 12 и 24 кратны обоим и посчитаны дважды, а программа считает каждое число один раз.", "7 + 5 = 12 — бұл 4-ке еселілер мен 6-ға еселілер бөлек-бөлек. 12 және 24 екеуіне де еселі, екі рет саналған, ал программа әр санды бір рет санайды."],
      ["7", "7", "7 — количество чисел, кратных 4. Числа, кратные 6 (но не 4), тоже считаются.", "7 — 4-ке еселі сандардың саны. 6-ға еселі (бірақ 4-ке емес) сандар да саналады."],
      ["5", "5", "5 — количество чисел, кратных 6. Кратные 4 тоже считаются.", "5 — 6-ға еселі сандардың саны. 4-ке еселілер де саналады."],
    ],
    ["Условие с or срабатывает, если число кратно 4 или 6 (или обоим). Выпиши такие числа от 1 до 30 и аккуратно сосчитай каждое один раз.", "or бар шарт сан 4-ке немесе 6-ға (немесе екеуіне де) еселі болса орындалады. 1-ден 30-ға дейінгі осындай сандарды жазып, әрқайсысын бір рет сана."],
    ["Кратны 4: 4, 8, 12, 16, 20, 24, 28 (7 чисел). Кратны 6: 6, 12, 18, 24, 30 (5 чисел). Числа 12 и 24 в обоих списках. Всего 7 + 5 − 2 = 10.", "4-ке еселі: 4, 8, 12, 16, 20, 24, 28 (7 сан). 6-ға еселі: 6, 12, 18, 24, 30 (5 сан). 12 және 24 екі тізімде де бар. Барлығы 7 + 5 − 2 = 10."],
    codeScene(["c = 0", "for i in range(1, 31):", "    if i % 4 == 0 or i % 6 == 0:", "        c += 1", "print(c)"]),
  ),
  ch(
    "equivalent-change",
    2,
    ["Какая замена не меняет вывод программы ни при каком вводе целых чисел?", "Қандай ауыстыру бүтін сандардың ешбір енгізуінде программаның шығаруын өзгертпейді?"],
    ["Заменить x < 10 на x <= 9", "x < 10 өрнегін x <= 9 өрнегімен ауыстыру"],
    [
      ["Заменить continue на break", "continue командасын break командасымен ауыстыру", "break остановит цикл на первом числе меньше 10, остальные числа не прочитаются.", "break циклді 10-нан кіші бірінші санда тоқтатады, қалған сандар оқылмайды."],
      ["Заменить s += x на s += 1", "s += x өрнегін s += 1 өрнегімен ауыстыру", "Тогда программа считает количество чисел от 10 и больше, а не их сумму.", "Онда программа 10-нан кем емес сандардың қосындысын емес, санын есептейді."],
      ["Заменить range(4) на range(3)", "range(4) өрнегін range(3) өрнегімен ауыстыру", "Цикл прочитает на одно число меньше, и сумма изменится.", "Цикл бір санға аз оқиды да, қосынды өзгереді."],
    ],
    ["Для целых чисел подумай, какие значения проходят условие. Для каждого варианта придумай ввод, на котором вывод изменится.", "Бүтін сандар үшін қандай мәндер шартқа сәйкес келетінін ойла. Әр нұсқа үшін шығару өзгеретін енгізу ойлап тап."],
    ["Для целых x < 10 и x <= 9 означают одно и то же: числа 9, 8, 7 и так далее. Остальные замены меняют вывод: break, s += 1 и range(3) дают другой результат.", "Бүтін x үшін x < 10 және x <= 9 бірдей мағына береді: 9, 8, 7 және т.с.с. сандар. Қалған ауыстырулар шығаруды өзгертеді: break, s += 1 және range(3) басқа нәтиже береді."],
    codeScene(["s = 0", "for i in range(4):", "    x = int(input())", "    if x < 10:", "        continue", "    s += x", "print(s)"]),
  ),
  inp(
    "digits-odd",
    2,
    ["Что выведет программа второй строкой при вводе 4172?", "4172 енгізілгенде программа екінші жолға не шығарады?"],
    "8",
    ["Цикл по очереди берёт цифры числа с конца (n % 10). Выпиши цифры и отметь нечётные: именно их считает c и складывает s.", "Цикл санның цифрларын соңынан кезекпен алады (n % 10). Цифрларды жазып, тақтарын белгіле: c дәл оларды санайды, s қосады."],
    ["Цифры с конца: 2, 7, 1, 4. Нечётные 7 и 1: c = 2, s = 7 + 1 = 8. Вторая строка — s.", "Цифрлар соңынан: 2, 7, 1, 4. Тақ цифрлар 7 және 1: c = 2, s = 7 + 1 = 8. Екінші жол — s."],
    codeScene(["n = int(input())", "c = 0", "s = 0", "while n > 0:", "    d = n % 10", "    if d % 2 == 1:", "        c += 1", "        s += d", "    n //= 10", "print(c)", "print(s)"]),
  ),
  ch(
    "which-line-5000",
    2,
    ["Заказ ровно на 5000 тенге должен давать 2 балла, а не 3; остальные суммы не меняются. Какое изменение нужно?", "Дәл 5000 теңгелік тапсырыс 3 емес, 2 ұпай беруі керек; қалған сомалар өзгермейді. Қандай өзгеріс қажет?"],
    ["В строке 2 заменить s >= 5000 на s > 5000", "2-жолда s >= 5000 өрнегін s > 5000 өрнегімен ауыстыру"],
    [
      ["В строке 3 заменить print(3) на print(2)", "3-жолда print(3) өрнегін print(2) өрнегімен ауыстыру", "Тогда 2 балла получат все заказы от 5000, а не только ровно 5000.", "Онда 2 ұпайды 5000-нан бастап барлық тапсырыс алады, тек дәл 5000 емес."],
      ["В строке 4 заменить s >= 2000 на s > 2000", "4-жолда s >= 2000 өрнегін s > 2000 өрнегімен ауыстыру", "Это изменит результат для суммы ровно 2000, а не 5000.", "Бұл дәл 2000 сомасының нәтижесін өзгертеді, 5000 емес."],
      ["В строке 6 заменить s >= 500 на s >= 5000", "6-жолда s >= 500 өрнегін s >= 5000 өрнегімен ауыстыру", "Это лишит баллов заказы от 500 до 4999.", "Бұл 500-ден 4999-ға дейінгі тапсырыстарды ұпайдан айырады."],
    ],
    ["Нужно, чтобы значение 5000 перестало попадать в первую ветку, но попало во вторую. Какой знак это сделает?", "5000 мәні бірінші тармаққа түспей, екіншісіне түсуі керек. Мұны қандай таңба жасайды?"],
    ["При s > 5000 сумма ровно 5000 не проходит первую проверку и попадает в s >= 2000: выводится 2. Суммы больше 5000 по-прежнему дают 3.", "s > 5000 болғанда дәл 5000 сомасы бірінші тексеруден өтпей, s >= 2000 тармағына түседі: 2 шығады. 5000-нан артық сомалар бұрынғыдай 3 береді."],
    codeScene(TIER),
  ),
  inp(
    "count-continue-even",
    2,
    ["Сколько раз сработает continue при вводе 3, 4, 7, 10, 5, 6 (каждое число с новой строки)?", "3, 4, 7, 10, 5, 6 енгізілгенде (әр сан жаңа жолдан) continue неше рет орындалады?"],
    "3",
    ["Для каждого из шести чисел проверь условие x % 2 == 0. continue срабатывает там, где оно верно.", "Алты санның әрқайсысы үшін x % 2 == 0 шартын тексер. continue шарт ақиқат жерде орындалады."],
    ["Чётные числа 4, 10 и 6 дают остаток 0, и для них срабатывает continue: 3 раза. Нечётные 3, 7, 5 прибавляются к s.", "Жұп 4, 10 және 6 сандары 0 қалдығын береді, олар үшін continue орындалады: 3 рет. Тақ 3, 7, 5 сандары s-ке қосылады."],
    codeScene(["s = 0", "for i in range(6):", "    x = int(input())", "    if x % 2 == 0:", "        continue", "    s += x", "print(s)"], [4]),
  ),

  // ---------------- C ----------------
  ch(
    "reverse-sum",
    3,
    ["Программа вывела 18. Какой ввод возможен (числа вводятся по одному в строке)?", "Программа 18 шығарды. Қандай енгізу мүмкін (әр сан жаңа жолдан)?"],
    ["4, 6, 8, 0", "4, 6, 8, 0"],
    [
      ["4, 6, 0, 8", "4, 6, 0, 8", "Ноль стоит третьим: число 8 после него не читается, сумма 10.", "Нөл үшінші болып тұр: одан кейінгі 8 саны оқылмайды, қосынды 10."],
      ["9, 9, 9, 0", "9, 9, 9, 0", "Сумма 27: три числа по 9 дают больше 18.", "Қосынды 27: 9 + 9 + 9 = 27, бұл 18-ден көп."],
      ["0, 9, 9", "0, 9, 9", "Ввод начинается с нуля: цикл сразу останавливается, сумма 0.", "Енгізу нөлден басталады: цикл бірден тоқтайды, қосынды 0."],
    ],
    ["Помни: ввод читается до первого нуля, а числа после нуля не читаются. Для каждого варианта найди сумму до нуля.", "Есіңде болсын: енгізу бірінші нөлге дейін оқылады, ал нөлден кейінгі сандар оқылмайды. Әр нұсқа үшін нөлге дейінгі қосындыны тап."],
    ["Нужно, чтобы сумма чисел до первого нуля была равна 18. «4, 6, 8, 0»: 4 + 6 + 8 = 18. В остальных вариантах сумма равна 10, 27 и 0.", "Бірінші нөлге дейінгі сандардың қосындысы 18 болуы керек. «4, 6, 8, 0»: 4 + 6 + 8 = 18. Қалған нұсқаларда қосынды 10, 27 және 0 болады."],
    codeScene(SUM_UNTIL_ZERO),
  ),
  ch(
    "parking-trace",
    3,
    ["Парковка на 2 места. Команды вводятся по одной в строке: in — машина въезжает, out — выезжает. Что выведет программа при вводе in, in, in, out, in?", "2 орындық тұрақ. Командалар әрқайсысы жаңа жолдан енгізіледі: in — көлік кіреді, out — шығады. in, in, in, out, in енгізілгенде программа не шығарады?"],
    ["3 0", "3 0"],
    [
      ["4 0", "4 0", "Третья команда in пропущена: мест нет (free == 0). Въехали три машины, а не четыре.", "Үшінші in командасы өткізіліп жіберілді: орын жоқ (free == 0). Төрт емес, үш көлік кірді."],
      ["2 0", "2 0", "После out место освободилось, и последняя команда in сработала.", "out-тан кейін орын босады, және соңғы in командасы орындалды."],
      ["3 1", "3 1", "После последнего in свободных мест нет: free = 0.", "Соңғы in-нен кейін бос орын жоқ: free = 0."],
    ],
    ["Веди таблицу free и ok по командам. Когда free равно 0, команда in пропускается; out увеличивает free.", "Командалар бойынша free және ok кестесін жүргіз. free 0 болғанда in командасы өткізіліп жіберіледі; out free мәнін арттырады."],
    ["free = 2. in: free = 1, ok = 1. in: free = 0, ok = 2. in: free == 0, continue. out: free = 1. in: free = 0, ok = 3. Вывод: 3 0.", "free = 2. in: free = 1, ok = 1. in: free = 0, ok = 2. in: free == 0, continue. out: free = 1. in: free = 0, ok = 3. Шығару: 3 0."],
    codeScene(["free = 2", "ok = 0", "for i in range(5):", "    c = input()", '    if c == "in":', "        if free == 0:", "            continue", "        free -= 1", "        ok += 1", "    else:", "        free += 1", "print(ok, free)"]),
  ),
  inp(
    "exec-count-break",
    3,
    ["Сколько раз выполнится строка s += i?", "s += i жолы неше рет орындалады?"],
    "6",
    ["Веди таблицу i и s. Останови, когда s станет больше 40: на этом круге строка s += i ещё выполняется, а i += 3 — уже нет.", "i және s кестесін жүргіз. s 40-тан асқанда тоқта: сол айналымда s += i жолы әлі орындалады, ал i += 3 — енді жоқ."],
    ["Значения i в момент s += i: 2, 5, 8, 11, 14, 17, а s становится 2, 7, 15, 26, 40, 57. Условие s > 40 впервые верно на шестом круге (57), там срабатывает break. Строка выполнилась 6 раз.", "s += i сәтіндегі i мәндері: 2, 5, 8, 11, 14, 17, ал s 2, 7, 15, 26, 40, 57 болады. s > 40 шарты алғаш алтыншы айналымда (57) ақиқат болады, сонда break орындалады. Жол 6 рет орындалды."],
    codeScene(["s = 0", "i = 2", "while True:", "    s += i", "    if s > 40:", "        break", "    i += 3", "print(i)"], [3]),
  ),
  ch(
    "order-swap",
    3,
    ["Что произойдёт при вводе 150, 0 (каждое число с новой строки)?", "150, 0 енгізілгенде (әр сан жаңа жолдан) не болады?"],
    ["Ноль пропустит continue, цикл не закончится и программа будет ждать следующее число", "Нөлді continue өткізіп жібереді, цикл аяқталмайды да, программа келесі санды күтеді"],
    [
      ["Программа выведет 150", "Программа 150 шығарады", "До print дело не дойдёт: цикл не завершается.", "print-ке кезек жетпейді: цикл аяқталмайды."],
      ["Программа выведет 0", "Программа 0 шығарады", "Вывода не будет: цикл не заканчивается.", "Шығару болмайды: цикл аяқталмайды."],
      ["Цикл закончится на нуле по команде break", "Цикл нөлде break командасымен аяқталады", "Проверка x < 100 стоит раньше: 0 < 100 верно, и срабатывает continue, а до break дело не доходит.", "x < 100 тексеруі бұрын тұр: 0 < 100 ақиқат, continue орындалады, ал break-ке кезек жетпейді."],
    ],
    ["Проверь, какая из двух проверок стоит раньше и верна ли она для нуля.", "Екі тексерудің қайсысы бұрын тұрғанын және ол нөл үшін ақиқат екенін тексер."],
    ["Для x = 0 сначала проверяется x < 100: это верно, срабатывает continue, и проверка x == 0 пропущена. Цикл продолжается и ждёт новое число. В уроке «Цикл while, break и continue» эту же ловушку мы уже разбирали.", "x = 0 үшін алдымен x < 100 тексеріледі: ол ақиқат, continue орындалады да, x == 0 тексеруі өткізіліп жіберіледі. Цикл жалғасып, жаңа санды күтеді. «while циклі, break және continue» сабағында дәл осы тұзақты талдаған едік."],
    codeScene(SWAPPED, [3, 5]),
  ),
  inp(
    "zeros-count",
    3,
    ["Что выведет программа при вводе 90210?", "90210 енгізілгенде программа не шығарады?"],
    "3",
    ["Цикл берёт цифры числа с конца. Для цифры 0 срабатывает continue, и счётчик не растёт. Сколько цифр ненулевые?", "Цикл санның цифрларын соңынан алады. 0 цифры үшін continue орындалады, санауыш өспейді. Нөлден өзге цифр қанша?"],
    ["Цифры 90210 с конца: 0, 1, 2, 0, 9. Для двух нулей срабатывает continue, c += 1 выполняется для 1, 2 и 9. Вывод: 3.", "90210 цифрлары соңынан: 0, 1, 2, 0, 9. Екі нөл үшін continue орындалады, c += 1 1, 2 және 9 үшін орындалады. Шығару: 3."],
    codeScene(["n = int(input())", "c = 0", "while n > 0:", "    d = n % 10", "    n //= 10", "    if d == 0:", "        continue", "    c += 1", "print(c)"]),
  ),
  inp(
    "bakery-total",
    3,
    ["Пекарня: покупка не дороже 200 тенге выдаётся в подарок, на покупку дороже 2000 скидка 300 тенге. Что выведет программа второй строкой при вводе 4, 250, 180, 2200, 2001?", "Наубайхана: 200 теңгеден қымбат емес сатып алу сыйлыққа беріледі, 2000-нан қымбат сатып алуға 300 теңге жеңілдік. 4, 250, 180, 2200, 2001 енгізілгенде программа екінші жолға не шығарады?"],
    "3851",
    ["Первое число — n. Среди остальных четырёх найди подарки (не дороже 200) и цены со скидкой (больше 2000), потом сложи цены к оплате.", "Бірінші сан — n. Қалған төртеуінің ішінен сыйлықтарды (200-ден қымбат емес) және жеңілдігі бар бағаларды (2000-нан артық) тап, содан кейін төлеуге тиісті бағаларды қос."],
    ["n = 4. 180 — подарок, пропущен. 250 платится полностью, 2200 − 300 = 1900, 2001 − 300 = 1701. Сумма 250 + 1900 + 1701 = 3851.", "n = 4. 180 — сыйлық, өткізіліп жіберілді. 250 толық төленеді, 2200 − 300 = 1900, 2001 − 300 = 1701. Қосынды 250 + 1900 + 1701 = 3851."],
    codeScene(BAKERY),
  ),
  ch(
    "kassa-two-lines",
    3,
    ["Что выведет программа (две строки) при вводе 1500, 90, 100, 1000, 0 (каждое число с новой строки)?", "1500, 90, 100, 1000, 0 енгізілгенде (әр сан жаңа жолдан) программа (екі жол) не шығарады?"],
    ["3 и 2350", "3 және 2350"],
    [
      ["4 и 2440", "4 және 2440", "Здесь в чек попало число 90, но оно меньше 100 и пропускается continue.", "Мұнда чекке 90 саны түскен, бірақ ол 100-ден кіші және continue өткізіп жібереді."],
      ["3 и 2600", "3 және 2600", "Скидка не применена: 1500 и 1000 стоят 1350 и 900.", "Жеңілдік қолданылмаған: 1500 және 1000 сәйкесінше 1350 және 900 тұрады."],
      ["2 и 2250", "2 және 2250", "Число 100 тоже учитывается: 100 < 100 ложно. Это ответ при условии x <= 100.", "100 саны да есепке алынады: 100 < 100 жалған. Бұл x <= 100 шартының жауабы."],
    ],
    ["Для каждого числа реши: пропустить (меньше 100), дать скидку (1000 и больше) или просто прибавить. Учти число ровно 100.", "Әр сан үшін шеш: өткізу (100-ден кіші), жеңілдік беру (1000 және одан жоғары) немесе жай қосу. Дәл 100 санын ескер."],
    ["1500: скидка 150, цена 1350. 90 — мелочь, пропущено. 100 учтено. 1000: скидка 100, цена 900. Учтены три товара: n = 3, total = 1350 + 100 + 900 = 2350.", "1500: жеңілдік 150, баға 1350. 90 — ұсақ-түйек, өткізіліп жіберілді. 100 есепке алынды. 1000: жеңілдік 100, баға 900. Үш тауар есепке алынды: n = 3, total = 1350 + 100 + 900 = 2350."],
    codeScene(KASSA),
  ),
];

const STATEMENTS: Statement[] = [
  { id: `s:${SKILL}:continue-next`, skill: SKILL, level: 1, text: w("Команда continue пропускает остаток текущего круга и переходит к следующему.", "continue командасы ағымдағы айналымның қалған бөлігін өткізіп, келесісіне өтеді."), value: true, explanation: w("Именно так: после continue цикл переходит к следующему кругу.", "Дәл солай: continue-ден кейін цикл келесі айналымға өтеді."), hint: w("Вспомни кассу: что делал continue с мелочью?", "Кассаны еске түсір: continue ұсақ-түйекпен не істеді?") },
  { id: `s:${SKILL}:break-program`, skill: SKILL, level: 1, text: w("Команда break завершает всю программу.", "break командасы бүкіл программаны аяқтайды."), value: false, explanation: w("break выходит только из цикла, а программа продолжается после него.", "break тек циклден шығады, ал программа одан кейін жалғасады."), hint: w("Подумай, какие строки выполняются после цикла.", "Циклден кейін қандай жолдар орындалатынын ойла.") },
  { id: `s:${SKILL}:input-next`, skill: SKILL, level: 1, text: w("Каждый вызов input() читает следующее значение из входных данных.", "input() әр шақыруы кіріс деректердің келесі мәнін оқиды."), value: true, explanation: w("Ввод читается по порядку: один вызов — одно значение.", "Енгізу ретімен оқылады: бір шақыру — бір мән."), hint: w("Вспомни ловушку про первое число n.", "Бірінші n санына қатысты тұзақты еске түсір.") },
  { id: `s:${SKILL}:five-questions`, skill: SKILL, level: 1, text: w("В контекстном задании ЕНТ к одной программе дают пять вопросов.", "ҰБТ-ның контекстік тапсырмасында бір программаға бес сұрақ беріледі."), value: true, explanation: w("Контекстное задание — это описание, программа и пять вопросов по четыре варианта.", "Контекстік тапсырма — сипаттама, программа және төрт нұсқалы бес сұрақ."), hint: w("Вспомни, сколько замков было на кассе в уроке.", "Сабақтағы кассада неше құлып болғанын еске түсір.") },
  { id: `s:${SKILL}:legend-wins`, skill: SKILL, level: 1, text: w("Если описание и код расходятся, надо верить описанию.", "Сипаттама мен код қайшы болса, сипаттамаға сену керек."), value: false, explanation: w("Программа выполняет код, поэтому верный ответ определяет код.", "Программа кодты орындайды, сондықтан дұрыс жауапты код анықтайды."), hint: w("Кто выполняет программу: описание или компьютер?", "Программаны кім орындайды: сипаттама ма, әлде компьютер ме?") },
  { id: `s:${SKILL}:le-border`, skill: SKILL, level: 2, text: w("Замена x < 100 на x <= 100 может изменить вывод только тогда, когда среди чисел ввода есть ровно 100.", "x < 100 өрнегін x <= 100 өрнегімен ауыстыру шығаруды тек енгізу сандарының арасында дәл 100 болғанда ғана өзгерте алады."), value: true, explanation: w("Для остальных чисел оба условия дают одинаковый результат; отличие только на границе.", "Қалған сандар үшін екі шарт бірдей нәтиже береді; айырмашылық тек шекарада."), hint: w("Найди число, для которого эти два условия дают разные ответы.", "Осы екі шарт әртүрлі жауап беретін санды тап.") },
  { id: `s:${SKILL}:elif-first`, skill: SKILL, level: 2, text: w("В цепочке if / elif / else выполняется только первая ветка с верным условием.", "if / elif / else тізбегінде шарты ақиқат бірінші тармақ қана орындалады."), value: true, explanation: w("Остальные ветки пропускаются, даже если их условия тоже верны.", "Қалған тармақтар, олардың шарттары да ақиқат болса да, өткізіліп жіберіледі."), hint: w("Подумай, проверяются ли остальные ветки после того, как одна уже сработала.", "Бір тармақ орындалғаннан кейін қалғандары тексеріле ме, соны ойла.") },
  { id: `s:${SKILL}:if-if-same`, skill: SKILL, level: 2, text: w("Три отдельных if подряд ведут себя так же, как if / elif / elif.", "Қатар тұрған үш бөлек if if / elif / elif тізбегі сияқты жұмыс істейді."), value: false, explanation: w("Отдельные if проверяются все, и несколько веток могут сработать. В цепочке с elif сработает не больше одной.", "Бөлек if-тер түгел тексеріледі, бірнеше тармақ орындалуы мүмкін. elif тізбегінде біреуден артық орындалмайды."), hint: w("Подумай, сколько веток сработает для числа, подходящего под все условия.", "Барлық шартқа сәйкес келетін сан үшін қанша тармақ орындалатынын ойла.") },
  { id: `s:${SKILL}:remove-line`, skill: SKILL, level: 2, text: w("Чтобы понять, зачем нужна строка, полезно мысленно убрать её и сравнить результаты.", "Жолдың не үшін керегін түсіну үшін оны ойша алып тастап, нәтижелерді салыстыру пайдалы."), value: true, explanation: w("Если без строки результат не меняется, она ничего не делает для этого ввода; если меняется, видно её роль.", "Жолсыз нәтиже өзгермесе, ол осы енгізу үшін ештеңе істемейді; өзгерсе, оның рөлі көрінеді."), hint: w("Вспомни приём из разбора про continue.", "continue туралы талдаудағы тәсілді еске түсір.") },
  { id: `s:${SKILL}:first-var`, skill: SKILL, level: 2, text: w("Первая строка вывода всегда равна значению первой переменной, объявленной в программе.", "Шығарудың бірінші жолы әрқашан программада алғаш жарияланған айнымалының мәніне тең."), value: false, explanation: w("Первой выводится то, что печатает первый по порядку выполнения print, а не первая переменная.", "Бірінші болып орындалу бойынша бірінші print басатын нәрсе шығады, бірінші айнымалы емес."), hint: w("Какая команда печатает значения?", "Қай команда мәндерді басады?") },
  { id: `s:${SKILL}:swap-zero`, skill: SKILL, level: 3, text: w("Если проверку x < 100 с continue поставить раньше проверки x == 0 с break, ввод нуля не остановит цикл.", "Егер continue бар x < 100 тексеруін break бар x == 0 тексеруінен бұрын қойса, нөлді енгізу циклді тоқтатпайды."), value: true, explanation: w("Для нуля 0 < 100 верно, срабатывает continue, и до break дело не доходит.", "Нөл үшін 0 < 100 ақиқат, continue орындалады да, break-ке кезек жетпейді."), hint: w("Проверь, какое из двух условий сработает для нуля первым.", "Нөл үшін екі шарттың қайсысы бірінші орындалатынын тексер.") },
  { id: `s:${SKILL}:discount-1000`, skill: SKILL, level: 3, text: w("При скидке x − x // 10 для x >= 1000 товар за 1000 после скидки стоит дешевле, чем товар за 999 без скидки.", "x >= 1000 үшін x − x // 10 жеңілдігі болғанда 1000 теңгелік тауар жеңілдіктен кейін жеңілдіксіз 999 теңгелік тауардан арзан тұрады."), value: true, explanation: w("1000 − 1000 // 10 = 900, а 999 скидки не получает и стоит 999.", "1000 − 1000 // 10 = 900, ал 999 жеңілдік алмайды және 999 тұрады."), hint: w("Посчитай цену после скидки для 1000 и сравни с 999.", "1000 үшін жеңілдіктен кейінгі бағаны есепте де, 999-бен салыстыр.") },
  { id: `s:${SKILL}:after-continue`, skill: SKILL, level: 3, text: w("Строка, которая стоит в теле цикла после continue, выполняется на каждом круге.", "Цикл денесінде continue-ден кейін тұрған жол әр айналымда орындалады."), value: false, explanation: w("Если на круге сработал continue, остаток тела пропускается, и строка после него не выполняется.", "Айналымда continue орындалса, дененің қалған бөлігі өткізіліп жіберіледі де, одан кейінгі жол орындалмайды."), hint: w("Что происходит с остатком тела, когда срабатывает continue?", "continue орындалғанда дененің қалған бөлігімен не болады?") },
  { id: `s:${SKILL}:answer-unique`, skill: SKILL, level: 3, text: w("Если при вводе 1000, x, 0 касса выводит 2 и 1800, то x обязательно равен 900.", "1000, x, 0 енгізілгенде касса 2 және 1800 шығарса, x міндетті түрде 900-ге тең."), value: false, explanation: w("Подходит и x = 1000: после скидки он тоже стоит 900. Поэтому x может быть 900 или 1000.", "x = 1000 да сәйкес келеді: жеңілдіктен кейін ол да 900 тұрады. Сондықтан x 900 немесе 1000 болуы мүмкін."), hint: w("Какие значения x дают после проверок цену 900?", "x-тің қандай мәндері тексеруден кейін 900 бағасын береді?") },
];

const PAIRS: Pair[] = [
  { id: `a:${SKILL}:continue`, skill: SKILL, level: 1, left: "continue", right: w("Перейти к следующему кругу", "Келесі айналымға өту") },
  { id: `a:${SKILL}:break`, skill: SKILL, level: 1, left: "break", right: w("Выйти из цикла", "Циклден шығу") },
  { id: `a:${SKILL}:input`, skill: SKILL, level: 1, left: "input()", right: w("Прочитать следующее значение ввода", "Енгізудің келесі мәнін оқу") },
  { id: `a:${SKILL}:sum`, skill: SKILL, level: 1, left: "total += x", right: w("Накопитель суммы", "Қосындының жинақтауышы") },
  { id: `a:${SKILL}:counter`, skill: SKILL, level: 1, left: "n += 1", right: w("Счётчик", "Санауыш") },
  { id: `a:${SKILL}:whiletrue`, skill: SKILL, level: 2, left: "while True", right: w("Цикл без условия, выход через break", "Шартсыз цикл, break арқылы шығу") },
  { id: `a:${SKILL}:lt`, skill: SKILL, level: 2, left: "x < 100", right: w("Число 100 не входит", "100 саны кірмейді") },
  { id: `a:${SKILL}:le`, skill: SKILL, level: 2, left: "x <= 100", right: w("Число 100 входит", "100 саны кіреді") },
  { id: `a:${SKILL}:elif`, skill: SKILL, level: 2, left: "elif", right: w("Проверяется, только если предыдущие условия ложны", "Алдыңғы шарттар жалған болғанда ғана тексеріледі") },
  { id: `a:${SKILL}:floor10`, skill: SKILL, level: 2, left: "x // 10", right: w("Целая часть от деления на 10", "10-ға бөлгендегі бүтін бөлік") },
  { id: `a:${SKILL}:discount`, skill: SKILL, level: 3, left: "x - x // 10", right: w("Цена со скидкой 10 % (дробная часть отброшена)", "10 % жеңілдігі бар баға (бөлшек бөлігі алынып тасталған)") },
  { id: `a:${SKILL}:legend`, skill: SKILL, level: 3, left: w("Описание и код расходятся", "Сипаттама мен код қайшы"), right: w("Верный ответ определяет код", "Дұрыс жауапты код анықтайды") },
];

const SHORTS: ShortQuestion[] = [
  { id: `q:${SKILL}:discount-1990`, skill: SKILL, level: 2, prompt: w("Скидка 10 % считается как x − x // 10. Сколько заплатит покупатель за товар 1990?", "10 % жеңілдік x − x // 10 болып есептеледі. Сатып алушы 1990 теңгелік тауар үшін қанша төлейді?"), answer: "1791", mode: "number", explanation: w("1990 // 10 = 199, цена 1990 − 199 = 1791.", "1990 // 10 = 199, баға 1990 − 199 = 1791."), hint: w("Сначала найди целую часть x // 10, потом вычти её из цены.", "Алдымен x // 10 бүтін бөлігін тап, содан кейін оны бағадан шегер.") },
  { id: `q:${SKILL}:discount-1234`, skill: SKILL, level: 3, prompt: w("Скидка считается как x − x // 10. Какую цену заплатит покупатель за товар 1234?", "Жеңілдік x − x // 10 болып есептеледі. Сатып алушы 1234 теңгелік тауар үшін қандай баға төлейді?"), answer: "1111", mode: "number", explanation: w("1234 // 10 = 123 (дробная часть отброшена), цена 1234 − 123 = 1111.", "1234 // 10 = 123 (бөлшек бөлігі алынып тасталған), баға 1234 − 123 = 1111."), hint: w("Целая часть при делении 1234 на 10 — это 123, а не 123,4.", "1234 санын 10-ға бөлгендегі бүтін бөлік — 123, ал 123,4 емес.") },
  { id: `q:${SKILL}:count-even`, skill: SKILL, level: 1, prompt: w("Вводятся числа 4, 7, 10, 3, 8. Счётчик k увеличивается на 1 для каждого чётного числа. Чему равен k после ввода?", "4, 7, 10, 3, 8 сандары енгізіледі. k санауышы әр жұп сан үшін 1-ге артады. Енгізуден кейін k неге тең?"), answer: "3", mode: "number", explanation: w("Чётные числа: 4, 10, 8. Их три.", "Жұп сандар: 4, 10, 8. Олар үшеу."), hint: w("Выпиши числа, которые делятся на 2 без остатка.", "2-ге қалдықсыз бөлінетін сандарды жаз.") },
  { id: `q:${SKILL}:sum-skip`, skill: SKILL, level: 1, prompt: w("Сумма s накапливает введённые числа, кроме тех, что меньше 10 (их пропускает continue). Ввод: 5, 12, 9, 20. Чему равна s?", "s қосындысы енгізілген сандарды жинақтайды, 10-нан кішілерден басқасын (оларды continue өткізіп жібереді). Енгізу: 5, 12, 9, 20. s неге тең?"), answer: "32", mode: "number", explanation: w("Числа 5 и 9 меньше 10 и пропущены. Складываются 12 и 20: 32.", "5 және 9 сандары 10-нан кіші, өткізіліп жіберілді. 12 және 20 қосылады: 32."), hint: w("Вычеркни числа меньше 10, остальные сложи.", "10-нан кіші сандарды сызып таста, қалғандарын қос.") },
  { id: `q:${SKILL}:input-n`, skill: SKILL, level: 1, prompt: w("Ввод: 3, 10, 20, 30. Первое число — n, затем n чисел складываются. Чему равна сумма?", "Енгізу: 3, 10, 20, 30. Бірінші сан — n, содан кейін n сан қосылады. Қосынды неге тең?"), answer: "60", mode: "number", explanation: w("Первое число 3 в сумму не входит: 10 + 20 + 30 = 60.", "Бірінші 3 саны қосындыға кірмейді: 10 + 20 + 30 = 60."), hint: w("Первое число сообщает, сколько чисел складывать, и само не складывается.", "Бірінші сан қанша санды қосу керегін айтады, өзі қосылмайды.") },
  { id: `q:${SKILL}:until-zero`, skill: SKILL, level: 1, prompt: w("Программа складывает числа до первого нуля. Ввод: 2, 1, 5, 0, 7. Чему равна сумма?", "Программа бірінші нөлге дейінгі сандарды қосады. Енгізу: 2, 1, 5, 0, 7. Қосынды неге тең?"), answer: "8", mode: "number", explanation: w("Складываются 2, 1 и 5: 8. Число 7 стоит после нуля и не читается.", "2, 1 және 5 қосылады: 8. 7 саны нөлден кейін тұр да, оқылмайды."), hint: w("Что происходит с числами после первого нуля?", "Бірінші нөлден кейінгі сандармен не болады?") },
  { id: `q:${SKILL}:skipped-small`, skill: SKILL, level: 1, prompt: w("Касса пропускает цены x < 100. Сколько из цен 99, 100, 101, 50, 150, 1 будет пропущено?", "Касса x < 100 болатын бағаларды өткізіп жібереді. 99, 100, 101, 50, 150, 1 бағаларының нешеуі өткізіліп жіберіледі?"), answer: "3", mode: "number", explanation: w("Меньше 100 числа 99, 50 и 1. Число 100 не меньше 100.", "100-ден кіші сандар: 99, 50 және 1. 100 саны 100-ден кіші емес."), hint: w("Для каждой цены проверь условие x < 100; число 100 — особый случай.", "Әр баға үшін x < 100 шартын тексер; 100 саны — ерекше жағдай.") },
  { id: `q:${SKILL}:div-four`, skill: SKILL, level: 2, prompt: w("Сколько раз выполнится c += 1 для условия i % 4 == 0, если i пробегает значения от 1 до 30?", "i мәндері 1-ден 30-ға дейін өтсе, i % 4 == 0 шарты үшін c += 1 неше рет орындалады?"), answer: "7", mode: "number", explanation: w("Кратны 4: 4, 8, 12, 16, 20, 24, 28. Их семь.", "4-ке еселілер: 4, 8, 12, 16, 20, 24, 28. Олар жетеу."), hint: w("Сколько чисел от 1 до 30 делится на 4 без остатка?", "1-ден 30-ға дейінгі қанша сан 4-ке қалдықсыз бөлінеді?") },
  { id: `q:${SKILL}:continue-three`, skill: SKILL, level: 2, prompt: w("Цикл перебирает i от 1 до 10. Для i, кратных 3, срабатывает continue, остальные доходят до строки после него. Сколько раз выполнится эта строка?", "Цикл i-ді 1-ден 10-ға дейін аралайды. 3-ке еселі i үшін continue орындалады, қалғандары одан кейінгі жолға жетеді. Бұл жол неше рет орындалады?"), answer: "7", mode: "number", explanation: w("Кратны 3: 3, 6, 9. Из десяти кругов три пропущены, остаётся 7.", "3-ке еселілер: 3, 6, 9. Он айналымнан үшеуі өткізіліп жіберіледі, 7 қалады."), hint: w("Сначала сосчитай, на каких кругах срабатывает continue, и вычти из 10.", "Алдымен continue қай айналымдарда орындалатынын сана да, 10-нан шегер.") },
  { id: `q:${SKILL}:no-discount-max`, skill: SKILL, level: 2, prompt: w("Скидка действует при x >= 500. Какое наибольшее целое значение x ещё не получает скидку?", "Жеңілдік x >= 500 болғанда әрекет етеді. Жеңілдік алмайтын ең үлкен бүтін x мәні қандай?"), answer: "499", mode: "number", explanation: w("Условие x >= 500 верно с 500, значит, не получает скидку 499 и меньшие числа.", "x >= 500 шарты 500-ден бастап ақиқат, демек, 499 және одан кіші сандар жеңілдік алмайды."), hint: w("Ближайшее число слева от границы 500.", "500 шекарасының сол жағындағы ең жақын сан.") },
  { id: `q:${SKILL}:bakery-2001`, skill: SKILL, level: 2, prompt: w("На покупку дороже 2000 тенге скидка 300 тенге. Сколько заплатит покупатель за покупку на 2001 тенге?", "2000 теңгеден қымбат сатып алуға 300 теңге жеңілдік. Сатып алушы 2001 теңгелік сатып алу үшін қанша төлейді?"), answer: "1701", mode: "number", explanation: w("2001 > 2000, скидка применяется: 2001 − 300 = 1701.", "2001 > 2000, жеңілдік қолданылады: 2001 − 300 = 1701."), hint: w("Проверь условие скидки для 2001, затем вычти 300.", "2001 үшін жеңілдік шартын тексер, содан кейін 300 шегер.") },
  { id: `q:${SKILL}:first-above`, skill: SKILL, level: 3, prompt: w("Скидка действует при x > 1000. Какое наименьшее целое значение x получит скидку?", "Жеңілдік x > 1000 болғанда әрекет етеді. Жеңілдік алатын ең кіші бүтін x мәні қандай?"), answer: "1001", mode: "number", explanation: w("Знак строгий: 1000 > 1000 ложно. Наименьшее целое, большее 1000, — 1001.", "Таңба қатаң: 1000 > 1000 жалған. 1000-нан үлкен ең кіші бүтін сан — 1001."), hint: w("Строгое неравенство не включает границу.", "Қатаң теңсіздік шекараны қоспайды.") },
  { id: `q:${SKILL}:kassa-two-prices`, skill: SKILL, level: 3, prompt: w("Касса из урока: x < 100 пропускается, при x >= 1000 цена x − x // 10. При вводе 1000, x, 0 выведено 2 и 1800. Чему равно наименьшее возможное x?", "Сабақтағы касса: x < 100 өткізіліп жіберіледі, x >= 1000 болғанда баға x − x // 10. 1000, x, 0 енгізілгенде 2 және 1800 шықты. x-тің ең кіші мүмкін мәні неге тең?"), answer: "900", mode: "number", explanation: w("Первый товар стоит 900, второй тоже должен добавить 900. Подходят x = 900 (без скидки) и x = 1000 (со скидкой). Наименьшее: 900.", "Бірінші тауар 900 тұрады, екіншісі де 900 қосуы керек. x = 900 (жеңілдіксіз) және x = 1000 (жеңілдікпен) сәйкес келеді. Ең кішісі: 900."), hint: w("Найди цену первого товара после скидки и сколько должен добавить второй. Проверь оба случая: второй товар без скидки и со скидкой.", "Бірінші тауардың жеңілдіктен кейінгі бағасын және екіншісі қанша қосуы керегін тап. Екі жағдайды да тексер: екінші тауар жеңілдіксіз және жеңілдікпен.") },
];

const pool = poolBank({ skill: SKILL, questions: QUESTIONS, statements: STATEMENTS, pairs: PAIRS, shorts: SHORTS });

const bank: SkillBank = {
  skill: SKILL,
  question(level, seed): QuestionStep {
    const rand = seeded(seed);
    if (rand() < 0.5) return pool.question(level, seed + 99991);
    return pick(rand, GENS[level])(rand, level, seed);
  },
  statement(level, seed): Statement {
    const rand = seeded(seed);
    if (rand() < 0.65) return pool.statement!(level, seed + 99991);
    return kassaStatement(level, seed);
  },
  pair(level, seed): Pair {
    return pool.pair!(level, seed);
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    if (rand() < 0.65) return pool.short!(level, seed + 99991);
    return kassaShort(level, seed);
  },
};

export const BANKS: SkillBank[] = [bank];
