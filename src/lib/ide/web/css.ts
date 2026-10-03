// Разбор CSS из <style> для проверки задач HTML/CSS (docs/specs/ide.md, I3).
// Чистая логика без DOM: селектор → свойства, без учёта регистра и лишних пробелов.
// Цвета сравниваются по смыслу: red = #f00 = #ff0000 = rgb(255, 0, 0).

/** Таблица разобранных правил: нормализованный селектор → свойства (последнее объявление побеждает). */
export type CssSheet = Map<string, Record<string, string>>;

/** Текст всех блоков <style> документа (склеен через перевод строки). */
export function extractStyleText(html: string): string {
  const parts: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) parts.push(m[1]);
  return parts.join("\n");
}

/** Селектор в канонический вид: нижний регистр, один пробел, комбинаторы « > », « + », « ~ », запятая без пробела перед ней. */
export function normalizeSelector(raw: string): string {
  let out = "";
  let depth = 0; // внутри [...] и (...) ничего не трогаем
  for (const ch of raw.trim().toLowerCase()) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ">" || ch === "+" || ch === "~")) out += ` ${ch} `;
    else if (depth === 0 && ch === ",") out += ", ";
    else out += ch;
  }
  return out.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

/** Значение свойства: нижний регистр, без !important, без пробелов после запятых и по краям скобок. */
export function normalizeValue(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/!\s*important/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/;+\s*$/, "")
    .trim();
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  lime: "#00ff00",
  navy: "#000080",
  teal: "#008080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  gold: "#ffd700",
  lightblue: "#add8e6",
  lightgreen: "#90ee90",
  lightyellow: "#ffffe0",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkblue: "#00008b",
  darkgreen: "#006400",
  darkred: "#8b0000",
  skyblue: "#87ceeb",
};

/** Цвет в единый вид «#rrggbb» (имя, #rgb, rgb(r,g,b)); всё остальное возвращается как есть. */
export function colorKey(value: string): string {
  const v = normalizeValue(value);
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  m = /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/.exec(v);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0"));
    return `#${hex.join("")}`;
  }
  return v;
}

/** Значения равны (с учётом цветов). */
export const sameCssValue = (a: string, b: string) => colorKey(a) === colorKey(b);

/** Объявления «свойство: значение; …» → объект. Точка с запятой внутри скобок/кавычек (url(data:…)) не разделяет. */
function parseDeclarations(body: string): Record<string, string> {
  const props: Record<string, string> = Object.create(null);
  const decls: string[] = [];
  let cur = "";
  let depth = 0;
  let quote = "";
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0 && !quote) {
      decls.push(cur);
      cur = "";
    } else cur += ch;
  }
  decls.push(cur);
  for (const d of decls) {
    const i = d.indexOf(":");
    if (i < 1) continue;
    const name = d.slice(0, i).trim().toLowerCase();
    const value = normalizeValue(d.slice(i + 1));
    if (/^-?[a-z_][a-z0-9_-]*$/.test(name) && value) props[name] = value;
  }
  return props;
}

const GROUP_AT_RULES = /^@(media|supports|layer|container|document)\b/i;

/** Разбор текста CSS в таблицу правил. Вложенные @media/@supports разворачиваются, @keyframes/@font-face пропускаются. */
export function parseCss(css: string, sheet: CssSheet = new Map()): CssSheet {
  const text = css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open === -1) break;
    // at-правило без блока («@import …;») — пропускаем до «;»
    if (semi !== -1 && semi < open && text.slice(i, semi).trimStart().startsWith("@")) {
      i = semi + 1;
      continue;
    }
    const prelude = text.slice(i, open).trim();
    // парная закрывающая скобка (учёт вложенности и кавычек)
    let depth = 1;
    let j = open + 1;
    let quote = "";
    for (; j < text.length && depth > 0; j++) {
      const ch = text[j];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    const body = text.slice(open + 1, depth === 0 ? j - 1 : j);
    i = j;
    if (prelude.startsWith("@")) {
      if (GROUP_AT_RULES.test(prelude)) parseCss(body, sheet);
      continue;
    }
    const props = parseDeclarations(body);
    for (const sel of prelude.split(",")) {
      const key = normalizeSelector(sel);
      if (!key) continue;
      const target = sheet.get(key) ?? Object.create(null);
      Object.assign(target, props);
      sheet.set(key, target);
    }
  }
  return sheet;
}

/** Сокращённые записи: если нет «background-color», смотрим значение внутри «background». */
const SHORTHAND: Record<string, string> = { "background-color": "background", "border-color": "border", "outline-color": "outline" };

/** Разбить значение на части по пробелам вне скобок («1px solid rgb(0, 0, 0)»). */
function splitTokens(v: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of v) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === " " && depth === 0) {
      if (cur) tokens.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** Есть ли в таблице правило для селектора со свойством (и значением, если equals задано). */
export function hasCssRule(sheet: CssSheet, selector: string, property: string, equals?: string): boolean {
  const props = sheet.get(normalizeSelector(selector));
  if (!props) return false;
  const name = property.trim().toLowerCase();
  const direct = props[name];
  if (direct !== undefined) return equals === undefined || sameCssValue(direct, equals);
  const short = SHORTHAND[name];
  if (short && props[short] !== undefined) return equals === undefined || splitTokens(props[short]).some((tok) => sameCssValue(tok, equals));
  return false;
}

/** Удобная обёртка: CSS из <style> документа ученика. */
export function sheetFromHtml(html: string): CssSheet {
  return parseCss(extractStyleText(html));
}
