import type { ChoiceStep, InputStep, L, Level, MultiStep, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import { poolBank } from "./pool";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка sheets.functions: функции СУММ, СРЗНАЧ, МАКС, МИН, СЧЁТ, СЧЁТЗ — значения по таблице, пустые ячейки, ноль и текст
// в диапазоне, несколько аргументов, функция в функции, пересекающиеся диапазоны, обратная задача, копирование.
// Половина заданий — генератор (ответ всегда считает код: мини-движок таблицы ниже), половина — статичный пул.
// Параметры задания зашиты в id (g:sheets.functions:<вид>:<формула>_<числа таблицы>:<seed>) — по ним ответы перепроверены
// независимым Python-движком (scratchpad/verify_bank.py).
// Названия функций: по-русски СУММ, СРЗНАЧ…; по-казахски в формулах — SUM, AVERAGE… (русское имя перед «(» заменяется автоматически).
// Казахские тексты — без падежных окончаний после имён ячеек и чисел.

const SKILL = "sheets.functions";

const EN: Record<string, string> = { СЧЁТЗ: "COUNTA", СЧЁТ: "COUNT", СУММ: "SUM", СРЗНАЧ: "AVERAGE", МАКС: "MAX", МИН: "MIN" };
const en = (s: string) => s.replace(/(СЧЁТЗ|СЧЁТ|СУММ|СРЗНАЧ|МАКС|МИН)\(/g, (_, n: string) => `${EN[n]}(`);
const lk = (ru: string, kk: string): L => ({ ru, kk: en(kk) });
/** Формула: kk — с английскими именами функций. */
const fx = (f: string): L => ({ ru: f, kk: en(f) });
/** Имя функции без скобок (для вариантов ответа): ru и английское. */
const nm = (n: string): L => ({ ru: n, kk: EN[n] });

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

// ======================================================================
// Мини-движок таблицы
// ======================================================================

type Fn = "СУММ" | "СРЗНАЧ" | "МАКС" | "МИН" | "СЧЁТ" | "СЧЁТЗ";
/** Ячейка: число, текст (локализованная строка или «—») или пусто (null). */
type Val = number | string | L | null;
type Grid = Val[][];
/** Диапазон (или одна ячейка): индексы с 0, включительно. */
interface Rg {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}
type Node = Rg | { num: number } | { fn: Fn; args: Node[] } | { op: "+" | "-" | "/"; l: Node; r: Node };

const colL = (c: number) => String.fromCharCode(65 + c);
const cellRef = (c: number, r: number) => `${colL(c)}${r + 1}`;
const rg = (c1: number, r1: number, c2: number, r2: number): Rg => ({ c1, r1, c2, r2 });
const rgText = (a: Rg) => (a.c1 === a.c2 && a.r1 === a.r2 ? cellRef(a.c1, a.r1) : `${cellRef(a.c1, a.r1)}:${cellRef(a.c2, a.r2)}`);
const call = (fn: Fn, ...args: Node[]): Node => ({ fn, args });
const bin = (op: "+" | "-" | "/", l: Node, r: Node): Node => ({ op, l, r });

function txt(n: Node): string {
  if ("c1" in n) return rgText(n);
  if ("num" in n) return String(n.num);
  if ("fn" in n) return `${n.fn}(${n.args.map(txt).join(";")})`;
  return `${txt(n.l)}${n.op}${txt(n.r)}`;
}

const isNum = (v: Val): v is number => typeof v === "number";
const cellsOf = (g: Grid, a: Rg): Val[] => {
  const out: Val[] = [];
  for (let r = a.r1; r <= a.r2; r++) for (let c = a.c1; c <= a.c2; c++) out.push(g[r]?.[c] ?? null);
  return out;
};
const numsOf = (g: Grid, a: Rg) => cellsOf(g, a).filter(isNum);

function evalNode(g: Grid, n: Node): number {
  if ("num" in n) return n.num;
  if ("op" in n) {
    const l = evalNode(g, n.l);
    const r = evalNode(g, n.r);
    return n.op === "+" ? l + r : n.op === "-" ? l - r : l / r;
  }
  if ("fn" in n) {
    const nums: number[] = [];
    let nonEmpty = 0;
    for (const a of n.args) {
      if ("c1" in a) {
        for (const v of cellsOf(g, a)) {
          if (isNum(v)) nums.push(v);
          if (v !== null) nonEmpty++;
        }
      } else {
        nums.push(evalNode(g, a));
        nonEmpty++;
      }
    }
    switch (n.fn) {
      case "СУММ":
        return nums.reduce((s, x) => s + x, 0);
      case "СРЗНАЧ":
        return nums.reduce((s, x) => s + x, 0) / nums.length;
      case "МАКС":
        return nums.length ? Math.max(...nums) : 0;
      case "МИН":
        return nums.length ? Math.min(...nums) : 0;
      case "СЧЁТ":
        return nums.length;
      case "СЧЁТЗ":
        return nonEmpty;
    }
  }
  throw new Error("evalNode: диапазон не может быть значением");
}

/** Сцена «электронная таблица» из сетки значений. */
const gridScene = (g: Grid, hi?: [number, number][], caption?: string | L): Scene => {
  const width = Math.max(...g.map((r) => r.length));
  return {
    kind: "table",
    sheet: true,
    mono: true,
    rows: g.map((r) => Array.from({ length: width }, (_, c): string | L => {
      const v = r[c] ?? null;
      return v === null ? "" : typeof v === "number" ? String(v) : v;
    })),
    highlightCells: hi,
    caption,
  };
};

/** Подсветка диапазона: [строка, столбец]. */
const hiRg = (a: Rg): [number, number][] => {
  const out: [number, number][] = [];
  for (let r = a.r1; r <= a.r2; r++) for (let c = a.c1; c <= a.c2; c++) out.push([r, c]);
  return out;
};

const TEXTS: Val[] = [lk("нет", "жоқ"), lk("н/б", "ж/ж"), "—", lk("отпуск", "демалыс")];

const idPart = (s: string) => s.replace(/[:;"()]/g, "_").replace(/\s+/g, "");
/** Строка для id: числа таблицы и маркеры e (пусто), t (текст), x (неизвестное). */
const gridKey = (g: Grid) => g.map((r) => r.map((v) => (v === null ? "e" : isNum(v) ? String(v) : v === "x" ? "x" : "t")).join("_")).join("-");

/** Подгоняет числа так, чтобы среднее было целым (меняет один положительный элемент, не более чем на m − 1). */
function fixMean(vals: number[], rand: Rand): void {
  const m = vals.length;
  const rem = vals.reduce((s, x) => s + x, 0) % m;
  if (!rem) return;
  const idx = vals.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  vals[pick(rand, idx)] += m - rem;
}

const fmtList = (nums: number[], sep = ", ") => nums.join(sep);

// ======================================================================
// Описания функций (для подсказок и разборов)
// ======================================================================

const WHAT: Record<Fn, L> = {
  СУММ: lk("сумма чисел", "сандардың қосындысы"),
  СРЗНАЧ: lk("среднее арифметическое", "орташа арифметикалық"),
  МАКС: lk("наибольшее число", "ең үлкен сан"),
  МИН: lk("наименьшее число", "ең кіші сан"),
  СЧЁТ: lk("количество чисел", "сандардың саны"),
  СЧЁТЗ: lk("количество непустых ячеек", "бос емес ұяшықтар саны"),
};

/** Как получено значение одной функции по диапазону (ru/kk). */
function calcLine(fn: Fn, nums: number[], nonEmpty: number, res: number): L {
  switch (fn) {
    case "СУММ":
      return lk(`СУММ: ${fmtList(nums, " + ")} = ${res}`, `СУММ: ${fmtList(nums, " + ")} = ${res}`);
    case "СРЗНАЧ":
      return lk(`СРЗНАЧ: ${nums.reduce((s, x) => s + x, 0)} / ${nums.length} = ${res}`, `СРЗНАЧ: ${nums.reduce((s, x) => s + x, 0)} / ${nums.length} = ${res}`);
    case "МАКС":
      return lk(`МАКС: наибольшее из них — ${res}`, `МАКС: олардың ішіндегі ең үлкені — ${res}`);
    case "МИН":
      return lk(`МИН: наименьшее из них — ${res}`, `МИН: олардың ішіндегі ең кішісі — ${res}`);
    case "СЧЁТ":
      return lk(`СЧЁТ: чисел — ${res}`, `СЧЁТ: сандар саны — ${res}`);
    case "СЧЁТЗ":
      return lk(`СЧЁТЗ: непустых ячеек — ${nonEmpty}`, `СЧЁТЗ: бос емес ұяшықтар — ${nonEmpty}`);
  }
}

// Разборы формул хранятся с русскими именами функций; для kk имена функций заменяются автоматически.
const calcLineKk = (fn: Fn, nums: number[], nonEmpty: number, res: number) => {
  const c = calcLine(fn, nums, nonEmpty, res);
  return { ru: c.ru, kk: en(c.kk.replace(/^(СЧЁТЗ|СЧЁТ|СУММ|СРЗНАЧ|МАКС|МИН):/, (_, n: string) => `${EN[n]}:`)) };
};

// ======================================================================
// Задание-вопрос: вспомогательные конструкторы
// ======================================================================

interface Cand {
  text: Text;
  why: L | null;
}

function buildChoice(
  rand: Rand,
  c: { id: string; level: Level; prompt: L; hint: L; explanation: L; correct: string; wrongs: { text: string; why: L }[]; scene?: Scene; reveal?: Scene },
): ChoiceStep | undefined {
  const seen = new Set<string>([c.correct]);
  const wrongs: { text: string; why: L }[] = [];
  for (const w of shuffle(c.wrongs, rand)) {
    if (wrongs.length >= 3) break;
    if (!seen.has(w.text)) {
      seen.add(w.text);
      wrongs.push(w);
    }
  }
  if (wrongs.length < 3) return undefined;
  const all = shuffle<Cand>([{ text: c.correct, why: null }, ...wrongs], rand);
  return {
    id: c.id,
    type: "choice",
    skill: SKILL,
    level: c.level,
    prompt: c.prompt,
    hint: c.hint,
    scene: c.scene,
    reveal: c.reveal,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
    explanation: c.explanation,
  };
}

function numInput(id: string, level: Level, prompt: L, hint: L, explanation: L, answer: number, scene?: Scene, reveal?: Scene): InputStep {
  return { id, type: "input", skill: SKILL, level, prompt, hint, scene, reveal, answers: [String(answer)], mode: "number", explanation };
}

const HINT_VALUE: L = lk(
  "Выпиши числа диапазона из таблицы, потом примени функцию: СУММ складывает, МАКС и МИН ищут наибольшее и наименьшее, СЧЁТ считает числа.",
  "Диапазондағы сандарды кестеден жазып ал, содан кейін функцияны қолдан: СУММ қосады, МАКС және МИН ең үлкенін және ең кішісін іздейді, СЧЁТ сандарды санайды.",
);
const HINT_GAPS: L = lk(
  "Вычеркни пустые ячейки и текст: они не числа. Ноль оставь — он число. Потом примени функцию к оставшимся числам.",
  "Бос ұяшықтар мен мәтінді сызып таста: олар сан емес. Нөлді қалдыр — ол сан. Содан кейін функцияны қалған сандарға қолдан.",
);
const HINT_PARTS: L = lk(
  "Найди значение каждой функции по отдельности, потом выполни действие между ними.",
  "Әр функцияның мәнін бөлек тап, содан кейін олардың арасындағы әрекетті орында.",
);
const HINT_OVERLAP: L = lk(
  "Сначала найди ячейки, попавшие в оба диапазона. Каждый аргумент функции считается отдельно.",
  "Алдымен екі диапазонға да түскен ұяшықтарды тап. Функцияның әр аргументі бөлек есептеледі.",
);
const HINT_MISSING: L = lk(
  "Сколько чисел усреднялось? Умножь среднее на это количество — получишь сумму, и останется вычесть известные числа.",
  "Неше сан орташаланды? Орташа мәнді осы санға көбейтсең, қосынды шығады, ал содан кейін белгілі сандарды шегеру қалады.",
);
const HINT_COPY: L = lk(
  "Сначала запиши формулу для новой ячейки: какой столбец в диапазоне? Потом считай, пропуская пустое и текст.",
  "Алдымен жаңа ұяшық үшін формуланы жаз: диапазонда қай баған болады? Содан кейін бос ұяшық пен мәтінді өткізіп есепте.",
);
const HINT_NEST: L = lk(
  "Считай изнутри наружу: сначала внутренние функции, потом внешнюю.",
  "Ішкі жағынан сыртқа қарай есепте: алдымен ішкі функциялар, содан кейін сыртқысы.",
);

// ======================================================================
// Генераторы заданий (ответ считает код)
// ======================================================================

/** A. Значение функции по диапазону из чисел: choice или input. */
function genValue(rand: Rand, seed: number): QuestionStep {
  for (let attempt = 0; attempt < 50; attempt++) {
    const layout = pick(rand, ["col", "row", "block-col", "block-row"] as const);
    const fn = pick(rand, ["СУММ", "СУММ", "МАКС", "МАКС", "МИН", "МИН", "СЧЁТ", "СРЗНАЧ", "СРЗНАЧ"] as const);
    const n = layout === "col" ? int(rand, 5, 6) : layout === "row" ? int(rand, 4, 6) : layout === "block-col" ? 4 : 3;
    const hi = layout.startsWith("block") ? 9 : 20;
    const vals = Array.from({ length: n }, () => int(rand, 1, hi));
    if (fn === "СРЗНАЧ") fixMean(vals, rand);
    let g: Grid;
    let r: Rg;
    if (layout === "col") {
      g = vals.map((v) => [v]);
      r = rg(0, 0, 0, n - 1);
    } else if (layout === "row") {
      g = [vals];
      r = rg(0, 0, n - 1, 0);
    } else if (layout === "block-col") {
      const c = int(rand, 0, 2);
      g = Array.from({ length: 4 }, (_, i) => Array.from({ length: 3 }, (_, j) => (j === c ? vals[i] : int(rand, 1, 9))));
      r = rg(c, 0, c, 3);
    } else {
      const row = int(rand, 0, 3);
      g = Array.from({ length: 4 }, (_, i) => Array.from({ length: 3 }, (_, j) => (i === row ? vals[j] : int(rand, 1, 9))));
      r = rg(0, row, 2, row);
    }
    const f = `=${txt(call(fn, r))}`;
    const answer = evalNode(g, call(fn, r));
    if (!Number.isInteger(answer)) continue;
    const range = rgText(r);
    const nums = numsOf(g, r);
    const id = `g:${SKILL}:value:${idPart(`${f}_${gridKey(g)}`)}:${seed}`;
    const prompt = lk(
      `В диапазоне ${range} записаны числа (см. таблицу). Чему равно значение формулы \`${f}\`?`,
      `${range} диапазонында сандар жазылған (кестені қара). \`${f}\` формуласының мәні неге тең?`,
    );
    const explanation: L = {
      ru: `Числа диапазона ${range}: ${fmtList(nums)}. ${calcLineKk(fn, nums, nums.length, answer).ru}.`,
      kk: `${range} диапазонындағы сандар: ${fmtList(nums)}. ${calcLineKk(fn, nums, nums.length, answer).kk}.`,
    };
    const scene = gridScene(g, hiRg(r));
    if (rand() < 0.5) {
      const others = (["СУММ", "СРЗНАЧ", "МАКС", "МИН", "СЧЁТ"] as Fn[]).filter((x) => x !== fn);
      const wrongs = others
        .map((o) => ({ v: evalNode(g, call(o, r)), o }))
        .filter((w) => Number.isInteger(w.v))
        .map((w) => ({
          text: String(w.v),
          why: lk(
            `Это значение функции ${w.o} (${WHAT[w.o].ru}), а в формуле стоит ${fn}.`,
            `Бұл ${EN[w.o]} функциясының мәні (${WHAT[w.o].kk}), ал формулада ${EN[fn]} тұр.`,
          ),
        }));
      const q = buildChoice(rand, { id, level: 1, prompt, hint: HINT_VALUE, explanation, correct: String(answer), wrongs, scene });
      if (q) return q;
    }
    return numInput(id, 1, prompt, HINT_VALUE, explanation, answer, scene);
  }
  throw new Error("genValue: не удалось подобрать задание");
}

/** Таблица-столбец с пустыми ячейками и текстом: возвращает сетку и число пустых/текстовых ячеек. */
function gapsColumn(rand: Rand, n: number, e: number, t: number, forceZero: boolean, needMean: boolean) {
  const m = n - e - t;
  const vals = Array.from({ length: m }, () => int(rand, 1, 15));
  if (forceZero || rand() < 0.5) vals[int(rand, 0, m - 1)] = 0;
  if (vals.filter((v) => v > 0).length < 2) vals[0] = 7;
  if (needMean) fixMean(vals, rand);
  const cells = shuffle<Val>([...vals, ...Array(e).fill(null), ...Array.from({ length: t }, () => pick(rand, TEXTS))], rand);
  return { g: cells.map((v) => [v]) as Grid, vals };
}

/** B. Пустые ячейки, текст и ноль в диапазоне. */
function genGaps(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 6, 8);
  const e = int(rand, 1, 2);
  const t = rand() < 0.6 ? 1 : 0;
  const fn = pick(rand, ["СРЗНАЧ", "СРЗНАЧ", "СЧЁТ", "СЧЁТЗ", "СУММ", "МИН", "МИН"] as const);
  const { g, vals } = gapsColumn(rand, n, e, t, fn === "МИН", fn === "СРЗНАЧ");
  const r = rg(0, 0, 0, n - 1);
  const f = `=${txt(call(fn, r))}`;
  const answer = evalNode(g, call(fn, r));
  const range = rgText(r);
  const hasZero = vals.includes(0);
  const skipped = lk(
    `пустых ячеек: ${e}${t ? ", текстовых: 1" : ""}`,
    `бос ұяшықтар: ${e}${t ? ", мәтіндік: 1" : ""}`,
  );
  const core = calcLineKk(fn, vals, vals.length + t, answer);
  return numInput(
    `g:${SKILL}:gaps:${idPart(`${f}_${gridKey(g)}`)}:${seed}`,
    2,
    lk(
      `В диапазоне ${range} записаны данные (см. таблицу). Чему равно значение формулы \`${f}\`?`,
      `${range} диапазонында деректер жазылған (кестені қара). \`${f}\` формуласының мәні неге тең?`,
    ),
    HINT_GAPS,
    {
      ru: `Числа диапазона: ${fmtList(vals)} (${skipped.ru} — не считаются${hasZero ? ", а ноль — число" : ""}). ${core.ru}.`,
      kk: `Диапазондағы сандар: ${fmtList(vals)} (${skipped.kk} — есептелмейді${hasZero ? ", ал нөл — сан" : ""}). ${core.kk}.`,
    },
    answer,
    gridScene(g, hiRg(r)),
  );
}

/** B. Формулы из двух функций, несколько диапазонов, подсчёт текстовых ячеек. */
function genParts(rand: Rand, seed: number): QuestionStep {
  const kind = pick(rand, ["maxmin", "sumdiff", "ratio", "twoavg", "maxplus", "textcount"] as const);
  let g: Grid = [];
  let node!: Node;
  let expl!: L;
  let hi: Rg[] = [];
  const block = (cols: number, rows: number, hiN: number): Grid => Array.from({ length: rows }, () => Array.from({ length: cols }, () => int(rand, 1, hiN)));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (kind === "maxmin") {
      g = block(3, 4, 30);
      const all = rg(0, 0, 2, 3);
      node = bin("-", call("МАКС", all), call("МИН", all));
      const nums = numsOf(g, all);
      expl = lk(
        `МАКС(A1:C4) = ${Math.max(...nums)}, МИН(A1:C4) = ${Math.min(...nums)}. Разность: ${Math.max(...nums)} − ${Math.min(...nums)} = ${Math.max(...nums) - Math.min(...nums)}.`,
        `МАКС(A1:C4) = ${Math.max(...nums)}, МИН(A1:C4) = ${Math.min(...nums)}. Айырмасы: ${Math.max(...nums)} − ${Math.min(...nums)} = ${Math.max(...nums) - Math.min(...nums)}.`,
      );
      hi = [all];
    } else if (kind === "sumdiff") {
      g = block(3, 4, 20);
      const a = rg(0, 0, 0, 3);
      const b = rg(1, 0, 1, 3);
      node = bin("-", call("СУММ", a), call("СУММ", b));
      const sa = evalNode(g, call("СУММ", a));
      const sb = evalNode(g, call("СУММ", b));
      if (sa <= sb) continue;
      expl = lk(`СУММ(A1:A4) = ${sa}, СУММ(B1:B4) = ${sb}. Разность: ${sa} − ${sb} = ${sa - sb}.`, `СУММ(A1:A4) = ${sa}, СУММ(B1:B4) = ${sb}. Айырмасы: ${sa} − ${sb} = ${sa - sb}.`);
      hi = [a, b];
    } else if (kind === "ratio") {
      const n = int(rand, 5, 6);
      g = gapsColumn(rand, n, 1, rand() < 0.5 ? 1 : 0, false, true).g;
      const a = rg(0, 0, 0, n - 1);
      node = bin("/", call("СУММ", a), call("СЧЁТ", a));
      const s = evalNode(g, call("СУММ", a));
      const c = evalNode(g, call("СЧЁТ", a));
      expl = lk(
        `${rgText(a)}: чисел ${c}, их сумма ${s}. Пустые ячейки и текст не считаются, поэтому делим на ${c}: ${s} / ${c} = ${s / c}.`,
        `${rgText(a)}: сандар саны ${c}, олардың қосындысы ${s}. Бос ұяшықтар мен мәтін есептелмейді, сондықтан ${c} санына бөлеміз: ${s} / ${c} = ${s / c}.`,
      );
      hi = [a];
    } else if (kind === "twoavg") {
      g = block(3, 3, 20);
      const a = rg(0, 0, 0, 2);
      const b = rg(2, 0, 2, 2);
      const total = evalNode(g, call("СУММ", a, b));
      if (total % 6 !== 0) continue;
      node = call("СРЗНАЧ", a, b);
      expl = lk(
        `Берутся все 6 чисел из двух диапазонов: сумма ${total}. Среднее: ${total} / 6 = ${total / 6}.`,
        `Екі диапазоннан барлық 6 сан алынады: қосынды ${total}. Орташа мән: ${total} / 6 = ${total / 6}.`,
      );
      hi = [a, b];
    } else if (kind === "maxplus") {
      g = block(3, 4, 20);
      const a = rg(0, 0, 0, 3);
      const b = rg(2, 0, 2, 3);
      node = bin("+", call("МАКС", a), call("МИН", b));
      const mx = evalNode(g, call("МАКС", a));
      const mn = evalNode(g, call("МИН", b));
      expl = lk(`МАКС(A1:A4) = ${mx}, МИН(C1:C4) = ${mn}. Сумма: ${mx} + ${mn} = ${mx + mn}.`, `МАКС(A1:A4) = ${mx}, МИН(C1:C4) = ${mn}. Қосындысы: ${mx} + ${mn} = ${mx + mn}.`);
      hi = [a, b];
    } else {
      // textcount: сколько в диапазоне непустых ячеек, не являющихся числами
      const n = int(rand, 6, 8);
      const t = int(rand, 1, 3);
      const e = int(rand, 1, 2);
      const col = gapsColumn(rand, n, e, t, false, false);
      g = col.g;
      const a = rg(0, 0, 0, n - 1);
      node = bin("-", call("СЧЁТЗ", a), call("СЧЁТ", a));
      const k = evalNode(g, call("СЧЁТЗ", a));
      const c = evalNode(g, call("СЧЁТ", a));
      expl = lk(
        `СЧЁТЗ(${rgText(a)}) = ${k} (все непустые ячейки), СЧЁТ(${rgText(a)}) = ${c} (только числа). Разность ${k} − ${c} = ${k - c} — это текстовые ячейки.`,
        `СЧЁТЗ(${rgText(a)}) = ${k} (барлық бос емес ұяшықтар), СЧЁТ(${rgText(a)}) = ${c} (тек сандар). Айырмасы ${k} − ${c} = ${k - c} — бұл мәтіндік ұяшықтар.`,
      );
      hi = [a];
    }
    const answer = evalNode(g, node);
    if (!Number.isInteger(answer) || answer < 0) continue;
    const f = `=${txt(node)}`;
    return numInput(
      `g:${SKILL}:parts-${kind}:${idPart(`${f}_${gridKey(g)}`)}:${seed}`,
      2,
      lk(`В таблице записаны данные. Чему равно значение формулы \`${f}\`?`, `Кестеде деректер жазылған. \`${f}\` формуласының мәні неге тең?`),
      HINT_PARTS,
      expl,
      answer,
      gridScene(g, hi.flatMap(hiRg)),
    );
  }
  throw new Error("genParts: не удалось подобрать задание");
}

/** C. Пересекающиеся диапазоны: общая ячейка учитывается дважды. */
function genOverlap(rand: Rand, seed: number): QuestionStep {
  for (let attempt = 0; attempt < 100; attempt++) {
    const count = rand() < 0.3;
    const g: Grid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => int(rand, 1, 9)));
    if (count) {
      // несколько пустых и текстовых ячеек
      for (let k = 0; k < 4; k++) g[int(rand, 0, 3)][int(rand, 0, 3)] = rand() < 0.5 ? null : pick(rand, TEXTS);
    }
    const c0 = int(rand, 0, 1);
    const r0 = int(rand, 0, 1);
    const a = rg(c0, r0, c0 + 1, r0 + 1);
    const dc = int(rand, 0, 1);
    const dr = int(rand, 0, 1);
    if (!dc && !dr) continue;
    const b = rg(c0 + dc, r0 + dr, c0 + dc + 1, r0 + dr + 1);
    const fn: Fn = count ? "СЧЁТ" : "СУММ";
    const node = call(fn, a, b);
    const answer = evalNode(g, node);
    const f = `=${txt(node)}`;
    const ov = rg(Math.max(a.c1, b.c1), Math.max(a.r1, b.r1), Math.min(a.c2, b.c2), Math.min(a.r2, b.r2));
    const ovList = hiRg(ov).map(([r, c]) => cellRef(c, r));
    const ovText = ovList.join(", ");
    const ovNum = numsOf(g, ov);
    const sa = evalNode(g, call(fn, a));
    const sb = evalNode(g, call(fn, b));
    const id = `g:${SKILL}:overlap:${idPart(`${f}_${gridKey(g)}`)}:${seed}`;
    const scene = gridScene(g, [...hiRg(a), ...hiRg(b)]);
    const prompt = lk(
      `В таблице записаны данные. Чему равно значение формулы \`${f}\`?`,
      `Кестеде деректер жазылған. \`${f}\` формуласының мәні неге тең?`,
    );
    const ovWord = ovList.length === 1 ? lk("ячейка", "ұяшық") : lk("ячейки", "ұяшықтар");
    const explanation: L = count
      ? {
          ru: `Каждый аргумент считается отдельно. В ${rgText(a)} чисел ${sa}, в ${rgText(b)} — ${sb}. Общие ${ovWord.ru} (${ovText}) входят в оба диапазона и считаются дважды: ${sa} + ${sb} = ${answer}.`,
          kk: `Әр аргумент бөлек есептеледі. ${rgText(a)} ішінде сан ${sa}, ${rgText(b)} ішінде — ${sb}. Ортақ ${ovWord.kk} (${ovText}) екі диапазонға да кіреді және екі рет есептеледі: ${sa} + ${sb} = ${answer}.`,
        }
      : {
          ru: `Каждый аргумент считается отдельно: сумма ${rgText(a)} = ${sa}, сумма ${rgText(b)} = ${sb}. Общие ${ovWord.ru} (${ovText}) входят в оба диапазона и складываются дважды: ${sa} + ${sb} = ${answer}.`,
          kk: `Әр аргумент бөлек есептеледі: ${rgText(a)} қосындысы = ${sa}, ${rgText(b)} қосындысы = ${sb}. Ортақ ${ovWord.kk} (${ovText}) екі диапазонға да кіреді және екі рет қосылады: ${sa} + ${sb} = ${answer}.`,
        };
    if (count) return numInput(id, 3, prompt, HINT_OVERLAP, explanation, answer, scene);
    const ovSum = ovNum.reduce((s, x) => s + x, 0);
    const q = buildChoice(rand, {
      id,
      level: 3,
      prompt,
      hint: HINT_OVERLAP,
      explanation,
      correct: String(answer),
      scene,
      wrongs: [
        { text: String(answer - ovSum), why: lk("Общие ячейки взяты один раз, а функция берёт их по разу из каждого диапазона — то есть дважды.", "Ортақ ұяшықтар бір рет алынған, ал функция оларды әр диапазоннан бір реттен — яғни екі рет алады.") },
        { text: String(sa), why: lk("Это сумма только первого диапазона: второй аргумент тоже нужно сложить.", "Бұл тек бірінші диапазонның қосындысы: екінші аргументті де қосу керек.") },
        { text: String(sb), why: lk("Это сумма только второго диапазона: первый аргумент тоже нужно сложить.", "Бұл тек екінші диапазонның қосындысы: бірінші аргументті де қосу керек.") },
        { text: String(ovSum), why: lk("Это сумма одних только общих ячеек, а нужны оба диапазона целиком.", "Бұл тек ортақ ұяшықтардың қосындысы, ал екі диапазонның толық қосындысы керек.") },
      ],
    });
    if (q) return q;
  }
  throw new Error("genOverlap: не удалось подобрать задание");
}

/** C. Обратная задача: известное среднее, найти неизвестное число (текст и пустые ячейки не считаются). */
function genMissing(rand: Rand, seed: number): QuestionStep {
  for (let attempt = 0; attempt < 100; attempt++) {
    const k = int(rand, 4, 6);
    const known = Array.from({ length: k - 1 }, () => int(rand, 5, 25));
    const s = known.reduce((a, b) => a + b, 0);
    let x = int(rand, 3, 20);
    x += (k - ((s + x) % k)) % k;
    if (x > 30) continue;
    const mean = (s + x) / k;
    const e = rand() < 0.4 ? 1 : 0;
    const cells = shuffle<Val>([...known, "x", pick(rand, TEXTS), ...Array(e).fill(null)], rand);
    const g: Grid = cells.map((v) => [v]);
    const n = cells.length;
    const r = rg(0, 0, 0, n - 1);
    const xRow = cells.indexOf("x");
    const f = `=${txt(call("СРЗНАЧ", r))}`;
    const range = rgText(r);
    return numInput(
      `g:${SKILL}:missing:${idPart(`${f}_${gridKey(g)}_m${mean}`)}:${seed}`,
      3,
      lk(
        `В ячейках ${range} записаны числа, неизвестное число x в ${cellRef(0, xRow)} и текст (см. таблицу). Значение формулы \`${f}\` равно ${mean}. Найди x.`,
        `${range} ұяшықтарында сандар, ${cellRef(0, xRow)} ұяшығында белгісіз x саны және мәтін жазылған (кестені қара). \`${f}\` формуласының нәтижесі — ${mean}. x-ті тап.`,
      ),
      HINT_MISSING,
      {
        ru: `Текст${e ? " и пустая ячейка не считаются" : " не считается"}, поэтому усреднялись ${k} чисел. Их сумма ${mean} · ${k} = ${mean * k}. Известные числа дают ${s}, значит x = ${mean * k} − ${s} = ${x}.`,
        kk: `Мәтін${e ? " мен бос ұяшық есептелмейді" : " есептелмейді"}, сондықтан ${k} сан орташаланған. Олардың қосындысы ${mean} · ${k} = ${mean * k}. Белгілі сандардың қосындысы ${s}, демек x = ${mean * k} − ${s} = ${x}.`,
      },
      x,
      gridScene(g, [[xRow, 0]]),
    );
  }
  throw new Error("genMissing: не удалось подобрать задание");
}

/** C. Копирование формулы с функциями: значение в целевой ячейке (в целевом столбце есть пустая ячейка или текст). */
function genCopy(rand: Rand, seed: number): QuestionStep {
  for (let attempt = 0; attempt < 200; attempt++) {
    const kind = pick(rand, ["ratio", "maxmin", "mean", "textcount"] as const);
    const sc = int(rand, 0, 1);
    const tc = sc + int(rand, 1, 2);
    const g: Grid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => int(rand, 1, 12)));
    // дырка в целевом столбце
    const hole = int(rand, 0, 3);
    g[hole][tc] = kind === "textcount" ? pick(rand, TEXTS) : rand() < 0.5 ? null : pick(rand, TEXTS);
    if (kind === "textcount") {
      const other = (hole + int(rand, 1, 3)) % 4;
      g[other][tc] = null;
    }
    const mk = (c: number): Node => {
      const r = rg(c, 0, c, 3);
      if (kind === "ratio") return bin("/", call("СУММ", r), call("СЧЁТ", r));
      if (kind === "maxmin") return bin("-", call("МАКС", r), call("МИН", r));
      if (kind === "mean") return call("СРЗНАЧ", r);
      return bin("-", call("СЧЁТЗ", r), call("СЧЁТ", r));
    };
    const answer = evalNode(g, mk(tc));
    if (!Number.isInteger(answer) || answer <= 0) continue;
    // исходная формула не должна давать тот же ответ (иначе копирование ничего не проверяет)
    const srcVal = evalNode(g, mk(sc));
    if (srcVal === answer) continue;
    const f = `=${txt(mk(sc))}`;
    const fT = `=${txt(mk(tc))}`;
    const S = cellRef(sc, 4);
    const T = cellRef(tc, 4);
    const last: Val[] = Array.from({ length: 4 }, (_, c) => (c === sc ? fx(f) : null));
    const rows: Grid = [...g, last];
    const col = colL(tc);
    const nums = numsOf(g, rg(tc, 0, tc, 3));
    return numInput(
      `g:${SKILL}:copy-${kind}:${idPart(`${f}_${S}_${T}_${gridKey(g)}`)}:${seed}`,
      3,
      lk(
        `В ячейке ${S} записана формула \`${f}\`. Её скопировали в ячейку ${T}. Чему равно значение в ${T}?`,
        `${S} ұяшығында \`${f}\` формуласы жазылған. Оны ${T} ұяшығына көшірді. ${T} ұяшығындағы мән неге тең?`,
      ),
      HINT_COPY,
      {
        ru: `Из ${S} в ${T} — на ${tc - sc} ${tc - sc === 1 ? "столбец" : "столбца"} вправо. В ${T} окажется \`${fT}\`. В ${col}1:${col}4 числа: ${fmtList(nums)} (пустое и текст не считаются). Значение: ${answer}.`,
        kk: `${S} → ${T}: ${tc - sc} баған оңға. ${T} ұяшығында \`${en(fT)}\` болады. ${col}1:${col}4 ішіндегі сандар: ${fmtList(nums)} (бос ұяшық пен мәтін есептелмейді). Мәні: ${answer}.`,
      },
      answer,
      gridScene(rows, [[4, sc], [4, tc]]),
    );
  }
  throw new Error("genCopy: не удалось подобрать задание");
}

/** C. Функция в функции: считаем изнутри наружу. */
function genNested(rand: Rand, seed: number): QuestionStep {
  for (let attempt = 0; attempt < 200; attempt++) {
    const kind = pick(rand, ["avg-max-min", "max-minus-min", "max-of-sums", "sum-max-min"] as const);
    const g: Grid = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => int(rand, 1, 20)));
    let node: Node;
    let expl: L;
    let hi: Rg[];
    if (kind === "avg-max-min") {
      const a = rg(0, 0, 0, 3);
      const b = rg(1, 0, 1, 3);
      node = call("СРЗНАЧ", call("МАКС", a), call("МИН", b));
      const mx = evalNode(g, call("МАКС", a));
      const mn = evalNode(g, call("МИН", b));
      expl = lk(
        `Сначала внутренние функции: МАКС(A1:A4) = ${mx}, МИН(B1:B4) = ${mn}. Потом среднее двух чисел: (${mx} + ${mn}) / 2 = ${(mx + mn) / 2}.`,
        `Алдымен ішкі функциялар: МАКС(A1:A4) = ${mx}, МИН(B1:B4) = ${mn}. Содан кейін екі санның орташасы: (${mx} + ${mn}) / 2 = ${(mx + mn) / 2}.`,
      );
      hi = [a, b];
    } else if (kind === "max-minus-min") {
      const a = rg(0, 0, 0, 3);
      const b = rg(2, 0, 2, 3);
      node = bin("-", call("МАКС", a), call("МИН", b));
      const mx = evalNode(g, call("МАКС", a));
      const mn = evalNode(g, call("МИН", b));
      expl = lk(`МАКС(A1:A4) = ${mx}, МИН(C1:C4) = ${mn}. Разность: ${mx} − ${mn} = ${mx - mn}.`, `МАКС(A1:A4) = ${mx}, МИН(C1:C4) = ${mn}. Айырмасы: ${mx} − ${mn} = ${mx - mn}.`);
      hi = [a, b];
    } else if (kind === "max-of-sums") {
      const a = rg(0, 0, 0, 2);
      const b = rg(1, 0, 1, 2);
      node = call("МАКС", call("СУММ", a), call("СУММ", b));
      const sa = evalNode(g, call("СУММ", a));
      const sb = evalNode(g, call("СУММ", b));
      expl = lk(
        `Сначала суммы: СУММ(A1:A3) = ${sa}, СУММ(B1:B3) = ${sb}. Потом наибольшее из них: ${Math.max(sa, sb)}.`,
        `Алдымен қосындылар: СУММ(A1:A3) = ${sa}, СУММ(B1:B3) = ${sb}. Содан кейін солардың ең үлкені: ${Math.max(sa, sb)}.`,
      );
      hi = [a, b];
    } else {
      const a = rg(0, 0, 1, 1);
      const b = rg(1, 2, 2, 3);
      node = call("СУММ", call("МАКС", a), call("МИН", b));
      const mx = evalNode(g, call("МАКС", a));
      const mn = evalNode(g, call("МИН", b));
      expl = lk(
        `Сначала МАКС(A1:B2) = ${mx} и МИН(B3:C4) = ${mn}. Потом их сумма: ${mx} + ${mn} = ${mx + mn}.`,
        `Алдымен МАКС(A1:B2) = ${mx} және МИН(B3:C4) = ${mn}. Содан кейін олардың қосындысы: ${mx} + ${mn} = ${mx + mn}.`,
      );
      hi = [a, b];
    }
    const answer = evalNode(g, node);
    if (!Number.isInteger(answer) || answer < 0) continue;
    const f = `=${txt(node)}`;
    return numInput(
      `g:${SKILL}:nested-${kind}:${idPart(`${f}_${gridKey(g)}`)}:${seed}`,
      3,
      lk(`В таблице записаны числа. Чему равно значение формулы \`${f}\`?`, `Кестеде сандар жазылған. \`${f}\` формуласының мәні неге тең?`),
      HINT_NEST,
      { ru: expl.ru, kk: en(expl.kk) },
      answer,
      gridScene(g, hi.flatMap(hiRg)),
    );
  }
  throw new Error("genNested: не удалось подобрать задание");
}

// ======================================================================
// Короткие вопросы с числовым ответом (данные — в тексте)
// ======================================================================

type ShortCell = "e" | "t" | number;

/** Описание столбца A1:An словами: «A1 = 8, A2 — пусто, A3 — текст». */
function describe(cells: ShortCell[]): L {
  const ru = cells.map((v, i) => (v === "e" ? `A${i + 1} — пусто` : v === "t" ? `A${i + 1} — текст` : `A${i + 1} = ${v}`)).join(", ");
  const kk = cells.map((v, i) => (v === "e" ? `A${i + 1} — бос` : v === "t" ? `A${i + 1} — мәтін` : `A${i + 1} = ${v}`)).join(", ");
  return { ru, kk };
}

const shortGrid = (cells: ShortCell[]): Grid => cells.map((v) => [v === "e" ? null : v === "t" ? "нет" : v]);
const shortKey = (cells: ShortCell[]) => cells.join("_");

function genShort(rand: Rand, level: Level, seed: number): ShortQuestion {
  for (let attempt = 0; attempt < 100; attempt++) {
    let cells: ShortCell[];
    let node: Node;
    let kind: string;
    if (level === 1) {
      const n = int(rand, 4, 6);
      const vals = Array.from({ length: n }, () => int(rand, 1, 20));
      const fn = pick(rand, ["СУММ", "МАКС", "МИН", "СЧЁТ", "СРЗНАЧ"] as const);
      if (fn === "СРЗНАЧ") fixMean(vals, rand);
      cells = vals;
      node = call(fn, rg(0, 0, 0, n - 1));
      kind = "value";
    } else if (level === 2) {
      const n = int(rand, 5, 7);
      const e = int(rand, 1, 2);
      const t = rand() < 0.6 ? 1 : 0;
      const fn = pick(rand, ["СРЗНАЧ", "СЧЁТ", "СЧЁТЗ", "СУММ", "МИН"] as const);
      const m = n - e - t;
      const vals = Array.from({ length: m }, () => int(rand, 1, 12));
      if (fn === "МИН" || rand() < 0.4) vals[int(rand, 0, m - 1)] = 0;
      if (vals.filter((v) => v > 0).length < 2) vals[0] = 5;
      if (fn === "СРЗНАЧ") fixMean(vals, rand);
      cells = shuffle<ShortCell>([...vals, ...Array<ShortCell>(e).fill("e"), ...Array<ShortCell>(t).fill("t")], rand);
      node = call(fn, rg(0, 0, 0, n - 1));
      kind = "gaps";
    } else {
      const n = 6;
      const vals = Array.from({ length: 4 }, () => int(rand, 1, 9));
      cells = shuffle<ShortCell>([...vals, "e", "t"], rand);
      const form = pick(rand, ["overlap", "textcount", "sumcount"] as const);
      if (form === "overlap") node = call("СУММ", rg(0, 0, 0, 3), rg(0, 2, 0, 5));
      else if (form === "textcount") node = bin("-", call("СЧЁТЗ", rg(0, 0, 0, n - 1)), call("СЧЁТ", rg(0, 0, 0, n - 1)));
      else node = bin("+", call("СУММ", rg(0, 0, 0, n - 1)), call("СЧЁТЗ", rg(0, 0, 0, n - 1)));
      kind = `mix-${form}`;
    }
    const g = shortGrid(cells);
    const answer = evalNode(g, node);
    if (!Number.isInteger(answer) || answer < 0) continue;
    const f = `=${txt(node)}`;
    const range = `A1:A${cells.length}`;
    const d = describe(cells);
    const nums = cells.filter((v): v is number => typeof v === "number");
    const hasGap = cells.some((v) => v === "e" || v === "t");
    const explanation: L = {
      ru: `Числа диапазона ${range}: ${fmtList(nums)}${hasGap ? " (пустые ячейки и текст не считаются)" : ""}. Значение формулы ${f}: ${answer}.`,
      kk: `${range} диапазонындағы сандар: ${fmtList(nums)}${hasGap ? " (бос ұяшықтар мен мәтін есептелмейді)" : ""}. ${en(f)} формуласының мәні: ${answer}.`,
    };
    return {
      id: `gs:${SKILL}:${kind}:${idPart(shortKey(cells))}:${seed}`,
      skill: SKILL,
      level,
      prompt: lk(
        `В ячейках ${range}: ${d.ru}. Чему равно значение формулы \`${f}\`?`,
        `${range} ұяшықтарында: ${d.kk}. \`${f}\` формуласының мәні неге тең?`,
      ),
      answer: String(answer),
      mode: "number",
      explanation,
      hint: level === 1 ? HINT_VALUE : level === 2 ? HINT_GAPS : HINT_PARTS,
    };
  }
  throw new Error("genShort: не удалось подобрать задание");
}

// ======================================================================
// Статичный пул: знания о функциях
// ======================================================================

/** Выбор одного ответа: верный всегда первый — poolBank перемешает варианты вместе с whyWrong. */
function ch(
  name: string,
  level: Level,
  prompt: L,
  options: Text[],
  whyWrong: (L | null)[],
  explanation: L,
  hint: L,
  scene?: Scene,
): ChoiceStep {
  return { id: `p:${SKILL}:${name}`, type: "choice", skill: SKILL, level, prompt, hint, scene, options, correct: 0, whyWrong, explanation };
}

/** Несколько верных: индексы верных — в первых позициях. */
function mu(name: string, level: Level, prompt: L, options: Text[], correct: number[], whyWrong: (L | null)[], explanation: L, hint: L, scene?: Scene): MultiStep {
  return { id: `p:${SKILL}:${name}`, type: "multi", skill: SKILL, level, prompt, hint, scene, options, correct, whyWrong, explanation };
}

const QUESTIONS: QuestionStep[] = [
  // ---------- A ----------
  ch(
    "name-max",
    1,
    lk("Какая функция находит наибольшее число в диапазоне?", "Қай функция диапазондағы ең үлкен санды табады?"),
    [nm("МАКС"), nm("МИН"), nm("СУММ"), nm("СЧЁТ")],
    [
      null,
      lk("МИН ищет наименьшее число, а нужно наибольшее.", "МИН ең кіші санды іздейді, ал ең үлкені керек."),
      lk("СУММ складывает числа, а не выбирает среди них.", "СУММ сандарды қосады, олардың ішінен таңдамайды."),
      lk("СЧЁТ считает, сколько чисел в диапазоне.", "СЧЁТ диапазонда неше сан барын санайды."),
    ],
    lk("МАКС (английское MAX) возвращает наибольшее число диапазона. Наименьшее находит МИН.", "МАКС (ағылшынша MAX) диапазондағы ең үлкен санды қайтарады. Ең кішісін МИН табады."),
    lk("Название функции похоже на слово «максимум».", "Функцияның аты «максимум» сөзіне ұқсас."),
  ),
  ch(
    "range-write",
    1,
    lk("Как правильно записать диапазон ячеек от C2 до C8?", "C2-ден C8-ге дейінгі ұяшықтар диапазонын қалай дұрыс жазады?"),
    ["C2:C8", "C2;C8", "C2-C8", "C2..C8"],
    [
      null,
      lk("Точка с запятой перечисляет отдельные ячейки: это только C2 и C8.", "Нүктелі үтір жеке ұяшықтарды тізеді: бұл тек C2 және C8."),
      lk("Минус — это вычитание, а не диапазон.", "Минус — бұл азайту, диапазон емес."),
      lk("Такой записи в электронных таблицах нет.", "Электрондық кестелерде мұндай жазба жоқ."),
    ],
    lk("Диапазон записывают через двоеточие: левый верхний и правый нижний угол — `C2:C8`.", "Диапазонды қос нүкте арқылы жазады: сол жақ жоғарғы және оң жақ төменгі бұрыш — `C2:C8`."),
    lk("Вспомни, чем отличается двоеточие от точки с запятой в формулах.", "Формулаларда қос нүкте мен нүктелі үтірдің айырмасын еске түсір."),
  ),
  ch(
    "name-english",
    1,
    lk("Как называется функция СРЗНАЧ в английской версии программы?", "СРЗНАЧ функциясы бағдарламаның ағылшын нұсқасында қалай аталады?"),
    ["AVERAGE", "MEDIAN", "MAX", "SUM"],
    [
      null,
      lk("MEDIAN — это медиана, серединное значение, а не среднее арифметическое.", "MEDIAN — медиана, ортаңғы мән, орташа арифметикалық емес."),
      lk("MAX — это МАКС, наибольшее число.", "MAX — бұл МАКС, ең үлкен сан."),
      lk("SUM — это СУММ, сумма чисел.", "SUM — бұл СУММ, сандардың қосындысы."),
    ],
    lk("СРЗНАЧ по-английски — AVERAGE. СУММ — SUM, МАКС — MAX, МИН — MIN, СЧЁТ — COUNT.", "СРЗНАЧ ағылшынша — AVERAGE. СУММ — SUM, МАКС — MAX, МИН — MIN, СЧЁТ — COUNT."),
    lk("«Average» по-английски значит «средний».", "«Average» ағылшынша «орташа» дегенді білдіреді."),
  ),
  ch(
    "name-count",
    1,
    lk("Какая функция считает, сколько чисел записано в диапазоне?", "Қай функция диапазонда неше сан жазылғанын санайды?"),
    [nm("СЧЁТ"), nm("СУММ"), nm("СРЗНАЧ"), nm("МАКС")],
    [
      null,
      lk("СУММ складывает значения, а не считает их количество.", "СУММ мәндерді қосады, олардың санын санамайды."),
      lk("СРЗНАЧ вычисляет среднее арифметическое.", "СРЗНАЧ орташа арифметикалықты есептейді."),
      lk("МАКС находит наибольшее число.", "МАКС ең үлкен санды табады."),
    ],
    lk("СЧЁТ (COUNT) считает количество чисел в диапазоне.", "СЧЁТ (COUNT) диапазондағы сандар санын санайды."),
    lk("Название функции — от слова «счёт», «считать».", "Функцияның аты «санау» сөзінен шыққан."),
  ),
  ch(
    "valid-formula",
    1,
    lk("Какая запись формулы записана верно?", "Формуланың қай жазбасы дұрыс жазылған?"),
    [fx("=СУММ(A1:A5)"), fx("=СУММ(A1:A5"), fx("СУММ(A1:A5)"), fx("=СУММ[A1:A5]")],
    [
      null,
      lk("Не закрыта скобка: у функции скобки всегда парные.", "Жақша жабылмаған: функцияның жақшалары әрқашан жұп болады."),
      lk("Нет знака «=»: без него таблица воспримет запись как обычный текст.", "«=» белгісі жоқ: онсыз кесте жазбаны қарапайым мәтін деп қабылдайды."),
      lk("Аргументы функции пишут в круглых скобках, а не в квадратных.", "Функцияның аргументтерін дөңгелек жақшаға жазады, шаршы жақшаға емес."),
    ],
    lk("Верно: знак «=», имя функции и круглые скобки с аргументом: `=СУММ(A1:A5)`.", "Дұрысы: «=» белгісі, функция аты және аргументі бар дөңгелек жақша: `=СУММ(A1:A5)`."),
    lk("Проверь по порядку: знак «=», имя, открывающая и закрывающая скобки.", "Ретімен тексер: «=» белгісі, аты, ашатын және жабатын жақша."),
  ),
  // ---------- B ----------
  ch(
    "list-vs-range",
    2,
    lk("В ячейках A1, A2, A3 записаны числа 5, 7, 2. Чему равно значение формулы `=СУММ(A1;A3)`?", "A1, A2, A3 ұяшықтарында 5, 7, 2 сандары жазылған. `=СУММ(A1;A3)` формуласының мәні неге тең?"),
    ["7", "14", "12", "5"],
    [
      null,
      lk("Сложены все три ячейки — так считал бы диапазон A1:A3. А через «;» берутся только A1 и A3.", "Үш ұяшықтың бәрі қосылған — A1:A3 диапазоны солай есептер еді. Ал «;» арқылы тек A1 және A3 алынады."),
      lk("Это сумма A1 и A2, а в формуле стоят A1 и A3.", "Бұл A1 және A2 қосындысы, ал формулада A1 және A3 тұр."),
      lk("Это значение только одной ячейки A1: второй аргумент A3 тоже нужно сложить.", "Бұл тек бір A1 ұяшығының мәні: екінші аргумент A3 те қосылуы керек."),
    ],
    lk("Точка с запятой разделяет аргументы: берутся только A1 (5) и A3 (2). 5 + 2 = 7. A2 в сумму не входит.", "Нүктелі үтір аргументтерді бөледі: тек A1 (5) және A3 (2) алынады. 5 + 2 = 7. A2 қосындыға кірмейді."),
    lk("Чем отличается `A1;A3` от `A1:A3`? Какие ячейки берёт каждая запись?", "`A1;A3` мен `A1:A3` жазбаларының айырмасы қандай? Әр жазба қай ұяшықтарды алады?"),
    gridScene([[5], [7], [2]]),
  ),
  ch(
    "count-vs-counta",
    2,
    lk("Чем отличается СЧЁТЗ от СЧЁТ?", "СЧЁТЗ функциясының СЧЁТ функциясынан айырмасы неде?"),
    [
      lk("СЧЁТ считает только числа, а СЧЁТЗ — все непустые ячейки", "СЧЁТ тек сандарды санайды, ал СЧЁТЗ — барлық бос емес ұяшықты"),
      lk("СЧЁТ считает все ячейки, а СЧЁТЗ — только числа", "СЧЁТ барлық ұяшықты санайды, ал СЧЁТЗ — тек сандарды"),
      lk("СЧЁТЗ считает только пустые ячейки", "СЧЁТЗ тек бос ұяшықтарды санайды"),
      lk("Они всегда дают одинаковый результат", "Олар әрқашан бірдей нәтиже береді"),
    ],
    [
      null,
      lk("Всё наоборот: считает все ячейки не СЧЁТ, а числа считает именно он.", "Керісінше: барлық ұяшықты санайтын СЧЁТ емес, ал сандарды дәл ол санайды."),
      lk("Пустые ячейки СЧЁТЗ как раз не считает.", "Бос ұяшықтарды СЧЁТЗ дәл санамайды."),
      lk("Результаты совпадают, только если в диапазоне нет текста; с текстом СЧЁТЗ даёт больше.", "Нәтижелер диапазонда мәтін болмағанда ғана сәйкес келеді; мәтін болса, СЧЁТЗ көбірек береді."),
    ],
    lk("СЧЁТ — только числа; СЧЁТЗ — все непустые ячейки (числа и текст). Если в диапазоне есть текст, СЧЁТЗ даёт больше.", "СЧЁТ — тек сандар; СЧЁТЗ — барлық бос емес ұяшықтар (сандар және мәтін). Диапазонда мәтін болса, СЧЁТЗ көбірек береді."),
    lk("Буква «З» в названии — «заполненные» ячейки.", "Атындағы «З» әрпі — «толтырылған» ұяшықтар."),
  ),
  ch(
    "text-skip",
    2,
    lk("Что произойдёт с формулой `=СУММ(B2:B6)`, если в одной из ячеек диапазона записан текст?", "B2:B6 диапазонының бір ұяшығында мәтін жазылса, `=СУММ(B2:B6)` формуласына не болады?"),
    [
      lk("Текст пропустится, сложатся только числа", "Мәтін өткізіліп кетеді, тек сандар қосылады"),
      lk("Появится ошибка #ЗНАЧ!", "#ЗНАЧ! қатесі шығады"),
      lk("Текст будет считаться числом 1", "Мәтін 1 саны деп есептеледі"),
      lk("Вся формула превратится в текст", "Бүкіл формула мәтінге айналады"),
    ],
    [
      null,
      lk("Ошибка #ЗНАЧ! появилась бы у `=A1+A2` с текстом, но функции пропускают текст в диапазонах.", "#ЗНАЧ! қатесі мәтіні бар `=A1+A2` формуласында шығар еді, ал функциялар диапазондағы мәтінді өткізіп жібереді."),
      lk("Текст не превращается в число: функция его просто не учитывает.", "Мәтін санға айналмайды: функция оны жай ғана ескермейді."),
      lk("Формула остаётся формулой и считает числа.", "Формула формула күйінде қалып, сандарды есептейді."),
    ],
    lk("Функции СУММ, СРЗНАЧ, МАКС, МИН и СЧЁТ берут из диапазона только числа: текст и пустые ячейки пропускаются.", "СУММ, СРЗНАЧ, МАКС, МИН және СЧЁТ функциялары диапазоннан тек сандарды алады: мәтін мен бос ұяшықтар өткізіліп кетеді."),
    lk("Вспомни ловушку из разбора: что функции делают с текстом внутри диапазона?", "Талдаудағы тұзақты еске түсір: функциялар диапазондағы мәтінмен не істейді?"),
  ),
  ch(
    "zero-vs-empty",
    2,
    lk(
      "В диапазоне B1:B4 записаны положительные числа, а ячейка B3 пуста. Как изменится значение `=СРЗНАЧ(B1:B4)`, если в B3 записать 0?",
      "B1:B4 диапазонында оң сандар жазылған, ал B3 ұяшығы бос. B3 ұяшығына 0 жазса, `=СРЗНАЧ(B1:B4)` мәні қалай өзгереді?",
    ),
    [lk("уменьшится", "азаяды"), lk("не изменится", "өзгермейді"), lk("увеличится", "артады"), lk("появится ошибка", "қате шығады")],
    [
      null,
      lk("Ноль — число, он добавляет к количеству чисел единицу, а пустая ячейка не добавляла.", "Нөл — сан, ол сандар санына бірді қосады, ал бос ұяшық қоспаған."),
      lk("Сумма не изменилась, а чисел стало больше, значит среднее не может вырасти.", "Қосынды өзгермеді, ал сандар көбейді, демек орташа мән өспейді."),
      lk("Ноль — обычное число, ошибки он не вызывает.", "Нөл — қарапайым сан, ол қате тудырмайды."),
    ],
    lk("С нулём чисел становится на одно больше, а сумма та же. Сумма делится на большее количество, поэтому среднее уменьшается.", "Нөлмен сандар бірге көбейеді, ал қосынды сол күйінде. Қосынды үлкен санға бөлінеді, сондықтан орташа мән азаяды."),
    lk("Что меняется при замене пустой ячейки нулём: сумма или количество чисел?", "Бос ұяшықты нөлмен ауыстырғанда не өзгереді: қосынды ма, әлде сандар саны ма?"),
  ),
  mu(
    "multi-nonempty",
    2,
    lk(
      "В ячейках A1:A5 записано: A1 = 3, A2 — текст «да», A3 пуста, A4 = 0, A5 = 5. Какие формулы дадут число 4? Выберите все верные ответы.",
      "A1:A5 ұяшықтарында жазылған: A1 = 3, A2 — «иә» мәтіні, A3 бос, A4 = 0, A5 = 5. Қай формулалар 4 санын береді? Барлық дұрыс жауапты таңдаңыз.",
    ),
    [fx("=СЧЁТЗ(A1:A5)"), fx("=СЧЁТ(A1:A5)+1"), fx("=СУММ(A1:A5)/2"), fx("=СЧЁТ(A1:A5)"), fx("=СРЗНАЧ(A1:A5)"), fx("=МАКС(A1:A5)-МИН(A1:A5)")],
    [0, 1, 2],
    [
      null,
      null,
      null,
      lk("Чисел только три (3, 0, 5): СЧЁТ даёт 3.", "Сандар тек үшеу (3, 0, 5): СЧЁТ 3 береді."),
      lk("Среднее 8 / 3 — это не 4.", "Орташа мән 8 / 3 — бұл 4 емес."),
      lk("Наибольшее 5, наименьшее 0 (ноль — число): разность 5.", "Ең үлкені 5, ең кішісі 0 (нөл — сан): айырмасы 5."),
    ],
    lk(
      "Числа в диапазоне: 3, 0 и 5 — сумма 8, их 3. Непустых ячеек 4 (3, «да», 0, 5): СЧЁТЗ = 4. СЧЁТ + 1 = 3 + 1 = 4. СУММ / 2 = 8 / 2 = 4. СЧЁТ = 3, СРЗНАЧ = 8 / 3, МАКС − МИН = 5 — не подходят.",
      "Диапазондағы сандар: 3, 0 және 5 — қосындысы 8, олар 3. Бос емес ұяшық 4 (3, «иә», 0, 5): СЧЁТЗ = 4. СЧЁТ + 1 = 3 + 1 = 4. СУММ / 2 = 8 / 2 = 4. СЧЁТ = 3, СРЗНАЧ = 8 / 3, МАКС − МИН = 5 — сәйкес келмейді.",
    ),
    lk("Для каждой формулы найди значение: сколько в диапазоне чисел, сколько непустых ячеек, чему равна сумма.", "Әр формуланың мәнін тап: диапазонда неше сан, неше бос емес ұяшық бар, қосынды неге тең."),
    gridScene([[3], [lk("да", "иә")], [null], [0], [5]]),
  ),
  // ---------- C ----------
  {
    id: `p:${SKILL}:running-sum`,
    type: "input",
    skill: SKILL,
    level: 3,
    prompt: lk(
      "В C2 записана формула `=СУММ($B$2:B2)`. Её скопировали вниз, в C4. Чему равно значение в C4?",
      "C2 ұяшығында `=СУММ($B$2:B2)` формуласы жазылған. Оны төмен, C4 ұяшығына көшірді. C4 ұяшығындағы мән неге тең?",
    ),
    scene: gridScene([
      [lk("День", "Күн"), lk("Продано", "Сатылды"), lk("Итого", "Барлығы")],
      [1, 3, fx("=СУММ($B$2:B2)")],
      [2, 5, null],
      [3, 2, null],
      [4, 6, null],
    ]),
    answers: ["10"],
    mode: "number",
    explanation: lk(
      "В C4 формула сдвинется на 2 строки вниз, а закреплённый край останется: `=СУММ($B$2:B4)`. Складываем B2, B3, B4: 3 + 5 + 2 = 10.",
      "C4 ұяшығында формула 2 жол төмен жылжиды, ал бекітілген шеті қалады: `=СУММ($B$2:B4)`. B2, B3, B4 қосамыз: 3 + 5 + 2 = 10.",
    ),
    hint: lk(
      "Какой край диапазона закреплён знаком $, а какой сдвигается при копировании вниз? Запиши формулу для C4.",
      "Диапазонның қай шеті $ белгісімен бекітілген, ал қайсысы төмен көшіргенде жылжиды? C4 үшін формуланы жаз.",
    ),
  } satisfies InputStep,
  ch(
    "copy-formula",
    3,
    lk("В C2 записана формула `=СРЗНАЧ(A2:B2)`. Её скопировали в E4. Какая формула окажется в E4?", "C2 ұяшығында `=СРЗНАЧ(A2:B2)` формуласы жазылған. Оны E4 ұяшығына көшірді. E4 ұяшығында қандай формула болады?"),
    [fx("=СРЗНАЧ(C4:D4)"), fx("=СРЗНАЧ(A4:B4)"), fx("=СРЗНАЧ(C2:D2)"), fx("=СРЗНАЧ(B4:C4)")],
    [
      null,
      lk("Сдвинуты только строки, а из C в E — ещё и два столбца вправо.", "Тек жолдар жылжытылған, ал C-дан E-ге — оңға екі баған да жылжиды."),
      lk("Сдвинуты только столбцы, а из строки 2 в строку 4 — ещё и две строки вниз.", "Тек бағандар жылжытылған, ал 2-жолдан 4-жолға — төмен екі жол да жылжиды."),
      lk("Столбцы сдвинуты только на один, а из C в E — на два.", "Бағандар тек бірге жылжытылған, ал C-дан E-ге — екіге."),
    ],
    lk("Из C2 в E4: на 2 столбца вправо (C → E) и на 2 строки вниз (2 → 4). Диапазон A2:B2 тоже сдвигается: A → C, B → D, 2 → 4. Получается `=СРЗНАЧ(C4:D4)`.", "C2-ден E4-ке: 2 баған оңға (C → E) және 2 жол төмен (2 → 4). A2:B2 диапазоны да жылжиды: A → C, B → D, 2 → 4. Нәтижесі: `=СРЗНАЧ(C4:D4)`."),
    lk("Найди сдвиг (на сколько столбцов и строк), потом сдвинь оба адреса диапазона.", "Жылжуды тап (қанша баған және қанша жол), содан кейін диапазонның екі мекенжайын да жылжыт."),
  ),
  ch(
    "abs-range",
    3,
    lk(
      "В C2 записана формула `=B2/СУММ($B$2:$B$6)` (доля товара в общей сумме). Её скопировали вниз, в C4. Какая формула окажется в C4?",
      "C2 ұяшығында `=B2/СУММ($B$2:$B$6)` формуласы жазылған (тауардың жалпы сомадағы үлесі). Оны төмен, C4 ұяшығына көшірді. C4 ұяшығында қандай формула болады?",
    ),
    [fx("=B4/СУММ($B$2:$B$6)"), fx("=B4/СУММ(B4:B8)"), fx("=B2/СУММ($B$2:$B$6)"), fx("=B4/СУММ($B$4:$B$8)")],
    [
      null,
      lk("Диапазон в знаменателе не закреплён, а он должен остаться прежним: поэтому в формуле и стоят знаки $.", "Бөлімдегі диапазон бекітілмеген, ал ол бұрынғыдай қалуы керек: сондықтан формулада $ белгілері тұр."),
      lk("Относительная ссылка B2 при копировании вниз должна сдвинуться до B4.", "Салыстырмалы B2 сілтемесі төмен көшіргенде B4 болып жылжуы керек."),
      lk("Знаки $ закрепляют и строки, и столбцы диапазона: он не сдвигается.", "$ белгілері диапазонның жолдары мен бағандарын да бекітеді: ол жылжымайды."),
    ],
    lk("Из C2 в C4 — на 2 строки вниз. Относительная B2 становится B4, а диапазон `$B$2:$B$6` закреплён знаками $ и не меняется. Получается `=B4/СУММ($B$2:$B$6)`.", "C2-ден C4-ке — 2 жол төмен. Салыстырмалы B2 сілтемесі B4 болады, ал `$B$2:$B$6` диапазоны $ белгілерімен бекітілген және өзгермейді. Нәтижесі: `=B4/СУММ($B$2:$B$6)`."),
    lk("Что в формуле «приколочено» знаком $, а что нет? Сдвигай только свободную ссылку.", "Формулада не $ белгісімен «шегеленген», не жоқ? Тек еркін сілтемені жылжыт."),
  ),
  ch(
    "range-difference",
    3,
    lk("Какая формула найдёт разность между наибольшим и наименьшим числами в диапазоне B2:B9?", "Қай формула B2:B9 диапазонындағы ең үлкен және ең кіші сандардың айырмасын табады?"),
    [fx("=МАКС(B2:B9)-МИН(B2:B9)"), fx("=МАКС(B2:B9;МИН(B2:B9))"), fx("=СУММ(МАКС(B2:B9);МИН(B2:B9))"), fx("=МАКС-МИН(B2:B9)")],
    [
      null,
      lk("Здесь МИН — просто второй аргумент МАКС: функция вернёт наибольшее число, и никакой разности не будет.", "Мұнда МИН — МАКС функциясының екінші аргументі ғана: функция ең үлкен санды қайтарады, айырма болмайды."),
      lk("СУММ складывает наибольшее и наименьшее, а нужна их разность.", "СУММ ең үлкен және ең кіші сандарды қосады, ал олардың айырмасы керек."),
      lk("У функций нет аргументов — так записать нельзя: диапазон нужен у каждой.", "Функцияларда аргумент жоқ — бұлай жазуға болмайды: әрқайсысына диапазон керек."),
    ],
    lk("Разность двух значений записывают знаком минус между двумя функциями: `=МАКС(B2:B9)-МИН(B2:B9)`.", "Екі мәннің айырмасын екі функцияның арасына минус қойып жазады: `=МАКС(B2:B9)-МИН(B2:B9)`."),
    lk("Нужно два значения — наибольшее и наименьшее. Каким знаком их соединить?", "Екі мән керек — ең үлкені және ең кішісі. Оларды қандай белгімен біріктіреді?"),
  ),
  ch(
    "mean-trap",
    3,
    lk(
      "В диапазоне B1:B5 записаны числа 4, 6 и 2, остальные две ячейки пусты. Какая формула даёт значение, НЕ равное `=СРЗНАЧ(B1:B5)`?",
      "B1:B5 диапазонында 4, 6 және 2 сандары жазылған, қалған екі ұяшық бос. Қай формула `=СРЗНАЧ(B1:B5)` мәніне ТЕҢ ЕМЕС мән береді?",
    ),
    [fx("=СУММ(B1:B5)/5"), fx("=СУММ(B1:B5)/СЧЁТ(B1:B5)"), fx("=СУММ(B1:B5)/СЧЁТЗ(B1:B5)"), fx("=СУММ(B1:B5)/3")],
    [
      null,
      lk("Здесь сумма 12 делится на количество чисел 3: получается 4, как у СРЗНАЧ.", "Мұнда 12 қосындысы сандар санына 3-ке бөлінеді: СРЗНАЧ сияқты 4 шығады."),
      lk("Непустых ячеек тоже 3 (все числа), поэтому 12 / 3 = 4, как у СРЗНАЧ.", "Бос емес ұяшық та 3 (бәрі сан), сондықтан 12 / 3 = 4, СРЗНАЧ сияқты."),
      lk("12 / 3 = 4: среднее по трём числам, как у СРЗНАЧ.", "12 / 3 = 4: үш сан бойынша орташа мән, СРЗНАЧ сияқты."),
    ],
    lk("СРЗНАЧ делит сумму 12 на количество чисел — 3 — и получает 4. Деление на 5 (все ячейки, включая пустые) даёт 2,4 — это не среднее.", "СРЗНАЧ 12 қосындысын сандар санына — 3-ке — бөліп, 4 алады. 5-ке бөлу (бос ұяшықтарды қоса, барлық ұяшық) 2,4 береді — бұл орташа мән емес."),
    lk("Сначала найди СРЗНАЧ: сумма и количество чисел. Затем проверь, какая формула делит на другое число.", "Алдымен СРЗНАЧ мәнін тап: қосынды және сандар саны. Содан кейін қай формула басқа санға бөлетінін тексер."),
    gridScene([[4], [6], [null], [2], [null]]),
  ),
];

const STATEMENTS: Statement[] = [
  { id: `s:${SKILL}:average`, skill: SKILL, level: 1, text: lk("Формула `=СРЗНАЧ(A1:A4)` вычисляет среднее арифметическое чисел в A1:A4", "`=СРЗНАЧ(A1:A4)` формуласы A1:A4 ішіндегі сандардың орташа арифметикалығын есептейді"), value: true, explanation: lk("СРЗНАЧ (AVERAGE) — среднее арифметическое.", "СРЗНАЧ (AVERAGE) — орташа арифметикалық."), hint: lk("Вспомни, что означает название функции.", "Функция атының не білдіретінін еске түсір.") },
  { id: `s:${SKILL}:max-min`, skill: SKILL, level: 1, text: lk("Формула `=МАКС(A1:A5)` находит наименьшее число в диапазоне", "`=МАКС(A1:A5)` формуласы диапазондағы ең кіші санды табады"), value: false, explanation: lk("МАКС находит наибольшее число, а наименьшее — МИН.", "МАКС ең үлкен санды табады, ал ең кішісін — МИН."), hint: lk("Название МАКС — от слова «максимум».", "МАКС атауы «максимум» сөзінен шыққан.") },
  { id: `s:${SKILL}:range-colon`, skill: SKILL, level: 1, text: lk("Диапазон ячеек от A1 до A5 записывают как A1;A5", "A1-ден A5-ке дейінгі ұяшықтар диапазонын A1;A5 деп жазады"), value: false, explanation: lk("Диапазон записывают через двоеточие: A1:A5. Запись A1;A5 — это две отдельные ячейки.", "Диапазонды қос нүкте арқылы жазады: A1:A5. A1;A5 жазбасы — екі жеке ұяшық."), hint: lk("Чем двоеточие отличается от точки с запятой?", "Қос нүкте нүктелі үтірден немен ерекшеленеді?") },
  { id: `s:${SKILL}:english`, skill: SKILL, level: 1, text: lk("SUM — это английское название функции СУММ", "SUM — бұл СУММ функциясының ағылшынша аты"), value: true, explanation: lk("СУММ — SUM, СРЗНАЧ — AVERAGE, МАКС — MAX, МИН — MIN, СЧЁТ — COUNT.", "СУММ — SUM, СРЗНАЧ — AVERAGE, МАКС — MAX, МИН — MIN, СЧЁТ — COUNT."), hint: lk("Sum по-английски — «сумма».", "Sum ағылшынша — «қосынды».") },
  { id: `s:${SKILL}:no-equals`, skill: SKILL, level: 1, text: lk("Запись `СУММ(A1:A5)` без знака «=» таблица вычислит как формулу", "`СУММ(A1:A5)` жазбасын «=» белгісінсіз кесте формула ретінде есептейді"), value: false, explanation: lk("Без «=» запись остаётся обычным текстом.", "«=» белгісінсіз жазба қарапайым мәтін күйінде қалады."), hint: lk("С какого знака начинается любая формула?", "Кез келген формула қандай белгіден басталады?") },
  { id: `s:${SKILL}:empty-avg`, skill: SKILL, level: 2, text: lk("Пустая ячейка в диапазоне считается нулём при вычислении СРЗНАЧ", "СРЗНАЧ есептегенде диапазондағы бос ұяшық нөл болып есептеледі"), value: false, explanation: lk("Пустая ячейка пропускается: она не увеличивает количество чисел. А вот записанный 0 — это число, его учитывают.", "Бос ұяшық өткізіліп кетеді: ол сандар санын көбейтпейді. Ал жазылған 0 — сан, оны ескереді."), hint: lk("Сравни пустую ячейку и ячейку с нулём: сколько чисел в каждом случае?", "Бос ұяшық пен нөлі бар ұяшықты салыстыр: әр жағдайда неше сан бар?") },
  { id: `s:${SKILL}:zero-number`, skill: SKILL, level: 2, text: lk("Ноль, записанный в ячейке, участвует в вычислении СРЗНАЧ", "Ұяшықта жазылған нөл СРЗНАЧ есептеуіне қатысады"), value: true, explanation: lk("Ноль — настоящее число: он увеличивает количество чисел на единицу, а сумму не меняет.", "Нөл — нағыз сан: ол сандар санын біреуге көбейтеді, ал қосындыны өзгертпейді."), hint: lk("Число это или нет — ноль, пустая ячейка, текст?", "Нөл, бос ұяшық, мәтін — қайсысы сан?") },
  { id: `s:${SKILL}:count-text`, skill: SKILL, level: 2, text: lk("Функция СЧЁТ считает и числа, и текст в диапазоне", "СЧЁТ функциясы диапазондағы сандарды да, мәтінді де санайды"), value: false, explanation: lk("СЧЁТ считает только числа. Числа и текст вместе считает СЧЁТЗ.", "СЧЁТ тек сандарды санайды. Сандарды да, мәтінді де СЧЁТЗ санайды."), hint: lk("Какая из двух функций — СЧЁТ или СЧЁТЗ — считает все непустые ячейки?", "СЧЁТ және СЧЁТЗ функцияларының қайсысы барлық бос емес ұяшықты санайды?") },
  { id: `s:${SKILL}:counta`, skill: SKILL, level: 2, text: lk("Функция СЧЁТЗ считает все непустые ячейки диапазона", "СЧЁТЗ функциясы диапазондағы барлық бос емес ұяшықты санайды"), value: true, explanation: lk("СЧЁТЗ (COUNTA) считает ячейки с числами и с текстом, пропуская только пустые.", "СЧЁТЗ (COUNTA) сандары және мәтіні бар ұяшықтарды санайды, тек бос ұяшықтарды өткізеді."), hint: lk("Буква «З» в названии — «заполненные».", "Атындағы «З» әрпі — «толтырылған».") },
  { id: `s:${SKILL}:sum-text-error`, skill: SKILL, level: 2, text: lk("Если в диапазоне функции СУММ есть текст, то формула выдаст ошибку #ЗНАЧ!", "СУММ функциясының диапазонында мәтін болса, формула #ЗНАЧ! қатесін береді"), value: false, explanation: lk("Функции пропускают текст в диапазоне. Ошибку #ЗНАЧ! даёт арифметика вида `=A1+A2`, если в ячейке текст.", "Функциялар диапазондағы мәтінді өткізіп жібереді. #ЗНАЧ! қатесін ұяшықта мәтін болғанда `=A1+A2` түріндегі арифметика береді."), hint: lk("Вспомни разбор ловушки: как функция относится к тексту в диапазоне?", "Тұзақтың талдауын еске түсір: функция диапазондағы мәтінге қалай қарайды?") },
  { id: `s:${SKILL}:overlap`, skill: SKILL, level: 3, text: lk("В формуле `=СУММ(A1:B2;B2:C3)` ячейка B2 складывается дважды", "`=СУММ(A1:B2;B2:C3)` формуласында B2 ұяшығы екі рет қосылады"), value: true, explanation: lk("Каждый аргумент считается отдельно, а B2 входит в оба диапазона.", "Әр аргумент бөлек есептеледі, ал B2 екі диапазонға да кіреді."), hint: lk("Входит ли B2 в оба диапазона?", "B2 екі диапазонға да кіре ме?") },
  { id: `s:${SKILL}:min-zero`, skill: SKILL, level: 3, text: lk("В диапазоне записаны числа 5 и 9, ячейка с нулём и пустая ячейка. Значение МИН для него равно 0", "Диапазонда 5 және 9 сандары, нөлі бар ұяшық және бос ұяшық жазылған. Оның МИН мәні 0-ге тең"), value: true, explanation: lk("Ноль — число, и он наименьший. Пустая ячейка не считается нулём, но нулевой ячейки достаточно.", "Нөл — сан, әрі ол ең кіші. Бос ұяшық нөл болып есептелмейді, бірақ нөлі бар ұяшық жеткілікті."), hint: lk("Какие значения диапазона участвуют в МИН?", "Диапазондағы қай мәндер МИН функциясына қатысады?") },
  { id: `s:${SKILL}:avg-by-four`, skill: SKILL, level: 3, text: lk("Формула `=СРЗНАЧ(A1:A4)` всегда равна `=СУММ(A1:A4)/4`", "`=СРЗНАЧ(A1:A4)` формуласы әрқашан `=СУММ(A1:A4)/4` формуласына тең"), value: false, explanation: lk("Это верно только когда во всех четырёх ячейках числа. Если есть пустая ячейка или текст, СРЗНАЧ делит на меньшее количество.", "Бұл тек төрт ұяшықтың бәрінде сан болғанда ғана дұрыс. Бос ұяшық немесе мәтін болса, СРЗНАЧ азырақ санға бөледі."), hint: lk("Подставь пример: в одной из четырёх ячеек пусто. На что делит СРЗНАЧ?", "Мысал қой: төрт ұяшықтың бірі бос. СРЗНАЧ неге бөледі?") },
  { id: `s:${SKILL}:copy-range`, skill: SKILL, level: 3, text: lk("Если формулу `=СУММ(B2:B4)` из B5 скопировать в C5, получится `=СУММ(C2:C4)`", "`=СУММ(B2:B4)` формуласын B5 ұяшығынан C5 ұяшығына көшірсе, `=СУММ(C2:C4)` шығады"), value: true, explanation: lk("Диапазон внутри функции сдвигается так же, как обычные ссылки: на один столбец вправо.", "Функция ішіндегі диапазон қарапайым сілтемелер сияқты жылжиды: бір баған оңға."), hint: lk("На сколько столбцов сдвинута формула? Сдвинется ли диапазон?", "Формула қанша бағанға жылжыған? Диапазон жылжи ма?") },
];

const PAIRS: Pair[] = [
  { id: `pr:${SKILL}:max`, skill: SKILL, level: 1, left: nm("МАКС"), right: lk("наибольшее число диапазона", "диапазондағы ең үлкен сан") },
  { id: `pr:${SKILL}:min`, skill: SKILL, level: 1, left: nm("МИН"), right: lk("наименьшее число диапазона", "диапазондағы ең кіші сан") },
  { id: `pr:${SKILL}:sum`, skill: SKILL, level: 1, left: nm("СУММ"), right: lk("сумма чисел", "сандардың қосындысы") },
  { id: `pr:${SKILL}:avg`, skill: SKILL, level: 1, left: nm("СРЗНАЧ"), right: lk("среднее арифметическое", "орташа арифметикалық") },
  { id: `pr:${SKILL}:count`, skill: SKILL, level: 1, left: nm("СЧЁТ"), right: lk("количество чисел", "сандардың саны") },
  { id: `pr:${SKILL}:colon`, skill: SKILL, level: 1, left: "A1:A5", right: lk("диапазон: пять ячеек подряд", "диапазон: қатарынан бес ұяшық") },
  { id: `pr:${SKILL}:semicolon`, skill: SKILL, level: 1, left: "A1;A5", right: lk("две отдельные ячейки", "екі жеке ұяшық") },
  { id: `pr:${SKILL}:counta`, skill: SKILL, level: 2, left: nm("СЧЁТЗ"), right: lk("количество непустых ячеек", "бос емес ұяшықтар саны") },
  { id: `pr:${SKILL}:en-average`, skill: SKILL, level: 2, left: "AVERAGE", right: "СРЗНАЧ" },
  { id: `pr:${SKILL}:en-count`, skill: SKILL, level: 2, left: "COUNT", right: "СЧЁТ" },
  { id: `pr:${SKILL}:en-counta`, skill: SKILL, level: 2, left: "COUNTA", right: "СЧЁТЗ" },
  { id: `pr:${SKILL}:span`, skill: SKILL, level: 3, left: fx("=МАКС(A1:A9)-МИН(A1:A9)"), right: lk("разность наибольшего и наименьшего", "ең үлкен және ең кіші сандардың айырмасы") },
  { id: `pr:${SKILL}:text-cells`, skill: SKILL, level: 3, left: fx("=СЧЁТЗ(A1:A9)-СЧЁТ(A1:A9)"), right: lk("количество текстовых ячеек", "мәтіндік ұяшықтар саны") },
  { id: `pr:${SKILL}:running`, skill: SKILL, level: 3, left: fx("=СУММ($B$2:B2)"), right: lk("сумма «с начала» при копировании вниз", "төмен көшіргендегі «басынан бастап» қосынды") },
];

const SHORTS: ShortQuestion[] = [
  { id: `ps:${SKILL}:cells-in-range`, skill: SKILL, level: 1, prompt: lk("В диапазоне B2:B9 все ячейки заполнены числами. Чему равно значение `=СЧЁТ(B2:B9)`?", "B2:B9 диапазонының барлық ұяшығы сандармен толтырылған. `=СЧЁТ(B2:B9)` мәні неге тең?"), answer: "8", mode: "number", explanation: lk("В диапазоне B2:B9 восемь ячеек (строки со 2 по 9), и все они числа: СЧЁТ = 8.", "B2:B9 диапазонында сегіз ұяшық (2-жолдан 9-жолға дейін), бәрі сан: СЧЁТ = 8."), hint: lk("Сколько строк от 2 до 9 включительно?", "2-ден 9-ға дейінгі, екеуін қоса, неше жол бар?") },
  { id: `ps:${SKILL}:arith-seq`, skill: SKILL, level: 2, prompt: lk("В A1, A2, A3 записаны числа 10, 20, 30, а в A4 — текст. Чему равно `=СРЗНАЧ(A1:A4)`?", "A1, A2, A3 ұяшықтарында 10, 20, 30 сандары, ал A4 ұяшығында мәтін жазылған. `=СРЗНАЧ(A1:A4)` неге тең?"), answer: "20", mode: "number", explanation: lk("Текст пропускается: 3 числа, сумма 60, среднее 60 / 3 = 20.", "Мәтін өткізіледі: 3 сан, қосындысы 60, орташа мәні 60 / 3 = 20."), hint: lk("Сколько чисел усредняется? Текст не считается.", "Неше сан орташаланады? Мәтін есептелмейді.") },
  { id: `ps:${SKILL}:max-min-sum`, skill: SKILL, level: 3, prompt: lk("В A1:A3 записаны числа 4, 9 и 6. Чему равно `=МАКС(A1:A3)+МИН(A1:A3)`?", "A1:A3 ұяшықтарында 4, 9 және 6 сандары жазылған. `=МАКС(A1:A3)+МИН(A1:A3)` неге тең?"), answer: "13", mode: "number", explanation: lk("МАКС = 9, МИН = 4, сумма 9 + 4 = 13.", "МАКС = 9, МИН = 4, қосындысы 9 + 4 = 13."), hint: lk("Найди наибольшее и наименьшее число, потом сложи их.", "Ең үлкен және ең кіші санды тап, содан кейін оларды қос.") },
];

const pool = poolBank({ skill: SKILL, questions: QUESTIONS, statements: STATEMENTS, pairs: PAIRS, shorts: SHORTS });

type Gen = (rand: Rand, seed: number) => QuestionStep;
const KINDS: Record<Level, Gen[]> = {
  1: [genValue, genValue],
  2: [genGaps, genGaps, genParts],
  3: [genOverlap, genMissing, genCopy, genNested, genNested],
};

const functionsBank: SkillBank = {
  skill: SKILL,
  // Около трети заданий — статичный пул «на знание», остальное — генератор: ответ считает код.
  question(level, seed) {
    const rand = seeded(seed);
    if (rand() < 0.3) return pool.question(level, seed + 99991);
    return pick(rand, KINDS[level])(rand, seed);
  },
  statement: (level, seed) => pool.statement!(level, seed),
  pair: (level, seed) => pool.pair!(level, seed),
  short(level, seed) {
    const rand = seeded(seed);
    if (rand() < 0.2) return pool.short!(level, seed + 99991);
    return genShort(rand, level, seed);
  },
};

export const BANKS: SkillBank[] = [functionsBank];
