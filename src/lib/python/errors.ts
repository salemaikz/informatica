// Понятное объяснение ошибок Python для ученика (ru/kk). Чистая логика: тип и сообщение Python → вид ошибки и текст.
// Тексты — в i18n/parts/python.ts (ключи python.err.<вид>.title / .hint).

import { pythonDict } from "@/i18n/parts/python";
import { fmt } from "@/lib/text";
import type { Lang } from "@/lib/types";
import type { PyError } from "./types";

export type ErrorKind =
  | "syntax"
  | "colon"
  | "assign"
  | "paren"
  | "quote"
  | "char"
  | "print"
  | "indentExpected"
  | "indentUnexpected"
  | "indentMismatch"
  | "name"
  | "mix"
  | "type"
  | "zero"
  | "index"
  | "notNumber"
  | "value"
  | "eof"
  | "recursion"
  | "key"
  | "attr"
  | "timeout"
  | "steps"
  | "load"
  | "generic";

export interface Classified {
  kind: ErrorKind;
  params: Record<string, string>;
}

export interface ErrorExplanation {
  kind: ErrorKind;
  title: string;
  hint: string;
  line: number | null;
}

/** Встроенные имена, которые часто пишут с большой буквы или с опечаткой. */
const KNOWN_NAMES = [
  "print", "input", "int", "float", "str", "len", "range", "list", "dict", "set", "tuple", "abs", "max", "min", "sum",
  "round", "sorted", "reversed", "enumerate", "bool", "ord", "chr", "pow", "map", "True", "False", "None",
];

const quoted = (s: string) => s.replace(/^['"]|['"]$/g, "");

/** Похожее известное имя: тот же текст без учёта регистра или одна опечатка. */
export function suggestName(name: string): string | null {
  const lower = name.toLowerCase();
  const exact = KNOWN_NAMES.find((k) => k.toLowerCase() === lower && k !== name);
  if (exact) return exact;
  if (name.length < 4) return null;
  for (const k of KNOWN_NAMES) if (k.length >= 4 && editDistance1(lower, k.toLowerCase())) return k;
  return null;
}

/** Строки отличаются ровно на одну правку (замена, вставка, удаление или перестановка соседних букв). */
function editDistance1(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

function classifySyntax(msg: string): ErrorKind {
  const m = msg.toLowerCase();
  if (m.includes("missing parentheses in call to 'print'")) return "print";
  if (m.includes("expected ':'")) return "colon";
  if (m.includes("maybe you meant '==' ") || m.includes("instead of '='") || (m.includes("cannot assign to") && m.includes("'=='")))
    return "assign";
  if (m.includes("was never closed") || m.includes("unmatched") || m.includes("does not match opening parenthesis")) return "paren";
  if (m.includes("unterminated string") || m.includes("unterminated triple-quoted") || m.includes("eol while scanning")) return "quote";
  if (m.includes("invalid character") || m.includes("invalid non-printable")) return "char";
  return "syntax";
}

/** Разбирает ошибку Python: вид и параметры для текста. */
export function classifyError(err: PyError): Classified {
  const msg = err.message ?? "";
  switch (err.type) {
    case "SyntaxError":
      return { kind: classifySyntax(msg), params: {} };
    case "IndentationError":
    case "TabError": {
      const m = msg.toLowerCase();
      if (err.type === "TabError" || m.includes("unindent does not match") || m.includes("inconsistent")) return { kind: "indentMismatch", params: {} };
      if (m.includes("expected an indented block")) return { kind: "indentExpected", params: {} };
      if (m.includes("unexpected indent")) return { kind: "indentUnexpected", params: {} };
      return { kind: "indentMismatch", params: {} };
    }
    case "NameError":
    case "UnboundLocalError": {
      const name = /'([^']+)'/.exec(msg)?.[1] ?? "?";
      const hinted = /did you mean:? '([^']+)'/i.exec(msg)?.[1];
      const suggest = hinted ?? suggestName(name);
      return { kind: "name", params: suggest ? { name, suggest } : { name } };
    }
    case "TypeError": {
      const mixed = /\bstr\b/.test(msg) && /\b(int|float)\b/.test(msg);
      return { kind: mixed ? "mix" : "type", params: {} };
    }
    case "ZeroDivisionError":
      return { kind: "zero", params: {} };
    case "IndexError":
      return { kind: "index", params: {} };
    case "ValueError": {
      const m = /invalid literal for int\(\) with base \d+: (.*)$/.exec(msg) ?? /could not convert string to float: (.*)$/.exec(msg);
      return m ? { kind: "notNumber", params: { value: quoted(m[1].trim()) } } : { kind: "value", params: {} };
    }
    case "EOFError":
      return { kind: "eof", params: {} };
    case "RecursionError":
      return { kind: "recursion", params: {} };
    case "KeyError":
      return { kind: "key", params: { value: msg || "?" } };
    case "AttributeError":
      return { kind: "attr", params: {} };
    case "Timeout":
      return { kind: "timeout", params: {} };
    case "TooManySteps":
      return { kind: "steps", params: {} };
    case "LoadError":
      return { kind: "load", params: {} };
    default:
      return { kind: "generic", params: { type: err.type } };
  }
}

type PyKey = keyof typeof pythonDict;

/** Объяснение ошибки на языке ученика: заголовок, подсказка, номер строки. */
export function explainError(err: PyError, lang: Lang): ErrorExplanation {
  const { kind, params } = classifyError(err);
  const text = (key: PyKey) => fmt(pythonDict[key][lang], params);
  let hint = text(`python.err.${kind}.hint`);
  if (kind === "name" && params.suggest) hint += " " + text("python.err.name.suggest");
  return { kind, title: text(`python.err.${kind}.title`), hint, line: err.line ?? null };
}
