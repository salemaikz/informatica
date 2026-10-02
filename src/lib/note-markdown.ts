// Разметка конспектов: маркер ==текст== с цветами, ссылки на картинки note-img:, чек-листы и правки текста
// для панели оформления. Чистая логика без React — покрыта tests/note-markdown.test.ts.

/** Цвета маркера: жёлтый — по умолчанию (==текст==), остальные — =={g}текст==. */
export const MARK_COLORS = ["y", "g", "b", "p"] as const;
export type MarkColor = (typeof MARK_COLORS)[number];

export const NOTE_IMG_PREFIX = "note-img:";

// ---------- Ссылки на картинки ----------

const IMG_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** id картинки из адреса `note-img:<id>`; null — не наш адрес или id некорректный. */
export function noteImageId(src: string | undefined | null): string | null {
  if (typeof src !== "string" || !src.startsWith(NOTE_IMG_PREFIX)) return null;
  const id = src.slice(NOTE_IMG_PREFIX.length);
  return IMG_ID_RE.test(id) ? id : null;
}

/** Все id картинок, на которые ссылается текст. */
export function imageIds(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\(note-img:([A-Za-z0-9_-]{4,64})\)/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

// ---------- Маркер ==текст== (remark-плагин) ----------

/** Минимальный вид узла mdast — чтобы не тянуть типы и `unist-util-visit`. */
export interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  [key: string]: unknown;
}

// Разделитель: `==` или `=={g}`; не часть `===`.
const DELIM_RE = /(?<!=)==(?:\{([ygbp])\})?(?!=)/g;

type Tok =
  | { k: "node"; node: MdNode }
  | { k: "text"; value: string }
  | { k: "delim"; raw: string; color: MarkColor; colored: boolean; openOk: boolean; closeOk: boolean };

function tokenize(children: MdNode[]): Tok[] {
  const toks: Tok[] = [];
  children.forEach((node, idx) => {
    if (node.type !== "text" || typeof node.value !== "string" || !node.value.includes("==")) {
      toks.push({ k: "node", node });
      return;
    }
    const v = node.value;
    let last = 0;
    for (const m of v.matchAll(DELIM_RE)) {
      const at = m.index;
      if (at > last) toks.push({ k: "text", value: v.slice(last, at) });
      const end = at + m[0].length;
      const before = at > 0 ? v[at - 1] : undefined;
      const after = end < v.length ? v[end] : undefined;
      toks.push({
        k: "delim",
        raw: m[0],
        color: (m[1] as MarkColor | undefined) ?? "y",
        colored: !!m[1],
        // Открывающий: после него не пробел (или он в конце узла, а дальше — другой узел: **жирный**).
        openOk: after !== undefined ? !/\s/.test(after) : idx < children.length - 1,
        // Закрывающий: перед ним не пробел (или он в начале узла, а раньше — другой узел).
        closeOk: before !== undefined ? !/\s/.test(before) : idx > 0,
      });
      last = end;
    }
    if (last < v.length) toks.push({ k: "text", value: v.slice(last) });
  });
  return toks;
}

/** Склеивает соседние дети в маркер: ищет пары разделителей на одном уровне (внутри абзаца). */
export function applyMarkers(children: MdNode[]): MdNode[] {
  if (!children.some((c) => c.type === "text" && typeof c.value === "string" && c.value.includes("=="))) return children;
  const toks = tokenize(children);
  const out: MdNode[] = [];
  const pushText = (target: MdNode[], value: string) => {
    if (!value) return;
    const prev = target[target.length - 1];
    if (prev && prev.type === "text" && typeof prev.value === "string") prev.value += value;
    else target.push({ type: "text", value });
  };
  const toNode = (t: Tok): MdNode | string => (t.k === "node" ? t.node : t.k === "text" ? t.value : t.raw);

  let open: { color: MarkColor; raw: string; inner: MdNode[] } | null = null;
  const add = (t: Tok) => {
    const target = open ? open.inner : out;
    const n = toNode(t);
    if (typeof n === "string") pushText(target, n);
    else target.push(n);
  };
  for (const t of toks) {
    if (t.k !== "delim") {
      add(t);
      continue;
    }
    if (open) {
      const hasContent = open.inner.some((n) => n.type !== "text" || (n.value ?? "").trim() !== "");
      if (t.closeOk && !t.colored && hasContent) {
        out.push({
          type: "noteMark",
          data: { hName: "mark", hProperties: { dataColor: open.color } },
          children: open.inner,
        });
        open = null;
        continue;
      }
      // Не закрывает: прежний открывающий становится обычным текстом.
      pushText(out, open.raw);
      for (const n of open.inner) {
        if (n.type === "text") pushText(out, n.value ?? "");
        else out.push(n);
      }
      open = null;
    }
    if (t.openOk) open = { color: t.color, raw: t.raw, inner: [] };
    else pushText(out, t.raw);
  }
  if (open) {
    pushText(out, open.raw);
    for (const n of open.inner) {
      if (n.type === "text") pushText(out, n.value ?? "");
      else out.push(n);
    }
  }
  return out;
}

function walk(node: MdNode) {
  if (!Array.isArray(node.children)) return;
  node.children.forEach(walk);
  // Код и HTML — листья (у них value, а не children), поэтому `==` внутри них не трогаем.
  node.children = applyMarkers(node.children);
}

/** remark-плагин: `==текст==` → узел noteMark → `<mark data-color>`. Сырой HTML не появляется. */
export function remarkNoteMark() {
  return (tree: MdNode) => {
    walk(tree);
  };
}

// ---------- Чек-листы ----------

/**
 * Переключает `[ ]` ↔ `[x]` у пункта списка, который начинается в тексте на позиции offset
 * (позиция узла listItem из mdast). null — это не чек-лист.
 */
export function toggleTaskAt(source: string, offset: number): string | null {
  if (!Number.isInteger(offset) || offset < 0 || offset >= source.length) return null;
  const head = source.slice(offset, offset + 24);
  const m = head.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/);
  if (!m) return null;
  const pos = offset + m[1].length;
  return source.slice(0, pos) + (m[2] === " " ? "x" : " ") + source.slice(pos + 1);
}

/** Сколько пунктов чек-листов выполнено: [выполнено, всего]. */
export function taskProgress(body: string): [number, number] {
  let done = 0;
  let total = 0;
  for (const m of body.matchAll(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[( |x|X)\]/gm)) {
    total++;
    if (m[1] !== " ") done++;
  }
  return [done, total];
}

// ---------- Правки текста для панели оформления ----------

export interface Edit {
  value: string;
  /** Выделение после правки. */
  start: number;
  end: number;
}

/** Заменяет выделение текстом, курсор — после вставки. */
export function insertText(value: string, start: number, end: number, text: string): Edit {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(value.length, Math.max(start, end));
  const next = value.slice(0, s) + text + value.slice(e);
  const pos = s + text.length;
  return { value: next, start: pos, end: pos };
}

/**
 * Оборачивает выделение в before/after (жирный, маркер, код); если уже обёрнуто — снимает.
 * Без выделения вставляет placeholder и выделяет его — удобно сразу печатать.
 */
export function wrapSelection(value: string, start: number, end: number, before: string, after: string, placeholder = ""): Edit {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(value.length, Math.max(start, end));
  const sel = value.slice(s, e);
  // Уже обёрнуто снаружи выделения: ...**[текст]**...
  if (s >= before.length && value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
    return {
      value: value.slice(0, s - before.length) + sel + value.slice(e + after.length),
      start: s - before.length,
      end: e - before.length,
    };
  }
  // Выделение вместе с обрамлением: [**текст**].
  if (sel.length >= before.length + after.length && sel.startsWith(before) && sel.endsWith(after)) {
    const inner = sel.slice(before.length, sel.length - after.length);
    return { value: value.slice(0, s) + inner + value.slice(e), start: s, end: s + inner.length };
  }
  const text = sel || placeholder;
  const next = value.slice(0, s) + before + text + after + value.slice(e);
  return { value: next, start: s + before.length, end: s + before.length + text.length };
}

export function markSyntax(color: MarkColor): [string, string] {
  return color === "y" ? ["==", "=="] : [`=={${color}}`, "=="];
}

export type LineKind = "h2" | "ul" | "ol" | "todo" | "quote";

const LINE_RE: Record<LineKind, RegExp> = {
  h2: /^## /,
  ul: /^[-*+] (?!\[[ xX]\] )/,
  ol: /^\d+\. /,
  todo: /^[-*+] \[[ xX]\] /,
  quote: /^> /,
};
const ANY_PREFIX_RE = /^(?:#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+\. |> )/;

/** Добавляет/снимает префикс у всех строк, затронутых выделением (заголовок, список, чек-лист, цитата). */
export function prefixLines(value: string, start: number, end: number, kind: LineKind): Edit {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(value.length, Math.max(start, end));
  const from = value.lastIndexOf("\n", s - 1) + 1;
  let to = value.indexOf("\n", e);
  if (to === -1) to = value.length;
  const lines = value.slice(from, to).split("\n");
  const filled = lines.filter((l) => l.trim() !== "");
  const allHave = filled.length > 0 && filled.every((l) => LINE_RE[kind].test(l));
  let n = 0;
  const next = lines.map((l) => {
    if (l.trim() === "" && lines.length > 1) return l;
    if (allHave) return l.replace(LINE_RE[kind], "");
    const bare = l.replace(ANY_PREFIX_RE, "");
    n++;
    const p = kind === "h2" ? "## " : kind === "ul" ? "- " : kind === "ol" ? `${n}. ` : kind === "todo" ? "- [ ] " : "> ";
    return p + bare;
  });
  const block = next.join("\n");
  const out = value.slice(0, from) + block + value.slice(to);
  // Один непустой, пустой — курсор в конец строки; несколько — выделяем весь блок.
  return lines.length === 1 ? { value: out, start: from + block.length, end: from + block.length } : { value: out, start: from, end: from + block.length };
}

/** Вставляет блок (картинку, блок кода) на отдельных строках. */
export function insertBlock(value: string, pos: number, block: string): Edit & { at: number } {
  const p = Math.max(0, Math.min(pos, value.length));
  const before = value.slice(0, p);
  const after = value.slice(p);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after === "" ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const text = lead + block + tail;
  const caret = before.length + lead.length + block.length + (tail === "" ? 0 : tail.length);
  return { value: before + text + after, start: caret, end: caret, at: before.length + lead.length };
}

/** Блок кода из выделения (или пустой блок, курсор внутри). */
export function codeBlock(value: string, start: number, end: number): Edit {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const sel = value.slice(s, e);
  if (!sel) {
    const r = insertBlock(value, s, "```\n\n```");
    // Курсор — на пустую строку внутри ограды.
    return { value: r.value, start: r.at + 4, end: r.at + 4 };
  }
  return insertText(value, s, e, "```\n" + sel + "\n```");
}

/** Короткий сниппет записи для карточки: текст без разметки, одной строкой. */
export function noteSnippet(body: string, max = 120): string {
  const text = body
    .split("\n")
    .map((l) =>
      l
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/^\s*(```.*|#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/, "")
        .replace(/==(\{[ygbp]\})?/g, "")
        .replace(/[*_`~]/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Запись без текста, заголовка и картинок (осталась от нажатия «+ Запись» без ввода). */
export function isEmptyNote(n: { title: string; body: string; images?: string[] }): boolean {
  return n.title.trim() === "" && n.body.trim() === "" && !n.images?.length;
}
