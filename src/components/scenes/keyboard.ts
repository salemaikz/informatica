// Чистая логика сцены keyboard: раскладка упрощённой клавиатуры, разбор названий клавиш и подпись сочетания.

export interface KeyDef {
  /** Уникальный id клавиши в раскладке. */
  id: string;
  /** Каноническое имя для сопоставления с `scene.keys` (у правых Ctrl/Alt/Shift совпадает с левыми). */
  norm: string;
  /** Подпись на клавише (латиница, как на настоящей клавиатуре); у пробела пусто — подпись из словаря. */
  label: string;
  /** Мелкая русская буква на букве клавиши. */
  sub?: string;
  /** Ширина в единицах клавиши (1 = обычная буква). */
  w: number;
  /** Позиция слева в единицах. */
  x: number;
  /** Дубликат (правый Ctrl/Alt/Shift): сам не подсвечивается — подсвечивается левый. */
  dup?: boolean;
}

export interface KeyRow {
  /** Верхний ряд F1–F12 ниже обычного. */
  small?: boolean;
  keys: KeyDef[];
}

/** Ширина клавиатуры в единицах. */
export const KB_UNITS = 15;

type Spec = [label: string, w: number] | [label: string, w: number, sub: string];

/** Собирает ряд: клавиши идут подряд; null-пропуск — `{gap: ширина}`. */
function row(specs: (Spec | { gap: number })[], opts: { small?: boolean } = {}): KeyRow {
  const keys: KeyDef[] = [];
  let x = 0;
  const seen = new Map<string, number>();
  for (const s of specs) {
    if (!Array.isArray(s)) {
      x += s.gap;
      continue;
    }
    const [label, w, sub] = s;
    const norm = label.toLowerCase();
    const n = (seen.get(norm) ?? 0) + 1;
    seen.set(norm, n);
    keys.push({ id: n === 1 ? norm : `${norm}-${n}`, norm, label, sub, w, x, dup: n > 1 ? true : undefined });
    x += w;
  }
  return { small: opts.small, keys };
}

const letters = (latin: string, cyr: string): Spec[] => [...latin].map((c, i) => [c, 1, cyr[i]] as Spec);

/** Раскладка: 6 рядов по 15 единиц (последний ряд — со стрелками). */
export const KEY_ROWS: KeyRow[] = [
  row([["Esc", 1.5], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 1] as Spec), ["Del", 1.5]], { small: true }),
  row([["`", 1, "Ё"], ...([..."1234567890"].map((c) => [c, 1] as Spec)), ["-", 1], ["=", 1], ["Backspace", 2]]),
  row([["Tab", 1.5], ...letters("QWERTYUIOP", "ЙЦУКЕНГШЩЗ"), ["[", 1, "Х"], ["]", 1, "Ъ"], ["\\", 1.5]]),
  row([["Caps", 1.75], ...letters("ASDFGHJKL", "ФЫВАПРОЛД"), [";", 1, "Ж"], ["'", 1, "Э"], ["Enter", 2.25]]),
  // Ряд Shift: после правого Shift (x = 13) — стрелка вверх, над стрелкой вниз.
  row([["Shift", 2.25], ...letters("ZXCVBNM", "ЯЧСМИТЬ"), [",", 1, "Б"], [".", 1, "Ю"], ["Shift", 1.75], ["↑", 1]]),
  row([["Ctrl", 1.5], ["Win", 1.25], ["Alt", 1.25], ["Space", 5], ["Alt", 1.25], ["Ctrl", 1.75], ["←", 1], ["↓", 1], ["→", 1]]),
];

/** Кириллица → клавиша латиницы по раскладке ЙЦУКЕН (чтобы «С» в данных подсветила клавишу C). */
const CYR_TO_LAT: Record<string, string> = Object.fromEntries(
  KEY_ROWS.flatMap((r) => r.keys.filter((k) => k.sub && /^[a-z]$/i.test(k.label)).map((k) => [k.sub!.toLowerCase(), k.label.toLowerCase()])),
);

const ALIASES: Record<string, string> = {
  control: "ctrl",
  ctl: "ctrl",
  windows: "win",
  "⊞": "win",
  super: "win",
  meta: "win",
  delete: "del",
  escape: "esc",
  return: "enter",
  "↵": "enter",
  пробел: "space",
  "бос орын": "space",
  spacebar: "space",
  "␣": "space",
  bksp: "backspace",
  "⌫": "backspace",
  capslock: "caps",
  "caps lock": "caps",
  left: "←",
  arrowleft: "←",
  up: "↑",
  arrowup: "↑",
  right: "→",
  arrowright: "→",
  down: "↓",
  arrowdown: "↓",
};

/** Каноническое имя клавиши: регистр и синонимы не важны («Control» = «ctrl», «Пробел» = «space», «с» = «c»). */
export function canonical(key: string): string {
  const s = key.trim().toLowerCase();
  const alias = ALIASES[s];
  if (alias) return alias;
  return CYR_TO_LAT[s] ?? s;
}

/** Id клавиш раскладки, которые нужно подсветить (правые Ctrl/Alt/Shift не подсвечиваем — у них есть левые). */
export function litKeyIds(keys: string[]): Set<string> {
  const want = new Set(keys.map(canonical));
  const ids = new Set<string>();
  for (const r of KEY_ROWS) for (const k of r.keys) if (!k.dup && want.has(k.norm)) ids.add(k.id);
  return ids;
}

/** Как показать клавишу в сочетании под клавиатурой: «Ctrl», «C», «Space» → подпись пробела, F5, стрелки как есть. */
export function keyCaption(key: string, spaceLabel: string): string {
  const c = canonical(key);
  if (c === "space") return spaceLabel;
  if (c === "esc") return "Esc";
  if (c === "del") return "Del";
  if (c === "win") return "Win";
  if (c === "caps") return "Caps Lock";
  if (c === "backspace") return "Backspace";
  if (c === "ctrl" || c === "alt" || c === "shift" || c === "tab" || c === "enter") return c[0].toUpperCase() + c.slice(1);
  if (/^f\d{1,2}$/.test(c)) return c.toUpperCase();
  if (["←", "↑", "→", "↓"].includes(c)) return c;
  return c.length === 1 ? c.toUpperCase() : key.trim();
}

/** Сочетание строкой: «Ctrl + C». */
export function comboText(keys: string[], spaceLabel: string): string {
  return keys.map((k) => keyCaption(k, spaceLabel)).join(" + ");
}
