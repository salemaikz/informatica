import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import { poolBank } from "./pool";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка sheets.formulas: адрес ячейки, диапазон, значение формулы, функции СУММ/СРЗНАЧ/МИН/МАКС/СЧЁТ,
// текстовые функции, ошибки, выбор диаграммы.
// Расчётная часть — генератор с мини-движком таблицы (evalGrid): значение формулы всегда считает код, неверные
// варианты — значения «соседних» формул (другой порядок действий, лишняя ячейка, делитель не тот).
// Знание (диаграммы, ошибки, смысл функций) — статичный пул.
// Правильность перепроверена независимым Python-движком (scripts/out/data-1-sheets/verify_bank.py).
// После переменных чисел казахские тексты без падежных окончаний.

const SKILL = "sheets.formulas";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });

/** Русское склонение: 1 ячейка, 2 ячейки, 5 ячеек. */
function ruPl(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Число для вывода: целое как есть, дробное с запятой (4,2). */
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ","));

// ---------- Мини-движок электронной таблицы ----------

/** Содержимое ячейки: число, текст, пусто (null) или формула (строка с «=» в начале). */
type Cell = number | string | null;
type Val = number | string | null;

class SheetError extends Error {}

const colName = (c: number) => String.fromCharCode(65 + c);
const addr = (c: number, r: number) => `${colName(c)}${r + 1}`;

/** Текстовые ячейки, которые показываются на двух языках. */
const TEXT_L: Record<string, L> = {
  нет: { ru: "нет", kk: "жоқ" },
  да: { ru: "да", kk: "иә" },
};

/**
 * Значения всех ячеек: формулы считаются рекурсивно. flat — «ошибочный» режим без приоритета операций
 * (слева направо) — нужен только для неверных вариантов ответа.
 */
function evalGrid(grid: Cell[][], flat = false): Val[][] {
  const memo = new Map<string, Val>();
  const visiting = new Set<string>();

  const get = (c: number, r: number): Val => {
    if (r < 0 || r >= grid.length || c < 0) return null;
    const raw = grid[r][c] ?? null;
    if (typeof raw !== "string" || !raw.startsWith("=")) return raw;
    const key = `${c}:${r}`;
    if (memo.has(key)) return memo.get(key) as Val;
    if (visiting.has(key)) throw new SheetError("#ССЫЛКА!");
    visiting.add(key);
    const v = evalFormula(raw.slice(1), get, flat);
    visiting.delete(key);
    memo.set(key, v);
    return v;
  };

  return grid.map((row, r) => row.map((_, c) => get(c, r)));
}

type Item = Val | Val[];

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|"([^"]*)"|([A-Z]+)(\d+)|([А-ЯЁ]+)|([-+*/^():;]))/y;

function evalFormula(src: string, get: (c: number, r: number) => Val, flat: boolean): Val {
  type Tok = { t: "num" | "str" | "ref" | "name" | "op"; v: string; col?: number; row?: number };
  const toks: Tok[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    const m = TOKEN.exec(src);
    if (!m) throw new SheetError("#ИМЯ?");
    if (m[1] !== undefined) toks.push({ t: "num", v: m[1] });
    else if (m[2] !== undefined) toks.push({ t: "str", v: m[2] });
    else if (m[3] !== undefined) toks.push({ t: "ref", v: m[3] + m[4], col: m[3].charCodeAt(0) - 65, row: Number(m[4]) - 1 });
    else if (m[5] !== undefined) toks.push({ t: "name", v: m[5] });
    else toks.push({ t: "op", v: m[6] });
  }
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === "op" && peek().v === v;
  const toNum = (x: Item): number => {
    if (Array.isArray(x)) throw new SheetError("#ЗНАЧ!");
    if (x === null) return 0;
    if (typeof x === "string") throw new SheetError("#ЗНАЧ!");
    return x;
  };
  const numsOf = (args: Item[]) => args.flat().filter((v): v is number => typeof v === "number");
  const text = (x: Item): string => (Array.isArray(x) ? "" : x === null ? "" : String(x));

  const call = (name: string, args: Item[]): Val => {
    switch (name) {
      case "СУММ":
        return numsOf(args).reduce((a, b) => a + b, 0);
      case "СРЗНАЧ": {
        const n = numsOf(args);
        if (!n.length) throw new SheetError("#ДЕЛ/0!");
        return n.reduce((a, b) => a + b, 0) / n.length;
      }
      case "МИН": {
        const n = numsOf(args);
        return n.length ? Math.min(...n) : 0;
      }
      case "МАКС": {
        const n = numsOf(args);
        return n.length ? Math.max(...n) : 0;
      }
      case "СЧЁТ":
        return numsOf(args).length;
      case "СТРОЧН":
        return text(args[0]).toLowerCase();
      case "ПРОПИСН":
        return text(args[0]).toUpperCase();
      case "ДЛСТР":
        return text(args[0]).length;
      default:
        throw new SheetError("#ИМЯ?");
    }
  };

  const atom = (): Item => {
    const t = toks[i++];
    if (!t) throw new SheetError("#ИМЯ?");
    if (t.t === "num") return Number(t.v);
    if (t.t === "str") return t.v;
    if (t.t === "op" && t.v === "(") {
      const v = expr();
      if (!isOp(")")) throw new SheetError("#ИМЯ?");
      i++;
      return v;
    }
    if (t.t === "name") {
      if (!isOp("(")) throw new SheetError("#ИМЯ?");
      i++;
      const args: Item[] = [];
      while (!isOp(")")) {
        args.push(expr());
        if (isOp(";")) i++;
      }
      i++;
      return call(t.v, args);
    }
    if (t.t === "ref") {
      if (isOp(":")) {
        i++;
        const t2 = toks[i++];
        const out: Val[] = [];
        for (let r = t.row as number; r <= (t2.row as number); r++) for (let c = t.col as number; c <= (t2.col as number); c++) out.push(get(c, r));
        return out;
      }
      return get(t.col as number, t.row as number);
    }
    throw new SheetError("#ИМЯ?");
  };
  const pow = (): Item => {
    let left = atom();
    while (isOp("^")) {
      i++;
      left = toNum(left) ** toNum(atom());
    }
    return left;
  };
  const mul = (): Item => {
    let left = pow();
    while (isOp("*") || isOp("/")) {
      const op = toks[i++].v;
      const right = toNum(pow());
      if (op === "/" && right === 0) throw new SheetError("#ДЕЛ/0!");
      left = op === "*" ? toNum(left) * right : toNum(left) / right;
    }
    return left;
  };
  const add = (): Item => {
    let left = mul();
    while (isOp("+") || isOp("-")) {
      const op = toks[i++].v;
      const right = toNum(mul());
      left = op === "+" ? toNum(left) + right : toNum(left) - right;
    }
    return left;
  };
  // Режим «слева направо без приоритета»: для неверных вариантов ответа.
  const flatExpr = (): Item => {
    let left = pow();
    while (isOp("+") || isOp("-") || isOp("*") || isOp("/")) {
      const op = toks[i++].v;
      const right = toNum(pow());
      if (op === "/" && right === 0) throw new SheetError("#ДЕЛ/0!");
      left = op === "+" ? toNum(left) + right : op === "-" ? toNum(left) - right : op === "*" ? toNum(left) * right : toNum(left) / right;
    }
    return left;
  };
  const expr = (): Item => (flat ? flatExpr() : add());

  const result = expr();
  if (i < toks.length) throw new SheetError("#ИМЯ?");
  return Array.isArray(result) ? result[0] : result;
}

/** Значение одной ячейки. */
function valueAt(grid: Cell[][], c: number, r: number, flat = false): Val {
  return evalGrid(grid, flat)[r][c];
}

/** Число или undefined, если вычислить нельзя (ошибка таблицы или не число). */
function numAt(grid: Cell[][], c: number, r: number, flat = false): number | undefined {
  try {
    const v = valueAt(grid, c, r, flat);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Сцены ----------

const cellText = (c: Cell): Text => (c === null ? "" : typeof c === "number" ? String(c) : (TEXT_L[c] ?? c));

/** Электронная таблица с подсветкой ячеек [строка, столбец] (индексы с 0). */
function sheetScene(grid: Cell[][], cells?: [number, number][], caption?: Text): Scene {
  const width = Math.max(...grid.map((r) => r.length));
  const rows = grid.map((r) => Array.from({ length: width }, (_, c) => cellText(r[c] ?? null)));
  return { kind: "table", sheet: true, rows, highlightCells: cells, caption };
}

const rect = (c1: number, r1: number, c2: number, r2: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push([r, c]);
  return out;
};

/** Таблица случайных чисел. */
function numbers(rand: Rand, rows: number, cols: number, min: number, max: number): Cell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => int(rand, min, max) as Cell));
}

/** Подстановка значений вместо адресов: =A1+B1*C1 → 4+3*2 (только для ячеек с числами). */
function substitute(formula: string, grid: Cell[][]): string {
  return formula.slice(1).replace(/([A-Z])(\d+)/g, (_, c: string, r: string) => {
    const v = grid[Number(r) - 1]?.[c.charCodeAt(0) - 65];
    return typeof v === "number" ? String(v) : `${c}${r}`;
  });
}

// ---------- Варианты ответа ----------

interface Opt {
  text: string;
  why: L | null;
  /** Запасной вариант без точного разбора ошибки: берётся, только если нет содержательных. */
  weak?: boolean;
}

interface ChoiceInput {
  id: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  hint: L;
  explanation: L;
  correct: string;
  wrongs: Opt[];
}

/** Задание choice: правильный вариант + 3 уникальных неверных (с разбором ошибки), перемешаны. */
function choice(rand: Rand, c: ChoiceInput): ChoiceStep {
  const seen = new Set<string>([c.correct]);
  const wrongs: Opt[] = [];
  const ordered = shuffle(c.wrongs, rand).sort((a, b) => Number(!!a.weak) - Number(!!b.weak));
  for (const w of ordered) {
    if (wrongs.length >= 3) break;
    if (w.text && !seen.has(w.text)) {
      seen.add(w.text);
      wrongs.push(w);
    }
  }
  if (wrongs.length < 3) throw new Error(`sheets.formulas ${c.id}: мало неверных вариантов`);
  const all: Opt[] = shuffle([{ text: c.correct, why: null }, ...wrongs], rand);
  return {
    id: c.id,
    type: "choice",
    skill: SKILL,
    level: c.level,
    prompt: c.prompt,
    scene: c.scene,
    hint: c.hint,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
    explanation: c.explanation,
  };
}

function input(id: string, level: Level, prompt: L, hint: L, explanation: L, answer: number, scene?: Scene): InputStep {
  return { id, type: "input", skill: SKILL, level, prompt, scene, hint, answers: [String(answer)], mode: "number", explanation };
}

/** Безопасный id: только буквы, цифры, «_», «.», «-» (двоеточие — разделитель частей id). */
const idp = (...parts: (string | number)[]) => parts.join("_").replace(/[^A-Za-z0-9А-Яа-яЁё_.-]/g, "");

/** Неверные числовые варианты: значения «соседних» формул + запасные ±1, ±2. */
function numWrongs(correct: number, cands: { v: number | undefined; why: L }[]): Opt[] {
  const out: Opt[] = [];
  const seen = new Set<number>([correct]);
  for (const c of cands) {
    if (c.v === undefined || !Number.isFinite(c.v) || c.v < 0 || seen.has(c.v)) continue;
    seen.add(c.v);
    out.push({ text: num(c.v), why: c.why });
  }
  const filler: L = {
    ru: "Ошибка в вычислениях: пересчитай решение по шагам ещё раз.",
    kk: "Есептеуде қате бар: шешуді қадамдар бойынша қайта есепте.",
  };
  for (const d of [1, -1, 2, -2, 3]) {
    const v = correct + d;
    if (v >= 0 && !seen.has(v)) {
      seen.add(v);
      out.push({ text: num(v), why: filler, weak: true });
    }
  }
  return out;
}

// ---------- Подсказки (не выдают ответ) ----------

const HINT_ADDR: L = {
  ru: "Найди букву над столбцом выделенной ячейки и номер её строки слева. Адрес: сначала буква, потом номер.",
  kk: "Белгіленген ұяшық бағанының үстіндегі әріпті және сол жақтағы жол нөмірін тап. Мекенжай: алдымен әріп, содан кейін нөмір.",
};
const HINT_COUNT: L = {
  ru: "Диапазон — прямоугольник. Посчитай столбцы от первой буквы до последней включительно и строки от первого номера до последнего включительно, потом перемножь.",
  kk: "Диапазон — тіктөртбұрыш. Бағандарды бірінші әріптен соңғысына дейін қоса есепте, жолдарды да бірінші нөмірден соңғысына дейін қоса есепте, содан кейін көбейт.",
};
const HINT_CALC: L = {
  ru: "Подставь числа из ячеек вместо адресов и выполняй действия по порядку: скобки, затем * и /, затем + и −.",
  kk: "Мекенжайлардың орнына ұяшықтардағы сандарды қойып, амалдарды ретімен орында: жақша, содан кейін * және /, содан кейін + және −.",
};
const HINT_FUNC: L = {
  ru: "Найди в диапазоне числа и выполни то, что делает функция: СУММ складывает, МИН и МАКС ищут наименьшее и наибольшее.",
  kk: "Диапазоннан сандарды тауып, функция не істейтінін орында: СУММ қосады, МИН мен МАКС ең кіші және ең үлкен санды іздейді.",
};
const HINT_TEXTCELLS: L = {
  ru: "Функции пропускают текст и пустые ячейки. Сначала выпиши только числа диапазона и посчитай, сколько их.",
  kk: "Функциялар мәтін мен бос ұяшықтарды өткізіп жібереді. Алдымен диапазондағы тек сандарды жазып ал да, олардың санын есепте.",
};
const HINT_TEXTFN: L = {
  ru: "Возьми текст из ячейки и примени функцию: СТРОЧН — все буквы строчные, ПРОПИСН — все заглавные, ДЛСТР — число символов.",
  kk: "Ұяшықтағы мәтінді алып, функцияны қолдан: СТРОЧН — барлық әріп кіші, ПРОПИСН — барлық әріп бас әріп, ДЛСТР — символдар саны.",
};
const HINT_SEP: L = {
  ru: "Двоеточие означает «весь диапазон от и до», а точка с запятой — перечисление отдельных ячеек. Какие ячейки названы в формуле?",
  kk: "Қос нүкте «бастап соңына дейінгі бүкіл диапазонды» білдіреді, ал нүктелі үтір жеке ұяшықтарды тізеді. Формулада қай ұяшықтар аталған?",
};
const HINT_UNION: L = {
  ru: "Посчитай ячейки каждого диапазона, затем найди ячейки, которые входят в оба, — их нельзя считать дважды.",
  kk: "Әр диапазондағы ұяшықтарды есепте, содан кейін екеуіне де кіретін ұяшықтарды тап — оларды екі рет санауға болмайды.",
};
const HINT_CHAIN: L = {
  ru: "Считай по порядку: сначала ячейки, которые зависят только от чисел, потом те, что используют их результаты.",
  kk: "Ретімен есепте: алдымен тек сандарға тәуелді ұяшықтар, содан кейін олардың нәтижесін қолданатындар.",
};

// ---------- Генераторы заданий ----------

type Gen = (rand: Rand, level: Level, seed: number) => QuestionStep;

/** Адрес ячейки по картинке. */
const genAddr: Gen = (rand, level, seed) => {
  const grid = numbers(rand, 4, 4, 1, 9);
  const c = int(rand, 1, 3);
  const r = int(rand, 1, 3);
  const right = addr(c, r);
  const swapped = `${colName(r)}${c + 1}`;
  const w = (text: string, ru: string, kk: string): Opt => ({ text, why: { ru, kk } });
  return choice(rand, {
    id: `g:${SKILL}:addr:${right}:${seed}`,
    level,
    prompt: { ru: "Каков адрес выделенной ячейки?", kk: "Белгіленген ұяшықтың мекенжайы қандай?" },
    scene: sheetScene(grid, [[r, c]]),
    hint: HINT_ADDR,
    explanation: {
      ru: `Над ячейкой стоит буква ${colName(c)}, слева от неё — номер ${r + 1}. Адрес: сначала буква, потом номер — ${right}.`,
      kk: `Ұяшықтың үстінде ${colName(c)} әрпі, сол жағында ${r + 1} нөмірі тұр. Мекенжай: алдымен әріп, содан кейін нөмір — ${right}.`,
    },
    correct: right,
    wrongs: [
      w(`${r + 1}${colName(c)}`, "Порядок записи перепутан: сначала буква столбца, потом номер строки.", "Жазылу реті шатастырылған: алдымен баған әрпі, содан кейін жол нөмірі."),
      w(addr(c - 1, r), "Это соседняя ячейка слева: проверь букву над выделенной ячейкой.", "Бұл сол жақтағы көрші ұяшық: белгіленген ұяшықтың үстіндегі әріпті тексер."),
      w(addr(c + 1, r), "Это соседняя ячейка справа: проверь букву над выделенной ячейкой.", "Бұл оң жақтағы көрші ұяшық: белгіленген ұяшықтың үстіндегі әріпті тексер."),
      w(addr(c, r - 1), "Это ячейка строкой выше: проверь номер строки слева от выделенной ячейки.", "Бұл бір жол жоғарыдағы ұяшық: белгіленген ұяшықтың сол жағындағы жол нөмірін тексер."),
      w(addr(c, r + 1), "Это ячейка строкой ниже: проверь номер строки слева от выделенной ячейки.", "Бұл бір жол төмендегі ұяшық: белгіленген ұяшықтың сол жағындағы жол нөмірін тексер."),
      w(swapped, "Номер строки принят за букву столбца, а номер столбца — за номер строки.", "Жол нөмірі баған әрпі, ал баған нөмірі жол нөмірі деп қабылданған."),
    ].filter((o) => o.text !== right),
  });
};

/** Число ячеек в диапазоне. A: от A1 с картинкой, B: произвольный диапазон, ввод числа. */
const genCount: Gen = (rand, level, seed) => {
  const countOpts = (cols: number, rows: number): Opt[] =>
    numWrongs(cols * rows, [
      { v: cols + rows, why: { ru: `${cols} + ${rows}: столбцы и строки сложены, а надо перемножить.`, kk: `${cols} + ${rows}: бағандар мен жолдар қосылған, ал көбейту керек.` } },
      { v: (cols - 1) * (rows - 1), why: { ru: "Крайние столбец и строка не посчитаны: диапазон включает и первую, и последнюю.", kk: "Шеткі баған мен жол санаққа кірмеген: диапазонға бірінші де, соңғы да кіреді." } },
      { v: (cols - 1) * rows, why: { ru: "Один крайний столбец не посчитан: в диапазон входят оба крайних столбца.", kk: "Бір шеткі баған санаққа кірмеген: диапазонға екі шеткі баған да кіреді." } },
      { v: cols * (rows - 1), why: { ru: "Одна крайняя строка не посчитана: в диапазон входят обе крайние строки.", kk: "Бір шеткі жол санаққа кірмеген: диапазонға екі шеткі жол да кіреді." } },
    ]);
  if (level === 1) {
    const cols = int(rand, 2, 4);
    const rows = int(rand, 2, 4);
    const rng = `A1:${addr(cols - 1, rows - 1)}`;
    const grid = numbers(rand, 5, 5, 1, 9);
    return choice(rand, {
      id: `g:${SKILL}:count:${idp(rng)}:${seed}`,
      level,
      prompt: { ru: `Сколько ячеек в диапазоне ${rng}?`, kk: `${rng} диапазонында неше ұяшық бар?` },
      scene: sheetScene(grid, rect(0, 0, cols - 1, rows - 1)),
      hint: HINT_COUNT,
      explanation: {
        ru: `Столбцы A–${colName(cols - 1)}: ${cols}, строки 1–${rows}: ${rows}. Ячеек: ${cols} × ${rows} = ${cols * rows}.`,
        kk: `A–${colName(cols - 1)} бағандары: ${cols}, 1–${rows} жолдары: ${rows}. Ұяшықтар саны: ${cols} × ${rows} = ${cols * rows}.`,
      },
      correct: String(cols * rows),
      wrongs: countOpts(cols, rows),
    });
  }
  const c1 = int(rand, 1, 3);
  const r1 = int(rand, 2, 5);
  const cols = int(rand, 2, 5);
  const rows = int(rand, 2, 6);
  const rng = `${addr(c1, r1 - 1)}:${addr(c1 + cols - 1, r1 + rows - 2)}`;
  return input(
    `g:${SKILL}:count:${idp(rng)}:${seed}`,
    level,
    { ru: `Сколько ячеек в диапазоне ${rng}?`, kk: `${rng} диапазонында неше ұяшық бар?` },
    HINT_COUNT,
    {
      ru: `Столбцы ${colName(c1)}–${colName(c1 + cols - 1)}: ${cols}, строки ${r1}–${r1 + rows - 1}: ${rows}. Ячеек: ${cols} × ${rows} = ${cols * rows}. Крайние столбец и строка тоже входят.`,
      kk: `${colName(c1)}–${colName(c1 + cols - 1)} бағандары: ${cols}, ${r1}–${r1 + rows - 1} жолдары: ${rows}. Ұяшықтар саны: ${cols} × ${rows} = ${cols * rows}. Шеткі баған мен жол да кіреді.`,
    },
    cols * rows,
  );
};

/** Шаблоны простых формул: формула, ограничение на значения, «соседние» формулы с пояснением. */
interface CalcTpl {
  f: string;
  ok: (a: number, b: number, c: number) => boolean;
  alts: { f: string; ru: string; kk: string; flat?: boolean }[];
}

const prio = {
  ru: "Порядок действий нарушен: сначала скобки, затем умножение и деление, затем сложение и вычитание.",
  kk: "Амалдардың орындалу реті бұзылған: алдымен жақша, содан кейін көбейту мен бөлу, соңында қосу мен азайту.",
};
const wrongOp = {
  ru: "Знак действия перепутан: проверь, какие знаки стоят в формуле.",
  kk: "Амал белгісі шатастырылған: формулада қандай белгілер тұрғанын тексер.",
};

const TPL_A: CalcTpl[] = [
  { f: "=A1+B1", ok: () => true, alts: [{ f: "=A1*B1", ...wrongOp }, { f: "=B1+C1", ru: "Взяты не те ячейки.", kk: "Басқа ұяшықтар алынған." }, { f: "=A1+B1+C1", ru: "Лишняя ячейка C1: в формуле её нет.", kk: "Артық C1 ұяшығы: формулада ол жоқ." }] },
  { f: "=A1*B1", ok: () => true, alts: [{ f: "=A1+B1", ...wrongOp }, { f: "=B1*C1", ru: "Взяты не те ячейки.", kk: "Басқа ұяшықтар алынған." }, { f: "=A1*B1*C1", ru: "Лишняя ячейка C1: в формуле её нет.", kk: "Артық C1 ұяшығы: формулада ол жоқ." }] },
  { f: "=A1+B1+C1", ok: () => true, alts: [{ f: "=A1+B1", ru: "Не учтена ячейка C1.", kk: "C1 ұяшығы ескерілмеген." }, { f: "=A1*B1*C1", ...wrongOp }, { f: "=B1+C1", ru: "Не учтена ячейка A1.", kk: "A1 ұяшығы ескерілмеген." }] },
  { f: "=C1-A1", ok: (a, _b, c) => c > a, alts: [{ f: "=C1+A1", ...wrongOp }, { f: "=C1-B1", ru: "Вычтена не та ячейка.", kk: "Басқа ұяшық алынып тасталған." }, { f: "=B1-A1", ru: "Взяты не те ячейки.", kk: "Басқа ұяшықтар алынған." }] },
];

const TPL_B: CalcTpl[] = [
  { f: "=A1+B1*C1", ok: () => true, alts: [{ f: "=(A1+B1)*C1", ...prio }, { f: "=A1+B1+C1", ...wrongOp }, { f: "=A1*B1+C1", ru: "Умножение выполнено над другими ячейками.", kk: "Көбейту басқа ұяшықтарға орындалған." }] },
  { f: "=(A1+B1)*C1", ok: () => true, alts: [{ f: "=A1+B1*C1", ru: "Скобки не учтены: сначала выполняется действие в скобках.", kk: "Жақша ескерілмеген: алдымен жақшадағы амал орындалады." }, { f: "=A1+B1+C1", ...wrongOp }, { f: "=A1*C1+B1", ru: "Скобки раскрыты неверно.", kk: "Жақша дұрыс ашылмаған." }] },
  { f: "=A1*B1+C1", ok: () => true, alts: [{ f: "=A1*(B1+C1)", ru: "Сложение выполнено раньше умножения: в формуле скобок нет.", kk: "Қосу көбейтуден бұрын орындалған: формулада жақша жоқ." }, { f: "=A1*B1*C1", ...wrongOp }, { f: "=A1+B1*C1", ru: "Умножение выполнено над другими ячейками.", kk: "Көбейту басқа ұяшықтарға орындалған." }] },
  { f: "=A1-B1*C1", ok: (a, b, c) => a > b * c, alts: [{ f: "=(A1-B1)*C1", ...prio }, { f: "=A1-B1-C1", ...wrongOp }, { f: "=A1+B1*C1", ru: "Знак действия перепутан: в формуле вычитание.", kk: "Амал белгісі шатастырылған: формулада азайту тұр." }] },
  { f: "=A1/B1+C1", ok: (a, b) => a % b === 0, alts: [{ f: "=A1/(B1+C1)", ...prio }, { f: "=A1/B1*C1", ...wrongOp }, { f: "=A1*B1+C1", ru: "Знак действия перепутан: в формуле деление.", kk: "Амал белгісі шатастырылған: формулада бөлу тұр." }] },
  { f: "=A1+B1/C1", ok: (_a, b, c) => b % c === 0, alts: [{ f: "=(A1+B1)/C1", ...prio }, { f: "=A1+B1*C1", ru: "Знак действия перепутан: в формуле деление.", kk: "Амал белгісі шатастырылған: формулада бөлу тұр." }, { f: "=A1+B1+C1", ...wrongOp }] },
  { f: "=A1^2+B1", ok: () => true, alts: [{ f: "=A1*2+B1", ru: "Знак ^ — это степень: A1^2 = A1 · A1, а не A1 · 2.", kk: "^ белгісі — дәреже: A1^2 = A1 · A1, ал A1 · 2 емес." }, { f: "=(A1+B1)^2", ...prio }, { f: "=A1+B1", ru: "Степень не учтена.", kk: "Дәреже ескерілмеген." }] },
];

/** Простая формула: значения в A1:C1, формула в D1. */
const genCalc: Gen = (rand, level, seed) => {
  const tpls = level === 1 ? TPL_A : TPL_B;
  for (let tries = 0; tries < 80; tries++) {
    const tpl = pick(rand, tpls);
    const [lo, hi] = level === 1 ? [2, 12] : [2, 9];
    const [a, b, c] = [int(rand, lo, hi), int(rand, lo, hi), int(rand, lo, hi)];
    if (!tpl.ok(a, b, c)) continue;
    const grid: Cell[][] = [[a, b, c, tpl.f]];
    const v = numAt(grid, 3, 0);
    if (v === undefined || !Number.isInteger(v) || v < 1) continue;
    const alts = tpl.alts.map((alt) => ({
      v: numAt([[a, b, c, alt.f]], 3, 0),
      why: { ru: alt.ru, kk: alt.kk } as L,
    }));
    const flatV = numAt(grid, 3, 0, true);
    if (flatV !== undefined && flatV !== v && /[()]/.test(tpl.f) === false) alts.push({ v: flatV, why: { ru: prio.ru, kk: prio.kk } });
    const wrongs = numWrongs(v, alts);
    if (wrongs.length < 3) continue;
    return choice(rand, {
      id: `g:${SKILL}:calc:${idp(tpl.f, a, b, c)}:${seed}`,
      level,
      prompt: { ru: "Чему равно значение, которое покажет ячейка D1?", kk: "D1 ұяшығында қандай мән көрсетіледі?" },
      scene: sheetScene(grid, [[0, 3]]),
      hint: HINT_CALC,
      explanation: {
        ru: `Подставляем значения: ${substitute(tpl.f, grid)} = ${v}. Скобки — первыми, затем степень, затем умножение и деление, затем сложение и вычитание.`,
        kk: `Мәндерді қоямыз: ${substitute(tpl.f, grid)} = ${v}. Алдымен жақша, содан кейін дәреже, содан кейін көбейту мен бөлу, соңында қосу мен азайту.`,
      },
      correct: String(v),
      wrongs,
    });
  }
  throw new Error("sheets.formulas calc: не удалось подобрать значения");
};

/** Функции СУММ / МИН / МАКС над числами (A). */
const genFuncBasic: Gen = (rand, level, seed) => {
  const fn = pick(rand, ["СУММ", "МИН", "МАКС"] as const);
  const vertical = rand() < 0.5;
  const n = 4;
  const data = Array.from({ length: n }, () => int(rand, 2, 30));
  // Для СУММ иногда берём не весь столбец — ловушка «диапазон до A3».
  const partial = fn === "СУММ" && rand() < 0.5;
  const take = partial ? 3 : n;
  const grid: Cell[][] = vertical ? data.map((v) => [v, null]) : [[...data, null]];
  const rngOf = (len: number) => (vertical ? `A1:A${len}` : `A1:${colName(len - 1)}1`);
  const formulaAt = (f: string): Cell[][] => {
    const g = grid.map((r) => [...r]);
    if (vertical) g[0][1] = f;
    else g[0][n] = f;
    return g;
  };
  const f = `=${fn}(${rngOf(take)})`;
  const g = formulaAt(f);
  const fc = vertical ? 1 : n;
  const v = numAt(g, fc, 0) as number;
  const altFor = (name: string, len: number) => numAt(formulaAt(`=${name}(${rngOf(len)})`), fc, 0);
  const cands: { v: number | undefined; why: L }[] = [];
  for (const other of ["СУММ", "МИН", "МАКС"] as const) {
    if (other === fn) continue;
    cands.push({
      v: altFor(other, take),
      why: { ru: `Это результат функции ${other}, а в формуле стоит ${fn}.`, kk: `Бұл ${other} функциясының нәтижесі, ал формулада ${fn} тұр.` },
    });
  }
  if (partial) {
    cands.push({
      v: altFor("СУММ", n),
      why: { ru: `Сложен весь ряд чисел, а диапазон ${rngOf(take)} короче: последнее число в него не входит.`, kk: `Сандардың бәрі қосылған, ал ${rngOf(take)} диапазоны қысқа: соңғы сан оған кірмейді.` },
    });
  }
  const wrongs = numWrongs(v, cands);
  const explanation: L = {
    ru: `В диапазоне ${rngOf(take)} числа: ${data.slice(0, take).join(", ")}. ${fn === "СУММ" ? "Складываем" : fn === "МИН" ? "Выбираем наименьшее" : "Выбираем наибольшее"}: ${v}.`,
    kk: `${rngOf(take)} диапазонында сандар: ${data.slice(0, take).join(", ")}. ${fn === "СУММ" ? "Қосамыз" : fn === "МИН" ? "Ең кішісін таңдаймыз" : "Ең үлкенін таңдаймыз"}: ${v}.`,
  };
  const prompt: L = {
    ru: `Чему равно значение в ячейке ${addr(fc, 0)}?`,
    kk: `${addr(fc, 0)} ұяшығындағы мән неге тең?`,
  };
  const scene = sheetScene(g, [[0, fc]]);
  const id = `g:${SKILL}:func:${idp(fn, take, vertical ? "v" : "h", data.join("."))}:${seed}`;
  if (rand() < 0.5) {
    return choice(rand, { id, level, prompt, scene, hint: HINT_FUNC, explanation, correct: String(v), wrongs });
  }
  return input(id, level, prompt, HINT_FUNC, explanation, v, scene);
};

/** СРЗНАЧ / СЧЁТ над диапазоном с текстом и пустой ячейкой (B). */
const genFuncText: Gen = (rand, level, seed) => {
  const fn = pick(rand, ["СРЗНАЧ", "СЧЁТ", "СРЗНАЧ"] as const);
  // Три числа с целым средним, один текст, одна пустая ячейка — в случайных местах столбца A.
  let nums: number[] = [];
  for (let t = 0; t < 50; t++) {
    const m = int(rand, 4, 14);
    const a = int(rand, 2, 20);
    const b = int(rand, 2, 20);
    const c = 3 * m - a - b;
    if (c >= 1 && c <= 25 && new Set([a, b, c]).size === 3) {
      nums = [a, b, c];
      break;
    }
  }
  if (!nums.length) nums = [6, 11, 10];
  const items: Cell[] = shuffle<Cell>([...nums, rand() < 0.5 ? "нет" : "да", null], rand);
  const grid: Cell[][] = items.map((v, i) => [v, i === 0 ? `=${fn}(A1:A5)` : null]);
  const sum = nums.reduce((a, b) => a + b, 0);
  const v = numAt(grid, 1, 0) as number;
  const wrongs =
    fn === "СРЗНАЧ"
      ? numWrongs(v, [
          { v: sum / 5, why: { ru: "Сумма разделена на 5 ячеек. СРЗНАЧ делит на количество чисел, а текст и пустая ячейка не в счёте.", kk: "Қосынды 5 ұяшыққа бөлінген. СРЗНАЧ сандар санына бөледі, ал мәтін мен бос ұяшық есепке кірмейді." } },
          { v: sum / 4, why: { ru: "Сумма разделена на 4 непустые ячейки, но текст — не число и тоже пропускается.", kk: "Қосынды 4 бос емес ұяшыққа бөлінген, бірақ мәтін сан емес, ол да өткізіліп кетеді." } },
          { v: sum, why: { ru: "Это сумма чисел: деление на их количество не выполнено.", kk: "Бұл сандардың қосындысы: олардың санына бөлу орындалмаған." } },
        ])
      : numWrongs(v, [
          { v: 5, why: { ru: "Посчитаны все ячейки диапазона, а СЧЁТ считает только числа.", kk: "Диапазонның барлық ұяшығы саналған, ал СЧЁТ тек сандарды санайды." } },
          { v: 4, why: { ru: "Посчитаны все непустые ячейки, включая текст; текст — не число.", kk: "Бос емес ұяшықтардың бәрі, соның ішінде мәтін де саналған; мәтін сан емес." } },
          { v: sum, why: { ru: "Это сумма чисел (СУММ), а СЧЁТ считает, сколько их.", kk: "Бұл сандардың қосындысы (СУММ), ал СЧЁТ олардың неше екенін санайды." } },
        ]);
  const prompt: L = { ru: "Чему равно значение в ячейке B1?", kk: "B1 ұяшығындағы мән неге тең?" };
  const explanation: L =
    fn === "СРЗНАЧ"
      ? {
          ru: `Текст и пустая ячейка пропускаются. Числа: ${nums.join(", ")}. Среднее: (${nums.join(" + ")}) / 3 = ${sum} / 3 = ${v}.`,
          kk: `Мәтін мен бос ұяшық өткізіліп кетеді. Сандар: ${nums.join(", ")}. Орташа мән: (${nums.join(" + ")}) / 3 = ${sum} / 3 = ${v}.`,
        }
      : {
          ru: `СЧЁТ считает только числа: ${nums.join(", ")} — всего ${v}. Текст и пустая ячейка не считаются.`,
          kk: `СЧЁТ тек сандарды санайды: ${nums.join(", ")} — барлығы ${v}. Мәтін мен бос ұяшық есепке кірмейді.`,
        };
  return choice(rand, {
    id: `g:${SKILL}:functext:${idp(fn, items.map((x) => (x === null ? "e" : x)).join("."))}:${seed}`,
    level,
    prompt,
    scene: sheetScene(grid, [[0, 1]]),
    hint: HINT_TEXTCELLS,
    explanation,
    correct: num(v),
    wrongs,
  });
};

// Слова пишутся одинаково по-русски и по-казахски (без Актау/Ақтау, Талдыкорган/Талдықорған и т. п.).
const WORDS = ["Астана", "Алматы", "Шымкент", "Атырау", "Тараз", "Семей", "Павлодар", "Кентау", "Информатика", "Excel"];

/** Текстовые функции: СТРОЧН / ПРОПИСН / ДЛСТР (B). */
const genTextFn: Gen = (rand, level, seed) => {
  const word = pick(rand, WORDS);
  const fn = pick(rand, ["СТРОЧН", "ПРОПИСН", "ДЛСТР"] as const);
  const grid: Cell[][] = [[word, `=${fn}(A1)`]];
  const val = (name: string) => valueAt([[word, `=${name}(A1)`]], 1, 0);
  const v = String(val(fn));
  const why = (other: string): L => ({
    ru: `Это результат функции ${other}, а в формуле стоит ${fn}.`,
    kk: `Бұл ${other} функциясының нәтижесі, ал формулада ${fn} тұр.`,
  });
  const cands: Opt[] = [];
  for (const other of ["СТРОЧН", "ПРОПИСН", "ДЛСТР"] as const) if (other !== fn) cands.push({ text: String(val(other)), why: why(other) });
  cands.push({ text: word, why: { ru: "Текст остался без изменений, а функция должна его обработать.", kk: "Мәтін өзгеріссіз қалған, ал функция оны өңдеуі керек." } });
  if (fn === "ДЛСТР") cands.push({ text: String(word.length + 1), why: { ru: "Ошибка на 1: пересчитай буквы.", kk: "1-ге қателесу: әріптерді қайта сана." } });
  return choice(rand, {
    id: `g:${SKILL}:textfn:${idp(fn, word)}:${seed}`,
    level,
    prompt: { ru: "Что отобразится в ячейке B1?", kk: "B1 ұяшығында не көрсетіледі?" },
    scene: sheetScene(grid, [[0, 1]]),
    hint: HINT_TEXTFN,
    explanation: {
      ru: `В A1 записано «${word}». ${fn === "СТРОЧН" ? "СТРОЧН делает все буквы строчными" : fn === "ПРОПИСН" ? "ПРОПИСН делает все буквы заглавными" : "ДЛСТР считает число символов"}: ${v}.`,
      kk: `A1 ұяшығында «${word}» жазылған. ${fn === "СТРОЧН" ? "СТРОЧН барлық әріпті кіші етеді" : fn === "ПРОПИСН" ? "ПРОПИСН барлық әріпті бас әріп етеді" : "ДЛСТР символдар санын есептейді"}: ${v}.`,
    },
    correct: v,
    wrongs: cands,
  });
};

/** Двоеточие и точка с запятой: =СУММ(A1;A4) (B). */
const genSep: Gen = (rand, level, seed) => {
  const data = Array.from({ length: 4 }, () => int(rand, 2, 20));
  const i = pick(rand, [1, 1, 2]);
  const j = pick(rand, i === 1 ? [3, 4] : [4]);
  const f = `=СУММ(A${i};A${j})`;
  const grid: Cell[][] = data.map((v, k) => [v, k === 0 ? f : null]);
  const v = numAt(grid, 1, 0) as number;
  const alt = (g: string) => numAt(data.map((x, k) => [x, k === 0 ? g : null]), 1, 0);
  const wrongs = numWrongs(v, [
    { v: alt("=СУММ(A1:A4)"), why: { ru: "Сложен весь диапазон A1:A4. Точка с запятой перечисляет отдельные ячейки, а «от и до» означает двоеточие.", kk: "A1:A4 диапазонының бәрі қосылған. Нүктелі үтір жеке ұяшықтарды тізеді, ал «бастап соңына дейін» дегенді қос нүкте білдіреді." } },
    { v: alt(`=СУММ(A${i}:A${j})`), why: { ru: `Это сумма диапазона A${i}:A${j} с двоеточием. В формуле же перечислены только две ячейки.`, kk: `Бұл қос нүктесі бар A${i}:A${j} диапазонының қосындысы. Ал формулада тек екі ұяшық аталған.` } },
    { v: alt(`=A${j}`), why: { ru: `Взята только ячейка A${j}, а в формуле названы обе ячейки.`, kk: `Тек A${j} ұяшығы алынған, ал формулада екі ұяшық та аталған.` } },
    { v: alt(`=A${i}`), why: { ru: `Взята только ячейка A${i}, а в формуле названы обе ячейки.`, kk: `Тек A${i} ұяшығы алынған, ал формулада екі ұяшық та аталған.` } },
  ]);
  return choice(rand, {
    id: `g:${SKILL}:sep:${idp(i, j, data.join("."))}:${seed}`,
    level,
    prompt: { ru: "Чему равно значение в ячейке B1?", kk: "B1 ұяшығындағы мән неге тең?" },
    scene: sheetScene(grid, [[0, 1]]),
    hint: HINT_SEP,
    explanation: {
      ru: `Точка с запятой перечисляет отдельные ячейки: складываются только A${i} и A${j}. ${data[i - 1]} + ${data[j - 1]} = ${v}.`,
      kk: `Нүктелі үтір жеке ұяшықтарды тізеді: тек A${i} және A${j} қосылады. ${data[i - 1]} + ${data[j - 1]} = ${v}.`,
    },
    correct: String(v),
    wrongs,
  });
};

/** Площадь пересечения двух прямоугольников. */
function overlap(a: [number, number, number, number], b: [number, number, number, number]): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + 1;
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + 1;
  return w > 0 && h > 0 ? w * h : 0;
}
const area = (r: [number, number, number, number]) => (r[2] - r[0] + 1) * (r[3] - r[1] + 1);

/** Сколько ячеек входит хотя бы в один из двух диапазонов (C). */
const genUnion: Gen = (rand, level, seed) => {
  for (let tries = 0; tries < 80; tries++) {
    const a: [number, number, number, number] = [0, 0, int(rand, 1, 3), int(rand, 1, 3)];
    const b0 = int(rand, 1, a[2]);
    const b1 = int(rand, 1, a[3]);
    const b: [number, number, number, number] = [b0, b1, b0 + int(rand, 1, 3), b1 + int(rand, 1, 3)];
    const inter = overlap(a, b);
    if (inter === 0) continue;
    const union = area(a) + area(b) - inter;
    const bound = (Math.max(a[2], b[2]) + 1) * (Math.max(a[3], b[3]) + 1);
    const wrongs = numWrongs(union, [
      { v: area(a) + area(b), why: { ru: "Общие ячейки двух диапазонов посчитаны дважды: их нужно учесть один раз.", kk: "Екі диапазонның ортақ ұяшықтары екі рет саналған: оларды бір-ақ рет есепке алу керек." } },
      { v: area(a) + area(b) - 2 * inter, why: { ru: "Общие ячейки вычтены дважды: из суммы их вычитают один раз.", kk: "Ортақ ұяшықтар екі рет алынып тасталған: оларды қосындыдан бір-ақ рет алып тастайды." } },
      { v: bound, why: { ru: "Это площадь большого прямоугольника, охватывающего оба диапазона, но часть его ячеек не входит ни в один из них.", kk: "Бұл екі диапазонды қамтитын үлкен тіктөртбұрыштың ауданы, бірақ оның кейбір ұяшығы екеуінің де құрамына кірмейді." } },
    ]);
    if (wrongs.length < 3) continue;
    const r1 = `${addr(a[0], a[1])}:${addr(a[2], a[3])}`;
    const r2 = `${addr(b[0], b[1])}:${addr(b[2], b[3])}`;
    return choice(rand, {
      id: `g:${SKILL}:union:${idp(r1, r2)}:${seed}`,
      level,
      prompt: {
        ru: `Сколько ячеек входит хотя бы в один из диапазонов ${r1} и ${r2}?`,
        kk: `${r1} және ${r2} диапазондарының кемінде біреуіне неше ұяшық кіреді?`,
      },
      hint: HINT_UNION,
      explanation: {
        ru: `${r1}: ${area(a)} ${ruPl(area(a), "ячейка", "ячейки", "ячеек")}, ${r2}: ${area(b)} ${ruPl(area(b), "ячейка", "ячейки", "ячеек")}. Общих ячеек: ${inter}. Всего: ${area(a)} + ${area(b)} − ${inter} = ${union}.`,
        kk: `${r1}: ${area(a)} ұяшық, ${r2}: ${area(b)} ұяшық. Ортақ ұяшықтар: ${inter}. Барлығы: ${area(a)} + ${area(b)} − ${inter} = ${union}.`,
      },
      correct: String(union),
      wrongs,
    });
  }
  throw new Error("sheets.formulas union: не удалось подобрать диапазоны");
};

/** Обратная задача: до какого столбца идёт диапазон с данным числом ячеек (C). */
const genRev: Gen = (rand, level, seed) => {
  const c1 = int(rand, 0, 2);
  const r1 = int(rand, 1, 3);
  const rows = int(rand, 2, 5);
  const cols = int(rand, 2, 5);
  const total = cols * rows;
  const end = colName(c1 + cols - 1);
  const w = (text: string, ru: string, kk: string): Opt => ({ text, why: { ru, kk } });
  return choice(rand, {
    id: `g:${SKILL}:rev:${idp(addr(c1, r1 - 1), rows, cols)}:${seed}`,
    level,
    prompt: {
      ru: `Диапазон ${addr(c1, r1 - 1)}:?${r1 + rows - 1} содержит ${total} ${ruPl(total, "ячейку", "ячейки", "ячеек")}. Какой буквой обозначен последний столбец диапазона?`,
      kk: `${addr(c1, r1 - 1)}:?${r1 + rows - 1} диапазонында ${total} ұяшық бар. Диапазонның соңғы бағаны қандай әріппен белгіленген?`,
    },
    hint: {
      ru: "Сначала найди число строк в диапазоне, затем раздели число ячеек на число строк — получишь число столбцов. Считай столбцы от первой буквы включительно.",
      kk: "Алдымен диапазондағы жол санын тап, содан кейін ұяшық санын жол санына бөл — баған санын аласың. Бағандарды бірінші әріптен қоса есепте.",
    },
    explanation: {
      ru: `Строки ${r1}–${r1 + rows - 1}: ${rows}. Столбцов ${total} / ${rows} = ${cols}. Считаем от ${colName(c1)}: ${Array.from({ length: cols }, (_, k) => colName(c1 + k)).join(", ")}. Последний — ${end}.`,
      kk: `${r1}–${r1 + rows - 1} жолдары: ${rows}. Баған саны ${total} / ${rows} = ${cols}. ${colName(c1)} әрпінен бастап санаймыз: ${Array.from({ length: cols }, (_, k) => colName(c1 + k)).join(", ")}. Соңғысы — ${end}.`,
    },
    correct: end,
    wrongs: [
      w(colName(c1 + cols), "Столбец за последним: первый столбец тоже входит в диапазон, поэтому счёт идёт включительно.", "Соңғыдан кейінгі баған: бірінші баған да диапазонға кіреді, сондықтан санақ қоса жүргізіледі."),
      w(colName(c1 + cols - 2), "Столбец перед последним: первый столбец не посчитан.", "Соңғыдан бұрынғы баған: бірінші баған санақта ескерілмеген."),
      w(colName(cols - 1), "Столбцы посчитаны от A, а диапазон начинается с другой буквы.", "Бағандар A әрпінен саналған, ал диапазон басқа әріптен басталады."),
      w(colName(c1 + Math.max(1, rows - 1)), "Использовано число строк вместо числа столбцов.", "Баған санының орнына жол саны пайдаланылған."),
      w(colName(c1 + cols + 1), "Столбец слишком далеко: проверь деление числа ячеек на число строк.", "Баған тым алыс: ұяшық санын жол санына бөлуді тексер."),
      w(colName(c1 + cols - 3), "Столбец слишком близко: пересчитай столбцы от первой буквы включительно.", "Баған тым жақын: бағандарды бірінші әріптен қоса қайта сана."),
    ].filter((o) => o.text !== end && /^[A-Z]$/.test(o.text)),
  });
};

/** Цепочка формул, ссылающихся на формулы (C). */
const genChain: Gen = (rand, level, seed) => {
  const t = int(rand, 0, 3);
  let grid: Cell[][];
  let target: [number, number];
  if (t === 0) {
    const a = int(rand, 2, 9);
    const b = int(rand, 2, 6);
    grid = [
      [a, b],
      ["=A1+B1", "=A2*B1-A1"],
    ];
    target = [1, 1];
  } else if (t === 1) {
    const vals = shuffle(Array.from({ length: 20 }, (_, k) => k + 1), rand).slice(0, 3);
    grid = [vals as Cell[], ["=МАКС(A1:C1)", "=МИН(A1:C1)", "=A2-B2"]];
    target = [2, 1];
  } else if (t === 2) {
    const a = int(rand, 2, 9);
    grid = [[a], ["=A1*2"], ["=A2*2"], ["=СУММ(A1:A3)"]];
    target = [0, 3];
  } else {
    const a = int(rand, 2, 8);
    const b = int(rand, 2, 8);
    const c = int(rand, 2, 6);
    grid = [[a, b, c, "=A1+B1", "=D1*C1-B1"]];
    target = [4, 0];
  }
  const v = numAt(grid, target[0], target[1]) as number;
  const lines = grid
    .flatMap((row, r) => row.map((cell, c) => ({ cell, c, r })))
    .filter((x) => typeof x.cell === "string" && x.cell.startsWith("="))
    .map((x) => `${addr(x.c, x.r)}: ${x.cell} → ${num(numAt(grid, x.c, x.r) as number)}`);
  return input(
    `g:${SKILL}:chain:${idp(t, grid.flat().join("."))}:${seed}`,
    level,
    { ru: `Чему равно значение в ячейке ${addr(target[0], target[1])}?`, kk: `${addr(target[0], target[1])} ұяшығындағы мән неге тең?` },
    HINT_CHAIN,
    {
      ru: `Считаем по порядку. ${lines.join("; ")}. Ответ: ${v}.`,
      kk: `Ретімен есептейміз. ${lines.join("; ")}. Жауабы: ${v}.`,
    },
    v,
    sheetScene(grid, [[target[1], target[0]]]),
  );
};

/** Функции в одной формуле, текст и пустые ячейки в диапазоне (C). */
const genCombo: Gen = (rand, level, seed) => {
  const t = int(rand, 0, 2);
  let grid: Cell[][];
  let fcol = 3;
  if (t === 0) {
    grid = numbers(rand, 2, 3, 1, 20);
    grid[0].push("=МАКС(A1:C2)-МИН(A1:C2)");
  } else if (t === 1) {
    grid = numbers(rand, 2, 3, 1, 9);
    grid[0].push("=СУММ(A1:C1)*МИН(A2:C2)");
  } else {
    // Четыре числа с целым средним, один текст и одна пустая ячейка.
    let ns: number[] = [];
    for (let k = 0; k < 60; k++) {
      const m = int(rand, 3, 9);
      const a = int(rand, 1, 12);
      const b = int(rand, 1, 12);
      const c = int(rand, 1, 12);
      const d = 4 * m - a - b - c;
      if (d >= 1 && d <= 14) {
        ns = [a, b, c, d];
        break;
      }
    }
    if (!ns.length) ns = [2, 4, 6, 8];
    const six = shuffle<Cell>([...ns, "нет", null], rand);
    grid = [six.slice(0, 3), six.slice(3, 6)];
    grid[0].push("=СУММ(A1:C2)/СЧЁТ(A1:C2)");
  }
  fcol = 3;
  const v = numAt(grid, fcol, 0);
  if (v === undefined || !Number.isInteger(v)) return genCombo(rand, level, seed + 1);
  const f = grid[0][fcol] as string;
  const explain =
    t === 0
      ? { ru: "Наибольшее число диапазона минус наименьшее.", kk: "Диапазондағы ең үлкен сан минус ең кіші сан." }
      : t === 1
        ? { ru: "Сумма первой строки умножается на наименьшее число второй строки.", kk: "Бірінші жолдың қосындысы екінші жолдағы ең кіші санға көбейтіледі." }
        : { ru: "СУММ складывает числа, СЧЁТ считает только числа: текст и пустая ячейка пропускаются.", kk: "СУММ сандарды қосады, СЧЁТ тек сандарды санайды: мәтін мен бос ұяшық өткізіліп кетеді." };
  return input(
    `g:${SKILL}:combo:${idp(t, grid.flat().map((x) => (x === null ? "e" : x)).join("."))}:${seed}`,
    level,
    { ru: "Чему равно значение в ячейке D1?", kk: "D1 ұяшығындағы мән неге тең?" },
    t === 2 ? HINT_TEXTCELLS : HINT_FUNC,
    {
      ru: `Формула ${f}. ${explain.ru} Результат: ${v}.`,
      kk: `Формула ${f}. ${explain.kk} Нәтиже: ${v}.`,
    },
    v,
    sheetScene(grid, [[0, 3]]),
  );
};

/** Длина текста с пробелом (C). */
const genLenSpace: Gen = (rand, level, seed) => {
  const w1 = pick(rand, WORDS);
  const w2 = pick(
    rand,
    WORDS.filter((w) => w !== w1),
  );
  const text = `${w1} ${w2}`;
  const grid: Cell[][] = [[text, "=ДЛСТР(A1)"]];
  const v = numAt(grid, 1, 0) as number;
  return choice(rand, {
    id: `g:${SKILL}:lenspace:${idp(w1, w2)}:${seed}`,
    level,
    prompt: { ru: "Чему равно значение в ячейке B1?", kk: "B1 ұяшығындағы мән неге тең?" },
    scene: sheetScene(grid, [[0, 1]]),
    hint: {
      ru: "ДЛСТР считает все символы текста. Пробел между словами — тоже символ.",
      kk: "ДЛСТР мәтіндегі барлық символды санайды. Сөздердің арасындағы бос орын да символ.",
    },
    explanation: {
      ru: `В тексте «${text}»: ${w1.length} + ${w2.length} букв и один пробел. ${w1.length} + 1 + ${w2.length} = ${v}.`,
      kk: `«${text}» мәтінінде: ${w1.length} + ${w2.length} әріп және бір бос орын. ${w1.length} + 1 + ${w2.length} = ${v}.`,
    },
    correct: String(v),
    wrongs: [
      { text: String(v - 1), why: { ru: "Пробел не посчитан, а он тоже символ.", kk: "Бос орын саналмаған, ал ол да символ." } },
      { text: String(v + 1), why: { ru: "Ошибка на 1: пересчитай символы.", kk: "1-ге қателесу: символдарды қайта сана." } },
      { text: "2", why: { ru: "Это число слов, а ДЛСТР считает символы.", kk: "Бұл сөздер саны, ал ДЛСТР символдарды санайды." } },
      { text: String(v + 2), why: { ru: "Лишние символы: пробел только один.", kk: "Артық символдар: бос орын тек біреу." } },
    ],
  });
};

const GEN: Record<string, Gen> = {
  addr: genAddr,
  count: genCount,
  calc: genCalc,
  func: genFuncBasic,
  functext: genFuncText,
  textfn: genTextFn,
  sep: genSep,
  union: genUnion,
  rev: genRev,
  chain: genChain,
  combo: genCombo,
  lenspace: genLenSpace,
};

const KINDS: Record<Level, readonly string[]> = {
  1: ["addr", "count", "calc", "func", "calc", "func"],
  2: ["count", "calc", "calc", "functext", "textfn", "sep"],
  3: ["union", "rev", "chain", "combo", "lenspace", "chain", "combo"],
};

// ---------- Статичный пул: диаграммы, ошибки, смысл функций ----------

function mc(id: string, level: Level, prompt: L, correct: Text, wrongs: [Text, L][], explanation: L, hint: L): ChoiceStep {
  return {
    id,
    type: "choice",
    skill: SKILL,
    level,
    prompt,
    hint,
    options: [correct, ...wrongs.map((w) => w[0])],
    correct: 0,
    whyWrong: [null, ...wrongs.map((w) => w[1])],
    explanation,
  };
}

const CIRCLE: Text = { ru: "Круговая диаграмма", kk: "Дөңгелек диаграмма" };
const COLUMNS: Text = { ru: "Столбчатая диаграмма", kk: "Бағанды диаграмма" };
const LINE: Text = { ru: "График", kk: "График" };

const whyCircle: L = { ru: "Круг показывает доли целого, а не изменение значения во времени.", kk: "Дөңгелек бүтіннің үлестерін көрсетеді, ал мәннің уақыт бойынша өзгеруін көрсетпейді." };
const whyColumns: L = { ru: "Столбцы удобны для сравнения значений разных объектов, а не для показа изменения во времени.", kk: "Бағандар түрлі нысандардың мәндерін салыстыруға ыңғайлы, ал уақыт бойынша өзгерісті көрсетуге емес." };
const whyLine: L = { ru: "График показывает, как величина меняется во времени, а не доли целого.", kk: "График шаманың уақыт бойынша өзгеруін көрсетеді, ал бүтіннің үлестерін емес." };
const whyLine2: L = { ru: "График показывает изменение во времени, а здесь нужно сравнить разные объекты.", kk: "График уақыт бойынша өзгерісті көрсетеді, ал мұнда түрлі нысандарды салыстыру керек." };
const whyCircle2: L = { ru: "Круговая диаграмма показывает доли одного целого, а здесь нужно сравнить разные объекты.", kk: "Дөңгелек диаграмма бір бүтіннің үлестерін көрсетеді, ал мұнда түрлі нысандарды салыстыру керек." };
const hintChart: L = {
  ru: "Спроси себя: нужно показать доли целого, сравнить значения или показать изменение во времени?",
  kk: "Өзіңе сұрақ қой: бүтіннің үлестерін көрсету керек пе, мәндерді салыстыру керек пе, әлде уақыт бойынша өзгерісті көрсету керек пе?",
};

const POOL_Q: QuestionStep[] = [
  // A
  mc("pq:sheets.formulas:chart-share", 1,
    { ru: "Какую диаграмму выбрать, чтобы показать, какую долю бюджета класса занимает каждая статья расходов?", kk: "Сынып бюджетінің әр шығыс бабы қандай үлесті құрайтынын көрсету үшін қандай диаграмманы таңдау керек?" },
    CIRCLE, [[COLUMNS, { ru: "Столбцы сравнивают суммы, а доли целого нагляднее видны на круге.", kk: "Бағандар сомаларды салыстырады, ал бүтіннің үлестері дөңгелекте анығырақ көрінеді." }], [LINE, whyLine]],
    { ru: "Нужно показать доли одного целого (бюджета) — для этого подходит круговая диаграмма.", kk: "Бір бүтіннің (бюджеттің) үлестерін көрсету керек — ол үшін дөңгелек диаграмма сәйкес келеді." }, hintChart),
  mc("pq:sheets.formulas:chart-time", 1,
    { ru: "Какую диаграмму выбрать, чтобы показать, как менялась температура воздуха по дням недели?", kk: "Апта күндері бойынша ауа температурасының қалай өзгергенін көрсету үшін қандай диаграмманы таңдау керек?" },
    LINE, [[CIRCLE, whyCircle], [COLUMNS, whyColumns]],
    { ru: "Нужно показать изменение величины во времени — это работа графика.", kk: "Шаманың уақыт бойынша өзгеруін көрсету керек — бұл графиктің міндеті." }, hintChart),
  mc("pq:sheets.formulas:chart-compare", 1,
    { ru: "Какую диаграмму выбрать, чтобы сравнить рост пяти учеников?", kk: "Бес оқушының бойын салыстыру үшін қандай диаграмманы таңдау керек?" },
    COLUMNS, [[CIRCLE, whyCircle2], [LINE, whyLine2]],
    { ru: "Нужно сравнить значения разных объектов (учеников) — подходит столбчатая диаграмма.", kk: "Түрлі нысандардың (оқушылардың) мәндерін салыстыру керек — бағанды диаграмма сәйкес келеді." }, hintChart),
  mc("pq:sheets.formulas:formula-which", 1,
    { ru: "Какая запись в ячейке будет воспринята как формула?", kk: "Ұяшықтағы қай жазба формула болып саналады?" },
    "=A1+B1", [["A1+B1", { ru: "Без знака = запись считается обычным текстом.", kk: "= белгісінсіз жазба қарапайым мәтін болып саналады." }], ["(A1+B1)", { ru: "Скобки формулу не создают: без знака = это просто текст.", kk: "Жақша формула жасамайды: = белгісінсіз бұл жай мәтін." }], ["A1+B1=", { ru: "Знак = стоит не в начале: это текст.", kk: "= белгісі басында емес: бұл мәтін." }]],
    { ru: "Формула всегда начинается со знака =.", kk: "Формула әрқашан = белгісінен басталады." },
    { ru: "С какого знака начинается формула?", kk: "Формула қандай белгіден басталады?" }),
  mc("pq:sheets.formulas:upper", 1,
    { ru: "Что отобразится в ячейке после ввода формулы =ПРОПИСН(\"Тараз\")?", kk: "=ПРОПИСН(\"Тараз\") формуласын енгізгеннен кейін ұяшықта не көрсетіледі?" },
    "ТАРАЗ", [["тараз", { ru: "Это результат СТРОЧН (все буквы строчные), а ПРОПИСН делает буквы заглавными.", kk: "Бұл СТРОЧН нәтижесі (барлық әріп кіші), ал ПРОПИСН әріптерді бас әріп етеді." }], ["Тараз", { ru: "Текст не изменился, а ПРОПИСН делает заглавными все буквы.", kk: "Мәтін өзгермеген, ал ПРОПИСН барлық әріпті бас әріп етеді." }], ["5", { ru: "Это число символов (ДЛСТР), а не результат ПРОПИСН.", kk: "Бұл символдар саны (ДЛСТР), ал ПРОПИСН нәтижесі емес." }]],
    { ru: "ПРОПИСН превращает все буквы в заглавные: Тараз → ТАРАЗ.", kk: "ПРОПИСН барлық әріпті бас әріпке айналдырады: Тараз → ТАРАЗ." }, HINT_TEXTFN),
  // B
  mc("pq:sheets.formulas:chart-time2", 2,
    { ru: "Метеостанция записывает температуру каждый час. Какая диаграмма лучше всего покажет, как температура менялась за сутки?", kk: "Метеостанция температураны әр сағат сайын жазады. Тәулік ішінде температураның қалай өзгергенін қандай диаграмма жақсы көрсетеді?" },
    LINE, [[CIRCLE, whyCircle], [COLUMNS, { ru: "Столбцы подойдут для сравнения, но линия графика лучше показывает ход изменения во времени.", kk: "Бағандар салыстыруға жарайды, бірақ график сызығы уақыт бойынша өзгеру барысын жақсырақ көрсетеді." }]],
    { ru: "Измерения идут во времени, нужна динамика — график.", kk: "Өлшеулер уақыт бойынша жүргізіледі, динамика керек — график." }, hintChart),
  mc("pq:sheets.formulas:chart-share2", 2,
    { ru: "В опросе участвовали все ученики класса (100%). Какая диаграмма наиболее наглядно покажет, какую часть класса составляют любители каждого вида спорта?", kk: "Сауалнамаға сыныптың барлық оқушысы (100%) қатысты. Әр спорт түрін сүйетіндер сыныптың қандай бөлігін құрайтынын қандай диаграмма анығырақ көрсетеді?" },
    CIRCLE, [[LINE, whyLine], [COLUMNS, { ru: "Столбцы покажут числа, но «часть от целого» нагляднее на круге.", kk: "Бағандар сандарды көрсетеді, ал «бүтіннің бөлігі» дөңгелекте анығырақ." }]],
    { ru: "Все ученики — это целое, виды спорта — его части: круговая диаграмма.", kk: "Барлық оқушы — бүтін, спорт түрлері — оның бөліктері: дөңгелек диаграмма." }, hintChart),
  mc("pq:sheets.formulas:chart-compare2", 2,
    { ru: "Нужно сравнить количество медалей, завоёванных пятью школами. Какую диаграмму выбрать?", kk: "Бес мектеп жеңіп алған медаль санын салыстыру керек. Қандай диаграмманы таңдау керек?" },
    COLUMNS, [[LINE, whyLine2], [CIRCLE, whyCircle2]],
    { ru: "Сравниваются значения разных объектов — столбчатая диаграмма.", kk: "Түрлі нысандардың мәндері салыстырылады — бағанды диаграмма." }, hintChart),
  mc("pq:sheets.formulas:semicolon-vs-colon", 2,
    { ru: "Чем отличается =СУММ(A1:A3) от =СУММ(A1;A3)?", kk: "=СУММ(A1:A3) формуласы =СУММ(A1;A3) формуласынан немен ерекшеленеді?" },
    { ru: "Первая складывает A1, A2 и A3, вторая — только A1 и A3", kk: "Біріншісі A1, A2 және A3 ұяшықтарын қосады, екіншісі — тек A1 және A3" },
    [
      [{ ru: "Ничем, результат всегда одинаков", kk: "Ештеңемен, нәтиже әрқашан бірдей" }, { ru: "Результат разный: двоеточие берёт весь диапазон, точка с запятой — только названные ячейки.", kk: "Нәтиже әртүрлі: қос нүкте бүкіл диапазонды алады, нүктелі үтір — тек аталған ұяшықтарды." }],
      [{ ru: "Первая складывает только A1 и A3, вторая — A1, A2 и A3", kk: "Біріншісі тек A1 және A3 ұяшықтарын қосады, екіншісі — A1, A2 және A3" }, { ru: "Наоборот: двоеточие — «от и до», точка с запятой — перечисление.", kk: "Керісінше: қос нүкте — «бастап соңына дейін», нүктелі үтір — тізу." }],
      [{ ru: "Вторая формула неверна и даст ошибку", kk: "Екінші формула қате жазылған, ұяшықта қате туралы хабарлама шығады" }, { ru: "Обе формулы верны, просто считают разные ячейки.", kk: "Екі формула да дұрыс, тек әртүрлі ұяшықтарды есептейді." }],
    ],
    { ru: "Двоеточие в A1:A3 означает весь диапазон (A1, A2, A3), а точка с запятой в A1;A3 — только две отдельные ячейки.", kk: "A1:A3 жазбасындағы қос нүкте бүкіл диапазонды (A1, A2, A3) білдіреді, ал A1;A3 жазбасындағы нүктелі үтір — тек екі жеке ұяшықты." },
    HINT_SEP),
  mc("pq:sheets.formulas:err-div0", 2,
    { ru: "Какое сообщение появится в ячейке после ввода формулы =10/0?", kk: "=10/0 формуласын енгізгеннен кейін ұяшықта қандай хабарлама пайда болады?" },
    "#ДЕЛ/0!", [["#ЗНАЧ!", { ru: "#ЗНАЧ! появляется, когда в арифметике участвует текст, а здесь делитель — число 0.", kk: "#ЗНАЧ! арифметикада мәтін қатысқанда шығады, ал мұнда бөлгіш — 0 саны." }], ["0", { ru: "Таблица не считает деление на ноль равным нулю — она сообщает об ошибке.", kk: "Кесте нөлге бөлуді нөлге тең деп есептемейді — қате туралы хабарлайды." }], ["#ИМЯ?", { ru: "#ИМЯ? говорит о неизвестном имени функции, а здесь функции нет.", kk: "#ИМЯ? функцияның белгісіз аты туралы айтады, ал мұнда функция жоқ." }]],
    { ru: "На ноль делить нельзя, поэтому таблица показывает ошибку #ДЕЛ/0!.", kk: "Нөлге бөлуге болмайды, сондықтан кесте #ДЕЛ/0! қатесін көрсетеді." },
    { ru: "Какое действие запрещено в математике, если делитель равен нулю?", kk: "Бөлгіш нөлге тең болғанда математикада қандай амалға тыйым салынады?" }),
  mc("pq:sheets.formulas:err-text", 2,
    { ru: "В A1 записан текст «нет», в B1 — число 5. Что покажет ячейка C1 с формулой =A1+B1?", kk: "A1 ұяшығында «жоқ» мәтіні, B1 ұяшығында 5 саны жазылған. =A1+B1 формуласы бар C1 ұяшығында не көрсетіледі?" },
    "#ЗНАЧ!", [["5", { ru: "Текст не превращается в ноль при сложении плюсом — такая формула даёт ошибку.", kk: "Мәтін қосқанда нөлге айналмайды — мұндай формула қате береді." }], ["#ДЕЛ/0!", { ru: "Деления в формуле нет, а ошибка вызвана текстом вместо числа.", kk: "Формулада бөлу жоқ, ал қате санның орнындағы мәтіннен шығады." }], ["0", { ru: "Таблица не считает текст нулём: она сообщает об ошибке.", kk: "Кесте мәтінді нөл деп есептемейді: қате туралы хабарлайды." }]],
    { ru: "Сложение со знаком + требует чисел. Текст в одной из ячеек даёт ошибку #ЗНАЧ!.", kk: "+ белгісімен қосу сандарды талап етеді. Ұяшықтардың бірінде мәтін болса, #ЗНАЧ! қатесі шығады." },
    { ru: "Можно ли складывать плюсом число и слово?", kk: "Санды сөзбен плюс арқылы қосуға бола ма?" }),
  mc("pq:sheets.formulas:which-count", 2,
    { ru: "В диапазоне есть числа, текст и пустые ячейки. Какая функция посчитает, сколько в нём чисел?", kk: "Диапазонда сандар, мәтін және бос ұяшықтар бар. Қай функция онда неше сан барын есептейді?" },
    "СЧЁТ (COUNT)", [["СУММ (SUM)", { ru: "СУММ складывает числа, а не считает, сколько их.", kk: "СУММ сандарды қосады, ал олардың неше екенін санамайды." }], ["ДЛСТР (LEN)", { ru: "ДЛСТР считает символы текста, а не числа в диапазоне.", kk: "ДЛСТР мәтіннің символдарын санайды, ал диапазондағы сандарды емес." }], ["СРЗНАЧ (AVERAGE)", { ru: "СРЗНАЧ находит среднее арифметическое, а не количество.", kk: "СРЗНАЧ орташа арифметикалықты табады, ал санын емес." }]],
    { ru: "Количество чисел считает функция СЧЁТ; текст и пустые ячейки она пропускает.", kk: "Сандардың санын СЧЁТ функциясы есептейді; мәтін мен бос ұяшықтарды ол өткізіп жібереді." },
    { ru: "Какая функция отвечает на вопрос «сколько?»", kk: "Қай функция «неше?» деген сұраққа жауап береді?" }),
  // C
  mc("pq:sheets.formulas:chart-bad", 3,
    { ru: "Какая диаграмма хуже всего подходит, чтобы показать изменение курса валюты по дням за месяц?", kk: "Айдағы күндер бойынша валюта бағамының өзгеруін көрсету үшін қай диаграмма ең нашар сәйкес келеді?" },
    CIRCLE, [[LINE, { ru: "График как раз подходит для изменения во времени.", kk: "График уақыт бойынша өзгеріске дәл сәйкес келеді." }], [COLUMNS, { ru: "Столбцы тоже можно использовать для значений по дням, это допустимый вариант.", kk: "Бағандарды күндер бойынша мәндер үшін де қолдануға болады, бұл жарамды нұсқа." }]],
    { ru: "Курс по дням — это динамика. Круг показывает доли целого и для динамики не подходит.", kk: "Күндер бойынша бағам — бұл динамика. Дөңгелек бүтіннің үлестерін көрсетеді, динамикаға жарамайды." }, hintChart),
  mc("pq:sheets.formulas:empty-zero", 3,
    { ru: "В A1 записано число 7, ячейка B1 пуста. Что покажет ячейка C1 с формулой =A1/B1?", kk: "A1 ұяшығында 7 саны жазылған, B1 ұяшығы бос. =A1/B1 формуласы бар C1 ұяшығында не көрсетіледі?" },
    "#ДЕЛ/0!", [["0", { ru: "Пустая ячейка действительно считается нулём, но деление на ноль не даёт 0 — таблица сообщает об ошибке.", kk: "Бос ұяшық шынымен нөл деп саналады, бірақ нөлге бөлу 0 бермейді — кесте қате туралы хабарлайды." }], ["7", { ru: "Деление на пустую ячейку не оставляет число без изменений.", kk: "Бос ұяшыққа бөлу санды өзгеріссіз қалдырмайды." }], ["#ЗНАЧ!", { ru: "Пустая ячейка — это не текст: в арифметике она считается нулём.", kk: "Бос ұяшық мәтін емес: арифметикада ол нөл деп саналады." }]],
    { ru: "Пустая ячейка в арифметике — ноль, а на ноль делить нельзя: #ДЕЛ/0!.", kk: "Арифметикада бос ұяшық — нөл, ал нөлге бөлуге болмайды: #ДЕЛ/0!." },
    { ru: "Чему равна пустая ячейка, когда её используют в делении?", kk: "Бөлуде қолданылғанда бос ұяшық неге тең?" }),
  mc("pq:sheets.formulas:len-spaces", 3,
    { ru: "Что покажет ячейка с формулой =ДЛСТР(\"Алматы Тараз\")?", kk: "=ДЛСТР(\"Алматы Тараз\") формуласы бар ұяшықта не көрсетіледі?" },
    "12", [["11", { ru: "Пробел между словами не посчитан, а он тоже символ.", kk: "Сөздердің арасындағы бос орын саналмаған, ал ол да символ." }], ["2", { ru: "Это число слов, а ДЛСТР считает символы.", kk: "Бұл сөздер саны, ал ДЛСТР символдарды санайды." }], ["13", { ru: "Ошибка на 1: в тексте один пробел, а не два.", kk: "1-ге қателесу: мәтінде екі емес, бір бос орын бар." }]],
    { ru: "Алматы — 6 букв, Тараз — 5 букв и один пробел: 6 + 1 + 5 = 12.", kk: "Алматы — 6 әріп, Тараз — 5 әріп және бір бос орын: 6 + 1 + 5 = 12." },
    { ru: "ДЛСТР считает все символы, а не только буквы.", kk: "ДЛСТР тек әріптерді емес, барлық символды санайды." }),
  mc("pq:sheets.formulas:mixed-count", 3,
    { ru: "В диапазоне A1:A6 записаны: 4, текст, 8, пусто, 9, текст. Чему равно =СУММ(A1:A6)/СЧЁТ(A1:A6)?", kk: "A1:A6 диапазонында: 4, мәтін, 8, бос, 9, мәтін жазылған. =СУММ(A1:A6)/СЧЁТ(A1:A6) неге тең?" },
    "7", [["21", { ru: "Это сумма 4 + 8 + 9: деление на количество чисел не выполнено.", kk: "Бұл 4 + 8 + 9 қосындысы: сандардың санына бөлу орындалмаған." }], ["3,5", { ru: "Сумма разделена на 6 ячеек, а СЧЁТ считает только числа — их 3.", kk: "Қосынды 6 ұяшыққа бөлінген, ал СЧЁТ тек сандарды санайды — олар 3." }], ["4,2", { ru: "Сумма разделена на 5 непустых ячеек, но две из них с текстом: СЧЁТ считает только числа — их 3.", kk: "Қосынды 5 бос емес ұяшыққа бөлінген, бірақ оның екеуінде мәтін бар: СЧЁТ тек сандарды санайды — олар 3." }]],
    { ru: "Сумма чисел: 4 + 8 + 9 = 21. Чисел 3 (текст и пустая ячейка не в счёте). 21 / 3 = 7.", kk: "Сандардың қосындысы: 4 + 8 + 9 = 21. Сандар 3 (мәтін мен бос ұяшық есепке кірмейді). 21 / 3 = 7." },
    HINT_TEXTCELLS),
];

const STATEMENTS: Statement[] = [
  { id: "st:sheets.formulas:eq", skill: SKILL, level: 1, text: { ru: "Формула в электронной таблице начинается со знака «=»", kk: "Электрондық кестедегі формула «=» белгісінен басталады" }, value: true, explanation: { ru: "Знак = показывает таблице, что дальше идёт формула, а не обычный текст.", kk: "= белгісі кестеге әрі қарай формула тұрғанын, қарапайым мәтін емес екенін көрсетеді." }, hint: { ru: "С чего таблица понимает, что в ячейке формула?", kk: "Ұяшықта формула тұрғанын кесте несінен түсінеді?" } },
  { id: "st:sheets.formulas:addr-order", skill: SKILL, level: 1, text: { ru: "Адрес ячейки записывают так: сначала номер строки, потом буква столбца (например, 3B)", kk: "Ұяшықтың мекенжайы былай жазылады: алдымен жол нөмірі, содан кейін баған әрпі (мысалы, 3B)" }, value: false, explanation: { ru: "Сначала буква столбца, потом номер строки: B3.", kk: "Алдымен баған әрпі, содан кейін жол нөмірі: B3." }, hint: { ru: "Вспомни морской бой: буква, потом цифра.", kk: "Теңіз шайқасын еске түсір: алдымен әріп, содан кейін сан." } },
  { id: "st:sheets.formulas:sum-range", skill: SKILL, level: 1, text: { ru: "=СУММ(A1:A3) складывает три ячейки: A1, A2 и A3", kk: "=СУММ(A1:A3) үш ұяшықты қосады: A1, A2 және A3" }, value: true, explanation: { ru: "Двоеточие означает весь диапазон от A1 до A3 — это три ячейки.", kk: "Қос нүкте A1-ден A3-ке дейінгі бүкіл диапазонды білдіреді — бұл үш ұяшық." }, hint: { ru: "Что означает двоеточие между адресами?", kk: "Мекенжайлардың арасындағы қос нүкте нені білдіреді?" } },
  { id: "st:sheets.formulas:semicolon", skill: SKILL, level: 2, text: { ru: "=СУММ(A1;A3) складывает все ячейки от A1 до A3", kk: "=СУММ(A1;A3) A1-ден A3-ке дейінгі барлық ұяшықты қосады" }, value: false, explanation: { ru: "Точка с запятой перечисляет отдельные ячейки: складываются только A1 и A3. «От и до» — это двоеточие.", kk: "Нүктелі үтір жеке ұяшықтарды тізеді: тек A1 және A3 қосылады. «Бастап соңына дейін» — бұл қос нүкте." }, hint: { ru: "Чем двоеточие отличается от точки с запятой в аргументах функции?", kk: "Функция аргументтерінде қос нүкте нүктелі үтірден немен ерекшеленеді?" } },
  { id: "st:sheets.formulas:count-text", skill: SKILL, level: 2, text: { ru: "Функция СЧЁТ считает все непустые ячейки диапазона, в том числе с текстом", kk: "СЧЁТ функциясы диапазонның бос емес барлық ұяшығын, соның ішінде мәтіні барларын да санайды" }, value: false, explanation: { ru: "СЧЁТ считает только ячейки с числами: текст и пустые ячейки она пропускает.", kk: "СЧЁТ тек сандары бар ұяшықтарды санайды: мәтін мен бос ұяшықтарды ол өткізіп жібереді." }, hint: { ru: "Какие значения считает функция СЧЁТ?", kk: "СЧЁТ функциясы қандай мәндерді санайды?" } },
  { id: "st:sheets.formulas:lower", skill: SKILL, level: 1, text: { ru: "Функция СТРОЧН превращает все буквы текста в строчные", kk: "СТРОЧН функциясы мәтіннің барлық әрпін кіші әріпке айналдырады" }, value: true, explanation: { ru: "СТРОЧН — это LOWER: «Алматы» превращается в «алматы».", kk: "СТРОЧН — бұл LOWER: «Алматы» «алматы» болып өзгереді." }, hint: { ru: "Подумай, как переводится английское LOWER.", kk: "Ағылшын LOWER сөзі қалай аударылатынын ойлан." } },
  { id: "st:sheets.formulas:chart-time", skill: SKILL, level: 1, text: { ru: "Изменение температуры по дням лучше всего показывает график", kk: "Күндер бойынша температураның өзгеруін график жақсы көрсетеді" }, value: true, explanation: { ru: "Для изменения величины во времени используют график.", kk: "Шаманың уақыт бойынша өзгеруі үшін график қолданылады." }, hint: { ru: "Какая диаграмма показывает «как менялось»?", kk: "Қай диаграмма «қалай өзгерді» дегенді көрсетеді?" } },
  { id: "st:sheets.formulas:chart-circle", skill: SKILL, level: 2, text: { ru: "Круговая диаграмма подходит, чтобы показать изменение температуры по дням", kk: "Күндер бойынша температураның өзгеруін көрсету үшін дөңгелек диаграмма жарайды" }, value: false, explanation: { ru: "Круговая диаграмма показывает доли целого, а изменение во времени показывает график.", kk: "Дөңгелек диаграмма бүтіннің үлестерін көрсетеді, ал уақыт бойынша өзгерісті график көрсетеді." }, hint: { ru: "Что показывает круг: доли или изменение?", kk: "Дөңгелек нені көрсетеді: үлестерді ме, өзгерісті ме?" } },
  { id: "st:sheets.formulas:div0", skill: SKILL, level: 2, text: { ru: "Ошибка #ДЕЛ/0! появляется при делении на ноль", kk: "#ДЕЛ/0! қатесі нөлге бөлгенде шығады" }, value: true, explanation: { ru: "На ноль делить нельзя — таблица сообщает об ошибке #ДЕЛ/0!. Пустая ячейка в делителе тоже считается нулём.", kk: "Нөлге бөлуге болмайды — кесте #ДЕЛ/0! қатесі туралы хабарлайды. Бөлгіштегі бос ұяшық та нөл деп саналады." }, hint: { ru: "Расшифруй название ошибки: ДЕЛ — деление.", kk: "Қатенің атын шеш: ДЕЛ — бөлу." } },
  { id: "st:sheets.formulas:prio", skill: SKILL, level: 2, text: { ru: "В формуле =A1+B1*C1 сначала выполняется сложение", kk: "=A1+B1*C1 формуласында алдымен қосу орындалады" }, value: false, explanation: { ru: "Умножение выполняется раньше сложения, как в математике. Чтобы сначала сложить, нужны скобки: =(A1+B1)*C1.", kk: "Көбейту қосудан бұрын орындалады, математикадағыдай. Алдымен қосу үшін жақша керек: =(A1+B1)*C1." }, hint: { ru: "Вспомни порядок действий в математике.", kk: "Математикадағы амалдардың орындалу ретін еске түсір." } },
  { id: "st:sheets.formulas:result-shown", skill: SKILL, level: 1, text: { ru: "В ячейке с формулой таблица показывает результат вычисления, а сама формула видна в строке формул", kk: "Формулалы ұяшықта кесте есептеу нәтижесін көрсетеді, ал формуланың өзі формулалар жолында көрінеді" }, value: true, explanation: { ru: "В ячейке — результат, в строке формул — запись формулы.", kk: "Ұяшықта — нәтиже, формулалар жолында — формуланың жазбасы." }, hint: { ru: "Что ты видишь в ячейке: формулу или её значение?", kk: "Ұяшықта нені көресің: формуланы ма, әлде оның мәнін бе?" } },
  { id: "st:sheets.formulas:active", skill: SKILL, level: 1, text: { ru: "Ячейка, в которой стоит курсор, называется активной", kk: "Курсор тұрған ұяшық белсенді ұяшық деп аталады" }, value: true, explanation: { ru: "Активная ячейка выделена рамкой: именно в неё вводятся данные.", kk: "Белсенді ұяшық жиекпен белгіленеді: деректер дәл сол ұяшыққа енгізіледі." }, hint: { ru: "Как называется ячейка с рамкой?", kk: "Жиегі бар ұяшық қалай аталады?" } },
  { id: "st:sheets.formulas:len-space", skill: SKILL, level: 2, text: { ru: "Функция ДЛСТР не считает пробелы между словами", kk: "ДЛСТР функциясы сөздердің арасындағы бос орындарды санамайды" }, value: false, explanation: { ru: "ДЛСТР считает все символы, в том числе пробелы: «Алматы Тараз» — 12 символов.", kk: "ДЛСТР барлық символды, соның ішінде бос орындарды да санайды: «Алматы Тараз» — 12 символ." }, hint: { ru: "Пробел — это символ?", kk: "Бос орын символ ба?" } },
  { id: "st:sheets.formulas:mult", skill: SKILL, level: 1, text: { ru: "Знак умножения в формулах электронной таблицы — буква x", kk: "Электрондық кесте формулаларындағы көбейту белгісі — x әрпі" }, value: false, explanation: { ru: "Умножение записывают звёздочкой *: =A1*B1.", kk: "Көбейту жұлдызшамен * жазылады: =A1*B1." }, hint: { ru: "Какой знак на клавиатуре ставят между сомножителями в формуле?", kk: "Формулада көбейткіштердің арасына пернетақтадағы қандай белгі қойылады?" } },
  { id: "st:sheets.formulas:text-err", skill: SKILL, level: 2, text: { ru: "Если в A1 записан текст, формула =A1+5 покажет ошибку #ЗНАЧ!", kk: "A1 ұяшығында мәтін жазылса, =A1+5 формуласы #ЗНАЧ! қатесін көрсетеді" }, value: true, explanation: { ru: "Сложение требует чисел: текст в арифметике вызывает ошибку #ЗНАЧ!.", kk: "Қосу сандарды талап етеді: арифметикада мәтін #ЗНАЧ! қатесін шығарады." }, hint: { ru: "Можно ли сложить слово и число?", kk: "Сөз бен санды қосуға бола ма?" } },
];

const fnPair = (id: string, level: Level, name: string, ru: string, kk: string): Pair => ({ id: `p:sheets.formulas:${id}`, skill: SKILL, level, left: name, right: { ru, kk } });

const PAIRS: Pair[] = [
  fnPair("sum", 1, "СУММ (SUM)", "Сумма чисел", "Сандардың қосындысы"),
  fnPair("avg", 1, "СРЗНАЧ (AVERAGE)", "Среднее арифметическое", "Орташа арифметикалық"),
  fnPair("min", 1, "МИН (MIN)", "Наименьшее число", "Ең кіші сан"),
  fnPair("max", 1, "МАКС (MAX)", "Наибольшее число", "Ең үлкен сан"),
  fnPair("count", 1, "СЧЁТ (COUNT)", "Количество чисел", "Сандар саны"),
  fnPair("lower", 1, "СТРОЧН (LOWER)", "Все буквы строчные", "Барлық әріп кіші әріп"),
  fnPair("upper", 1, "ПРОПИСН (UPPER)", "Все буквы заглавные", "Барлық әріп бас әріп"),
  fnPair("len", 1, "ДЛСТР (LEN)", "Длина текста в символах", "Мәтіннің ұзындығы (символ саны)"),
  { id: "p:sheets.formulas:circle", skill: SKILL, level: 2, left: CIRCLE, right: { ru: "Доли целого", kk: "Бүтіннің үлестері" } },
  { id: "p:sheets.formulas:columns", skill: SKILL, level: 2, left: COLUMNS, right: { ru: "Сравнение значений", kk: "Мәндерді салыстыру" } },
  { id: "p:sheets.formulas:line", skill: SKILL, level: 2, left: LINE, right: { ru: "Изменение во времени", kk: "Уақыт бойынша өзгеру" } },
  { id: "p:sheets.formulas:err-div", skill: SKILL, level: 2, left: "#ДЕЛ/0!", right: { ru: "Деление на ноль", kk: "Нөлге бөлу" } },
  { id: "p:sheets.formulas:err-val", skill: SKILL, level: 2, left: "#ЗНАЧ!", right: { ru: "Текст там, где нужно число", kk: "Сан керек жерде мәтін" } },
  { id: "p:sheets.formulas:b3", skill: SKILL, level: 1, left: "B3", right: { ru: "Столбец B, строка 3", kk: "B бағаны, 3-жол" } },
  { id: "p:sheets.formulas:a1b3", skill: SKILL, level: 2, left: "A1:B3", right: { ru: "6 ячеек", kk: "6 ұяшық" } },
  { id: "p:sheets.formulas:c2e4", skill: SKILL, level: 2, left: "C2:E4", right: { ru: "9 ячеек", kk: "9 ұяшық" } },
];

const pool = poolBank({ skill: SKILL, questions: POOL_Q, statements: STATEMENTS, pairs: PAIRS });

// ---------- Утверждения (генератор + пул) ----------

function genStatement(rand: Rand, level: Level): Statement {
  if (level === 1 || rand() < 0.5) {
    // Число ячеек в диапазоне.
    const c1 = level === 1 ? 0 : int(rand, 1, 3);
    const r1 = level === 1 ? 1 : int(rand, 2, 4);
    const cols = int(rand, 2, 4);
    const rows = int(rand, 2, 4);
    const rng = `${addr(c1, r1 - 1)}:${addr(c1 + cols - 1, r1 + rows - 2)}`;
    const value = rand() < 0.5;
    const claim = value ? cols * rows : pick(rand, [cols + rows, (cols - 1) * (rows - 1), cols * rows + 1].filter((x) => x !== cols * rows));
    return {
      id: `s:${SKILL}:count:${idp(rng)}:${claim}`,
      skill: SKILL,
      level,
      text: { ru: `Диапазон ${rng} содержит ${claim} ${ruPl(claim, "ячейку", "ячейки", "ячеек")}`, kk: `${rng} диапазонында ${claim} ұяшық бар` },
      value,
      explanation: {
        ru: `Столбцов ${cols}, строк ${rows}: ${cols} × ${rows} = ${cols * rows}. Крайние столбец и строка тоже входят.`,
        kk: `Баған саны ${cols}, жол саны ${rows}: ${cols} × ${rows} = ${cols * rows}. Шеткі баған мен жол да кіреді.`,
      },
      hint: HINT_COUNT,
    };
  }
  // Значение формулы с приоритетом операций.
  for (let tries = 0; tries < 60; tries++) {
    const tpl = pick(rand, TPL_B);
    const [a, b, c] = [int(rand, 2, 9), int(rand, 2, 9), int(rand, 2, 9)];
    if (!tpl.ok(a, b, c)) continue;
    const grid: Cell[][] = [[a, b, c, tpl.f]];
    const v = numAt(grid, 3, 0);
    if (v === undefined || !Number.isInteger(v)) continue;
    const alt = tpl.alts.map((x) => numAt([[a, b, c, x.f]], 3, 0)).find((x) => x !== undefined && Number.isInteger(x) && x >= 0 && x !== v);
    const value = rand() < 0.5 || alt === undefined;
    const claim = value ? v : (alt as number);
    return {
      id: `s:${SKILL}:calc:${idp(tpl.f, a, b, c)}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Если A1 = ${a}, B1 = ${b}, C1 = ${c}, то формула ${tpl.f} даёт значение ${claim}`,
        kk: `A1 = ${a}, B1 = ${b}, C1 = ${c} болса, ${tpl.f} формуласының мәні: ${claim}`,
      },
      value: claim === v,
      explanation: {
        ru: `Подставляем: ${substitute(tpl.f, grid)} = ${v}. Скобки — первыми, затем степень, затем умножение и деление, затем сложение и вычитание.`,
        kk: `Мәндерді қоямыз: ${substitute(tpl.f, grid)} = ${v}. Алдымен жақша, содан кейін дәреже, содан кейін көбейту мен бөлу, соңында қосу мен азайту.`,
      },
      hint: HINT_CALC,
    };
  }
  throw new Error("sheets.formulas statement: не удалось подобрать значения");
}

// ---------- Короткие вопросы ----------

function genShort(rand: Rand, level: Level, seed: number): ShortQuestion {
  const kind = pick(rand, level === 1 ? ["count", "calc", "sum"] : level === 2 ? ["count", "calc", "len"] : ["calc", "len", "avg"]);
  if (kind === "count") {
    const c1 = level === 1 ? 0 : int(rand, 1, 3);
    const r1 = level === 1 ? 1 : int(rand, 2, 5);
    const cols = int(rand, 2, 5);
    const rows = int(rand, 2, 5);
    const rng = `${addr(c1, r1 - 1)}:${addr(c1 + cols - 1, r1 + rows - 2)}`;
    return {
      id: `q:${SKILL}:count:${idp(rng)}`,
      skill: SKILL,
      level,
      prompt: { ru: `Сколько ячеек в диапазоне ${rng}?`, kk: `${rng} диапазонында неше ұяшық бар?` },
      answer: String(cols * rows),
      mode: "number",
      explanation: { ru: `${cols} ${ruPl(cols, "столбец", "столбца", "столбцов")} × ${rows} ${ruPl(rows, "строка", "строки", "строк")} = ${cols * rows}`, kk: `${cols} баған × ${rows} жол = ${cols * rows}` },
      hint: HINT_COUNT,
    };
  }
  if (kind === "sum") {
    const data = Array.from({ length: 4 }, () => int(rand, 2, 30));
    return {
      id: `q:${SKILL}:sum:${idp(data.join("."))}`,
      skill: SKILL,
      level,
      prompt: { ru: `В A1:A4 записаны числа ${data.join(", ")}. Чему равно =СУММ(A1:A4)?`, kk: `A1:A4 ұяшықтарында ${data.join(", ")} сандары жазылған. =СУММ(A1:A4) неге тең?` },
      answer: String(data.reduce((a, b) => a + b, 0)),
      mode: "number",
      explanation: same(`${data.join(" + ")} = ${data.reduce((a, b) => a + b, 0)}`),
      hint: HINT_FUNC,
    };
  }
  if (kind === "len") {
    const w = pick(rand, WORDS);
    return {
      id: `q:${SKILL}:len:${w}`,
      skill: SKILL,
      level,
      prompt: { ru: `Чему равно =ДЛСТР("${w}")?`, kk: `=ДЛСТР("${w}") неге тең?` },
      answer: String(w.length),
      mode: "number",
      explanation: { ru: `В слове «${w}» ${w.length} ${ruPl(w.length, "буква", "буквы", "букв")}.`, kk: `«${w}» сөзінде ${w.length} әріп бар.` },
      hint: HINT_TEXTFN,
    };
  }
  if (kind === "avg") {
    const m = int(rand, 4, 20);
    const a = int(rand, 1, m);
    const b = int(rand, 1, m);
    const c = 3 * m - a - b;
    return {
      id: `q:${SKILL}:avg:${a}.${b}.${c}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `В A1:A5 записаны: ${a}, текст, ${b}, пусто, ${c}. Чему равно =СРЗНАЧ(A1:A5)?`,
        kk: `A1:A5 ұяшықтарында: ${a}, мәтін, ${b}, бос, ${c} жазылған. =СРЗНАЧ(A1:A5) неге тең?`,
      },
      answer: String(m),
      mode: "number",
      explanation: { ru: `Числа: ${a}, ${b}, ${c}. (${a} + ${b} + ${c}) / 3 = ${m}. Текст и пустая ячейка пропускаются.`, kk: `Сандар: ${a}, ${b}, ${c}. (${a} + ${b} + ${c}) / 3 = ${m}. Мәтін мен бос ұяшық өткізіліп кетеді.` },
      hint: HINT_TEXTCELLS,
    };
  }
  // calc
  for (let tries = 0; tries < 60; tries++) {
    const tpl = pick(rand, level === 1 ? TPL_A : TPL_B);
    const [a, b, c] = [int(rand, 2, 9), int(rand, 2, 9), int(rand, 2, 9)];
    if (!tpl.ok(a, b, c)) continue;
    const v = numAt([[a, b, c, tpl.f]], 3, 0);
    if (v === undefined || !Number.isInteger(v) || v < 1) continue;
    return {
      id: `q:${SKILL}:calc:${idp(tpl.f, a, b, c)}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `A1 = ${a}, B1 = ${b}, C1 = ${c}. Чему равно значение ${tpl.f}?`,
        kk: `A1 = ${a}, B1 = ${b}, C1 = ${c}. ${tpl.f} формуласының мәні неге тең?`,
      },
      answer: String(v),
      mode: "number",
      explanation: same(`${substitute(tpl.f, [[a, b, c]])} = ${v}`),
      hint: HINT_CALC,
    };
  }
  void seed;
  throw new Error("sheets.formulas short: не удалось подобрать значения");
}

// ---------- Банк ----------

/** Доля заданий из статичного пула (диаграммы, ошибки, смысл функций). */
const POOL_SHARE: Record<Level, number> = { 1: 0.3, 2: 0.3, 3: 0.25 };

const formulas: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    if (rand() < POOL_SHARE[level]) return pool.question(level, seed);
    return GEN[pick(rand, KINDS[level])](rand, level, seed);
  },
  statement(level, seed) {
    const rand = seeded(seed);
    if (rand() < 0.5) return genStatement(rand, level);
    return (pool.statement as NonNullable<SkillBank["statement"]>)(level, seed);
  },
  pair: pool.pair,
  short(level, seed) {
    return genShort(seeded(seed), level, seed);
  },
};

export const BANKS: SkillBank[] = [formulas];
