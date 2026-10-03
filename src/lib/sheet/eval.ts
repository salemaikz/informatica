// Вычисление формул и пересчёт листа. Правила — как в Excel (русская локаль):
// ошибки распространяются по формулам, пустая ячейка = 0 / "", сравнение текста без учёта регистра,
// результаты арифметики округляются до 15 значащих цифр (0,1+0,2=0,3 даёт ИСТИНА).

import { isFormula, parseConstant, parseNumberText, valueToText, type SheetCells } from "./format";
import { normName, parseFormula, type Node, type ParseError } from "./parse";
import { addrOf, inRange, normalizeAddr, normalizeRange, parseAddr, rangeArea, type RangeAddr } from "./refs";
import { ERR, isError, type SheetError, type Value } from "./value";

/** Окружение вычисления: значения ячеек листа. */
export interface Env {
  get(col: number, row: number): Value;
  /** Непустые ячейки диапазона по строкам слева направо (пустые не перечисляются). */
  stored(r: RangeAddr): { col: number; row: number; value: Value }[];
}

type Arg = { k: "v"; v: Value } | { k: "r"; r: RangeAddr; single: boolean };

// ---------- Преобразования ----------

/** Результат арифметики: 15 значащих цифр, без -0; не число → #ЧИСЛО!. */
function fix(x: number): Value {
  if (!Number.isFinite(x)) return ERR.num;
  if (x === 0) return 0;
  return Number(x.toPrecision(15));
}

function toNum(v: Value): number | SheetError {
  if (isError(v)) return v;
  if (typeof v === "number") return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  return parseNumberText(v) ?? ERR.value;
}

function toBool(v: Value): boolean | SheetError {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  const up = v.trim().toUpperCase();
  if (up === "TRUE" || up === "ИСТИНА") return true;
  if (up === "FALSE" || up === "ЛОЖЬ") return false;
  return ERR.value;
}

const rank = (v: number | string | boolean) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);

/** Сравнение значений без ошибок: числа < текст < логические; текст — без учёта регистра. */
function compare(a: Exclude<Value, SheetError>, b: Exclude<Value, SheetError>): number {
  let x = a;
  let y = b;
  if (x === null && y === null) return 0;
  if (x === null) x = typeof y === "string" ? "" : typeof y === "boolean" ? false : 0;
  if (y === null) y = typeof x === "string" ? "" : typeof x === "boolean" ? false : 0;
  if (rank(x) !== rank(y)) return rank(x) < rank(y) ? -1 : 1;
  if (typeof x === "string") {
    const p = x.toLowerCase();
    const q = (y as string).toLowerCase();
    return p < q ? -1 : p > q ? 1 : 0;
  }
  const p = Number(x);
  const q = Number(y);
  return p < q ? -1 : p > q ? 1 : 0;
}

// ---------- Вычисление дерева ----------

function evalNode(node: Node, env: Env): Value {
  switch (node.type) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "err":
      return { error: node.code };
    case "empty":
      return null;
    case "name":
      return ERR.name;
    case "range":
      // Диапазон в обычном выражении (=A1:A3, =ABS(A1:A3)) — как в Excel без неявного пересечения.
      return ERR.value;
    case "ref":
      return env.get(node.ref.col, node.ref.row);
    case "un": {
      if (node.op === "+") return evalNode(node.arg, env);
      const n = toNum(evalNode(node.arg, env));
      return isError(n) ? n : fix(-n);
    }
    case "pct": {
      const n = toNum(evalNode(node.arg, env));
      return isError(n) ? n : fix(n / 100);
    }
    case "bin":
      return evalBin(node.op, evalNode(node.l, env), evalNode(node.r, env));
    case "call": {
      const def = FUNCS.get(normName(node.name));
      if (!def) return ERR.name;
      if (node.args.length < def.min || node.args.length > def.max) return ERR.value;
      return def.run(node.args, env);
    }
  }
}

function evalBin(op: string, l: Value, r: Value): Value {
  if (isError(l)) return l;
  if (isError(r)) return r;
  if (op === "&") return valueToText(l) + valueToText(r);
  if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") {
    const c = compare(l, r);
    switch (op) {
      case "=": return c === 0;
      case "<>": return c !== 0;
      case "<": return c < 0;
      case ">": return c > 0;
      case "<=": return c <= 0;
      default: return c >= 0;
    }
  }
  const a = toNum(l);
  if (isError(a)) return a;
  const b = toNum(r);
  if (isError(b)) return b;
  switch (op) {
    case "+": return fix(a + b);
    case "-": return fix(a - b);
    case "*": return fix(a * b);
    case "/": return b === 0 ? ERR.div0 : fix(a / b);
    default: // ^
      if (a === 0 && b === 0) return ERR.num;
      if (a === 0 && b < 0) return ERR.div0;
      return fix(Math.pow(a, b));
  }
}

function evalArgs(nodes: Node[], env: Env): Arg[] {
  return nodes.map((n): Arg => {
    if (n.type === "ref") return { k: "r", r: { c1: n.ref.col, r1: n.ref.row, c2: n.ref.col, r2: n.ref.row }, single: true };
    if (n.type === "range") return { k: "r", r: normalizeRange(n.a, n.b), single: false };
    return { k: "v", v: evalNode(n, env) };
  });
}

/** Аргумент как одно значение (диапазон из одной ячейки — её значение, больше — #ЗНАЧ!). */
function scalarOf(a: Arg, env: Env): Value {
  if (a.k === "v") return a.v;
  return a.single ? env.get(a.r.c1, a.r.r1) : ERR.value;
}

// ---------- Функции ----------

interface FnDef {
  min: number;
  max: number;
  run: (nodes: Node[], env: Env) => Value;
}

const FUNCS = new Map<string, FnDef>();

/** Названия функций для подсказок интерфейса. */
export const FUNCTION_NAMES: { ru: string; en: string }[] = [];

function def(ru: string, en: string, min: number, max: number, run: (args: Arg[], env: Env) => Value) {
  const d: FnDef = { min, max, run: (nodes, env) => run(evalArgs(nodes, env), env) };
  FUNCS.set(normName(ru), d);
  FUNCS.set(normName(en), d);
  FUNCTION_NAMES.push({ ru, en });
}

function defLazy(ru: string, en: string, min: number, max: number, run: (nodes: Node[], env: Env) => Value) {
  FUNCS.set(normName(ru), { min, max, run });
  FUNCS.set(normName(en), { min, max, run });
  FUNCTION_NAMES.push({ ru, en });
}

/** Числа из аргументов: в диапазонах только числа, текст прямо в аргументе — число или #ЗНАЧ!. */
function numbersOf(args: Arg[], env: Env): number[] | SheetError {
  const out: number[] = [];
  for (const a of args) {
    if (a.k === "r") {
      for (const c of env.stored(a.r)) {
        if (isError(c.value)) return c.value;
        if (typeof c.value === "number") out.push(c.value);
      }
      continue;
    }
    const v = a.v;
    if (isError(v)) return v;
    if (v === null) out.push(0);
    else if (typeof v === "number") out.push(v);
    else if (typeof v === "boolean") out.push(v ? 1 : 0);
    else {
      const n = parseNumberText(v);
      if (n === null) return ERR.value;
      out.push(n);
    }
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

def("СУММ", "SUM", 1, 255, (args, env) => {
  const xs = numbersOf(args, env);
  return isError(xs) ? xs : fix(sum(xs));
});
def("СРЗНАЧ", "AVERAGE", 1, 255, (args, env) => {
  const xs = numbersOf(args, env);
  if (isError(xs)) return xs;
  return xs.length ? fix(sum(xs) / xs.length) : ERR.div0;
});
def("МИН", "MIN", 1, 255, (args, env) => {
  const xs = numbersOf(args, env);
  return isError(xs) ? xs : xs.length ? Math.min(...xs) : 0;
});
def("МАКС", "MAX", 1, 255, (args, env) => {
  const xs = numbersOf(args, env);
  return isError(xs) ? xs : xs.length ? Math.max(...xs) : 0;
});
def("ПРОИЗВЕД", "PRODUCT", 1, 255, (args, env) => {
  const xs = numbersOf(args, env);
  return isError(xs) ? xs : xs.length ? fix(xs.reduce((p, x) => p * x, 1)) : 0;
});
def("СЧЁТ", "COUNT", 1, 255, (args, env) => {
  let n = 0;
  for (const a of args) {
    if (a.k === "r") n += env.stored(a.r).filter((c) => typeof c.value === "number").length;
    else if (typeof a.v === "number" || typeof a.v === "boolean" || (typeof a.v === "string" && parseNumberText(a.v) !== null)) n++;
  }
  return n;
});
def("СЧЁТЗ", "COUNTA", 1, 255, (args, env) => {
  let n = 0;
  for (const a of args) {
    if (a.k === "r") n += env.stored(a.r).length;
    else if (a.v !== null) n++;
  }
  return n;
});

// --- Условия по диапазону ---

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Шаблон с подстановками: * — любые символы, ? — один, ~ — экранирование. */
function wildcard(s: string): RegExp {
  let re = "^";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "~" && i + 1 < s.length && "*?~".includes(s[i + 1])) re += escapeRe(s[++i]);
    else if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else re += escapeRe(ch);
  }
  return new RegExp(re + "$", "is");
}

/** Условие СЧЁТЕСЛИ/СУММЕСЛИ: 5, "5", ">5", "<>0", "яблоко", "а*" … */
function predicate(crit: Value): (v: Value) => boolean {
  if (crit === null) crit = 0;
  if (typeof crit === "number") {
    const n = crit;
    return (v) => (typeof v === "number" ? v === n : typeof v === "string" && parseNumberText(v) === n);
  }
  if (typeof crit === "boolean") return (v) => v === crit;
  if (isError(crit)) return () => false;
  const m = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/.exec(crit)!;
  const op = m[1] ?? "=";
  const operand = m[2];
  const empty = (v: Value) => v === null || v === "";
  if (operand === "") return op === "=" ? empty : op === "<>" ? (v) => !empty(v) : () => false;
  const n = parseNumberText(operand);
  if (n !== null) {
    const eq = (v: Value) => (typeof v === "number" ? v === n : typeof v === "string" && parseNumberText(v) === n);
    switch (op) {
      case "=": return eq;
      case "<>": return (v) => !eq(v);
      case "<": return (v) => typeof v === "number" && v < n;
      case ">": return (v) => typeof v === "number" && v > n;
      case "<=": return (v) => typeof v === "number" && v <= n;
      default: return (v) => typeof v === "number" && v >= n;
    }
  }
  const up = operand.trim().toUpperCase();
  if ((up === "TRUE" || up === "ИСТИНА" || up === "FALSE" || up === "ЛОЖЬ") && (op === "=" || op === "<>")) {
    const want = up === "TRUE" || up === "ИСТИНА";
    return op === "=" ? (v) => v === want : (v) => v !== want;
  }
  const re = wildcard(operand);
  const low = operand.toLowerCase();
  const isText = (v: Value): v is string => typeof v === "string";
  switch (op) {
    case "=": return (v) => isText(v) && re.test(v);
    case "<>": return (v) => !(isText(v) && re.test(v));
    case "<": return (v) => isText(v) && v.toLowerCase() < low;
    case ">": return (v) => isText(v) && v.toLowerCase() > low;
    case "<=": return (v) => isText(v) && v.toLowerCase() <= low;
    default: return (v) => isText(v) && v.toLowerCase() >= low;
  }
}

def("СЧЁТЕСЛИ", "COUNTIF", 2, 2, (args, env) => {
  const [range, critArg] = args;
  if (range.k !== "r") return ERR.value;
  const crit = scalarOf(critArg, env);
  if (isError(crit)) return crit;
  const pred = predicate(crit);
  const cells = env.stored(range.r);
  let n = cells.filter((c) => pred(c.value)).length;
  if (pred(null)) n += rangeArea(range.r) - cells.length;
  return n;
});

def("СУММЕСЛИ", "SUMIF", 2, 3, (args, env) => {
  const [range, critArg, sumArg] = args;
  if (range.k !== "r" || (sumArg && sumArg.k !== "r")) return ERR.value;
  const crit = scalarOf(critArg, env);
  if (isError(crit)) return crit;
  const pred = predicate(crit);
  let total = 0;
  const cellsToScan: { col: number; row: number; value: Value }[] = [];
  if (pred(null) && rangeArea(range.r) <= 10000) {
    for (let row = range.r.r1; row <= range.r.r2; row++) for (let col = range.r.c1; col <= range.r.c2; col++) cellsToScan.push({ col, row, value: env.get(col, row) });
  } else cellsToScan.push(...env.stored(range.r));
  for (const c of cellsToScan) {
    if (!pred(c.value)) continue;
    const v = sumArg && sumArg.k === "r" ? env.get(sumArg.r.c1 + (c.col - range.r.c1), sumArg.r.r1 + (c.row - range.r.r1)) : c.value;
    if (isError(v)) return v;
    if (typeof v === "number") total += v;
  }
  return fix(total);
});

// --- Логика ---

defLazy("ЕСЛИ", "IF", 2, 3, (nodes, env) => {
  const cond = toBool(evalNode(nodes[0], env));
  if (isError(cond)) return cond;
  const branch = cond ? nodes[1] : nodes[2];
  if (!branch) return false;
  const v = evalNode(branch, env);
  return v === null ? 0 : v;
});
defLazy("ЕСЛИОШИБКА", "IFERROR", 2, 2, (nodes, env) => {
  const v = evalNode(nodes[0], env);
  if (isError(v)) {
    const alt = evalNode(nodes[1], env);
    return alt === null ? 0 : alt;
  }
  return v === null ? 0 : v;
});

/** Логические значения из аргументов И/ИЛИ: в диапазонах текст и пустые игнорируются; нет ни одного — #ЗНАЧ!. */
function logicals(args: Arg[], env: Env): boolean[] | SheetError {
  const out: boolean[] = [];
  for (const a of args) {
    if (a.k === "r") {
      for (const c of env.stored(a.r)) {
        if (isError(c.value)) return c.value;
        if (typeof c.value === "boolean") out.push(c.value);
        else if (typeof c.value === "number") out.push(c.value !== 0);
      }
      continue;
    }
    const v = a.v;
    if (isError(v)) return v;
    if (v === null) continue;
    if (typeof v === "string") {
      const b = toBool(v);
      if (isError(b)) return b;
      out.push(b);
    } else out.push(typeof v === "boolean" ? v : v !== 0);
  }
  return out.length ? out : ERR.value;
}
def("И", "AND", 1, 255, (args, env) => {
  const xs = logicals(args, env);
  return isError(xs) ? xs : xs.every(Boolean);
});
def("ИЛИ", "OR", 1, 255, (args, env) => {
  const xs = logicals(args, env);
  return isError(xs) ? xs : xs.some(Boolean);
});
def("НЕ", "NOT", 1, 1, (args, env) => {
  const b = toBool(scalarOf(args[0], env));
  return isError(b) ? b : !b;
});

// --- Числа ---

/** x · 10^e без накопления ошибки двоичной дроби (1,005 → 100,5). */
function shift10(x: number, e: number): number {
  if (x === 0) return 0;
  const [mant, exp] = x.toExponential(14).split("e");
  return Number(`${mant}e${Number(exp) + e}`);
}

/** Округление «от нуля» (как в Excel): 2,5 → 3; −2,5 → −3; 1,005 до сотых → 1,01. */
export function roundHalfAway(x: number, digits: number): number {
  const sign = x < 0 ? -1 : 1;
  return sign * shift10(Math.round(shift10(Math.abs(x), digits)), -digits);
}

const num1 = (a: Arg, env: Env) => toNum(scalarOf(a, env));

def("ОКРУГЛ", "ROUND", 2, 2, (args, env) => {
  const x = num1(args[0], env);
  if (isError(x)) return x;
  const d = num1(args[1], env);
  if (isError(d)) return d;
  return fix(roundHalfAway(x, Math.trunc(d)));
});
def("ABS", "ABS", 1, 1, (args, env) => {
  const x = num1(args[0], env);
  return isError(x) ? x : fix(Math.abs(x));
});
def("ЦЕЛОЕ", "INT", 1, 1, (args, env) => {
  const x = num1(args[0], env);
  return isError(x) ? x : fix(Math.floor(x));
});
def("ОСТАТ", "MOD", 2, 2, (args, env) => {
  const a = num1(args[0], env);
  if (isError(a)) return a;
  const b = num1(args[1], env);
  if (isError(b)) return b;
  return b === 0 ? ERR.div0 : fix(a - b * Math.floor(a / b));
});
def("КОРЕНЬ", "SQRT", 1, 1, (args, env) => {
  const x = num1(args[0], env);
  if (isError(x)) return x;
  return x < 0 ? ERR.num : fix(Math.sqrt(x));
});

// ---------- Лист целиком ----------

export interface SheetResult {
  /** Вычисленные значения всех непустых ячеек (формулы — результат, остальное — как введено). */
  values: Record<string, Value>;
  /** Формулы, которые не удалось разобрать (в ячейке — #ЗНАЧ!). */
  parseErrors: Record<string, ParseError>;
  /** Значение ячейки по адресу («B3», «$b$3»); пустая — null. */
  get(addr: string): Value;
}

export type SheetInput = Record<string, string | number | boolean | null | undefined>;

/** Нормализация ввода: адреса в верхнем регистре, значения — строки, пустые отброшены. */
export function normalizeCells(input: SheetInput): SheetCells {
  const out: SheetCells = {};
  for (const [k, v] of Object.entries(input)) {
    const addr = normalizeAddr(k);
    if (!addr || v === null || v === undefined) continue;
    const s = String(v);
    if (s.trim() !== "") out[addr] = s;
  }
  return out;
}

function collectRefs(node: Node, out: Node[]): void {
  switch (node.type) {
    case "ref":
    case "range":
      out.push(node);
      return;
    case "un":
    case "pct":
      collectRefs(node.arg, out);
      return;
    case "bin":
      collectRefs(node.l, out);
      collectRefs(node.r, out);
      return;
    case "call":
      node.args.forEach((a) => collectRefs(a, out));
      return;
    default:
  }
}

interface FormulaCell {
  addr: string;
  ast: Node;
  deps: Set<string>;
}

/**
 * Пересчёт листа: формулы считаются в порядке зависимостей. Ячейки, вошедшие в цикл (или зависящие от него),
 * получают #ЦИКЛ!. Неразобранная формула — #ЗНАЧ!.
 */
export function evaluateSheet(input: SheetInput): SheetResult {
  const cells = normalizeCells(input);
  const store = new Map<string, Value>();
  const parseErrors: Record<string, ParseError> = {};
  const formulas = new Map<string, FormulaCell>();

  for (const [addr, raw] of Object.entries(cells)) {
    if (!isFormula(raw)) {
      store.set(addr, parseConstant(raw));
      continue;
    }
    const parsed = parseFormula(raw.trim());
    if (parsed.ok) formulas.set(addr, { addr, ast: parsed.ast, deps: new Set() });
    else {
      store.set(addr, ERR.value);
      parseErrors[addr] = parsed.error;
    }
  }

  // Непустые ячейки по строкам — для обхода диапазонов.
  const sorted = Object.keys(cells)
    .map((addr) => ({ addr, ...parseAddr(addr)! }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const env: Env = {
    get: (col, row) => store.get(addrOf(col, row)) ?? null,
    stored: (r) => {
      const out: { col: number; row: number; value: Value }[] = [];
      for (const c of sorted) {
        if (!inRange(c.col, c.row, r)) continue;
        const value = store.get(c.addr);
        if (value !== undefined && value !== null) out.push({ col: c.col, row: c.row, value });
      }
      return out;
    },
  };

  // Зависимости между формулами: ссылки и диапазоны, в которые попадают другие формулы.
  const formulaList = [...formulas.values()].map((f) => ({ f, ...parseAddr(f.addr)! }));
  for (const f of formulas.values()) {
    const refs: Node[] = [];
    collectRefs(f.ast, refs);
    for (const n of refs) {
      if (n.type === "ref") {
        const key = addrOf(n.ref.col, n.ref.row);
        if (formulas.has(key)) f.deps.add(key);
      } else if (n.type === "range") {
        const r = normalizeRange(n.a, n.b);
        for (const o of formulaList) if (inRange(o.col, o.row, r)) f.deps.add(o.f.addr);
      }
    }
  }

  // Порядок вычисления (алгоритм Кана); то, что осталось, — цикл или зависит от цикла.
  const pending = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const queue: string[] = [];
  for (const f of formulas.values()) {
    pending.set(f.addr, f.deps.size);
    if (f.deps.size === 0) queue.push(f.addr);
    for (const d of f.deps) {
      const list = dependents.get(d);
      if (list) list.push(f.addr);
      else dependents.set(d, [f.addr]);
    }
  }
  const done = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const addr = queue[i];
    const v = evalNode(formulas.get(addr)!.ast, env);
    store.set(addr, v === null ? 0 : v);
    done.add(addr);
    for (const d of dependents.get(addr) ?? []) {
      const left = (pending.get(d) ?? 0) - 1;
      pending.set(d, left);
      if (left === 0) queue.push(d);
    }
  }
  for (const addr of formulas.keys()) if (!done.has(addr)) store.set(addr, ERR.cycle);

  const values: Record<string, Value> = {};
  for (const c of sorted) {
    const v = store.get(c.addr);
    if (v !== undefined && v !== null) values[c.addr] = v;
  }
  return {
    values,
    parseErrors,
    get: (addr) => {
      const a = normalizeAddr(addr);
      return (a && store.get(a)) ?? null;
    },
  };
}

/** Значение одной формулы (с «=») на листе из cells — для тестов и подсказок. */
export function evaluateFormula(formula: string, cells: SheetInput = {}): Value {
  const key = "ZZ9999";
  return evaluateSheet({ ...cells, [key]: formula }).get(key);
}
