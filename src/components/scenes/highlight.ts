// Простая подсветка синтаксиса без библиотек: разбор одной строки кода на токены.
// Чистая логика (без React): конкатенация текстов токенов всегда равна исходной строке.

export type CodeLang = "python" | "sql" | "html" | "css" | "text";

export type TokenType = "plain" | "keyword" | "string" | "number" | "comment";

export interface Token {
  text: string;
  type: TokenType;
}

const PY_KEYWORDS = new Set(
  "def if elif else for while in range return print input and or not True False None break continue import from as with open".split(" "),
);

const SQL_KEYWORDS = new Set(
  (
    "SELECT FROM WHERE AND OR NOT BETWEEN IN LIKE ORDER BY ASC DESC INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE " +
    "PRIMARY KEY COUNT SUM AVG MIN MAX GROUP DISTINCT AS"
  ).split(" "),
);

/** Токены токенайзеров склеиваются: соседние куски одного типа объединяются. */
function push(out: Token[], text: string, type: TokenType) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === type) last.text += text;
  else out.push({ text, type });
}

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isIdentStart = (ch: string) => /[A-Za-z_Ѐ-ӿ]/.test(ch);
const isIdentPart = (ch: string) => /[A-Za-z0-9_Ѐ-ӿ]/.test(ch);

/** Конец строкового литерала, начинающегося в позиции i (кавычка q). Незакрытая строка — до конца. */
function stringEnd(line: string, i: number, escapes: boolean): number {
  const q = line[i];
  let j = i + 1;
  while (j < line.length) {
    if (escapes && line[j] === "\\") {
      j += 2;
      continue;
    }
    if (line[j] === q) {
      // SQL: '' внутри строки — экранированная кавычка.
      if (!escapes && line[j + 1] === q) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j++;
  }
  return line.length;
}

/** Число, начинающееся в позиции i: целое или десятичное (1, 3.14). */
function numberEnd(line: string, i: number): number {
  let j = i;
  while (j < line.length && isDigit(line[j])) j++;
  if (line[j] === "." && isDigit(line[j + 1] ?? "")) {
    j++;
    while (j < line.length && isDigit(line[j])) j++;
  }
  return j;
}

function tokenizePython(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#") {
      push(out, line.slice(i), "comment");
      break;
    }
    if (ch === '"' || ch === "'") {
      const end = stringEnd(line, i, true);
      push(out, line.slice(i, end), "string");
      i = end;
      continue;
    }
    if (isDigit(ch)) {
      const end = numberEnd(line, i);
      push(out, line.slice(i, end), "number");
      i = end;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < line.length && isIdentPart(line[j])) j++;
      const word = line.slice(i, j);
      // Префикс строки: f"..", r'..', b".."
      if (/^[fFrRbB]{1,2}$/.test(word) && (line[j] === '"' || line[j] === "'")) {
        const end = stringEnd(line, j, true);
        push(out, line.slice(i, end), "string");
        i = end;
        continue;
      }
      push(out, word, PY_KEYWORDS.has(word) ? "keyword" : "plain");
      i = j;
      continue;
    }
    push(out, ch, "plain");
    i++;
  }
  return out;
}

function tokenizeSql(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "-" && line[i + 1] === "-") {
      push(out, line.slice(i), "comment");
      break;
    }
    if (ch === "'" || ch === '"') {
      const end = stringEnd(line, i, false);
      push(out, line.slice(i, end), "string");
      i = end;
      continue;
    }
    if (isDigit(ch)) {
      const end = numberEnd(line, i);
      push(out, line.slice(i, end), "number");
      i = end;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < line.length && isIdentPart(line[j])) j++;
      const word = line.slice(i, j);
      push(out, word, SQL_KEYWORDS.has(word.toUpperCase()) ? "keyword" : "plain");
      i = j;
      continue;
    }
    push(out, ch, "plain");
    i++;
  }
  return out;
}

/** HTML: теги (и их скобки) — keyword, значения атрибутов — string, комментарии — comment. Имена атрибутов — обычный текст. */
function tokenizeHtml(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let inTag = false;
  while (i < line.length) {
    if (!inTag) {
      if (line.startsWith("<!--", i)) {
        const close = line.indexOf("-->", i + 4);
        const end = close === -1 ? line.length : close + 3;
        push(out, line.slice(i, end), "comment");
        i = end;
        continue;
      }
      const m = /^<\/?[A-Za-z!][\w:-]*/.exec(line.slice(i));
      if (m) {
        push(out, m[0], "keyword");
        i += m[0].length;
        inTag = true;
        continue;
      }
      push(out, line[i], "plain");
      i++;
      continue;
    }
    const ch = line[i];
    if (ch === ">" || (ch === "/" && line[i + 1] === ">")) {
      const len = ch === ">" ? 1 : 2;
      push(out, line.slice(i, i + len), "keyword");
      i += len;
      inTag = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = stringEnd(line, i, false);
      push(out, line.slice(i, end), "string");
      i = end;
      continue;
    }
    push(out, ch, "plain");
    i++;
  }
  return out;
}

/** CSS: свойства — keyword, числа/цвета — number, строки — string, комментарии — comment. */
function tokenizeCss(line: string): Token[] {
  const out: Token[] = [];
  const braceLine = line.includes("{");
  let seenBrace = false;
  let atStart = true; // первый токен в «объявлении»
  let inValue = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "/" && line[i + 1] === "*") {
      const close = line.indexOf("*/", i + 2);
      const end = close === -1 ? line.length : close + 2;
      push(out, line.slice(i, end), "comment");
      i = end;
      continue;
    }
    if (ch === "{") {
      seenBrace = true;
      atStart = true;
      inValue = false;
      push(out, ch, "plain");
      i++;
      continue;
    }
    if (ch === ";" || ch === "}") {
      atStart = true;
      inValue = false;
      push(out, ch, "plain");
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      push(out, ch, "plain");
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = stringEnd(line, i, true);
      push(out, line.slice(i, end), "string");
      i = end;
      atStart = false;
      continue;
    }
    if (inValue) {
      const m = /^(#[0-9a-fA-F]{3,8}\b|-?\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg|fr)?)/.exec(line.slice(i));
      if (m) {
        push(out, m[0], "number");
        i += m[0].length;
        continue;
      }
      push(out, ch, "plain");
      i++;
      continue;
    }
    if (isIdentStart(ch) || ch === "-") {
      let j = i + 1;
      while (j < line.length && (isIdentPart(line[j]) || line[j] === "-")) j++;
      const word = line.slice(i, j);
      let k = j;
      while (line[k] === " ") k++;
      const property = line[k] === ":" && (seenBrace || (atStart && !braceLine));
      if (property) {
        push(out, word, "keyword");
        push(out, line.slice(j, k + 1), "plain");
        i = k + 1;
        inValue = true;
      } else {
        push(out, word, "plain");
        i = j;
      }
      atStart = false;
      continue;
    }
    push(out, ch, "plain");
    i++;
    atStart = false;
  }
  return out;
}

/** Разбор одной строки кода на токены (подсветка без библиотек). Для `text` — один обычный токен. */
export function tokenizeLine(line: string, lang: CodeLang = "text"): Token[] {
  if (line === "") return [];
  switch (lang) {
    case "python":
      return tokenizePython(line);
    case "sql":
      return tokenizeSql(line);
    case "html":
      return tokenizeHtml(line);
    case "css":
      return tokenizeCss(line);
    default:
      return [{ text: line, type: "plain" }];
  }
}

/** Класс цвета токена — токены темы (светлая и тёмная); ink-*, потому что строки кода подсвечивают -soft-заливкой (ревью v18b: warning-strong на warning-soft был ≈ 2,7:1). */
export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "",
  keyword: "text-ink-primary",
  string: "text-ink-success",
  number: "text-ink-warning",
  comment: "text-muted",
};
