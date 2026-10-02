// Логика инструментов: системы счисления с шагами, единицы информации, обычный калькулятор.
// Чистые функции без React — покрыты тестами в tests/calc.test.ts.

import type { L } from "./types";

// ---------- Системы счисления ----------

export type Base = 2 | 8 | 10 | 16;
export const BASES: Base[] = [2, 8, 10, 16];

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const DIGITS = "0123456789ABCDEF";

/** Нижний индекс основания: 2 → "₂", 16 → "₁₆". */
export function subscript(base: number): string {
  return String(base).replace(/\d/g, (d) => SUB[Number(d)]);
}

/** Верхний индекс (степень): 10 → "¹⁰". */
export function superscript(n: number): string {
  return String(n).replace(/\d/g, (d) => SUP[Number(d)]);
}

function digitValue(ch: string): number {
  return DIGITS.indexOf(ch.toUpperCase());
}

const strip = (s: string) => s.replace(/\s+/g, "");
const stripZeros = (s: string) => s.replace(/^0+(?=.)/, "");

/** Проверяет, что все цифры допустимы в системе. Регистр и пробелы не важны; пустая строка → ok:false, digit "". */
export function checkDigits(value: string, base: Base): { ok: true } | { ok: false; digit: string } {
  const s = strip(value);
  if (!s) return { ok: false, digit: "" };
  for (const ch of s) {
    const v = digitValue(ch);
    if (v < 0 || v >= base) return { ok: false, digit: ch.toUpperCase() };
  }
  return { ok: true };
}

/** Неотрицательное целое до Number.MAX_SAFE_INTEGER; иначе null. */
export function parseIn(value: string, base: Base): number | null {
  const s = strip(value);
  if (!checkDigits(s, base).ok) return null;
  let n = 0;
  for (const ch of s) {
    const d = digitValue(ch);
    if (n > Math.floor((Number.MAX_SAFE_INTEGER - d) / base)) return null;
    n = n * base + d;
  }
  return n;
}

/** Число в системе (шестнадцатеричные цифры — заглавными). */
export function formatIn(n: number, base: Base): string {
  return n.toString(base).toUpperCase();
}

export interface LadderRow {
  dividend: number;
  quotient: number;
  remainder: number;
  /** Остаток как цифра системы (A..F). */
  digit: string;
}

export interface PowerTerm {
  digit: string;
  value: number;
  power: number;
  weight: number;
  product: number;
}

export interface Group {
  chunk: string;
  digit: string;
}

export type ConvertMethod = "same" | "ladder" | "powers" | "groups" | "ungroup" | "via2" | "via10";

export type Conversion =
  | {
      ok: true;
      result: string;
      method: ConvertMethod;
      /** ladder: деление уголком (10 → b). */
      ladder?: LadderRow[];
      /** powers: слагаемые цифра·bᵏ (b → 10). */
      terms?: PowerTerm[];
      /**
       * groups (2 → 8/16): двоичные группы → цифры результата.
       * ungroup (8/16 → 2): цифры исходного числа → двоичные группы (с незначащими нулями слева).
       * via2 (8 ↔ 16): ВТОРОЙ шаг — двоичная запись, разбитая на группы → цифры результата.
       */
      groups?: Group[];
      /** via2: ПЕРВЫЙ шаг — цифры исходного числа → двоичные группы. */
      groupsIn?: Group[];
      /** via2: промежуточная двоичная запись (без ведущих нулей). */
      binary?: string;
      /** groups/via2: сколько нулей дописано слева перед разбиением на группы. */
      pad?: number;
      /** Размер двоичной группы: 3 для восьмеричной, 4 для шестнадцатеричной. */
      groupSize?: 3 | 4;
      decimal: number;
      explain: L[];
    }
  | { ok: false; error: "empty" | "digit" | "tooBig"; digit?: string };

// Названия систем для пояснений: русские прилагательные при слове «цифра» (им., вин., твор. падеж) и казахские.
const SYS_RU: Record<Base, { nom: string; acc: string; ins: string }> = {
  2: { nom: "двоичная", acc: "двоичную", ins: "двоичной" },
  8: { nom: "восьмеричная", acc: "восьмеричную", ins: "восьмеричной" },
  10: { nom: "десятичная", acc: "десятичную", ins: "десятичной" },
  16: { nom: "шестнадцатеричная", acc: "шестнадцатеричную", ins: "шестнадцатеричной" },
};
const SYS_KK: Record<Base, string> = { 2: "екілік", 8: "сегіздік", 10: "ондық", 16: "он алтылық" };

function ladderRows(n: number, b: Base): LadderRow[] {
  if (n === 0) return [{ dividend: 0, quotient: 0, remainder: 0, digit: "0" }];
  const rows: LadderRow[] = [];
  let v = n;
  while (v > 0) {
    const q = Math.floor(v / b);
    const r = v - q * b;
    rows.push({ dividend: v, quotient: q, remainder: r, digit: DIGITS[r] });
    v = q;
  }
  return rows;
}

function powerTerms(norm: string, b: Base): PowerTerm[] {
  const len = norm.length;
  return [...norm].map((ch, i) => {
    const value = digitValue(ch);
    const power = len - 1 - i;
    const weight = b ** power;
    return { digit: ch, value, power, weight, product: value * weight };
  });
}

/** Двоичная строка → группы по size цифр справа налево (слева дополняем нулями). */
function packBits(bits: string, size: 3 | 4): { groups: Group[]; pad: number; result: string } {
  const pad = (size - (bits.length % size)) % size;
  const padded = "0".repeat(pad) + bits;
  const groups: Group[] = [];
  for (let i = 0; i < padded.length; i += size) {
    const chunk = padded.slice(i, i + size);
    groups.push({ chunk, digit: DIGITS[parseInt(chunk, 2)] });
  }
  return { groups, pad, result: stripZeros(groups.map((g) => g.digit).join("")) };
}

/** Цифры 8/16-ричного числа → двоичные группы по size бит. */
function unpackDigits(digits: string, size: 3 | 4): Group[] {
  return [...digits].map((ch) => ({ chunk: digitValue(ch).toString(2).padStart(size, "0"), digit: ch }));
}

/**
 * Перевод между системами 2/8/10/16 с шагами решения.
 * Методы: 10→b — ladder, b→10 — powers, 2→8/16 — groups, 8/16→2 — ungroup, 8↔16 — via2, одинаковые — same.
 */
export function convert(value: string, from: Base, to: Base): Conversion {
  const check = checkDigits(value, from);
  if (!check.ok) return check.digit === "" ? { ok: false, error: "empty" } : { ok: false, error: "digit", digit: check.digit };
  const n = parseIn(value, from);
  if (n === null) return { ok: false, error: "tooBig" };
  const norm = stripZeros(strip(value).toUpperCase());
  const result = formatIn(n, to);
  const fs = subscript(from);
  const ts = subscript(to);

  if (from === to) {
    return {
      ok: true,
      result,
      method: "same",
      decimal: n,
      explain: [{ ru: "Системы одинаковые — число не меняется", kk: "Жүйелер бірдей — сан өзгермейді" }],
    };
  }

  // 10 → 2/8/16: деление на основание.
  if (from === 10) {
    const ladder = ladderRows(n, to);
    if (n === 0) {
      return {
        ok: true,
        result,
        method: "ladder",
        ladder,
        decimal: n,
        explain: [{ ru: "Ноль в любой системе — 0", kk: "Нөл кез келген жүйеде — 0" }],
      };
    }
    const explain: L[] = [
      {
        ru: `Делим ${n} на ${to} и записываем остатки`,
        kk: `${n} санын жүйенің негізіне (${to}) бөліп, қалдықты жазамыз`,
      },
      { ru: `Частное снова делим на ${to}, пока оно не станет 0`, kk: "Бөлінді 0 болғанша бөлуді қайталаймыз" },
    ];
    if (to === 16 && ladder.some((r) => r.remainder >= 10)) {
      explain.push({ ru: "Остатки 10–15 пишем буквами A–F", kk: "10–15 қалдықтарын A–F әріптерімен жазамыз" });
    }
    explain.push({
      ru: `Читаем остатки снизу вверх: ${result}${ts}`,
      kk: `Қалдықтарды төменнен жоғары оқимыз: ${result}${ts}`,
    });
    return { ok: true, result, method: "ladder", ladder, decimal: n, explain };
  }

  // 2/8/16 → 10: сумма цифра·основание^разряд.
  if (to === 10) {
    const terms = powerTerms(norm, from);
    const sum = terms.map((t) => t.product).join(" + ");
    const explain: L[] = [
      { ru: "Нумеруем разряды справа налево: 0, 1, 2, …", kk: "Разрядтарды оңнан солға қарай нөмірлейміз: 0, 1, 2, …" },
      {
        ru: `Каждую цифру умножаем на ${from} в степени её разряда`,
        kk: `Әр цифрды ${from} негізінің осы разряд нөміріне тең дәрежесіне көбейтеміз`,
      },
    ];
    if (from === 16 && /[A-F]/.test(norm)) {
      explain.push({ ru: "Буквы A–F — это цифры 10–15", kk: "A–F әріптері — 10–15 цифрлары" });
    }
    explain.push({ ru: `Складываем: ${sum} = ${n}${subscript(10)}`, kk: `Қосамыз: ${sum} = ${n}${subscript(10)}` });
    return { ok: true, result, method: "powers", terms, decimal: n, explain };
  }

  // 2 → 8/16: группы битов.
  if (from === 2) {
    const size = to === 8 ? 3 : 4;
    const { groups, pad } = packBits(norm, size);
    const explain: L[] = [
      {
        ru: `Делим двоичное число на группы по ${size} цифры справа налево`,
        kk: `Екілік санды оңнан солға қарай ${size} цифрдан топтарға бөлеміз`,
      },
    ];
    if (pad > 0) {
      explain.push({ ru: "Слева не хватает цифр — дополняем нулями", kk: "Сол жағында цифр жетіспесе — нөлмен толықтырамыз" });
    }
    explain.push(
      {
        ru: `Каждую группу заменяем одной ${SYS_RU[to].ins} цифрой`,
        kk: `Әр топты бір ${SYS_KK[to]} цифрмен ауыстырамыз`,
      },
      { ru: `Записываем цифры подряд: ${result}${ts}`, kk: `Цифрларды қатарынан жазамыз: ${result}${ts}` },
    );
    return { ok: true, result, method: "groups", groups, pad, groupSize: size, decimal: n, explain };
  }

  // 8/16 → 2: каждая цифра — 3/4 бита.
  if (to === 2) {
    const size = from === 8 ? 3 : 4;
    const groups = unpackDigits(norm, size);
    const joined = groups.map((g) => g.chunk).join("");
    const explain: L[] = [
      {
        ru: `Каждую ${SYS_RU[from].acc} цифру заменяем ${size} двоичными цифрами`,
        kk: `Әр ${SYS_KK[from]} цифрды ${size === 3 ? "үш" : "төрт"} екілік цифрмен ауыстырамыз`,
      },
    ];
    if (joined.length > result.length) {
      explain.push({ ru: "Незначащие нули в начале отбрасываем", kk: "Басындағы мәнсіз нөлдерді тастаймыз" });
    }
    explain.push({ ru: `Получаем: ${result}${ts}`, kk: `Нәтиже: ${result}${ts}` });
    return { ok: true, result, method: "ungroup", groups, groupSize: size, decimal: n, explain };
  }

  // 8 ↔ 16: через двоичную систему.
  const sizeIn = from === 8 ? 3 : 4;
  const sizeOut = to === 8 ? 3 : 4;
  const groupsIn = unpackDigits(norm, sizeIn);
  const binary = stripZeros(groupsIn.map((g) => g.chunk).join(""));
  const packed = packBits(binary, sizeOut);
  const explain: L[] = [
    {
      ru: `Переводим через двоичную систему: ${norm}${fs} → ${binary}${subscript(2)} → ${result}${ts}`,
      kk: `Екілік жүйе арқылы аударамыз: ${norm}${fs} → ${binary}${subscript(2)} → ${result}${ts}`,
    },
    {
      ru: `Каждую ${SYS_RU[from].acc} цифру заменяем ${sizeIn} двоичными цифрами`,
      kk: `Әр ${SYS_KK[from]} цифрды ${sizeIn === 3 ? "үш" : "төрт"} екілік цифрмен ауыстырамыз`,
    },
    {
      ru: `Двоичное число делим на группы по ${sizeOut} справа налево, слева дополняя нулями`,
      kk: `Екілік санды оңнан солға қарай ${sizeOut} цифрдан топтап, сол жағын нөлмен толықтырамыз`,
    },
    {
      ru: `Каждая группа — одна ${SYS_RU[to].nom} цифра: ${result}${ts}`,
      kk: `Әр топ — бір ${SYS_KK[to]} цифр: ${result}${ts}`,
    },
  ];
  return {
    ok: true,
    result,
    method: "via2",
    groupsIn,
    groups: packed.groups,
    binary,
    pad: packed.pad,
    groupSize: sizeOut,
    decimal: n,
    explain,
  };
}

// ---------- Арифметика в системе ----------

export type ArithOp = "+" | "-" | "*" | "/";

export type ArithResult =
  | {
      ok: true;
      result: string;
      /** Только для деления: остаток в той же системе. */
      remainder?: string;
      decimal: { a: number; b: number; result: number; remainder?: number };
    }
  | { ok: false; error: "digit" | "empty" | "divZero" | "negative" | "tooBig"; digit?: string };

/** Целочисленные + − × ÷ над числами в системе счисления; ÷ — деление с остатком. */
export function arith(a: string, b: string, op: ArithOp, base: Base): ArithResult {
  for (const x of [a, b]) {
    if (strip(x)) {
      const c = checkDigits(x, base);
      if (!c.ok) return { ok: false, error: "digit", digit: c.digit };
    }
  }
  if (!strip(a) || !strip(b)) return { ok: false, error: "empty" };
  const na = parseIn(a, base);
  const nb = parseIn(b, base);
  if (na === null || nb === null) return { ok: false, error: "tooBig" };

  let res: number;
  let rem: number | undefined;
  switch (op) {
    case "+":
      res = na + nb;
      break;
    case "-":
      if (na < nb) return { ok: false, error: "negative" };
      res = na - nb;
      break;
    case "*":
      res = na * nb;
      break;
    case "/":
      if (nb === 0) return { ok: false, error: "divZero" };
      res = Math.floor(na / nb);
      rem = na - res * nb;
      break;
  }
  if (!Number.isSafeInteger(res)) return { ok: false, error: "tooBig" };
  return {
    ok: true,
    result: formatIn(res, base),
    ...(rem !== undefined ? { remainder: formatIn(rem, base) } : {}),
    decimal: { a: na, b: nb, result: res, ...(rem !== undefined ? { remainder: rem } : {}) },
  };
}

// ---------- Единицы информации ----------

export type InfoUnit = "bit" | "byte" | "KB" | "MB" | "GB";
export const INFO_UNITS: InfoUnit[] = ["bit", "byte", "KB", "MB", "GB"];

const BITS_IN: Record<InfoUnit, number> = {
  bit: 1,
  byte: 8,
  KB: 8 * 1024,
  MB: 8 * 1024 ** 2,
  GB: 8 * 1024 ** 3,
};

export const UNIT_LABEL: Record<InfoUnit, L> = {
  bit: { ru: "бит", kk: "бит" },
  byte: { ru: "байт", kk: "байт" },
  KB: { ru: "Кбайт", kk: "Кбайт" },
  MB: { ru: "Мбайт", kk: "Мбайт" },
  GB: { ru: "Гбайт", kk: "Гбайт" },
};

export function toBits(value: number, unit: InfoUnit): number {
  return value * BITS_IN[unit];
}

export function convertUnits(value: number, from: InfoUnit, to: InfoUnit): number {
  return toBits(value, from) / BITS_IN[to];
}

/** Читает десятичное число из поля ввода: "1,5" и "1.5", без знака и без экспоненты. */
export function parseDecimal(s: string): number | null {
  const t = s.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(t)) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Время передачи t = I / v в секундах (скорость — «единиц в секунду»). Скорость ≤ 0 или объём < 0 → null. */
export function transferTime(
  size: number,
  sizeUnit: InfoUnit,
  speed: number,
  speedUnit: InfoUnit,
): { seconds: number; explain: L[] } | null {
  if (!Number.isFinite(size) || !Number.isFinite(speed) || size < 0 || speed <= 0) return null;
  const sizeInSpeedUnit = convertUnits(size, sizeUnit, speedUnit);
  const seconds = sizeInSpeedUnit / speed;
  const ru = (u: InfoUnit) => UNIT_LABEL[u].ru;
  const kk = (u: InfoUnit) => UNIT_LABEL[u].kk;

  const explain: L[] = [
    {
      ru: "Время = объём ÷ скорость: t = I / v",
      kk: "Уақыт = көлем ÷ жылдамдық: t = I / v",
    },
  ];
  if (sizeUnit !== speedUnit) {
    const ratio = BITS_IN[sizeUnit] / BITS_IN[speedUnit];
    const how = ratio >= 1 ? `${formatNumber(size)} · ${formatNumber(ratio)}` : `${formatNumber(size)} / ${formatNumber(1 / ratio)}`;
    explain.push({
      ru: `Приводим объём к единицам скорости: ${formatNumber(size)} ${ru(sizeUnit)} = ${how} = ${formatNumber(sizeInSpeedUnit)} ${ru(speedUnit)}`,
      kk: `Көлемді жылдамдық бірлігіне келтіреміз: ${formatNumber(size)} ${kk(sizeUnit)} = ${how} = ${formatNumber(sizeInSpeedUnit)} ${kk(speedUnit)}`,
    });
  }
  const calc = `t = ${formatNumber(sizeInSpeedUnit)} / ${formatNumber(speed)} = ${formatNumber(seconds)}`;
  explain.push({ ru: `Считаем: ${calc} с`, kk: `Есептейміз: ${calc} с` });
  return { seconds, explain };
}

// ---------- Обычный калькулятор ----------

type Tok = { t: "num"; v: number } | { t: "op"; v: "+" | "-" | "*" | "/" } | { t: "(" } | { t: ")" };

const NUM_RE = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?/i;

function tokenize(expr: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.,]/.test(ch)) {
      const m = NUM_RE.exec(expr.slice(i));
      if (!m) return null;
      toks.push({ t: "num", v: parseFloat(m[0].replace(",", ".")) });
      i += m[0].length;
    } else if (ch === "+") {
      toks.push({ t: "op", v: "+" });
      i++;
    } else if (ch === "-" || ch === "−" || ch === "–") {
      toks.push({ t: "op", v: "-" });
      i++;
    } else if (ch === "*" || ch === "×" || ch === "·" || ch === "⋅") {
      toks.push({ t: "op", v: "*" });
      i++;
    } else if (ch === "/" || ch === "÷" || ch === ":") {
      toks.push({ t: "op", v: "/" });
      i++;
    } else if (ch === "(" || ch === ")") {
      toks.push({ t: ch });
      i++;
    } else {
      return null;
    }
  }
  return toks;
}

class CalcError extends Error {}

/** Вычисляет выражение: + − × ÷ * /, скобки, унарный минус, десятичная точка/запятая. Никакого eval. Ошибка → null. */
export function evaluateExpression(expr: string): number | null {
  if (expr.length > 500) return null;
  const toks = tokenize(expr);
  if (!toks || toks.length === 0) return null;
  let pos = 0;

  const peekOp = (...ops: string[]) => {
    const tk = toks[pos];
    return tk && tk.t === "op" && ops.includes(tk.v) ? tk.v : null;
  };

  function primary(): number {
    const tk = toks![pos++];
    if (!tk) throw new CalcError();
    if (tk.t === "num") return tk.v;
    if (tk.t === "(") {
      const v = additive();
      if (toks![pos++]?.t !== ")") throw new CalcError();
      return v;
    }
    throw new CalcError();
  }
  function unary(): number {
    if (peekOp("-")) {
      pos++;
      return -unary();
    }
    return primary();
  }
  function multiplicative(): number {
    let v = unary();
    for (let op = peekOp("*", "/"); op; op = peekOp("*", "/")) {
      pos++;
      const r = unary();
      if (op === "/") {
        if (r === 0) throw new CalcError();
        v /= r;
      } else {
        v *= r;
      }
    }
    return v;
  }
  function additive(): number {
    let v = multiplicative();
    for (let op = peekOp("+", "-"); op; op = peekOp("+", "-")) {
      pos++;
      const r = multiplicative();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  try {
    const v = additive();
    if (pos !== toks.length || !Number.isFinite(v)) return null;
    // Убираем шум плавающей точки (0.1 + 0.2 → 0.3), целые не трогаем.
    return Number.isInteger(v) ? v : Number(v.toPrecision(15));
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

/**
 * Достраивает набираемое выражение до вычислимого: отбрасывает висящие операторы/точку/«(» в конце
 * и закрывает незакрытые скобки. Пустое → null. Одну и ту же логику используют предпросмотр и «=».
 */
export function completeExpression(expr: string): string | null {
  const s = expr.replace(/[+\-−×÷*/(\s.,]+$/, "");
  if (!s) return null;
  const open = (s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length;
  return open > 0 ? s + ")".repeat(open) : s;
}

/** Предпросмотр для набираемого выражения: достраивает его (completeExpression) и вычисляет. */
export function previewExpression(expr: string): number | null {
  const s = completeExpression(expr);
  return s === null ? null : evaluateExpression(s);
}

/**
 * Число → строка для дисплея: без шума плавающей точки, не больше `digits` значащих цифр в дробях.
 * Безопасные целые (до 2⁵³−1) печатаем точно, без выдуманных нулей; большие — в экспоненциальной форме.
 * Дробям добавляем разряды под целую часть, чтобы 12345678901.5 не терял единицы.
 */
export function formatNumber(n: number, digits = 10): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (Number.isInteger(n)) {
    if (Math.abs(n) <= Number.MAX_SAFE_INTEGER) return String(n);
    return Number(n.toExponential(Math.max(0, digits - 1))).toExponential();
  }
  const intDigits = Math.abs(n) >= 1 ? Math.floor(Math.log10(Math.abs(n))) + 1 : 0;
  const precision = Math.min(15, Math.max(digits, intDigits + 2));
  return String(Number(n.toPrecision(precision)));
}

/**
 * Результат «=» как текст выражения — с полной точностью (15 значащих цифр), без округления до дисплея.
 * Безопасные целые — точно, большие целые — в экспоненциальной форме (String дописал бы выдуманные нули).
 */
export function exactText(n: number): string {
  if (n === 0) return "0";
  if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) return n.toExponential();
  return String(n);
}

/** Результат после «=» для дисплея: округляем только здесь, а в состоянии держим полную точность. */
export function displayResult(expr: string): string {
  const n = Number(expr);
  return displayExpr(Number.isFinite(n) ? formatNumber(n) : expr);
}

/** Для показа: десятичная запятая и настоящий минус. */
export function displayExpr(s: string): string {
  return s.replace(/\./g, ",").replace(/-/g, "−");
}

export function isPlainNumber(s: string): boolean {
  return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/.test(s);
}

// ---------- Ввод в калькулятор (клавиши) ----------

export interface CalcState {
  /** Выражение во внутреннем виде: цифры, ".", + - × ÷ ( ). */
  expr: string;
  /** expr — результат после «=»: цифра начнёт новое выражение, оператор продолжит это. */
  fresh: boolean;
  /** Выражение, давшее результат (для строки «… =»). */
  prev: string;
}

export const CALC_INIT: CalcState = { expr: "", fresh: false, prev: "" };

const MAX_LEN = 80;
const MAX_NUM_DIGITS = 15;
const isOp = (c: string) => c === "+" || c === "-" || c === "×" || c === "÷";

function normKey(key: string): string {
  switch (key) {
    case "*":
    case "x":
    case "X":
      return "×";
    case "/":
    case ":":
      return "÷";
    case "−":
    case "–":
      return "-";
    case ",":
      return ".";
    case "Enter":
      return "=";
    case "Backspace":
      return "⌫";
    default:
      return key;
  }
}

const count = (s: string, ch: string) => s.split(ch).length - 1;
const currentNumber = (expr: string) => /\d*\.?\d*$/.exec(expr)?.[0] ?? "";

/**
 * Редьюсер нажатий калькулятора. Ключи: 0–9 . , + - * / × ÷ ( ) = C ⌫ (и Enter/Backspace).
 * Не даёт набрать мусор: два оператора подряд заменяются, вторая точка в числе игнорируется,
 * перед «(» после числа ставится ×.
 */
export function calcPress(state: CalcState, rawKey: string): CalcState {
  const key = normKey(rawKey);
  const { fresh } = state;
  let expr = state.expr;
  const next = (e: string): CalcState => ({ expr: e, fresh: false, prev: "" });

  if (key === "C") return CALC_INIT;

  if (key === "=") {
    if (fresh) return state; // результат уже посчитан
    // Считаем то же, что показывает предпросмотр: «5+=» и «2+(3=» дают 5.
    const done = completeExpression(expr);
    const v = done === null ? null : evaluateExpression(done);
    if (done === null || v === null) return state;
    // В выражении держим полную точность, до 10 знаков округляет только дисплей (displayResult).
    return { expr: exactText(v), fresh: true, prev: isPlainNumber(done) ? "" : done };
  }

  if (key === "⌫") {
    // Результат «=» стираем целиком: по символам от «1e-7» остался бы битый «1e-».
    if (fresh) return CALC_INIT;
    const e = expr.slice(0, -1);
    // Остался один вычисленный результат (после снятия оператора) — снова «свежий», а не набранное число.
    if (isPlainNumber(e) && (/e/i.test(e) || e.replace(/[-.]/g, "").length > MAX_NUM_DIGITS)) {
      return { expr: e, fresh: true, prev: "" };
    }
    return next(e);
  }

  if (/^[0-9]$/.test(key)) {
    if (fresh) return next(key);
    if (expr.length >= MAX_LEN) return state;
    if (expr.endsWith(")")) expr += "×";
    const seg = currentNumber(expr);
    if (seg === "0") expr = expr.slice(0, -1);
    else if (seg.replace(".", "").length >= MAX_NUM_DIGITS) return state;
    return next(expr + key);
  }

  if (key === ".") {
    if (fresh) return next("0.");
    if (expr.length >= MAX_LEN) return state;
    if (expr.endsWith(")")) expr += "×";
    const seg = currentNumber(expr);
    if (seg.includes(".")) return state;
    return next(expr + (seg === "" ? "0." : "."));
  }

  if (isOp(key)) {
    if (expr === "") return key === "-" ? next("-") : state;
    const e = expr.replace(/\.$/, "");
    if (e.length >= MAX_LEN) return state;
    const tail = /[+\-×÷]+$/.exec(e)?.[0] ?? "";
    const head = e.slice(0, e.length - tail.length);
    if (key === "-") {
      if (tail === "" || tail === "×" || tail === "÷") return next(e + "-");
      if (tail === "+") return next(head + "-");
      return state; // уже стоит минус (унарный) — не наращиваем
    }
    if (head === "" || head.endsWith("(")) return state;
    return next(head + key);
  }

  if (key === "(") {
    if (fresh) return next("(");
    if (expr.length >= MAX_LEN) return state;
    const e = expr.replace(/\.$/, "");
    return next(e + (/[0-9)]$/.test(e) ? "×" : "") + "(");
  }

  if (key === ")") {
    const e = expr.replace(/\.$/, "");
    if (count(e, "(") - count(e, ")") <= 0 || !/[0-9)]$/.test(e)) return state;
    return next(e + ")");
  }

  return state;
}
