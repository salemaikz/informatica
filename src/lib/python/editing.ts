// Правки редактора кода (чистая логика): Tab/Shift+Tab, автоотступ после Enter, Backspace по отступу.
// Правка = заменить текст [start, end) на text, после чего выделение — [selStart, selEnd].

export const INDENT = "    ";

export interface Edit {
  start: number;
  end: number;
  text: string;
  selStart: number;
  selEnd: number;
}

/** Применяет правку к строке (для тестов и запасного пути без execCommand). */
export function applyEdit(value: string, e: Edit): string {
  return value.slice(0, e.start) + e.text + value.slice(e.end);
}

const lineStart = (v: string, pos: number) => v.lastIndexOf("\n", pos - 1) + 1;
function lineEnd(v: string, pos: number) {
  const i = v.indexOf("\n", pos);
  return i === -1 ? v.length : i;
}
const leading = (line: string) => /^[ \t]*/.exec(line)![0];

/** Сколько пробелов убрать в начале строки при «Убрать отступ» (до 4, табуляция — целиком). */
function dedentCount(line: string): number {
  if (line.startsWith("\t")) return 1;
  let n = 0;
  while (n < INDENT.length && line[n] === " ") n++;
  return n;
}

/**
 * Tab / Shift+Tab. Без выделения Tab вставляет 4 пробела; с выделением в несколько строк (или Shift) —
 * сдвигает все затронутые строки.
 */
export function tabEdit(value: string, selStart: number, selEnd: number, shift: boolean): Edit {
  const multi = value.slice(selStart, selEnd).includes("\n");
  if (!shift && !multi) {
    return { start: selStart, end: selEnd, text: INDENT, selStart: selStart + INDENT.length, selEnd: selStart + INDENT.length };
  }
  const from = lineStart(value, selStart);
  // Выделение, кончающееся в начале строки, эту строку не захватывает.
  const endPos = selEnd > selStart && value[selEnd - 1] === "\n" ? selEnd - 1 : selEnd;
  const to = lineEnd(value, endPos);
  const lines = value.slice(from, to).split("\n");
  let firstDelta = 0;
  let total = 0;
  const out = lines.map((line, i) => {
    let delta: number;
    let next: string;
    if (shift) {
      const n = dedentCount(line);
      next = line.slice(n);
      delta = -n;
    } else {
      next = line.length === 0 ? line : INDENT + line;
      delta = next.length - line.length;
    }
    if (i === 0) firstDelta = delta;
    total += delta;
    return next;
  });
  const text = out.join("\n");
  const col = selStart - from;
  // Курсор не уезжает левее начала строки при снятии отступа.
  const newSelStart = Math.max(from, selStart + (shift ? Math.max(firstDelta, -col) : firstDelta));
  const newSelEnd = selEnd === selStart ? newSelStart : Math.max(newSelStart, selEnd + total);
  return { start: from, end: to, text, selStart: newSelStart, selEnd: newSelEnd };
}

const DEDENT_AFTER = /^(return|pass|break|continue|raise)\b/;

/** Enter: перенос строки с тем же отступом; после «:» — на 4 пробела глубже, после return/pass/break — мельче. */
export function enterEdit(value: string, selStart: number, selEnd: number): Edit {
  const from = lineStart(value, selStart);
  const before = value.slice(from, selStart);
  let indent = leading(before);
  const code = before.replace(/\s+$/, "");
  if (code.endsWith(":")) indent += INDENT;
  else if (DEDENT_AFTER.test(code.trimStart())) indent = indent.slice(0, Math.max(0, indent.length - INDENT.length));
  const text = "\n" + indent;
  const pos = selStart + text.length;
  return { start: selStart, end: selEnd, text, selStart: pos, selEnd: pos };
}

/** Backspace в отступе (слева от курсора только пробелы): удаляет до предыдущей ступени в 4 пробела. Иначе null. */
export function backspaceEdit(value: string, selStart: number, selEnd: number): Edit | null {
  if (selStart !== selEnd) return null;
  const from = lineStart(value, selStart);
  const col = selStart - from;
  if (col === 0) return null;
  const before = value.slice(from, selStart);
  if (!/^ +$/.test(before)) return null;
  const n = ((col - 1) % INDENT.length) + 1;
  return { start: selStart - n, end: selStart, text: "", selStart: selStart - n, selEnd: selStart - n };
}

/** Позиция начала строки с номером line (с 1) — чтобы показать строку с ошибкой. */
export function lineOffset(value: string, line: number): { start: number; end: number } {
  let start = 0;
  for (let i = 1; i < line; i++) {
    const nl = value.indexOf("\n", start);
    if (nl === -1) break;
    start = nl + 1;
  }
  return { start, end: lineEnd(value, start) };
}
