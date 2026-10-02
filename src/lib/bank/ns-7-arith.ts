import type { L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка ns.arith: арифметика в двоичной системе (+, −, ×2ᵏ, :2ᵏ), перенос при 8 и 16.
// Правильный ответ всегда считает код (toString/parseInt), неверные варианты — типичные ошибки:
// потерянный перенос, «десятичное» сложение цифр (появляется цифра 2), потерянный последний перенос,
// вычитание без заёма, лишний/недостающий ноль при сдвиге.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа).
// Сцены-таблицы сложения/вычитания столбиком (addScene, subScene) используются и в уроке ns-7-arith.

const SKILL = "ns.arith";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const T = (ru: string, kk: string): L => ({ ru, kk });

type Base = 2 | 8 | 16;
const DIGITS = "0123456789ABCDEF";
const SUB: Record<Base, string> = { 2: "₂", 8: "₈", 16: "₁₆" };
const rec = (s: string | number, b: Base) => `${s}${SUB[b]}`;
const toBase = (n: number, b: Base) => n.toString(b).toUpperCase();
const dv = (ch: string) => DIGITS.indexOf(ch);
const bin = (n: number) => n.toString(2);
const ones = (s: string) => s.split("").filter((c) => c === "1").length;
const trimZeros = (s: string) => s.replace(/^0+(?=.)/, "");
const SYS: Record<Base, L> = {
  2: T("двоичной", "екілік"),
  8: T("восьмеричной", "сегіздік"),
  16: T("шестнадцатеричной", "он алтылық"),
};

// ---------- Сложение и вычитание столбиком (данные для сцен и объяснений) ----------

export interface AddCol {
  /** Цифры слагаемых в этом разряде. */
  a: number;
  b: number;
  /** Перенос из младшего разряда. */
  cin: number;
  /** Сумма в разряде (десятичное значение): a + b + cin. */
  total: number;
  /** Цифра, которую пишем. */
  digit: number;
  /** Перенос в старший разряд. */
  cout: number;
}

/** Разряды справа налево; последний элемент — «столбец» итогового переноса (a = b = 0). */
export function addColumns(a: string, b: string, base: number): AddCol[] {
  const n = Math.max(a.length, b.length);
  const ap = a.padStart(n, "0");
  const bp = b.padStart(n, "0");
  const cols: AddCol[] = [];
  let carry = 0;
  for (let i = n - 1; i >= 0; i--) {
    const x = dv(ap[i]);
    const y = dv(bp[i]);
    const total = x + y + carry;
    cols.push({ a: x, b: y, cin: carry, total, digit: total % base, cout: Math.floor(total / base) });
    carry = Math.floor(total / base);
  }
  cols.push({ a: 0, b: 0, cin: carry, total: carry, digit: carry, cout: 0 });
  return cols;
}

/**
 * Таблица «сложение столбиком». done — сколько разрядов справа уже сложено (0…n, где n — число столбцов,
 * включая столбец итогового переноса). Первый столбец таблицы — подписи строк.
 * Подсвечивается столбец последнего сложенного разряда; перенос показывается над следующим разрядом.
 */
export function addScene(a: string, b: string, base: Base, done: number, highlight = true): Scene {
  const cols = addColumns(a, b, base);
  const n = cols.length;
  // Позиция p считается справа (0 — единицы); в таблице позиция p лежит в столбце n - p.
  const row = (f: (p: number) => string) => Array.from({ length: n }, (_, i) => f(n - 1 - i));
  const carry = row((p) => (p >= 1 && done >= p && cols[p].cin > 0 ? "1" : ""));
  const top = row((p) => (p < a.length ? a[a.length - 1 - p] : ""));
  const low = row((p) => (p < b.length ? b[b.length - 1 - p] : ""));
  const sum = row((p) => (p < done ? (done === n && p === n - 1 && cols[p].digit === 0 ? "" : DIGITS[cols[p].digit]) : ""));
  return {
    kind: "table",
    rows: [[T("в уме", "ойда"), ...carry], ["", ...top], ["+", ...low], ["=", ...sum]],
    highlightCols: highlight && done > 0 && done <= n ? [n - done + 1] : [],
    mono: true,
  };
}

export interface SubCol {
  a: number;
  b: number;
  /** Заём, отданный соседу справа (вычитается из этого разряда). */
  bin: number;
  /** Цифра результата. */
  digit: number;
  /** Занято у соседа слева (1, если не хватило). */
  bout: number;
}

/** Разряды справа налево для a − b в двоичной системе (a ≥ b). */
export function subColumns(a: string, b: string): SubCol[] {
  const n = a.length;
  const bp = b.padStart(n, "0");
  const cols: SubCol[] = [];
  let borrow = 0;
  for (let i = n - 1; i >= 0; i--) {
    const x = dv(a[i]);
    const y = dv(bp[i]);
    let d = x - y - borrow;
    const bin2 = borrow;
    borrow = 0;
    if (d < 0) {
      d += 2;
      borrow = 1;
    }
    cols.push({ a: x, b: y, bin: bin2, digit: d, bout: borrow });
  }
  return cols;
}

/** Таблица «вычитание столбиком» с заёмом; done — сколько разрядов справа уже вычтено (0…n). */
export function subScene(a: string, b: string, done: number, highlight = true): Scene {
  const cols = subColumns(a, b);
  const n = cols.length;
  const row = (f: (p: number) => string) => Array.from({ length: n }, (_, i) => f(n - 1 - i));
  const loan = row((p) => (p >= 1 && done >= p && cols[p].bin > 0 ? "−1" : ""));
  const top = row((p) => a[a.length - 1 - p]);
  const low = row((p) => (p < b.length ? b[b.length - 1 - p] : ""));
  // Ведущие нули результата в готовой записи не показываем.
  const lead = (p: number) => done === n && p > 0 && cols.slice(p).every((c) => c.digit === 0);
  const diff = row((p) => (p < done ? (lead(p) ? "" : String(cols[p].digit)) : ""));
  return {
    kind: "table",
    rows: [[T("заём", "қарыз"), ...loan], ["", ...top], ["−", ...low], ["=", ...diff]],
    highlightCols: highlight && done > 0 && done <= n ? [n - done + 1] : [],
    mono: true,
  };
}

/** Разбор сложения по разрядам одной строкой (ru/kk). */
function addWalk(a: string, b: string, base: Base): L {
  const cols = addColumns(a, b, base);
  const ru: string[] = [];
  const kk: string[] = [];
  cols.forEach((c, i) => {
    if (i === cols.length - 1) {
      if (c.cin > 0) {
        ru.push(`Разряд ${i + 1}: остался перенос 1 → пишем 1.`);
        kk.push(`Разряд ${i + 1}: ауысқан 1 қалды → 1 жазамыз.`);
      }
      return;
    }
    const expr = `${DIGITS[c.a]} + ${DIGITS[c.b]}${c.cin ? " + 1" : ""} = ${base === 2 ? `${bin(c.total)}₂` : `${c.total}${c.cout ? ` = 1 · ${base} + ${c.digit}` : ""}`}`;
    ru.push(`Разряд ${i + 1}: ${expr} → пишем ${DIGITS[c.digit]}${c.cout ? ", переносим 1" : ""}.`);
    kk.push(`Разряд ${i + 1}: ${expr} → ${DIGITS[c.digit]} жазамыз${c.cout ? ", 1 келесі разрядқа ауысады" : ""}.`);
  });
  return T(ru.join(" "), kk.join(" "));
}

/** Разбор вычитания по разрядам (ru/kk). */
function subWalk(a: string, b: string): L {
  const cols = subColumns(a, b);
  const ru: string[] = [];
  const kk: string[] = [];
  cols.forEach((c, i) => {
    const v = c.a - c.b - c.bin;
    const expr = `${c.a} − ${c.b}${c.bin ? " − 1" : ""} = ${v < 0 ? `−${-v}` : v}`;
    if (v < 0) {
      ru.push(`Разряд ${i + 1}: ${expr} — не хватает → занимаем 1 у соседа слева (она стоит 2): пишем ${v + 2}.`);
      kk.push(`Разряд ${i + 1}: ${expr} — жетпейді → сол жақтағы көршіден 1 қарыз аламыз (ол 2 тұрады): ${v + 2} жазамыз.`);
    } else {
      ru.push(`Разряд ${i + 1}: ${expr} → пишем ${v}.`);
      kk.push(`Разряд ${i + 1}: ${expr} → ${v} жазамыз.`);
    }
  });
  return T(ru.join(" "), kk.join(" "));
}

// ---------- Подсказки (без ответа) ----------

const HINT_ADD: L = T(
  "Пиши числа столбиком по правому краю и складывай справа налево. Если в разряде получилось 2 (10₂) — пиши 0 и перенеси 1 влево.",
  "Сандарды оң жақ шетінен теңдеп бағанға жаз да, оңнан солға қарай қос. Разрядта 2 (10₂) шықса — 0 жазып, 1-ді солға ауыстыр.",
);
const HINT_SUB: L = T(
  "Вычитай справа налево. Если сверху цифра меньше, чем снизу, займи 1 у соседа слева: в двоичной системе она стоит 2 (10₂).",
  "Оңнан солға қарай азайт. Үстіндегі цифр астындағыдан кіші болса, сол жақтағы көршіден 1 қарыз ал: екілік жүйеде ол 2 (10₂) тұрады.",
);
const HINT_MUL: L = T(
  "Множитель — степень двойки. Каждое умножение на 2 дописывает справа один ноль; посчитай, сколько раз нужно умножить на 2.",
  "Көбейткіш — екінің дәрежесі. Әр рет 2-ге көбейту оң жаққа бір нөл жазады; неше рет 2-ге көбейту керегін сана.",
);
const HINT_DIV: L = T(
  "Делитель — степень двойки. Каждое деление на 2 нацело отбрасывает последнюю цифру; посчитай, сколько раз делим.",
  "Бөлгіш — екінің дәрежесі. Әр рет 2-ге бүтін бөлу соңғы цифрды алып тастайды; неше рет бөлетінімізді сана.",
);
const HINT_BASE: L = T(
  "Складывай разряды справа налево. Когда сумма достигла основания системы, вычти основание, запиши остаток и перенеси 1. Цифры A–F — это 10–15.",
  "Разрядтарды оңнан солға қарай қос. Қосынды жүйе негізіне жеткенде, негізді алып таста, қалдықты жаз да, бір бірлікті ауыстыр. A–F цифрлары — 10–15.",
);
const HINT_DEC: L = T(
  "Проверь через обычные числа: переведи оба числа в десятичную систему и выполни действие.",
  "Қарапайым сандар арқылы тексер: екі санды да ондық жүйеге аударып, амалды орында.",
);
const HINT_ONES_SUM: L = T(
  "Сначала сложи числа столбиком, а потом посчитай единицы в получившейся записи (а не в слагаемых).",
  "Алдымен сандарды бағанмен қос, содан кейін шыққан жазбадағы бірліктерді сана (қосылғыштардағыны емес).",
);

// ---------- Причины неверных вариантов ----------

const WHY = {
  noCarry: T(
    "Переносы потеряны: 1 + 1 = 10₂ — пишем 0 и переносим 1 влево, а не просто 0.",
    "Ауысулар жоғалған: 1 + 1 = 10₂ — 0 жазып, 1-ді солға ауыстырамыз, жай 0 емес.",
  ),
  digit2: T(
    "Цифры сложены как десятичные: в двоичной системе нет цифр 2 и 3. Если в разряде получилось 2, пишем 0 и переносим 1.",
    "Цифрлар ондық сияқты қосылған: екілік жүйеде 2 және 3 цифрлары жоқ. Разрядта 2 шықса, 0 жазып, 1-ді ауыстырамыз.",
  ),
  lostTop: T(
    "Потерян последний перенос: он становится новой старшей цифрой 1.",
    "Соңғы ауысу жоғалған: ол жаңа ең жоғарғы 1 цифры болады.",
  ),
  decimal: T(
    "Это десятичное значение, а не двоичная запись ответа.",
    "Бұл — ондық мән, жауаптың екілік жазбасы емес.",
  ),
  off: T(
    "Ошибка в одном из разрядов: перепроверь каждую колонку и перенос.",
    "Разрядтардың бірінде қате бар: әр бағанды және ауысуды қайта тексер.",
  ),
  noBorrow: T(
    "Заём не использован: из меньшей цифры вычитали большую. Занимаем 1 у соседа слева — она стоит 2.",
    "Қарыз алынбаған: кіші цифрдан үлкенін алып тастаған. Сол жақтағы көршіден 1 қарыз аламыз — ол 2 тұрады.",
  ),
  added: T(
    "Числа сложены, а нужно вычесть.",
    "Сандар қосылған, ал азайту керек еді.",
  ),
};

interface Wrong {
  v: string;
  why: L;
}

/** Правильный вариант + 3 неверных (типичные ошибки, затем запасные), перемешанные вместе с whyWrong. */
function choose(rand: Rand, correct: string, wrongs: Wrong[], spare: () => string): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  const seen = new Set([correct]);
  const chosen: Wrong[] = [];
  for (const w of shuffle(wrongs, rand)) {
    if (chosen.length >= 3) break;
    if (!w.v || seen.has(w.v)) continue;
    seen.add(w.v);
    chosen.push(w);
  }
  for (let guard = 0; chosen.length < 3 && guard < 80; guard++) {
    const v = spare();
    if (v && !seen.has(v)) {
      seen.add(v);
      chosen.push({ v, why: WHY.off });
    }
  }
  const entries = shuffle([{ v: correct, why: null as L | null }, ...chosen], rand);
  return { options: entries.map((e) => e.v), correct: entries.findIndex((e) => e.why === null), whyWrong: entries.map((e) => e.why) };
}

/** Меняет один бит (старший не трогаем, если запись длиннее 1 цифры). */
function flipBit(rand: Rand, s: string): string {
  if (s.length < 2) return s === "0" ? "1" : "10";
  const pos = int(rand, 1, s.length - 1);
  return `${s.slice(0, pos)}${s[pos] === "1" ? "0" : "1"}${s.slice(pos + 1)}`;
}

/** Поразрядная сумма без переносов: «110 + 11» → «121». */
function digitwise(a: string, b: string): string {
  const n = Math.max(a.length, b.length);
  const ap = a.padStart(n, "0");
  const bp = b.padStart(n, "0");
  return trimZeros(ap.split("").map((x, i) => String(Number(x) + Number(bp[i]))).join(""));
}

/** Типичные неверные ответы для a + b в двоичной системе. */
function addWrongs(rand: Rand, a: number, b: number): Wrong[] {
  const A = bin(a);
  const B = bin(b);
  const sum = bin(a + b);
  const out: Wrong[] = [];
  if ((a & b) !== 0) {
    out.push({ v: trimZeros(bin(a ^ b)), why: WHY.noCarry });
    out.push({ v: digitwise(A, B), why: WHY.digit2 });
  }
  if (sum.length > Math.max(A.length, B.length)) out.push({ v: trimZeros(sum.slice(1)), why: WHY.lostTop });
  out.push({ v: String(a + b), why: WHY.decimal });
  out.push({ v: bin(a + b + 1), why: WHY.off });
  out.push({ v: bin(a + b - 1), why: WHY.off });
  out.push({ v: flipBit(rand, sum), why: WHY.off });
  return out;
}

// ---------- Задания ----------

/** Сложение a₂ + b₂: выбор (A) или ввод (B). */
function addQuestion(rand: Rand, level: Level, seed: number, mode: "choice" | "input"): QuestionStep {
  const [lo, hi] = level === 1 ? [2, 11] : level === 2 ? [9, 45] : [20, 60];
  const a = int(rand, lo, hi);
  const b = int(rand, lo, hi);
  const A = bin(a);
  const B = bin(b);
  const sum = bin(a + b);
  const reveal = addScene(A, B, 2, Math.max(A.length, B.length) + 1);
  const explanation = T(
    `Складываем столбиком справа налево. ${addWalk(A, B, 2).ru} Ответ: ${rec(sum, 2)}. Проверка: ${a} + ${b} = ${a + b}, а ${rec(sum, 2)} = ${a + b}.`,
    `Бағанмен оңнан солға қарай қосамыз. ${addWalk(A, B, 2).kk} Жауабы: ${rec(sum, 2)}. Тексеру: ${a} + ${b} = ${a + b}, ал ${rec(sum, 2)} = ${a + b}.`,
  );
  if (mode === "choice") {
    const o = choose(rand, sum, addWrongs(rand, a, b), () => flipBit(rand, sum));
    return {
      id: `g:ns.arith:add:${A}+${B}:${seed}`,
      type: "choice",
      skill: SKILL,
      level,
      prompt: { ru: `Чему равна сумма ${rec(A, 2)} + ${rec(B, 2)}?`, kk: `${rec(A, 2)} + ${rec(B, 2)} қосындысы неге тең?` },
      ...o,
      reveal,
      hint: HINT_ADD,
      explanation,
    };
  }
  return {
    id: `g:ns.arith:addi:${A}+${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Сложи в двоичной системе: ${rec(A, 2)} + ${rec(B, 2)} = ?`, kk: `Екілік жүйеде қос: ${rec(A, 2)} + ${rec(B, 2)} = ?` },
    answers: [sum],
    mode: "binary",
    suffix: "₂",
    reveal,
    hint: HINT_ADD,
    explanation,
  };
}

/** Вычитание a₂ − b₂: выбор (A) или ввод (B). */
function subQuestion(rand: Rand, level: Level, seed: number, mode: "choice" | "input"): QuestionStep {
  const [lo, hi] = level === 1 ? [5, 15] : [16, 62];
  const a = int(rand, lo, hi);
  const b = int(rand, level === 1 ? 1 : 3, a - 1);
  const A = bin(a);
  const B = bin(b);
  const diff = bin(a - b);
  const reveal = subScene(A, B, A.length);
  const explanation = T(
    `Вычитаем столбиком справа налево. ${subWalk(A, B).ru} Ответ: ${rec(diff, 2)}. Проверка: ${a} − ${b} = ${a - b}, а ${rec(diff, 2)} = ${a - b}.`,
    `Бағанмен оңнан солға қарай азайтамыз. ${subWalk(A, B).kk} Жауабы: ${rec(diff, 2)}. Тексеру: ${a} − ${b} = ${a - b}, ал ${rec(diff, 2)} = ${a - b}.`,
  );
  if (mode === "choice") {
    const ap = A;
    const bp = B.padStart(ap.length, "0");
    const noBorrow = trimZeros(ap.split("").map((x, i) => String(Math.abs(Number(x) - Number(bp[i])))).join(""));
    const o = choose(
      rand,
      diff,
      [
        { v: noBorrow, why: WHY.noBorrow },
        { v: bin(a + b), why: WHY.added },
        { v: String(a - b), why: WHY.decimal },
        { v: bin(a - b + 1), why: WHY.off },
        { v: bin(a - b - 1), why: WHY.off },
        { v: flipBit(rand, diff), why: WHY.off },
      ],
      () => flipBit(rand, diff),
    );
    return {
      id: `g:ns.arith:sub:${A}-${B}:${seed}`,
      type: "choice",
      skill: SKILL,
      level,
      prompt: { ru: `Чему равна разность ${rec(A, 2)} − ${rec(B, 2)}?`, kk: `${rec(A, 2)} − ${rec(B, 2)} айырмасы неге тең?` },
      ...o,
      reveal,
      hint: HINT_SUB,
      explanation,
    };
  }
  return {
    id: `g:ns.arith:subi:${A}-${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Вычти в двоичной системе: ${rec(A, 2)} − ${rec(B, 2)} = ?`, kk: `Екілік жүйеде азайт: ${rec(A, 2)} − ${rec(B, 2)} = ?` },
    answers: [diff],
    mode: "binary",
    suffix: "₂",
    reveal,
    hint: HINT_SUB,
    explanation,
  };
}

/** Умножение на 2ᵏ (дописать k нулей): выбор (A) или ввод (B). */
function mulQuestion(rand: Rand, level: Level, seed: number, mode: "choice" | "input"): QuestionStep {
  const k = level === 1 ? int(rand, 1, 2) : int(rand, 2, 4);
  const n = level === 1 ? int(rand, 3, 11) : int(rand, 5, 31);
  const N = bin(n);
  const m = 2 ** k;
  const ans = N + "0".repeat(k);
  const explanation = T(
    `${m} = 2${sup(k)}, значит дописываем справа ${k} ${zerosRu(k)}: ${rec(N, 2)} → ${rec(ans, 2)}. Проверка: ${n} · ${m} = ${n * m}, а ${rec(ans, 2)} = ${n * m}.`,
    `${m} = 2${sup(k)}, демек оң жаққа ${k} нөл жазамыз: ${rec(N, 2)} → ${rec(ans, 2)}. Тексеру: ${n} · ${m} = ${n * m}, ал ${rec(ans, 2)} = ${n * m}.`,
  );
  const prompt = { ru: `Чему равно ${rec(N, 2)} · ${m}?`, kk: `${rec(N, 2)} · ${m} неге тең?` };
  if (mode === "choice") {
    const o = choose(
      rand,
      ans,
      [
        { v: N + "0".repeat(k - 1), why: T(`Нулей на один меньше: умножение на ${m} = 2${sup(k)} дописывает ${k}, а не ${k - 1}.`, `Нөл бірге аз: ${m} = 2${sup(k)} санына көбейту ${k} нөл жазады, ${k - 1} емес.`) },
        { v: N + "0".repeat(k + 1), why: T(`Нулей на один больше: нужно дописать ровно ${k}.`, `Нөл бірге артық: дәл ${k} нөл жазу керек.`) },
        { v: N + "1".repeat(k), why: T("Дописаны единицы, а при умножении на 2 дописывают нули.", "Бірліктер жазылған, ал 2-ге көбейткенде нөлдер жазылады.") },
        { v: String(n * m), why: WHY.decimal },
        { v: N.length > k ? trimZeros(N.slice(0, N.length - k)) : "", why: T("Это деление, а не умножение: цифры отброшены, а не дописаны.", "Бұл бөлу, көбейту емес: цифрлар жазылмай, алынып тасталған.") },
      ],
      () => flipBit(rand, ans),
    );
    return { id: `g:ns.arith:mul:${N}x${m}:${seed}`, type: "choice", skill: SKILL, level, prompt, ...o, hint: HINT_MUL, explanation };
  }
  return {
    id: `g:ns.arith:muli:${N}x${m}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Умножь: ${rec(N, 2)} · ${m} = ?`, kk: `Көбейт: ${rec(N, 2)} · ${m} = ?` },
    answers: [ans],
    mode: "binary",
    suffix: "₂",
    hint: HINT_MUL,
    explanation,
  };
}

/** Целое частное при делении на 2ᵏ (отбросить k цифр): выбор или ввод. */
function divQuestion(rand: Rand, level: Level, seed: number, mode: "choice" | "input"): QuestionStep {
  const k = level === 1 ? 1 : int(rand, 2, 3);
  const n = level === 1 ? int(rand, 8, 31) : int(rand, 24, 127);
  const N = bin(n);
  const m = 2 ** k;
  const ans = bin(n >> k);
  const dropped = N.slice(N.length - k);
  const explanation = T(
    `${m} = 2${sup(k)}, значит отбрасываем справа ${k} ${k === 1 ? "цифру" : "цифры"}: ${N} → ${ans} (отброшено ${dropped} — это остаток). Проверка: ${n} : ${m} = ${n >> k} (нацело), а ${rec(ans, 2)} = ${n >> k}.`,
    `${m} = 2${sup(k)}, демек оң жақтан ${k} цифрды алып тастаймыз: ${N} → ${ans} (${dropped} алынып тасталды — бұл қалдық). Тексеру: ${n} : ${m} = ${n >> k} (бүтін бөлігі), ал ${rec(ans, 2)} = ${n >> k}.`,
  );
  const prompt = {
    ru: `Чему равно целое частное ${rec(N, 2)} : ${m}?`,
    kk: `${rec(N, 2)} : ${m} бөліндісінің бүтін бөлігі неге тең?`,
  };
  if (mode === "choice") {
    const o = choose(
      rand,
      ans,
      [
        { v: trimZeros(dropped), why: T("Это отброшенные цифры (остаток), а ответ — то, что осталось слева.", "Бұл алынып тасталған цифрлар (қалдық), ал жауап — сол жақта қалғаны.") },
        { v: trimZeros(N.slice(0, Math.max(1, N.length - k + 1))), why: T(`Отброшено на одну цифру меньше: деление на ${m} убирает ${k}.`, `Бір цифр аз алынып тасталған: ${m}-ге бөлу ${k} цифрды алып тастайды.`) },
        { v: N.length - k - 1 >= 1 ? trimZeros(N.slice(0, N.length - k - 1)) : "", why: T(`Отброшено на одну цифру больше: убрать нужно ровно ${k}.`, `Бір цифр артық алынып тасталған: дәл ${k} цифрды алу керек.`) },
        { v: N + "0".repeat(k), why: T("Это умножение, а не деление: нули дописаны вместо того, чтобы убрать цифры.", "Бұл көбейту, бөлу емес: цифрларды алудың орнына нөлдер жазылған.") },
        { v: String(n >> k), why: WHY.decimal },
      ],
      () => flipBit(rand, ans),
    );
    return { id: `g:ns.arith:div:${N}:${m}:${seed}`, type: "choice", skill: SKILL, level, prompt, ...o, hint: HINT_DIV, explanation };
  }
  return {
    id: `g:ns.arith:divi:${N}:${m}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Найди целое частное: ${rec(N, 2)} : ${m} = ?`, kk: `Бөліндінің бүтін бөлігін тап: ${rec(N, 2)} : ${m} = ?` },
    answers: [ans],
    mode: "binary",
    suffix: "₂",
    hint: HINT_DIV,
    explanation,
  };
}

/** B: сумма двоичных чисел — ответ в десятичной системе. */
function sumDecQuestion(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 9, 45);
  const b = int(rand, 9, 45);
  const A = bin(a);
  const B = bin(b);
  return {
    id: `g:ns.arith:sumdec:${A}+${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Найди сумму ${rec(A, 2)} + ${rec(B, 2)} и запиши её в десятичной системе`,
      kk: `${rec(A, 2)} + ${rec(B, 2)} қосындысын тауып, ондық жүйеде жаз`,
    },
    answers: [String(a + b)],
    mode: "number",
    suffix: "₁₀",
    hint: T(
      "Можно сложить столбиком и перевести ответ в обычную систему, а можно сначала перевести оба числа и сложить их обычным способом.",
      "Бағанмен қосып, жауапты қарапайым жүйеге аударуға болады, не болмаса алдымен екі санды аударып, қарапайым тәсілмен қосуға болады.",
    ),
    explanation: T(
      `${rec(A, 2)} = ${a}, ${rec(B, 2)} = ${b}. Сумма: ${a} + ${b} = ${a + b}. Проверка столбиком: ${rec(A, 2)} + ${rec(B, 2)} = ${rec(bin(a + b), 2)} = ${a + b}.`,
      `${rec(A, 2)} = ${a}, ${rec(B, 2)} = ${b}. Қосынды: ${a} + ${b} = ${a + b}. Бағанмен тексеру: ${rec(A, 2)} + ${rec(B, 2)} = ${rec(bin(a + b), 2)} = ${a + b}.`,
    ),
  };
}

/** C: сложение в восьмеричной/шестнадцатеричной системе (ввод). */
function addBaseQuestion(rand: Rand, level: Level, seed: number, base: 8 | 16): QuestionStep {
  let A = "";
  let B = "";
  let guard = 0;
  do {
    const la = int(rand, 2, 3);
    const lb = Math.max(1, la - int(rand, 0, 1));
    const gen = (len: number) => {
      let s = toBase(int(rand, 1, base - 1), base);
      for (let i = 1; i < len; i++) s += toBase(int(rand, 0, base - 1), base);
      return s;
    };
    A = gen(la);
    B = gen(lb);
    guard++;
    // нужен хотя бы один перенос — иначе задание слишком простое
  } while (guard < 40 && !addColumns(A, B, base).slice(0, -1).some((c) => c.cout > 0));
  const total = parseInt(A, base) + parseInt(B, base);
  const ans = toBase(total, base);
  return {
    id: `g:ns.arith:add${base}:${A}+${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сложи в ${base === 8 ? "восьмеричной" : "шестнадцатеричной"} системе: ${rec(A, base)} + ${rec(B, base)} = ?`,
      kk: `${base === 8 ? "Сегіздік" : "Он алтылық"} жүйеде қос: ${rec(A, base)} + ${rec(B, base)} = ?`,
    },
    answers: [...new Set([ans, ans.toLowerCase()])],
    mode: "number",
    suffix: SUB[base],
    reveal: addScene(A, B, base, Math.max(A.length, B.length) + 1),
    hint: HINT_BASE,
    explanation: T(
      `Складываем столбиком справа налево, перенос — при ${base}. ${addWalk(A, B, base).ru} Ответ: ${rec(ans, base)}. Проверка: ${parseInt(A, base)} + ${parseInt(B, base)} = ${total} = ${rec(ans, base)}.`,
      `Бағанмен оңнан солға қарай қосамыз, ауысу жүйе негізіне (${base}) жеткенде болады. ${addWalk(A, B, base).kk} Жауабы: ${rec(ans, base)}. Тексеру: ${parseInt(A, base)} + ${parseInt(B, base)} = ${total} = ${rec(ans, base)}.`,
    ),
  };
}

/** C: сумма двоичных чисел, ответ — в восьмеричной/шестнадцатеричной системе (выбор или ввод). */
function sumOtherQuestion(rand: Rand, level: Level, seed: number, mode: "choice" | "input"): QuestionStep {
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const k = base === 8 ? 3 : 4;
  const a = int(rand, 20, 120);
  const b = int(rand, 20, 120);
  const A = bin(a);
  const B = bin(b);
  const sum = bin(a + b);
  const ans = toBase(a + b, base);
  const groups = sum.padStart(Math.ceil(sum.length / k) * k, "0").match(new RegExp(`.{${k}}`, "g")) ?? [];
  const leftGroups = sum.match(new RegExp(`.{1,${k}}`, "g")) ?? [];
  const leftAns = leftGroups.map((g) => parseInt(g, 2).toString(16).toUpperCase()).join("");
  const explanation = T(
    `Сначала сумма в двоичной системе: ${rec(A, 2)} + ${rec(B, 2)} = ${rec(sum, 2)} (${a} + ${b} = ${a + b}). Теперь группы по ${k} бита справа налево: ${groups.join(" | ")} → ${rec(ans, base)}. Проверка: ${a + b} в системе с основанием ${base} — ${ans}.`,
    `Алдымен екілік жүйедегі қосынды: ${rec(A, 2)} + ${rec(B, 2)} = ${rec(sum, 2)} (${a} + ${b} = ${a + b}). Енді оңнан солға қарай ${k} биттен топтар: ${groups.join(" | ")} → ${rec(ans, base)}. Тексеру: ${a + b} саны негізі ${base} жүйеде — ${ans}.`,
  );
  const prompt = {
    ru: `Сложи ${rec(A, 2)} + ${rec(B, 2)} и запиши результат в ${SYS[base].ru} системе`,
    kk: `${rec(A, 2)} + ${rec(B, 2)} қосындысын тауып, ${SYS[base].kk} жүйеде жаз`,
  };
  const hint = T(
    "Сначала сложи числа столбиком в двоичной системе, потом режь результат на группы по 3 (для 8) или по 4 (для 16) бита справа налево.",
    "Алдымен сандарды екілік жүйеде бағанмен қос, содан кейін нәтижені оңнан солға қарай 3 (сегіздік үшін) немесе 4 (он алтылық үшін) биттен топтарға бөл.",
  );
  if (mode === "choice") {
    const o = choose(
      rand,
      ans,
      [
        { v: leftAns, why: T("Группы бит взяты слева направо. Резать нужно справа налево, недостающие нули пишут слева.", "Бит топтары солдан оңға қарай алынған. Оңнан солға қарай бөлу керек, жетпейтін нөлдер сол жаққа жазылады.") },
        { v: String(a + b), why: WHY.decimal },
        { v: sum, why: T("Это двоичная запись суммы, а не запись в нужной системе.", "Бұл қосындының екілік жазбасы, керек жүйедегі жазба емес.") },
        { v: ans.split("").reverse().join(""), why: T("Цифры записаны в обратном порядке.", "Цифрлар кері ретпен жазылған.") },
        { v: toBase(a + b + 1, base), why: WHY.off },
      ],
      () => toBase(a + b + int(rand, 2, 5), base),
    );
    return {
      id: `g:ns.arith:sumo:${A}+${B}:${base}:${seed}`,
      type: "choice",
      skill: SKILL,
      level,
      ent: true,
      prompt,
      ...o,
      hint,
      explanation,
    };
  }
  return {
    id: `g:ns.arith:sumoi:${A}+${B}:${base}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    ent: true,
    prompt,
    answers: [...new Set([ans, ans.toLowerCase()])],
    mode: "number",
    suffix: SUB[base],
    hint,
    explanation,
  };
}

/** C: сколько единиц в двоичной записи суммы. */
function onesInSumQuestion(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 20, 120);
  const b = int(rand, 20, 120);
  const A = bin(a);
  const B = bin(b);
  const sum = bin(a + b);
  const total = ones(sum);
  return {
    id: `g:ns.arith:ones:${A}+${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    ent: true,
    prompt: {
      ru: `Сколько единиц в двоичной записи суммы ${rec(A, 2)} + ${rec(B, 2)}?`,
      kk: `${rec(A, 2)} + ${rec(B, 2)} қосындысының екілік жазбасында неше бірлік бар?`,
    },
    answers: [String(total)],
    mode: "number",
    hint: HINT_ONES_SUM,
    explanation: T(
      `${rec(A, 2)} + ${rec(B, 2)} = ${rec(sum, 2)} (${a} + ${b} = ${a + b}). Единиц в сумме: ${total}. Ловушка: единицы в слагаемых (${ones(A)} и ${ones(B)}) складывать нельзя — при переносах они «склеиваются».`,
      `${rec(A, 2)} + ${rec(B, 2)} = ${rec(sum, 2)} (${a} + ${b} = ${a + b}). Қосындыдағы бірліктер: ${total}. Тұзақ: қосылғыштардағы бірліктерді (${ones(A)} және ${ones(B)}) қосуға болмайды — ауысу кезінде олар «жабысады».`,
    ),
    reveal: addScene(A, B, 2, Math.max(A.length, B.length) + 1),
  };
}

/** C: обратная задача — найти слагаемое. */
function inverseQuestion(rand: Rand, level: Level, seed: number): QuestionStep {
  const x = int(rand, 5, 40);
  const b = int(rand, 3, 30);
  const c = x + b;
  const X = bin(x);
  const B = bin(b);
  const C = bin(c);
  return {
    id: `g:ns.arith:inv:${B}:${C}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Найди X, если X + ${rec(B, 2)} = ${rec(C, 2)} (все числа двоичные)`,
      kk: `X мәнін тап: X + ${rec(B, 2)} = ${rec(C, 2)} (барлық сандар екілік)`,
    },
    answers: [X],
    mode: "binary",
    suffix: "₂",
    hint: T(
      "Неизвестное слагаемое — это сумма минус известное слагаемое. Вычти столбиком (с заёмом) или переведи в десятичную систему.",
      "Белгісіз қосылғыш — қосынды минус белгілі қосылғыш. Бағанмен (қарызбен) азайт немесе ондық жүйеге аудар.",
    ),
    explanation: T(
      `X = ${rec(C, 2)} − ${rec(B, 2)}. В десятичной: ${c} − ${b} = ${x}, то есть X = ${rec(X, 2)}. Проверка сложением: ${rec(X, 2)} + ${rec(B, 2)} = ${rec(C, 2)}.`,
      `X = ${rec(C, 2)} − ${rec(B, 2)}. Ондық жүйеде: ${c} − ${b} = ${x}, яғни X = ${rec(X, 2)}. Қосып тексеру: ${rec(X, 2)} + ${rec(B, 2)} = ${rec(C, 2)}.`,
    ),
  };
}

/** C: что больше — сравнение результатов двух действий. */
function compareQuestion(rand: Rand, level: Level, seed: number): QuestionStep {
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  let guard = 0;
  do {
    a = int(rand, 10, 40);
    b = int(rand, 10, 40);
    c = int(rand, 30, 90);
    d = int(rand, 3, 25);
    guard++;
  } while (guard < 50 && (a + b === c - d || Math.abs(a + b - (c - d)) < 2));
  const v1 = a + b;
  const v2 = c - d;
  const E1 = `${rec(bin(a), 2)} + ${rec(bin(b), 2)}`;
  const E2 = `${rec(bin(c), 2)} − ${rec(bin(d), 2)}`;
  return {
    id: `g:ns.arith:cmp:${bin(a)}+${bin(b)}:${bin(c)}-${bin(d)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    ent: true,
    prompt: {
      ru: `Что больше: A = ${E1} или B = ${E2}?`,
      kk: `Қайсысы үлкен: A = ${E1} немесе B = ${E2}?`,
    },
    options: [T("A больше", "A үлкен"), T("B больше", "B үлкен"), T("A = B", "A = B")],
    correct: v1 > v2 ? 0 : 1,
    whyWrong: v1 > v2
      ? [null, T("Проверь значения: сумма A больше разности B.", "Мәндерді тексер: A қосындысы B айырмасынан үлкен."), T("Результаты разные: посчитай оба до конца.", "Нәтижелер әртүрлі: екеуін де соңына дейін есепте.")]
      : [T("Проверь значения: разность B больше суммы A.", "Мәндерді тексер: B айырмасы A қосындысынан үлкен."), null, T("Результаты разные: посчитай оба до конца.", "Нәтижелер әртүрлі: екеуін де соңына дейін есепте.")],
    hint: T(
      "Выполни оба действия (столбиком или переведя числа в обычную систему), а потом сравни результаты.",
      "Екі амалды да орында (бағанмен немесе сандарды қарапайым жүйеге аударып), содан кейін нәтижелерді салыстыр.",
    ),
    explanation: T(
      `A = ${E1} = ${rec(bin(v1), 2)} = ${v1}. B = ${E2} = ${rec(bin(v2), 2)} = ${v2}. ${v1 > v2 ? `${v1} > ${v2}, значит A больше.` : `${v1} < ${v2}, значит B больше.`}`,
      `A = ${E1} = ${rec(bin(v1), 2)} = ${v1}. B = ${E2} = ${rec(bin(v2), 2)} = ${v2}. ${v1 > v2 ? `${v1} > ${v2}, демек A үлкен.` : `${v1} < ${v2}, демек B үлкен.`}`,
    ),
  };
}

/** C: сумма чисел из разных систем — ответ в десятичной. */
function mixedQuestion(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 9, 40);
  const b = int(rand, 9, 60);
  const A = bin(a);
  const B = toBase(b, 8);
  return {
    id: `g:ns.arith:mix:${A}+${B}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Найди сумму ${rec(A, 2)} + ${rec(B, 8)} и запиши её в десятичной системе`,
      kk: `${rec(A, 2)} + ${rec(B, 8)} қосындысын тауып, ондық жүйеде жаз`,
    },
    answers: [String(a + b)],
    mode: "number",
    suffix: "₁₀",
    hint: T(
      "Числа записаны в разных системах: столбиком их складывать нельзя. Сначала переведи каждое в десятичную систему.",
      "Сандар әртүрлі жүйеде жазылған: оларды бағанмен қосуға болмайды. Алдымен әрқайсысын ондық жүйеге аудар.",
    ),
    explanation: T(
      `${rec(A, 2)} = ${a}, ${rec(B, 8)} = ${b}. Складываем в десятичной: ${a} + ${b} = ${a + b}. Ловушка: числа из разных систем нельзя складывать «как есть».`,
      `${rec(A, 2)} = ${a}, ${rec(B, 8)} = ${b}. Ондық жүйеде қосамыз: ${a} + ${b} = ${a + b}. Тұзақ: әртүрлі жүйедегі сандарды «сол қалпында» қосуға болмайды.`,
    ),
  };
}

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const zerosRu = (k: number) => (k === 1 ? "ноль" : k < 5 ? "нуля" : "нулей");
function sup(n: number): string {
  return String(n).replace(/\d/g, (d) => SUPS[Number(d)]);
}

function makeQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["add", "add", "sub", "mul", "div", "addi"] as const);
    switch (kind) {
      case "add":
        return addQuestion(rand, 1, seed, "choice");
      case "addi":
        return addQuestion(rand, 1, seed, "input");
      case "sub":
        return subQuestion(rand, 1, seed, "choice");
      case "mul":
        return mulQuestion(rand, 1, seed, "choice");
      default:
        return divQuestion(rand, 1, seed, "choice");
    }
  }
  if (level === 2) {
    const kind = pick(rand, ["addi", "addi", "subi", "subc", "muli", "mulc", "divi", "sumdec"] as const);
    switch (kind) {
      case "addi":
        return addQuestion(rand, 2, seed, "input");
      case "subi":
        return subQuestion(rand, 2, seed, "input");
      case "subc":
        return subQuestion(rand, 2, seed, "choice");
      case "muli":
        return mulQuestion(rand, 2, seed, "input");
      case "mulc":
        return mulQuestion(rand, 2, seed, "choice");
      case "divi":
        return divQuestion(rand, 2, seed, "input");
      default:
        return sumDecQuestion(rand, 2, seed);
    }
  }
  const kind = pick(rand, ["oct", "hex", "hex", "sumo", "sumoi", "ones", "inv", "cmp", "mix"] as const);
  switch (kind) {
    case "oct":
      return addBaseQuestion(rand, 3, seed, 8);
    case "hex":
      return addBaseQuestion(rand, 3, seed, 16);
    case "sumo":
      return sumOtherQuestion(rand, 3, seed, "choice");
    case "sumoi":
      return sumOtherQuestion(rand, 3, seed, "input");
    case "ones":
      return onesInSumQuestion(rand, 3, seed);
    case "inv":
      return inverseQuestion(rand, 3, seed);
    case "cmp":
      return compareQuestion(rand, 3, seed);
    default:
      return mixedQuestion(rand, 3, seed);
  }
}

// ---------- Утверждения «верно / неверно» ----------

function makeStatement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const value = rand() < 0.5;
  if (level === 1) {
    const a = int(rand, 2, 11);
    const b = int(rand, 2, 11);
    const A = bin(a);
    const B = bin(b);
    const sum = bin(a + b);
    const cands = [
      ...((a & b) !== 0 ? [trimZeros(bin(a ^ b))] : []),
      ...(sum.length > Math.max(A.length, B.length) ? [trimZeros(sum.slice(1))] : []),
      bin(a + b + 1),
      bin(a + b - 1),
    ].filter((x) => x && x !== sum);
    const claim = value ? sum : pick(rand, cands);
    return {
      id: `s:ns.arith:add:${A}+${B}:${claim}`,
      skill: SKILL,
      level,
      text: same(`${rec(A, 2)} + ${rec(B, 2)} = ${rec(claim, 2)}`),
      value: claim === sum,
      explanation: same(`${rec(A, 2)} + ${rec(B, 2)} = ${rec(sum, 2)} (${a} + ${b} = ${a + b})`),
      hint: HINT_DEC,
    };
  }
  if (level === 2) {
    const kind = pick(rand, ["sub", "mul", "div"] as const);
    if (kind === "sub") {
      const a = int(rand, 16, 62);
      const b = int(rand, 3, a - 1);
      const A = bin(a);
      const B = bin(b);
      const diff = bin(a - b);
      const claim = value ? diff : pick(rand, [bin(a - b + 1), bin(a - b - 1), bin(a + b)].filter((x) => x !== diff));
      return {
        id: `s:ns.arith:sub:${A}-${B}:${claim}`,
        skill: SKILL,
        level,
        text: same(`${rec(A, 2)} − ${rec(B, 2)} = ${rec(claim, 2)}`),
        value: claim === diff,
        explanation: same(`${rec(A, 2)} − ${rec(B, 2)} = ${rec(diff, 2)} (${a} − ${b} = ${a - b})`),
        hint: HINT_DEC,
      };
    }
    if (kind === "mul") {
      const k = int(rand, 1, 4);
      const n = int(rand, 3, 31);
      const N = bin(n);
      const zeros = value ? k : pick(rand, [k - 1, k + 1].filter((z) => z >= 0));
      return {
        id: `s:ns.arith:mul:${N}:${k}:${zeros}`,
        skill: SKILL,
        level,
        text: same(`${rec(N, 2)} · ${2 ** k} = ${rec(N + "0".repeat(zeros), 2)}`),
        value: zeros === k,
        explanation: T(
          `Умножение на ${2 ** k} = 2${sup(k)} дописывает ${k} ${zerosRu(k)}: ${rec(N + "0".repeat(k), 2)}.`,
          `${2 ** k} = 2${sup(k)} санына көбейту ${k} нөл жазады: ${rec(N + "0".repeat(k), 2)}.`,
        ),
        hint: HINT_MUL,
      };
    }
    const k = int(rand, 1, 3);
    const n = int(rand, 24, 127);
    const N = bin(n);
    const ans = bin(n >> k);
    const claim = value ? ans : pick(rand, [bin(n >> (k + 1)), bin(n >> Math.max(0, k - 1)), trimZeros(N.slice(N.length - k))].filter((x) => x && x !== ans));
    return {
      id: `s:ns.arith:div:${N}:${k}:${claim}`,
      skill: SKILL,
      level,
      text: T(`Целое частное (${rec(N, 2)} : ${2 ** k}) = ${rec(claim, 2)}`, `Бөліндінің бүтін бөлігі (${rec(N, 2)} : ${2 ** k}) = ${rec(claim, 2)}`),
      value: claim === ans,
      explanation: T(
        `Деление на ${2 ** k} = 2${sup(k)} отбрасывает ${k} последних цифр: ${N} → ${ans}.`,
        `${2 ** k} = 2${sup(k)} санына бөлу соңғы ${k} цифрды алып тастайды: ${N} → ${ans}.`,
      ),
      hint: HINT_DIV,
    };
  }
  // C: сложение в 8-й или 16-й системе.
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const a = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  const b = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  const A = toBase(a, base);
  const B = toBase(b, base);
  const sum = toBase(a + b, base);
  const claim = value ? sum : pick(rand, [toBase(a + b + 1, base), toBase(a + b - 1, base), toBase(a + b + base, base)].filter((x) => x !== sum));
  return {
    id: `s:ns.arith:add${base}:${A}+${B}:${claim}`,
    skill: SKILL,
    level,
    text: same(`${rec(A, base)} + ${rec(B, base)} = ${rec(claim, base)}`),
    value: claim === sum,
    explanation: same(`${rec(A, base)} + ${rec(B, base)} = ${rec(sum, base)} (${a} + ${b} = ${a + b})`),
    hint: HINT_BASE,
  };
}

// ---------- Пары ----------

function makePair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1) {
    const a = int(rand, 2, 11);
    const b = int(rand, 2, 11);
    return { id: `p:ns.arith:add:${a}+${b}`, skill: SKILL, level, left: `${rec(bin(a), 2)} + ${rec(bin(b), 2)}`, right: rec(bin(a + b), 2) };
  }
  if (level === 2) {
    if (rand() < 0.5) {
      const a = int(rand, 16, 62);
      const b = int(rand, 3, a - 1);
      return { id: `p:ns.arith:sub:${a}-${b}`, skill: SKILL, level, left: `${rec(bin(a), 2)} − ${rec(bin(b), 2)}`, right: rec(bin(a - b), 2) };
    }
    const k = int(rand, 1, 4);
    const n = int(rand, 3, 31);
    return { id: `p:ns.arith:mul:${n}:${k}`, skill: SKILL, level, left: `${rec(bin(n), 2)} · ${2 ** k}`, right: rec(bin(n << k), 2) };
  }
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const a = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  const b = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  return { id: `p:ns.arith:add${base}:${a}+${b}`, skill: SKILL, level, left: `${rec(toBase(a, base), base)} + ${rec(toBase(b, base), base)}`, right: rec(toBase(a + b, base), base) };
}

// ---------- Короткие вопросы ----------

function makeShort(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const a = int(rand, 2, 11);
    const b = int(rand, 2, 11);
    const sum = bin(a + b);
    return {
      id: `q:ns.arith:add:${a}+${b}`,
      skill: SKILL,
      level,
      prompt: same(`${rec(bin(a), 2)} + ${rec(bin(b), 2)} = ?₂`),
      answer: sum,
      mode: "binary",
      explanation: same(`${a} + ${b} = ${a + b} → ${sum}₂`),
      hint: HINT_ADD,
    };
  }
  if (level === 2) {
    if (rand() < 0.5) {
      const a = int(rand, 16, 62);
      const b = int(rand, 3, a - 1);
      return {
        id: `q:ns.arith:sub:${a}-${b}`,
        skill: SKILL,
        level,
        prompt: same(`${rec(bin(a), 2)} − ${rec(bin(b), 2)} = ?₂`),
        answer: bin(a - b),
        mode: "binary",
        explanation: same(`${a} − ${b} = ${a - b} → ${bin(a - b)}₂`),
        hint: HINT_SUB,
      };
    }
    const k = int(rand, 2, 4);
    const n = int(rand, 5, 31);
    return {
      id: `q:ns.arith:mul:${n}:${k}`,
      skill: SKILL,
      level,
      prompt: same(`${rec(bin(n), 2)} · ${2 ** k} = ?₂`),
      answer: bin(n << k),
      mode: "binary",
      explanation: T(`${2 ** k} = 2${sup(k)}: дописываем справа ${k} ${zerosRu(k)}.`, `${2 ** k} = 2${sup(k)}: оң жаққа ${k} нөл жазамыз.`),
      hint: HINT_MUL,
    };
  }
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const a = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  const b = int(rand, base === 8 ? 20 : 30, base === 8 ? 200 : 250);
  const A = toBase(a, base);
  const B = toBase(b, base);
  return {
    id: `q:ns.arith:add${base}:${A}+${B}`,
    skill: SKILL,
    level,
    prompt: same(`${rec(A, base)} + ${rec(B, base)} = ?${SUB[base]}`),
    answer: toBase(a + b, base),
    mode: "number",
    explanation: same(`${a} + ${b} = ${a + b} → ${toBase(a + b, base)}${SUB[base]}`),
    hint: HINT_BASE,
  };
}

export const BANKS: SkillBank[] = [
  {
    skill: SKILL,
    question: makeQuestion,
    statement: makeStatement,
    pair: makePair,
    short: makeShort,
  },
];
