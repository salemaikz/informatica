// Разбор формул: лексер и рекурсивный разбор в дерево (AST), копирование формулы со сдвигом ссылок.
// Приоритеты как в Excel (от низшего): сравнения < & < + − < * / < ^ < унарный минус < %.
// Поэтому =-2^2 даёт 4, а =2^3^2 считается слева направо: 64.

import { ERROR_LITERALS, type ErrorCode } from "./value";
import { normalizeRange, parseRef, refText, shiftRef, type CellAddr, type CellRef } from "./refs";

// ---------- Лексер ----------

export type TokKind = "num" | "str" | "ref" | "name" | "err" | "op" | "(" | ")" | ":" | "sep";

export interface Token {
  t: TokKind;
  /** Исходный текст токена (для «op» — нормализованный оператор). */
  text: string;
  start: number;
  end: number;
  num?: number;
  str?: string;
  ref?: CellRef;
  code?: ErrorCode;
}

export type ParseErrorKind = "empty" | "char" | "string" | "syntax" | "paren" | "depth";

export interface ParseError {
  kind: ParseErrorKind;
  /** Позиция в строке формулы. */
  pos: number;
}

/** Нормализация имени функции: регистр и «ё» не важны (СЧЁТ = счет). */
export const normName = (s: string) => s.toUpperCase().replace(/Ё/g, "Е");

const NAME_START = /[A-Za-z_Ѐ-ӿ]/;
const NAME_PART = /[A-Za-z0-9_Ѐ-ӿ]/;
const QUOTE_OPEN = '"“”„«';
const QUOTE_CLOSE = '"“”»';
/** Кириллические двойники латинских букв (русская раскладка на телефоне): А1 вместо A1. */
const HOMOGLYPHS: Record<string, string> = { А: "A", В: "B", С: "C", Е: "E", Н: "H", К: "K", М: "M", Р: "P", Т: "T", Х: "X", а: "a", в: "b", с: "c", е: "e", н: "h", к: "k", м: "m", р: "p", т: "t", х: "x" };
const toLatinLookalikes = (s: string) => s.replace(/[АВСЕНКМРТХавсенкмртх]/g, (ch) => HOMOGLYPHS[ch]);
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

/** Есть ли «;» вне строк: тогда запятая в числах — десятичная (как в русском Excel). */
function hasSemicolon(src: string): boolean {
  let inStr = false;
  for (const c of src) {
    if (QUOTE_OPEN.includes(c) || c === "»") inStr = !inStr;
    else if (c === ";" && !inStr) return true;
  }
  return false;
}

const SINGLE_OPS: Record<string, string> = { "+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "/": "/", "÷": "/", "^": "^", "&": "&", "%": "%", "=": "=", "≤": "<=", "≥": ">=", "≠": "<>" };

export function tokenize(src: string): { tokens: Token[]; error?: ParseError } {
  const tokens: Token[] = [];
  const semi = hasSemicolon(src);
  // Стек скобок: для каждой — имя функции (или null для скобок-группировки).
  const stack: { fn: string | null }[] = [];
  const push = (t: TokKind, start: number, end: number, extra: Partial<Token> = {}) => tokens.push({ t, text: src.slice(start, end), start, end, ...extra });
  const fail = (kind: ParseErrorKind, pos: number) => ({ tokens, error: { kind, pos } as ParseError });
  let i = 0;

  /** Запятая между цифрами — десятичная, если есть «;», либо запятая вне вызова функции (в скобках-группировке). Без «;» внутри вызова функции запятая — разделитель. */
  const commaIsDecimal = () => {
    if (semi || stack.length === 0) return true;
    return stack[stack.length - 1].fn === null;
  };

  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // Числа
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (isDigit(src[j])) j++;
      if (src[j] === ".") {
        j++;
        while (isDigit(src[j])) j++;
      } else if (src[j] === "," && isDigit(src[j + 1]) && commaIsDecimal()) {
        j++;
        while (isDigit(src[j])) j++;
      }
      if ((src[j] === "e" || src[j] === "E") && (isDigit(src[j + 1]) || ((src[j + 1] === "+" || src[j + 1] === "-") && isDigit(src[j + 2])))) {
        j += 2;
        while (isDigit(src[j])) j++;
      }
      if (j < src.length && NAME_START.test(src[j])) return fail("char", j);
      push("num", i, j, { num: Number(src.slice(i, j).replace(",", ".")) });
      i = j;
      continue;
    }
    // Строки
    if (QUOTE_OPEN.includes(c)) {
      let j = i + 1;
      let out = "";
      let closed = false;
      while (j < src.length) {
        const d = src[j];
        if (c === '"' && d === '"') {
          if (src[j + 1] === '"') {
            out += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        if (c !== '"' && QUOTE_CLOSE.includes(d)) {
          closed = true;
          j++;
          break;
        }
        out += d;
        j++;
      }
      if (!closed) return fail("string", i);
      push("str", i, j, { str: out });
      i = j;
      continue;
    }
    // Литералы ошибок: #ССЫЛКА!, #REF!
    if (c === "#") {
      const m = /^#[A-Za-zЀ-ӿ\/0!?]+/.exec(src.slice(i));
      const code = m ? ERROR_LITERALS[m[0].toUpperCase()] : undefined;
      if (!m || !code) return fail("char", i);
      push("err", i, i + m[0].length, { code });
      i += m[0].length;
      continue;
    }
    // Ссылки и имена
    if (c === "$" || NAME_START.test(c)) {
      const m = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(toLatinLookalikes(src.slice(i, i + 12)));
      if (m) {
        const end = i + m[0].length;
        const next = src[end];
        const ref = !next || !(NAME_PART.test(next) || next === "(" || next === ".") ? parseRef(m[0]) : null;
        if (ref) {
          push("ref", i, end, { ref });
          i = end;
          continue;
        }
      }
      if (c === "$") return fail("char", i);
      let j = i + 1;
      while (j < src.length && NAME_PART.test(src[j])) j++;
      push("name", i, j, { str: src.slice(i, j) });
      i = j;
      continue;
    }
    // Операторы сравнения
    if (c === "<" || c === ">") {
      const n = src[i + 1];
      const op = c === "<" ? (n === "=" ? "<=" : n === ">" ? "<>" : "<") : n === "=" ? ">=" : ">";
      push("op", i, i + op.length);
      tokens[tokens.length - 1].text = op;
      i += op.length;
      continue;
    }
    const single = SINGLE_OPS[c];
    if (single) {
      push("op", i, i + 1);
      tokens[tokens.length - 1].text = single;
      i++;
      continue;
    }
    if (c === "(") {
      const prev = tokens[tokens.length - 1];
      stack.push({ fn: prev && prev.t === "name" ? (prev.str ?? "") : null });
      push("(", i, i + 1);
      i++;
      continue;
    }
    if (c === ")") {
      if (!stack.pop()) return fail("paren", i);
      push(")", i, i + 1);
      i++;
      continue;
    }
    if (c === ":") {
      push(":", i, i + 1);
      i++;
      continue;
    }
    if (c === ";" || c === ",") {
      push("sep", i, i + 1);
      i++;
      continue;
    }
    return fail("char", i);
  }
  if (stack.length) return fail("paren", src.length);
  return { tokens };
}

// ---------- Дерево разбора ----------

export type BinOp = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type Node =
  | { type: "num"; v: number }
  | { type: "str"; v: string }
  | { type: "bool"; v: boolean }
  | { type: "ref"; ref: CellRef }
  | { type: "range"; a: CellRef; b: CellRef }
  | { type: "name"; name: string }
  | { type: "err"; code: ErrorCode }
  | { type: "un"; op: "-" | "+"; arg: Node }
  | { type: "pct"; arg: Node }
  | { type: "bin"; op: BinOp; l: Node; r: Node }
  | { type: "call"; name: string; args: Node[] }
  /** Пропущенный аргумент: ЕСЛИ(A1;;B1). */
  | { type: "empty" };

export type ParseResult = { ok: true; ast: Node } | { ok: false; error: ParseError };

class Fail extends Error {
  constructor(readonly info: ParseError) {
    super(info.kind);
  }
}

const MAX_DEPTH = 100;
const COMPARE = new Set(["=", "<>", "<", ">", "<=", ">="]);
const TRUE_NAMES = new Set(["TRUE", "ИСТИНА"]);
const FALSE_NAMES = new Set(["FALSE", "ЛОЖЬ"]);

class Parser {
  private p = 1; // токен 0 — «=»
  private depth = 0;
  constructor(private readonly toks: Token[], private readonly srcLen: number) {}

  private get cur(): Token | undefined {
    return this.toks[this.p];
  }
  private fail(kind: ParseErrorKind, tok = this.cur): never {
    throw new Fail({ kind, pos: tok ? tok.start : this.srcLen });
  }
  private isOp(...ops: string[]) {
    const c = this.cur;
    return !!c && c.t === "op" && ops.includes(c.text);
  }

  parseAll(): Node {
    if (!this.cur) this.fail("empty");
    const n = this.expr();
    if (this.cur) this.fail("syntax");
    return n;
  }

  private expr(): Node {
    if (++this.depth > MAX_DEPTH) this.fail("depth");
    let l = this.concat();
    while (this.cur && this.cur.t === "op" && COMPARE.has(this.cur.text)) {
      const op = this.cur.text as BinOp;
      this.p++;
      l = { type: "bin", op, l, r: this.concat() };
    }
    this.depth--;
    return l;
  }
  private concat(): Node {
    let l = this.additive();
    while (this.isOp("&")) {
      this.p++;
      l = { type: "bin", op: "&", l, r: this.additive() };
    }
    return l;
  }
  private additive(): Node {
    let l = this.mul();
    while (this.isOp("+", "-")) {
      const op = this.cur!.text as BinOp;
      this.p++;
      l = { type: "bin", op, l, r: this.mul() };
    }
    return l;
  }
  private mul(): Node {
    let l = this.power();
    while (this.isOp("*", "/")) {
      const op = this.cur!.text as BinOp;
      this.p++;
      l = { type: "bin", op, l, r: this.power() };
    }
    return l;
  }
  private power(): Node {
    let l = this.unary();
    while (this.isOp("^")) {
      this.p++;
      l = { type: "bin", op: "^", l, r: this.unary() };
    }
    return l;
  }
  private unary(): Node {
    if (this.isOp("-", "+")) {
      if (++this.depth > MAX_DEPTH) this.fail("depth");
      const op = this.cur!.text as "-" | "+";
      this.p++;
      const arg = this.unary();
      this.depth--;
      return { type: "un", op, arg };
    }
    let n = this.primary();
    while (this.isOp("%")) {
      this.p++;
      n = { type: "pct", arg: n };
    }
    return n;
  }

  private primary(): Node {
    const tok = this.cur;
    if (!tok) return this.fail("syntax");
    switch (tok.t) {
      case "num":
        this.p++;
        return { type: "num", v: tok.num ?? 0 };
      case "str":
        this.p++;
        return { type: "str", v: tok.str ?? "" };
      case "err":
        this.p++;
        return { type: "err", code: tok.code! };
      case "ref": {
        this.p++;
        if (this.cur && this.cur.t === ":") {
          this.p++;
          const b = this.cur;
          if (!b || b.t !== "ref") return this.fail("syntax");
          this.p++;
          return { type: "range", a: tok.ref!, b: b.ref! };
        }
        return { type: "ref", ref: tok.ref! };
      }
      case "(": {
        this.p++;
        const n = this.expr();
        if (!this.cur || this.cur.t !== ")") return this.fail("paren");
        this.p++;
        return n;
      }
      case "name": {
        this.p++;
        const name = tok.str ?? tok.text;
        if (this.cur && this.cur.t === "(") {
          this.p++;
          return { type: "call", name, args: this.args() };
        }
        const up = normName(name);
        if (TRUE_NAMES.has(up)) return { type: "bool", v: true };
        if (FALSE_NAMES.has(up)) return { type: "bool", v: false };
        return { type: "name", name };
      }
      default:
        return this.fail("syntax");
    }
  }

  private args(): Node[] {
    const out: Node[] = [];
    if (this.cur && this.cur.t === ")") {
      this.p++;
      return out;
    }
    for (;;) {
      const c = this.cur;
      if (!c) return this.fail("paren");
      out.push(c.t === "sep" || c.t === ")" ? { type: "empty" } : this.expr());
      const n = this.cur;
      if (n && n.t === "sep") {
        this.p++;
        continue;
      }
      if (n && n.t === ")") {
        this.p++;
        return out;
      }
      return this.fail("paren");
    }
  }
}

/** Разбор формулы, начинающейся с «=». Ошибка — не исключение, а `{ ok: false }`. */
export function parseFormula(src: string): ParseResult {
  const { tokens, error } = tokenize(src);
  if (error) return { ok: false, error };
  const first = tokens[0];
  if (!first || first.t !== "op" || first.text !== "=") return { ok: false, error: { kind: "syntax", pos: first ? first.start : 0 } };
  if (tokens.length === 1) return { ok: false, error: { kind: "empty", pos: first.end } };
  try {
    return { ok: true, ast: new Parser(tokens, src.length).parseAll() };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.info };
    throw e;
  }
}

// ---------- Ссылки внутри формулы ----------

export interface RefSpan {
  kind: "cell" | "range";
  /** Начало и конец (для ячейки совпадают), нормализованные. */
  from: CellAddr;
  to: CellAddr;
  start: number;
  end: number;
}

/** Ссылки и диапазоны формулы по тексту (работает и для недописанной формулы) — для подсветки ячеек в сетке. */
export function formulaRefs(formula: string): RefSpan[] {
  if (!formula.trimStart().startsWith("=")) return [];
  const { tokens } = tokenize(formula);
  const out: RefSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t !== "ref" || !t.ref) continue;
    const colon = tokens[i + 1];
    const b = tokens[i + 2];
    if (colon && colon.t === ":" && b && b.t === "ref" && b.ref) {
      const r = normalizeRange(t.ref, b.ref);
      out.push({ kind: "range", from: { col: r.c1, row: r.r1 }, to: { col: r.c2, row: r.r2 }, start: t.start, end: b.end });
      i += 2;
    } else {
      out.push({ kind: "cell", from: { col: t.ref.col, row: t.ref.row }, to: { col: t.ref.col, row: t.ref.row }, start: t.start, end: t.end });
    }
  }
  return out;
}

// ---------- Копирование формулы ----------

/**
 * Формула, скопированная на dRow строк вниз и dCol столбцов вправо: относительные ссылки сдвигаются,
 * абсолютные ($) — нет. Ссылка, вышедшая за край таблицы, становится #ССЫЛКА! (для диапазона — весь диапазон).
 * Строки в кавычках и пробелы сохраняются как есть. Не формулу возвращает без изменений.
 */
export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  if (!formula.startsWith("=")) return formula;
  const { tokens, error } = tokenize(formula);
  if (error) return formula;
  let out = "";
  let pos = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t !== "ref" || !t.ref) continue;
    const colon = tokens[i + 1];
    const b = tokens[i + 2];
    const isRange = !!colon && colon.t === ":" && !!b && b.t === "ref" && !!b.ref;
    const a2 = shiftRef(t.ref, dRow, dCol);
    const b2 = isRange ? shiftRef(b.ref!, dRow, dCol) : a2;
    const end = isRange ? b.end : t.end;
    out += formula.slice(pos, t.start);
    out += a2 && b2 ? (isRange ? refText(a2) + ":" + refText(b2) : refText(a2)) : "#ССЫЛКА!";
    pos = end;
    if (isRange) i += 2;
  }
  return out + formula.slice(pos);
}
